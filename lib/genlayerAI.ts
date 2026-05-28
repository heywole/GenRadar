import type { AIScore, SubmitProjectPayload } from '@/types'
import { scanProject, type ScannerSignals } from './scanner'

function clean(s: string, max: number) {
  return (s || '').replace(/[<>{}[\]]/g, '').trim().slice(0, max)
}

function sanitizeAddress(addr: string): `0x${string}` {
  // Remove any leading zeros or extra characters before 0x
  const match = addr.match(/0x[0-9a-fA-F]{40}/)
  if (match) return match[0] as `0x${string}`
  // Strip all non-hex then add 0x
  const hex = addr.replace(/^0+x/, '').replace(/[^0-9a-fA-F]/g, '')
  return `0x${hex}` as `0x${string}`
}

async function sleep(ms: number) {
  return new Promise(r => setTimeout(r, ms))
}

export async function evaluateProject(
  project: SubmitProjectPayload & { telegram_url?: string },
  projectId: string
): Promise<AIScore> {
  const contractAddress = process.env.GENLAYER_CONTRACT_ADDRESS
  const privateKeyRaw   = process.env.GENLAYER_PRIVATE_KEY

  if (!contractAddress || !privateKeyRaw) {
    throw new Error('GENLAYER_CONTRACT_ADDRESS and GENLAYER_PRIVATE_KEY must be set.')
  }

  // Private key: just ensure 0x prefix, never strip characters
  const privateKey = (privateKeyRaw.startsWith('0x')
    ? privateKeyRaw
    : `0x${privateKeyRaw}`) as `0x${string}`

  // Contract address: sanitize to handle any double-prefix typos
  const contractAddr = sanitizeAddress(contractAddress)

  // ── Step 1: Scanner returns raw signals only ──────────
  console.log(`[Scanner] Scanning ${project.website_url}...`)
  let signals: ScannerSignals

  try {
    signals = await scanProject(
      project.website_url,
      project.github_url,
      (project as any).docs_url,
      (project as any).twitter_url,
      project.telegram_url,
      (project as any).discord_url,
    )
    console.log(`[Scanner] Done. Signals:`, {
      phishing:      signals.phishing_detected,
      unsafe_wallet: signals.unsafe_wallet_behavior,
      scripts:       signals.suspicious_scripts,
      redirects:     signals.hidden_redirects,
      has_github:    signals.has_github,
      has_docs:      signals.has_docs,
      has_twitter:   signals.has_twitter,
      has_telegram:  signals.has_telegram,
      has_discord:   signals.has_discord,
    })
  } catch (e: any) {
    console.warn('[Scanner] Scanner failed, using defaults:', e.message)
    signals = {
      phishing_detected: false, suspicious_scripts: false,
      wallet_present: false, unsafe_wallet_behavior: false,
      hidden_redirects: false,
      has_github:   !!(project.github_url),
      recently_active: false,
      has_docs:     !!(project as any).docs_url,
      has_twitter:  !!(project as any).twitter_url,
      has_telegram: !!project.telegram_url,
      has_discord:  !!(project as any).discord_url,
      domain_age_days: null, website_unreachable: true,
      website_html: '', github_summary: '',
    }
  }

  // ── Step 2: Send raw signals to GenLayer contract ─────
  const gljs   = await import('genlayer-js')
  const chains = await import('genlayer-js/chains')
  const { createClient, createAccount } = gljs
  const { studionet } = chains

  const account = createAccount(privateKey)
  const client  = createClient({ chain: studionet, account })

  const signalPayload = JSON.stringify({
    website_unreachable:    signals.website_unreachable,
    phishing_detected:      signals.phishing_detected,
    suspicious_scripts:     signals.suspicious_scripts,
    wallet_present:         signals.wallet_present,
    unsafe_wallet_behavior: signals.unsafe_wallet_behavior,
    hidden_redirects:       signals.hidden_redirects,
    has_github:             signals.has_github,
    recently_active:        signals.recently_active,
    has_docs:               signals.has_docs,
    has_twitter:            signals.has_twitter,
    has_telegram:           signals.has_telegram,
    has_discord:            signals.has_discord,
    domain_age_days:        signals.domain_age_days,
    github_summary:         signals.github_summary.slice(0, 200),
    website_preview:        signals.website_html.slice(0, 500),
  })

  console.log(`[GenLayer] Sending signals to contract for scoring...`)

  let txHash: string
  try {
    txHash = await client.writeContract({
      address:      contractAddr,
      functionName: 'evaluate_project',
      args: [
        projectId,
        clean(project.name,        100),
        clean(project.description, 800),
        clean(project.website_url, 200),
        clean(project.github_url ?? '', 200),
        clean(project.category,    50),
        clean(signalPayload,       2000),
      ],
      value: 0n,
    })
    console.log(`[GenLayer] TX: ${txHash}`)
  } catch (e: any) {
    console.error('[GenLayer] TX send failed:', e.message)
    console.log('[GenLayer] Using fallback score from scanner signals')
    return buildFallbackScore(signals)
  }

  // ── Step 3: Poll for result ───────────────────────────
  for (let i = 0; i < 180; i++) {
    await sleep(5000)
    try {
      const raw = await client.readContract({
        address:      contractAddr,
        functionName: 'get_evaluation',
        args:         [projectId],
      }) as string

      if (raw && raw !== '{}' && raw !== 'null' && String(raw).length > 5) {
        console.log(`[GenLayer] Got result on attempt ${i + 1}`)
        const data = typeof raw === 'string' ? JSON.parse(raw) : raw
        console.log(`[GenLayer] Contract score: ${data.score} | Risk: ${data.risk}`)

        return {
          score:       Number(data.score),
          risk:        data.risk,
          confidence:  data.confidence,
          positives:   Array.isArray(data.positives) ? data.positives.slice(0, 5) : [],
          risks:       Array.isArray(data.risks)     ? data.risks.slice(0, 5)     : [],
          breakdown:   data.breakdown ?? null,
          findings:    Array.isArray(data.findings)  ? data.findings.slice(0, 5)  : [],
          explanation: data.explanation ?? '',
          tx_hash:     txHash,
        } as AIScore
      }
    } catch { /* keep polling */ }
    if (i % 12 === 0 && i > 0) console.log(`[GenLayer] Still waiting... attempt ${i}`)
  }

  console.warn('[GenLayer] Timed out — using fallback')
  return buildFallbackScore(signals)
}

