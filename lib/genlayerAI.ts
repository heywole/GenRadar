import type { AIScore, SubmitProjectPayload } from '@/types'

function clean(s: string, max: number) {
  return (s || '').replace(/[<>{}[\]]/g, '').trim().slice(0, max)
}

function sanitizeAddress(addr: string): `0x${string}` {
  const match = addr.match(/0x[0-9a-fA-F]{40}/)
  if (match) return match[0] as `0x${string}`
  const hex = addr.replace(/^0+x/, '').replace(/[^0-9a-fA-F]/g, '')
  return `0x${hex}` as `0x${string}`
}

async function sleep(ms: number) {
  return new Promise(r => setTimeout(r, ms))
}

// Run only security API checks — transparency is verified by GenLayer validators directly
async function runSecurityScans(websiteUrl: string): Promise<Record<string, any>> {
  const signals: Record<string, any> = {
    goplus_flagged:        false,
    safe_browsing_flagged: false,
    scamsniffer_flagged:   false,
    ssl_valid:             websiteUrl.startsWith('https://'),
    website_unreachable:   false,
  }

  const domain = websiteUrl.replace(/^https?:\/\//, '').split('/')[0]

  // GoPlus phishing check
  try {
    const res = await fetch(
      `https://api.gopluslabs.io/api/v1/phishing_site?url=${encodeURIComponent(websiteUrl)}`,
      { signal: AbortSignal.timeout(8000) }
    )
    const d = await res.json()
    if (d?.result?.phishing_site === '1' || Number(d?.result?.phishing_site) === 1) {
      signals.goplus_flagged = true
    }
  } catch {}

  // Google Safe Browsing
  const sbKey = process.env.GOOGLE_SAFE_BROWSING_KEY
  if (sbKey) {
    try {
      const res = await fetch(
        `https://safebrowsing.googleapis.com/v4/threatMatches:find?key=${sbKey}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            client: { clientId: 'genradar', clientVersion: '1.0' },
            threatInfo: {
              threatTypes:      ['MALWARE', 'SOCIAL_ENGINEERING', 'UNWANTED_SOFTWARE'],
              platformTypes:    ['ANY_PLATFORM'],
              threatEntryTypes: ['URL'],
              threatEntries:    [{ url: websiteUrl }],
            },
          }),
          signal: AbortSignal.timeout(8000),
        }
      )
      const d = await res.json()
      if (d?.matches?.length) signals.safe_browsing_flagged = true
    } catch {}
  }

  // ScamSniffer blacklist
  try {
    const res = await fetch(
      'https://raw.githubusercontent.com/scamsniffer/scam-database/main/blacklist/domains.json',
      { signal: AbortSignal.timeout(8000) }
    )
    if (res.ok) {
      const list: string[] = await res.json()
      if (list.some(d => typeof d === 'string' && (d === domain || domain.endsWith('.' + d)))) {
        signals.scamsniffer_flagged = true
      }
    }
  } catch {}

  // Quick reachability check
  try {
    const res = await fetch(websiteUrl, {
      method: 'HEAD',
      signal: AbortSignal.timeout(8000),
    })
    signals.website_unreachable = !res.ok
  } catch {
    signals.website_unreachable = true
  }

  return signals
}

export async function evaluateProject(
  project: SubmitProjectPayload & {
    telegram_url?: string
    twitter_url?:  string
    discord_url?:  string
    docs_url?:     string
  },
  projectId: string
): Promise<AIScore> {
  const contractAddress = process.env.GENLAYER_CONTRACT_ADDRESS
  const privateKeyRaw   = process.env.GENLAYER_PRIVATE_KEY

  if (!contractAddress || !privateKeyRaw) {
    throw new Error('GENLAYER_CONTRACT_ADDRESS and GENLAYER_PRIVATE_KEY must be set.')
  }

  const privateKey   = (privateKeyRaw.startsWith('0x') ? privateKeyRaw : `0x${privateKeyRaw}`) as `0x${string}`
  const contractAddr = sanitizeAddress(contractAddress)

  console.log(`[GenLayer] Contract: ${contractAddr}`)
  console.log(`[GenLayer] Evaluating: ${project.name} (${project.website_url})`)

  // Step 1: Run security scans (API checks only — transparency verified by validators)
  console.log('[Scanner] Running security API checks...')
  const securitySignals = await runSecurityScans(project.website_url || '')
  console.log(`[Scanner] Done. goplus=${securitySignals.goplus_flagged} safebrowsing=${securitySignals.safe_browsing_flagged} ssl=${securitySignals.ssl_valid}`)

  // Step 2: Connect to GenLayer
  const gljs   = await import('genlayer-js')
  const chains = await import('genlayer-js/chains')
  const { createClient: createGLClient, createAccount } = gljs
  const { studionet } = chains

  const account = createAccount(privateKey)
  const client  = createGLClient({ chain: studionet, account })

  // Step 3: Send to contract — URLs passed directly for validator verification
  // Security signals (from our API checks) passed as extra context
  let txHash: string
  try {
    txHash = await client.writeContract({
      address:      contractAddr,
      functionName: 'evaluate_project',
      args: [
        projectId,
        clean(project.name,           100),
        clean(project.description,    800),
        clean(project.website_url,    200),
        clean(project.github_url   ?? '', 200),
        clean(project.twitter_url  ?? '', 200),
        clean(project.telegram_url ?? '', 200),
        clean(project.discord_url  ?? '', 200),
        clean(project.docs_url     ?? '', 200),
        clean(project.category,        50),
        // Pass security signals only — transparency verified by validators themselves
        JSON.stringify(securitySignals),
      ],
      value: BigInt(0),
    })
    console.log(`[GenLayer] TX submitted: ${txHash}`)
  } catch (e: any) {
    console.error('[GenLayer] TX failed:', e.message)
    throw new Error(`GenLayer TX failed: ${e.message}`)
  }

  // Step 4: Poll for consensus (up to 15 min)
  console.log('[GenLayer] Waiting for validator consensus...')
  for (let i = 0; i < 180; i++) {
    await sleep(5000)
    try {
      const raw = await client.readContract({
        address:      contractAddr,
        functionName: 'get_evaluation',
        args:         [projectId],
      }) as string

      if (raw && raw !== '{}' && raw !== 'null' && String(raw).length > 5) {
        const data = typeof raw === 'string' ? JSON.parse(raw) : raw
        console.log(`[GenLayer] ✓ Consensus on attempt ${i + 1}. score=${data.score}`)

        const score      = Number(data.score ?? 0)
        const secScore   = Number(data.security_score     ?? data.breakdown?.security     ?? 0)
        const transScore = Number(data.transparency_score ?? data.breakdown?.transparency ?? 0)
        const risk       = data.risk ?? (score >= 75 ? 'Low' : score >= 50 ? 'Medium' : 'High')

        return {
          score,
          risk,
          confidence:               data.confidence ?? 'Medium',
          positives:                Array.isArray(data.positives) ? data.positives.slice(0, 6) : [],
          risks:                    Array.isArray(data.risks)     ? data.risks.slice(0, 6)     : [],
          findings:                 Array.isArray(data.findings)  ? data.findings.slice(0, 6)  : [],
          explanation:              data.explanation              ?? '',
          breakdown: {
            security:     secScore,
            transparency: transScore,
            community:    0,
            ...(data.breakdown ?? {}),
          },
          tx_hash: txHash,
          ...(data.security_explanation     ? { security_explanation:     data.security_explanation     } : {}),
          ...(data.transparency_explanation ? { transparency_explanation: data.transparency_explanation } : {}),
        } as AIScore
      }
    } catch { /* keep polling */ }

    if (i % 12 === 0 && i > 0) {
      console.log(`[GenLayer] Still waiting... ${Math.round(i * 5 / 60)} min elapsed`)
    }
  }

  // Timed out — this means GenLayer consensus took > 15 min (rare)
  throw new Error('GenLayer consensus timed out after 15 minutes')
}
