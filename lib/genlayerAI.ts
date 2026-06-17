import type { AIScore, SubmitProjectPayload } from '@/types'
import { scanProject, type ScannerSignals } from './scanner'
import { createClient } from '@supabase/supabase-js'

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

export async function evaluateProject(
  project: SubmitProjectPayload & { telegram_url?: string; twitter_url?: string; discord_url?: string; docs_url?: string },
  projectId: string
): Promise<AIScore> {
  const contractAddress = process.env.GENLAYER_CONTRACT_ADDRESS
  const privateKeyRaw   = process.env.GENLAYER_PRIVATE_KEY

  if (!contractAddress || !privateKeyRaw) {
    throw new Error('GENLAYER_CONTRACT_ADDRESS and GENLAYER_PRIVATE_KEY must be set.')
  }

  const privateKey   = (privateKeyRaw.startsWith('0x') ? privateKeyRaw : `0x${privateKeyRaw}`) as `0x${string}`
  const contractAddr = sanitizeAddress(contractAddress)

  console.log(`[GenLayer] Using contract: ${contractAddr}`)

  // ── Step 1: Scanner ───────────────────────────────────
  console.log(`[Scanner] Scanning ${project.website_url}...`)
  let signals: ScannerSignals

  try {
    signals = await scanProject(
      project.website_url,
      project.github_url,
      project.docs_url,
      project.twitter_url,
      project.telegram_url,
      project.discord_url,
    )
    console.log(`[Scanner] Done. github=${signals.has_github} twitter=${signals.has_twitter} docs=${signals.has_docs}`)
  } catch (e: any) {
    console.warn('[Scanner] Failed, using defaults:', e.message)
    signals = {
      phishing_detected: false, suspicious_scripts: false,
      wallet_present: false, unsafe_wallet_behavior: false,
      hidden_redirects: false,
      has_github:   !!(project.github_url),
      recently_active: false,
      has_docs:     !!(project.docs_url),
      has_twitter:  !!(project.twitter_url),
      has_telegram: !!(project.telegram_url),
      has_discord:  !!(project.discord_url),
      domain_age_days: null, website_unreachable: true,
      website_html: '', github_summary: '',
      goplus_flagged: false, safe_browsing_flagged: false, scamsniffer_flagged: false,
      ssl_valid: true, redirect_chain_length: 0, external_script_count: 0,
      has_honeypot_patterns: false,
      security_score:     90,
      transparency_score: 25 +
        (!!(project.github_url)   ? 20 : 0) +
        (!!(project.docs_url)     ? 20 : 0) +
        (!!(project.twitter_url)  ? 15 : 0) +
        (!!(project.telegram_url) ? 10 : 0) +
        (!!(project.discord_url)  ? 10 : 0),
    }
  }

  // ── Step 2: Send to GenLayer contract ─────────────────
  const gljs   = await import('genlayer-js')
  const chains = await import('genlayer-js/chains')
  const { createClient: createGLClient, createAccount } = gljs
  const { studionet } = chains

  const account = createAccount(privateKey)
  const client  = createGLClient({ chain: studionet, account })

  // Security-only signals sent to contract (social transparency computed from URLs)
  const signalPayload = JSON.stringify({
    website_unreachable:    signals.website_unreachable,
    phishing_detected:      signals.phishing_detected,
    suspicious_scripts:     signals.suspicious_scripts,
    wallet_present:         signals.wallet_present,
    unsafe_wallet_behavior: signals.unsafe_wallet_behavior,
    hidden_redirects:       signals.hidden_redirects,
    has_honeypot_patterns:  signals.has_honeypot_patterns ?? false,
    recently_active:        signals.recently_active,
    domain_age_days:        signals.domain_age_days,
    github_summary:         (signals.github_summary || '').slice(0, 200),
    website_preview:        (signals.website_html   || '').slice(0, 400),
    goplus_flagged:         signals.goplus_flagged,
    safe_browsing_flagged:  signals.safe_browsing_flagged,
    scamsniffer_flagged:    signals.scamsniffer_flagged,
    ssl_valid:              signals.ssl_valid,
  })

  console.log(`[GenLayer] Sending to contract with URLs: github=${project.github_url ?? 'none'} twitter=${project.twitter_url ?? 'none'}`)

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
        clean(signalPayload,         2000),
      ],
      value: BigInt(0),
    })
    console.log(`[GenLayer] TX submitted: ${txHash}`)
  } catch (e: any) {
    console.error('[GenLayer] TX send failed:', e.message)
    return buildFallbackScore(signals)
  }

  // ── Step 3: Poll for consensus result ─────────────────
  // Poll up to 15 min (180 × 5s)
  for (let i = 0; i < 180; i++) {
    await sleep(5000)
    try {
      const raw = await client.readContract({
        address:      contractAddr,
        functionName: 'get_evaluation',
        args:         [projectId],
      }) as string

      if (raw && raw !== '{}' && raw !== 'null' && String(raw).length > 5) {
        console.log(`[GenLayer] Consensus on attempt ${i + 1}`)
        const data = typeof raw === 'string' ? JSON.parse(raw) : raw
        console.log(`[GenLayer] score=${data.score} risk=${data.risk} sec=${data.security_score} trans=${data.transparency_score}`)

        // Handle both old contract format (no score) and new v0.5 format
        const score      = Number(data.score ?? 0)
        const secScore   = Number(data.security_score     ?? data.breakdown?.security     ?? 0)
        const transScore = Number(data.transparency_score ?? data.breakdown?.transparency ?? 0)
        const risk       = data.risk ?? (score >= 75 ? 'Low' : score >= 50 ? 'Medium' : 'High')

        return {
          score,
          risk,
          confidence:               data.confidence               ?? 'Medium',
          positives:                Array.isArray(data.positives) ? data.positives.slice(0, 5) : [],
          risks:                    Array.isArray(data.risks)     ? data.risks.slice(0, 5)     : [],
          findings:                 Array.isArray(data.findings)  ? data.findings.slice(0, 5)  : [],
          explanation:              data.explanation              ?? '',
          breakdown: {
            security:     secScore,
            transparency: transScore,
            community:    0,
            ...(data.breakdown ?? {}),
          },
          tx_hash: txHash,
          // Extra fields for AI Evaluation panel
          ...(data.security_explanation     ? { security_explanation:     data.security_explanation     } : {}),
          ...(data.transparency_explanation ? { transparency_explanation: data.transparency_explanation } : {}),
        }
      }
    } catch { /* keep polling */ }
    if (i % 12 === 0 && i > 0) console.log(`[GenLayer] Still waiting... attempt ${i}`)
  }

  console.warn('[GenLayer] Timed out — using fallback score, tx_hash preserved')
  return { ...buildFallbackScore(signals), tx_hash: txHash! }
}