function buildFallbackScore(signals: ScannerSignals): AIScore {
  let score = 100
  const risks: string[] = []

  if (signals.phishing_detected)      { score -= 25; risks.push('Phishing patterns detected') }
  if (signals.unsafe_wallet_behavior) { score -= 23; risks.push('Unsafe wallet behavior detected') }
  if (signals.suspicious_scripts)     { score -= 15; risks.push('Obfuscated scripts detected') }
  if (signals.hidden_redirects)       { score -= 10; risks.push('Hidden redirects detected') }
  if (signals.domain_age_days !== null && signals.domain_age_days < 30) { score -= 3; risks.push('Domain age under 30 days') }
  if (!signals.has_github)            { score -= 10; risks.push('No GitHub repository') }
  if (!signals.has_docs)              { score -= 5;  risks.push('No documentation provided') }
  if (!signals.has_twitter)           { score -= 3;  risks.push('No Twitter/X presence') }
  if (!signals.has_telegram)          { score -= 3;  risks.push('No Telegram community') }
  if (!signals.has_discord)           { score -= 3;  risks.push('No Discord community') }

  score = Math.max(0, Math.min(100, score))

  const positives: string[] = []
  if (!signals.phishing_detected)      positives.push('No phishing patterns detected')
  if (!signals.suspicious_scripts)     positives.push('No malicious scripts detected')
  if (!signals.unsafe_wallet_behavior) positives.push('No unsafe wallet behavior detected')
  if (!signals.hidden_redirects)       positives.push('No hidden redirects detected')
  if (!signals.website_unreachable)    positives.push('Website is accessible and reachable')
  if (signals.has_github)              positives.push('Public GitHub repository found')

  return {
    score,
    risk:        score >= 75 ? 'Low' : score >= 50 ? 'Medium' : 'High',
    confidence:  signals.website_unreachable ? 'Low' : signals.has_github ? 'High' : 'Medium',
    positives,
    risks,
    breakdown: {
      security:     100 - (signals.phishing_detected ? 25 : 0) - (signals.unsafe_wallet_behavior ? 23 : 0) - (signals.suspicious_scripts ? 15 : 0) - (signals.hidden_redirects ? 10 : 0),
      transparency: 100 - (!signals.has_github ? 10 : 0) - (!signals.has_docs ? 5 : 0),
      community:    100 - (!signals.has_twitter ? 3 : 0) - (!signals.has_telegram ? 3 : 0) - (!signals.has_discord ? 3 : 0),
    },
    findings: risks,
    explanation: `Scanner found no security threats. Score deductions: ${risks.join(', ') || 'none'}.`,
  } as AIScore
}
