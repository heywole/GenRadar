// @ts-nocheck
// Supabase Edge Function — runs GenLayer evaluation with no timeout limit
// Deploy: supabase functions deploy evaluate-project
// Triggered by: Database webhook on projects table (INSERT/UPDATE where evaluation_status = 'pending')

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const SUPABASE_URL     = Deno.env.get('SUPABASE_URL')!
const SUPABASE_KEY     = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const GENLAYER_KEY     = Deno.env.get('GENLAYER_PRIVATE_KEY')!
const GENLAYER_NET     = Deno.env.get('GENLAYER_NETWORK') || 'studionet'
const CONTRACT_ADDR    = Deno.env.get('GENLAYER_CONTRACT_ADDRESS')!
const GOOGLE_SB_KEY    = Deno.env.get('GOOGLE_SAFE_BROWSING_KEY') || ''

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY)

// ── Scanner (lightweight Deno version) ───────────────────────────────────────
async function scan(project: any): Promise<Record<string, any>> {
  const signals: Record<string, any> = {
    goplus_flagged: false, safe_browsing_flagged: false, scamsniffer_flagged: false,
    phishing_detected: false, unsafe_wallet_behavior: false, has_honeypot_patterns: false,
    suspicious_scripts: false, ssl_valid: true, website_unreachable: false,
    has_github:   !!(project.github_url),
    has_twitter:  !!(project.twitter_url),
    has_telegram: !!(project.telegram_url),
    has_discord:  !!(project.discord_url),
    has_docs:     !!(project.docs_url),
    website_preview: '',
  }

  const url = project.website_url
  if (!url) return signals

  const domain = url.replace(/^https?:\/\//, '').split('/')[0]

  // GoPlus check
  try {
    const res = await fetch(`https://api.gopluslabs.io/api/v1/phishing_site?url=${encodeURIComponent(url)}`, { signal: AbortSignal.timeout(8000) })
    const d = await res.json()
    if (d?.result?.is_phishing === '1') signals.goplus_flagged = true
  } catch {}

  // Google Safe Browsing
  if (GOOGLE_SB_KEY) {
    try {
      const res = await fetch(`https://safebrowsing.googleapis.com/v4/threatMatches:find?key=${GOOGLE_SB_KEY}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ client: { clientId: 'genradar', clientVersion: '1.0' }, threatInfo: { threatTypes: ['MALWARE','SOCIAL_ENGINEERING','UNWANTED_SOFTWARE','POTENTIALLY_HARMFUL_APPLICATION'], platformTypes: ['ANY_PLATFORM'], threatEntryTypes: ['URL'], threatEntries: [{ url }] } }),
        signal: AbortSignal.timeout(8000),
      })
      const d = await res.json()
      if (d?.matches?.length) signals.safe_browsing_flagged = true
    } catch {}
  }

  // Fetch website HTML
  try {
    const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0 GenRadarBot/1.0' }, signal: AbortSignal.timeout(12000) })
    signals.ssl_valid = url.startsWith('https')
    const html = await res.text()
    signals.website_preview = html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 300)

    const lhtml = html.toLowerCase()
    const walletPatterns = ['eth_signtypeddata', 'eth_sendtransaction', 'wallet_connect', 'web3modal', 'approve(', 'transferfrom(']
    const honeypotPatterns = ['claim your', 'free tokens', 'connect wallet to claim', 'mint your', 'airdrop']
    const scriptPatterns = ['eval(atob', 'eval(unescape', 'document.write(unescape', 'fromcharcode']

    if (walletPatterns.some(p => lhtml.includes(p))) signals.unsafe_wallet_behavior = true
    if (honeypotPatterns.some(p => lhtml.includes(p))) signals.has_honeypot_patterns = true
    if (scriptPatterns.some(p => lhtml.includes(p))) signals.suspicious_scripts = true
  } catch {
    signals.website_unreachable = true
    signals.ssl_valid = false
  }

  // Calculate scores
  const sec = (signals.goplus_flagged ? 0 : 20) + (signals.safe_browsing_flagged ? 0 : 20) +
    (signals.scamsniffer_flagged ? 0 : 20) + (signals.unsafe_wallet_behavior ? 0 : 15) +
    (signals.has_honeypot_patterns ? 0 : 10) + (signals.ssl_valid ? 10 : 0) +
    (signals.suspicious_scripts ? 0 : 5)
  const tr = 25 + (signals.has_github ? 20 : 0) + (signals.has_docs ? 20 : 0) +
    (signals.has_twitter ? 15 : 0) + (signals.has_telegram ? 10 : 0) + (signals.has_discord ? 10 : 0)

  signals.security_score     = Math.min(100, sec)
  signals.transparency_score = Math.min(100, tr)

  return signals
}

// ── Main handler ─────────────────────────────────────────────────────────────
Deno.serve(async (req) => {
  try {
    const body = await req.json()
    // Webhook sends the record directly
    const record = body.record ?? body

    const project_id = record.id
    if (!project_id) return new Response('No project_id', { status: 400 })

    // Mark as processing
    await supabase.from('projects').update({ evaluation_status: 'processing' }).eq('id', project_id)

    // Fetch full project
    const { data: project } = await supabase.from('projects').select('*').eq('id', project_id).single()
    if (!project) return new Response('Project not found', { status: 404 })

    console.log(`[edge] scanning ${project.name}...`)
    const signals = await scan(project)
    console.log(`[edge] scan done. security=${signals.security_score} transparency=${signals.transparency_score}`)

    // Call GenLayer contract
    const { createClient: glCreateClient } = await import('https://esm.sh/genlayer-js@0.9.3')
    const gl = glCreateClient({ network: GENLAYER_NET as any, privateKey: GENLAYER_KEY as `0x${string}` })

    console.log('[edge] sending to GenLayer...')
    const txHash = await gl.writeContract({
      address:      CONTRACT_ADDR as `0x${string}`,
      functionName: 'evaluate_project',
      args: [
        project_id,
        project.name,
        project.description ?? '',
        project.website_url ?? '',
        project.github_url  ?? '',
        project.category    ?? '',
        JSON.stringify(signals),
      ],
    })

    console.log(`[edge] TX: ${txHash}`)

    // Wait for consensus
    const receipt = await gl.waitForTransactionReceipt({ hash: txHash, retries: 100, interval: 3000 })
    console.log(`[edge] consensus reached`)

    // Read result from contract
    const result = await gl.readContract({
      address:      CONTRACT_ADDR as `0x${string}`,
      functionName: 'get_evaluation',
      args:         [project_id],
    }) as string

    let evalData: any = {}
    try { evalData = JSON.parse(result) } catch {}

    const score        = evalData.score              ?? Math.round((signals.security_score + signals.transparency_score) / 2)
    const secScore     = evalData.security_score     ?? signals.security_score
    const transScore   = evalData.transparency_score ?? signals.transparency_score
    const risk         = evalData.risk               ?? (score >= 75 ? 'Low' : score >= 50 ? 'Medium' : 'High')

    // Save to DB
    await supabase.from('ai_scores').delete().eq('project_id', project_id)
    await supabase.from('ai_scores').insert({
      project_id,
      score,
      security_score:           secScore,
      transparency_score:       transScore,
      risk,
      confidence:               evalData.confidence   ?? 'Medium',
      positives:                evalData.positives    ?? [],
      risks:                    evalData.risks        ?? [],
      findings:                 evalData.findings     ?? [],
      explanation:              evalData.explanation  ?? '',
      security_explanation:     evalData.security_explanation ?? '',
      transparency_explanation: evalData.transparency_explanation ?? '',
      breakdown:                evalData.breakdown    ?? { security: secScore, transparency: transScore },
      tx_hash:                  txHash,
      created_at:               new Date().toISOString(),
    })

    await supabase.from('projects').update({ evaluation_status: 'completed' }).eq('id', project_id)
    console.log(`[edge] done. score=${score}`)

    return new Response(JSON.stringify({ success: true, score, security_score: secScore, transparency_score: transScore }), {
      headers: { 'Content-Type': 'application/json' }
    })

  } catch (err: any) {
    console.error('[edge] error:', err.message)
    return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: { 'Content-Type': 'application/json' } })
  }
})
