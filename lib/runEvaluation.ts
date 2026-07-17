import { createClient, SupabaseClient } from '@supabase/supabase-js'

function serviceClient(): SupabaseClient {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  )
}

function sanitizeAddress(addr: string): `0x${string}` {
  const match = addr.match(/0x[0-9a-fA-F]{40}/)
  if (match) return match[0] as `0x${string}`
  const hex = addr.replace(/^0+x/, '').replace(/[^0-9a-fA-F]/g, '')
  return `0x${hex}` as `0x${string}`
}

function clean(s: string, max: number) {
  return (s || '').replace(/[<>{}[\]]/g, '').trim().slice(0, max)
}

async function getGenLayerClient() {
  const contractAddress = process.env.GENLAYER_CONTRACT_ADDRESS
  const privateKeyRaw   = process.env.GENLAYER_PRIVATE_KEY
  if (!contractAddress || !privateKeyRaw) {
    throw new Error('GENLAYER_CONTRACT_ADDRESS and GENLAYER_PRIVATE_KEY must be set.')
  }
  const privateKey   = (privateKeyRaw.startsWith('0x') ? privateKeyRaw : `0x${privateKeyRaw}`) as `0x${string}`
  const contractAddr = sanitizeAddress(contractAddress)

  const gljs   = await import('genlayer-js')
  const chains = await import('genlayer-js/chains')
  const { createClient: createGLClient, createAccount } = gljs
  const { studionet } = chains

  const account = createAccount(privateKey)
  const client  = createGLClient({ chain: studionet, account })
  return { client, contractAddr }
}

// Security-only scans — transparency is verified independently by GenLayer validators
async function runSecurityScans(websiteUrl: string): Promise<Record<string, any>> {
  const signals: Record<string, any> = {
    goplus_flagged:        false,
    safe_browsing_flagged: false,
    scamsniffer_flagged:   false,
    ssl_valid:             websiteUrl.startsWith('https://'),
    website_unreachable:   false,
  }
  const domain = websiteUrl.replace(/^https?:\/\//, '').split('/')[0]

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

  try {
    const res = await fetch(websiteUrl, { method: 'HEAD', signal: AbortSignal.timeout(8000) })
    signals.website_unreachable = !res.ok
  } catch {
    signals.website_unreachable = true
  }

  return signals
}

// ── Submit a project to GenLayer — returns fast, does not wait for consensus ──
export async function startEvaluation(project_id: string): Promise<{ tx_hash?: string; error?: string }> {
  const supabase = serviceClient()

  const { data: project, error: fetchErr } = await supabase
    .from('projects').select('*').eq('id', project_id).single()
  if (fetchErr || !project) return { error: 'Project not found' }

  try {
    console.log(`[startEvaluation] ${project.name} (${project.website_url})`)
    const securitySignals = await runSecurityScans(project.website_url || '')

    const { client, contractAddr } = await getGenLayerClient()

    const txHash = await client.writeContract({
      address:      contractAddr,
      functionName: 'evaluate_project',
      args: [
        project_id,
        clean(project.name,                100),
        clean(project.description,         800),
        clean(project.website_url,         200),
        clean(project.github_url   ?? '',  200),
        clean(project.twitter_url  ?? '',  200),
        clean(project.telegram_url ?? '',  200),
        clean(project.discord_url  ?? '',  200),
        clean(project.docs_url     ?? '',  200),
        clean(project.category,             50),
        JSON.stringify(securitySignals),
      ],
      value: BigInt(0),
    })

    console.log(`[startEvaluation] TX submitted: ${txHash}`)

    await supabase.from('projects').update({
      evaluation_status:         'processing',
      evaluation_error:          null,
      evaluation_tx_hash:        txHash,
      evaluation_last_polled_at: new Date().toISOString(),
    }).eq('id', project_id)

    return { tx_hash: txHash }
  } catch (e: any) {
    console.error('[startEvaluation] failed:', e.message)
    await supabase.from('projects').update({
      evaluation_status: 'failed',
      evaluation_error:  clean(e.message || 'Unknown error', 500),
    }).eq('id', project_id)
    return { error: e.message }
  }
}

// ── Check once whether GenLayer consensus is ready — called opportunistically ──
export async function checkEvaluation(project_id: string): Promise<{ ready: boolean; error?: string }> {
  const supabase = serviceClient()

  // Always stamp that we polled, to throttle future opportunistic checks
  await supabase.from('projects')
    .update({ evaluation_last_polled_at: new Date().toISOString() })
    .eq('id', project_id)

  try {
    const { contractAddr, client } = await getGenLayerClient()

    const raw = await client.readContract({
      address:      contractAddr,
      functionName: 'get_evaluation',
      args:         [project_id],
    }) as string

    if (!raw || raw === '{}' || raw === 'null' || String(raw).length < 5) {
      return { ready: false }
    }

    const data = typeof raw === 'string' ? JSON.parse(raw) : raw
    const score      = Number(data.score ?? 0)
    const secScore   = Number(data.security_score     ?? data.breakdown?.security     ?? 0)
    const transScore = Number(data.transparency_score ?? data.breakdown?.transparency ?? 0)
    const risk        = data.risk ?? (score >= 75 ? 'Low' : score >= 50 ? 'Medium' : 'High')

    const { data: proj } = await supabase.from('projects').select('evaluation_tx_hash').eq('id', project_id).single()
    const txHash: string | null = proj?.evaluation_tx_hash ?? null

    await supabase.from('ai_scores').delete().eq('project_id', project_id)
    await supabase.from('ai_scores').insert({
      project_id,
      score,
      security_score:           secScore,
      transparency_score:       transScore,
      risk,
      confidence:               data.confidence ?? 'Medium',
      positives:                Array.isArray(data.positives) ? data.positives.slice(0, 6) : [],
      risks:                    Array.isArray(data.risks)     ? data.risks.slice(0, 6)     : [],
      findings:                 Array.isArray(data.findings)  ? data.findings.slice(0, 6)  : [],
      breakdown:                data.breakdown ?? { security: secScore, transparency: transScore },
      explanation:              data.explanation              ?? null,
      security_explanation:     data.security_explanation     ?? null,
      transparency_explanation: data.transparency_explanation ?? null,
      tx_hash:                  txHash,
      created_at:               new Date().toISOString(),
    })

    await supabase.from('projects').update({
      evaluation_status: 'completed',
      evaluation_error:  null,
    }).eq('id', project_id)

    console.log(`[checkEvaluation] ✓ ${project_id} score=${score}`)
    return { ready: true }
  } catch (e: any) {
    // Not ready yet or transient error — don't mark as failed, just try again next poll
    console.warn(`[checkEvaluation] not ready or error for ${project_id}:`, e.message)
    return { ready: false, error: e.message }
  }
}
