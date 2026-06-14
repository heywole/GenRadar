// @ts-nocheck
// Supabase Edge Function — runs GenLayer evaluation with no timeout limit
// Deploy: supabase functions deploy evaluate-project
// Triggered by: Database webhook on projects table (INSERT/UPDATE where evaluation_status = 'pending')

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const SUPABASE_URL  = Deno.env.get('SUPABASE_URL')!
const SUPABASE_KEY  = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const GENLAYER_KEY  = Deno.env.get('GENLAYER_PRIVATE_KEY')!
const GENLAYER_NET  = Deno.env.get('GENLAYER_NETWORK') || 'studionet'
const CONTRACT_ADDR = Deno.env.get('GENLAYER_CONTRACT_ADDRESS')!
const GOOGLE_SB_KEY = Deno.env.get('GOOGLE_SAFE_BROWSING_KEY') || ''

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY)

// ── Scanner — produces signals only (true/false), NOT the score ───────────────
async function scan(project: any): Promise<Record<string, any>> {
  const signals: Record<string, any> = {
    goplus_flagged:         false,
    safe_browsing_flagged:  false,
    scamsniffer_flagged:    false,
    phishing_detected:      false,
    unsafe_wallet_behavior: false,
    has_honeypot_patterns:  false,
    suspicious_scripts:     false,
    ssl_valid:              true,
    website_unreachable:    false,
    has_github:             !!(project.github_url),
    has_twitter:            !!(project.twitter_url),
    has_telegram:           !!(project.telegram_url),
    has_discord:            !!(project.discord_url),
    has_docs:               !!(project.docs_url),
    website_preview:        '',
    github_summary:         '',
  }

  const url = project.website_url
  if (!url) return signals

  const domain = url.replace(/^https?:\/\//, '').split('/')[0]

  // GoPlus check
  try {
    const res = await fetch(
      `https://api.gopluslabs.io/api/v1/phishing_site?url=${encodeURIComponent(url)}`,
      { signal: AbortSignal.timeout(8000) }
    )
    const d = await res.json()
    if (d?.result?.phishing_site === '1' || d?.result?.phishing_site === 1) {
      signals.goplus_flagged = true
    }
  } catch {}

  // Google Safe Browsing
  if (GOOGLE_SB_KEY) {
    try {
      const res = await fetch(
        `https://safebrowsing.googleapis.com/v4/threatMatches:find?key=${GOOGLE_SB_KEY}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            client: { clientId: 'genradar', clientVersion: '1.0' },
            threatInfo: {
              threatTypes:      ['MALWARE', 'SOCIAL_ENGINEERING', 'UNWANTED_SOFTWARE', 'POTENTIALLY_HARMFUL_APPLICATION'],
              platformTypes:    ['ANY_PLATFORM'],
              threatEntryTypes: ['URL'],
              threatEntries:    [{ url }],
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

  // Fetch website HTML
  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 GenRadarBot/1.0' },
      signal: AbortSignal.timeout(12000),
    })
    signals.ssl_valid = url.startsWith('https')
    const html  = await res.text()
    const lhtml = html.toLowerCase()

    signals.website_preview = html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 400)

    const walletPatterns   = ['eth_signtypeddata', 'eth_sendtransaction', 'wallet_connect', 'web3modal', 'approve(', 'transferfrom(']
    const honeypotPatterns = ['claim your', 'free tokens', 'connect wallet to claim', 'mint your', 'airdrop']
    const scriptPatterns   = ['eval(atob', 'eval(unescape', 'document.write(unescape', 'fromcharcode']
    const phishingPatterns = ['enter.*private.*key', 'enter.*seed.*phrase', 'wallet.*validation.*required']

    if (walletPatterns.some(p => lhtml.includes(p)))           signals.unsafe_wallet_behavior = true
    if (honeypotPatterns.some(p => lhtml.includes(p)))         signals.has_honeypot_patterns  = true
    if (scriptPatterns.some(p => lhtml.includes(p)))           signals.suspicious_scripts     = true
    if (phishingPatterns.some(p => new RegExp(p, 'i').test(html))) signals.phishing_detected  = true
  } catch {
    signals.website_unreachable = true
    signals.ssl_valid = false
  }

  // GitHub summary
  if (project.github_url?.startsWith('http')) {
    try {
      const match = project.github_url.match(/github\.com\/([^/]+)\/([^/?#\s]+)/)
      if (match) {
        const [, owner, repo] = match
        const r = await fetch(
          `https://api.github.com/repos/${owner}/${repo.replace(/\.git$/, '')}`,
          { headers: { Accept: 'application/vnd.github.v3+json', 'User-Agent': 'GenRadarBot' }, signal: AbortSignal.timeout(8000) }
        )
        if (r.ok) {
          const d = await r.json()
          const days = Math.round((Date.now() - new Date(d.pushed_at).getTime()) / 86400000)
          signals.github_summary = `Stars:${d.stargazers_count} Forks:${d.forks_count} LastPush:${days}d Language:${d.language || 'unknown'}`
        }
      }
    } catch {}
  }

  return signals
}