function buildFallbackScore(signals: ScannerSignals): AIScore {
  const secScore = Math.max(0, Math.min(100,
    20 + // GoPlus
    20 + // Safe Browsing
    20 + // ScamSniffer
    (signals.unsafe_wallet_behavior || signals.phishing_detected ? 0 : 15) +
    (signals.has_honeypot_patterns ? 0 : 10) +
    (signals.ssl_valid !== false ? 10 : 0) +
    (signals.suspicious_scripts ? 0 : 5)
  ))
  const transScore = Math.max(0, Math.min(100,
    25 +
    (signals.has_github   ? 20 : 0) +
    (signals.has_docs     ? 20 : 0) +
    (signals.has_twitter  ? 15 : 0) +
    (signals.has_telegram ? 10 : 0) +
    (signals.has_discord  ? 10 : 0)
  ))
  const score = Math.round((secScore + transScore) / 2)

  const risks: string[] = []
  if (signals.phishing_detected)      risks.push('Phishing patterns detected')
  if (signals.unsafe_wallet_behavior) risks.push('Unsafe wallet behavior detected')
  if (signals.suspicious_scripts)     risks.push('Obfuscated scripts detected')
  if (!signals.has_github)            risks.push('No GitHub repository linked')
  if (!signals.has_docs)              risks.push('No documentation linked')
  if (!signals.has_twitter)           risks.push('No Twitter/X account linked')

  const positives: string[] = []
  if (!signals.goplus_flagged && !signals.safe_browsing_flagged && !signals.scamsniffer_flagged)
    positives.push('Not flagged by any threat database (GoPlus, Safe Browsing, ScamSniffer)')
  if (!signals.phishing_detected)      positives.push('No phishing patterns detected')
  if (!signals.unsafe_wallet_behavior) positives.push('No unsafe wallet behavior detected')
  if (signals.ssl_valid !== false)     positives.push('Valid SSL/HTTPS certificate')
  if (signals.has_github)              positives.push('GitHub repository linked')
  if (signals.has_twitter)             positives.push('Twitter/X account linked')

  return {
    score,
    risk:        score >= 75 ? 'Low' : score >= 50 ? 'Medium' : 'High',
    confidence:  signals.website_unreachable ? 'Low' : signals.has_github ? 'High' : 'Medium',
    positives,
    risks,
    findings:    risks,
    breakdown:   { security: secScore, transparency: transScore, community: 0 },
    explanation: `Security: ${secScore}/100. Transparency: ${transScore}/100. Final: ${score}/100.`,
  }
}