// ── Main handler ──────────────────────────────────────────────────────────────
Deno.serve(async (req) => {
  try {
    const body   = await req.json()
    const record = body.record ?? body

    const project_id = record.id
    if (!project_id) {
      console.error('[edge] no project_id in payload')
      return new Response('No project_id', { status: 400 })
    }

    // Skip if not pending
    if (record.evaluation_status && record.evaluation_status !== 'pending') {
      console.log(`[edge] skipping — status=${record.evaluation_status}`)
      return new Response(JSON.stringify({ skipped: true }), { headers: { 'Content-Type': 'application/json' } })
    }

    // Mark as processing immediately so webhook doesn't re-fire
    await supabase.from('projects').update({ evaluation_status: 'processing' }).eq('id', project_id)

    // Fetch full project record
    const { data: project } = await supabase.from('projects').select('*').eq('id', project_id).single()
    if (!project) {
      console.error('[edge] project not found:', project_id)
      return new Response('Project not found', { status: 404 })
    }

    // Run scanner — signals only
    console.log(`[edge] scanning ${project.name}...`)
    const signals = await scan(project)
    console.log(`[edge] scan done. goplus=${signals.goplus_flagged} safebrowsing=${signals.safe_browsing_flagged} ssl=${signals.ssl_valid}`)
    console.log(`[edge] SOCIAL SIGNALS — github=${signals.has_github} docs=${signals.has_docs} twitter=${signals.has_twitter} telegram=${signals.has_telegram} discord=${signals.has_discord}`)
    console.log(`[edge] PROJECT URLS — github_url=${project.github_url} twitter_url=${project.twitter_url} docs_url=${project.docs_url} telegram_url=${project.telegram_url} discord_url=${project.discord_url}`)

    // Send signals to GenLayer contract
    const { createClient: glCreateClient } = await import('https://esm.sh/genlayer-js@0.9.3')
    const gl = glCreateClient({
      network:    GENLAYER_NET as any,
      privateKey: GENLAYER_KEY as `0x${string}`,
    })

    console.log('[edge] sending to GenLayer...')
    const txHash = await gl.writeContract({
      address:      CONTRACT_ADDR as `0x${string}`,
      functionName: 'evaluate_project',
      args: [
        project_id,
        project.name            ?? '',
        project.description     ?? '',
        project.website_url     ?? '',
        project.github_url      ?? '',
        project.twitter_url     ?? '',
        project.telegram_url    ?? '',
        project.discord_url     ?? '',
        project.docs_url        ?? '',
        project.category        ?? '',
        JSON.stringify({
          // Security scan results — these are backend-verified facts
          goplus_flagged:         signals.goplus_flagged,
          safe_browsing_flagged:  signals.safe_browsing_flagged,
          scamsniffer_flagged:    signals.scamsniffer_flagged,
          phishing_detected:      signals.phishing_detected,
          unsafe_wallet_behavior: signals.unsafe_wallet_behavior,
          has_honeypot_patterns:  signals.has_honeypot_patterns,
          suspicious_scripts:     signals.suspicious_scripts,
          ssl_valid:              signals.ssl_valid,
          website_unreachable:    signals.website_unreachable,
          github_summary:         signals.github_summary,
          website_preview:        (signals.website_preview || '').slice(0, 300),
        }),
      ],
    })

    console.log(`[edge] TX submitted: ${txHash} — waiting for consensus...`)

    // Wait for GenLayer validators to reach consensus — no timeout, edge function handles it
    await gl.waitForTransactionReceipt({ hash: txHash, retries: 100, interval: 3000 })
    console.log('[edge] consensus reached')

    // Read score from contract
    const result = await gl.readContract({
      address:      CONTRACT_ADDR as `0x${string}`,
      functionName: 'get_evaluation',
      args:         [project_id],
    }) as string

    let evalData: any = {}
    try { evalData = JSON.parse(result) } catch {}

    const score      = evalData.score              ?? 0
    const secScore   = evalData.security_score     ?? evalData.breakdown?.security     ?? 0
    const transScore = evalData.transparency_score ?? evalData.breakdown?.transparency ?? 0
    const risk       = evalData.risk               ?? (score >= 75 ? 'Low' : score >= 50 ? 'Medium' : 'High')

    // Save score to DB
    await supabase.from('ai_scores').upsert({
      project_id,
      score,
      security_score:           secScore,
      transparency_score:       transScore,
      risk,
      confidence:               evalData.confidence              ?? 'Medium',
      positives:                evalData.positives               ?? [],
      risks:                    evalData.risks                   ?? [],
      findings:                 evalData.findings                ?? [],
      explanation:              evalData.explanation             ?? '',
      security_explanation:     evalData.security_explanation    ?? '',
      transparency_explanation: evalData.transparency_explanation ?? '',
      breakdown:                evalData.breakdown               ?? { security: secScore, transparency: transScore },
      tx_hash:                  txHash,
      created_at:               new Date().toISOString(),
    }, { onConflict: 'project_id' })

    await supabase.from('projects').update({ evaluation_status: 'completed' }).eq('id', project_id)
    console.log(`[edge] done. project=${project_id} score=${score} tx=${txHash}`)

    return new Response(JSON.stringify({ success: true, score, tx_hash: txHash }), {
      headers: { 'Content-Type': 'application/json' },
    })

  } catch (err: any) {
    console.error('[edge] error:', err.message)
    // Don't mark as failed — let it stay processing so it can be manually re-triggered
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    })
  }
})
