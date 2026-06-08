// scanner.ts
// Real security scanner — GoPlus API, Google Safe Browsing, ScamSniffer,
// deep HTML analysis, GitHub API.
// Every external call has a timeout + try/catch so one failure never
// blocks the rest of the scan.

export interface ScannerSignals {
  phishing_detected:       boolean
  suspicious_scripts:      boolean
  wallet_present:          boolean
  unsafe_wallet_behavior:  boolean
  hidden_redirects:        boolean
  has_github:              boolean
  has_docs:                boolean
  has_twitter:             boolean
  has_telegram:            boolean
  has_discord:             boolean
  recently_active:         boolean
  domain_age_days:         number | null
  website_unreachable:     boolean
  website_html:            string
  github_summary:          string
  // New deep-scan fields
  goplus_flagged:          boolean
  safe_browsing_flagged:   boolean
  scamsniffer_flagged:     boolean
  ssl_valid:               boolean
  redirect_chain_length:   number
  external_script_count:   number
  has_honeypot_patterns:   boolean
  security_score:          number
  transparency_score:      number
}

// ── Helpers ─────────────────────────────────────────────────────────────────

function extractDomain(url: string): string {
  try { return new URL(url).hostname.replace(/^www\./, '') } catch { return url }
}

async function fetchWithTimeout(
  url: string,
  options: RequestInit = {},
  timeoutMs = 10000
): Promise<Response> {
  const controller = new AbortController()
  const id = setTimeout(() => controller.abort(), timeoutMs)
  try {
    const res = await fetch(url, { ...options, signal: controller.signal })
    clearTimeout(id)
    return res
  } catch (e) {
    clearTimeout(id)
    throw e
  }
}

// ── GoPlus Security API (free, no key needed) ────────────────────────────────
// Used by Trust Wallet, OKX, and major wallets. Checks phishing site database.
async function checkGoPlus(url: string): Promise<{ flagged: boolean; detail: string }> {
  try {
    const encoded = encodeURIComponent(url)
    const res = await fetchWithTimeout(
      `https://api.gopluslabs.io/api/v1/phishing_site?url=${encoded}`,
      { headers: { 'Accept': 'application/json' } },
      8000
    )
    if (!res.ok) return { flagged: false, detail: 'GoPlus unavailable' }
    const data = await res.json()
    // result: 1 = phishing, 0 = clean
    const flagged = data?.result?.phishing_site === '1' ||
                    data?.result?.phishing_site === 1 ||
                    Number(data?.result?.phishing_site) === 1
    return { flagged, detail: flagged ? 'Flagged by GoPlus as phishing site' : 'GoPlus: clean' }
  } catch {
    return { flagged: false, detail: 'GoPlus check skipped (timeout)' }
  }
}

// ── Google Safe Browsing API (free, 10k/day) ────────────────────────────────
// Used by Chrome, Firefox, Safari. Checks malware + phishing + deceptive.
// If quota exceeded or API key missing, scan continues without it — no blocking.
async function checkGoogleSafeBrowsing(url: string): Promise<{ flagged: boolean; detail: string }> {
  const apiKey = process.env.GOOGLE_SAFE_BROWSING_KEY
  if (!apiKey) return { flagged: false, detail: 'Safe Browsing: no API key configured' }
  try {
    const body = {
      client: { clientId: 'genradar', clientVersion: '1.0' },
      threatInfo: {
        threatTypes:      ['MALWARE', 'SOCIAL_ENGINEERING', 'UNWANTED_SOFTWARE', 'POTENTIALLY_HARMFUL_APPLICATION'],
        platformTypes:    ['ANY_PLATFORM'],
        threatEntryTypes: ['URL'],
        threatEntries:    [{ url }],
      },
    }
    const res = await fetchWithTimeout(
      `https://safebrowsing.googleapis.com/v4/threatMatches:find?key=${apiKey}`,
      { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) },
      8000
    )
    if (res.status === 429) {
      // Quota exceeded — do NOT block the scan, just skip
      console.warn('[Scanner] Google Safe Browsing quota exceeded — continuing without it')
      return { flagged: false, detail: 'Safe Browsing: quota exceeded, skipped' }
    }
    if (!res.ok) return { flagged: false, detail: 'Safe Browsing unavailable' }
    const data = await res.json()
    const flagged = !!(data?.matches?.length)
    return {
      flagged,
      detail: flagged
        ? `Flagged by Google Safe Browsing: ${data.matches[0]?.threatType}`
        : 'Google Safe Browsing: clean',
    }
  } catch {
    return { flagged: false, detail: 'Safe Browsing check skipped (timeout)' }
  }
}

// ── ScamSniffer / open-source phishing list ─────────────────────────────────
// Checks against the public ScamSniffer blacklist (GitHub raw file, free).
let scamSnifferCache: string[] | null = null
async function checkScamSniffer(domain: string): Promise<{ flagged: boolean }> {
  try {
    if (!scamSnifferCache) {
      const res = await fetchWithTimeout(
        'https://raw.githubusercontent.com/scamsniffer/scam-database/main/blacklist/domains.json',
        {},
        8000
      )
      if (!res.ok) return { flagged: false }
      scamSnifferCache = await res.json()
    }
    const list: string[] = scamSnifferCache || []
    const flagged = list.some(d =>
      typeof d === 'string' && (d === domain || domain.endsWith('.' + d))
    )
    return { flagged }
  } catch {
    return { flagged: false }
  }
}

// ── Deep HTML analysis ───────────────────────────────────────────────────────
function analyzeHTML(html: string) {
  const h = html.toLowerCase()

  // Phishing — private key / seed phrase harvesting
  const phishingPatterns = [
    /enter.*private.*key/i,
    /enter.*seed.*phrase/i,
    /enter.*mnemonic/i,
    /confirm.*recovery.*phrase/i,
    /verify.*wallet.*to.*claim/i,
    /connect.*wallet.*to.*receive/i,
    /limited.*time.*airdrop.*connect/i,
    /wallet.*sync.*required/i,
    /wallet.*validation.*required/i,
    /import.*wallet.*phrase/i,
  ]
  const phishing_detected = phishingPatterns.some(p => p.test(html))

  // Wallet presence
  const walletKeywords = [
    'window.ethereum', 'connectwallet', 'connect wallet', 'wagmi',
    'ethers.js', 'web3.js', 'walletconnect', 'metamask', 'coinbase wallet',
    'rainbow', 'phantom', 'web3modal', 'rainbowkit', 'web3-react',
  ]
  const wallet_present = walletKeywords.some(p => h.includes(p.toLowerCase()))

  // Unsafe wallet — dangerous approval patterns
  const unsafePatterns = [
    /approve\s*\(\s*[^)]*0xffffffff/i,          // unlimited token approval
    /eth_sign\b/i,                                // blind signing
    /personal_sign.*auto/i,
    /transferFrom.*unlimited/i,
    /setApprovalForAll.*true/i,                   // NFT drainer
    /permit\s*\(.*deadline.*\d{10,}/i,            // permit signature phishing
  ]
  const unsafe_wallet_behavior = wallet_present && unsafePatterns.some(p => p.test(html))

  // Honeypot patterns — fake token contracts, fake claim buttons
  const honeypotPatterns = [
    /you.*won.*\$[\d,]+/i,
    /unclaimed.*reward/i,
    /your.*wallet.*eligible/i,
    /secret.*bonus.*wallet/i,
    /gas.*fee.*only/i,
    /send.*bnb.*receive.*back/i,
  ]
  const has_honeypot_patterns = honeypotPatterns.some(p => p.test(html))

  // Obfuscated scripts — real obfuscation, not just minification
  const obfuscatedPatterns = [
    /eval\s*\(\s*atob\s*\(/i,
    /eval\s*\(\s*function\s*\(p,a,c,k,e,d\)/i,
    /String\.fromCharCode\([0-9,\s]{50,}\)/i,
    /\bexec\s*\(\s*unescape\s*\(/i,
    /document\.write\s*\(\s*unescape\s*\(/i,
  ]
  const suspicious_scripts = obfuscatedPatterns.some(p => p.test(html))

  // Hidden redirects — immediate, not user-triggered
  const noScriptHTML = html.replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
  const redirectPatterns = [
    /window\.location\s*=\s*['"]/i,
    /meta.*http-equiv.*refresh.*content.*0\s*;/i,
  ]
  const hidden_redirects = redirectPatterns.some(p => p.test(noScriptHTML))

  // Count external scripts — many = higher risk
  const externalScripts = (html.match(/<script[^>]+src\s*=\s*['"][^'"]+['"]/gi) || [])
    .filter(s => !s.includes('googleapis') && !s.includes('cloudflare') && !s.includes('jsdelivr'))
  const external_script_count = externalScripts.length

  return {
    phishing_detected,
    wallet_present,
    unsafe_wallet_behavior,
    suspicious_scripts,
    hidden_redirects,
    has_honeypot_patterns,
    external_script_count,
  }
}

// ── Main scanner ─────────────────────────────────────────────────────────────

export async function scanProject(
  website_url:  string,
  github_url?:  string,
  docs_url?:    string,
  twitter_url?: string,
  telegram_url?: string,
  discord_url?: string,
): Promise<ScannerSignals> {

  const signals: ScannerSignals = {
    phishing_detected:      false,
    suspicious_scripts:     false,
    wallet_present:         false,
    unsafe_wallet_behavior: false,
    hidden_redirects:       false,
    // Use submitted URLs as ground truth — scanner augments but never overrides these
    has_github:             !!(github_url  && github_url.startsWith('http')),
    has_docs:               !!(docs_url),
    has_twitter:            !!(twitter_url),
    has_telegram:           !!(telegram_url),
    has_discord:            !!(discord_url),
    recently_active:        false,
    domain_age_days:        null,
    website_unreachable:    false,
    website_html:           '',
    github_summary:         '',
    goplus_flagged:         false,
    safe_browsing_flagged:  false,
    scamsniffer_flagged:    false,
    ssl_valid:              website_url.startsWith('https://'),
    redirect_chain_length:  0,
    external_script_count:  0,
    has_honeypot_patterns:  false,
    security_score:         0,
    transparency_score:     0,
  }

  const domain = extractDomain(website_url)

  // ── Run all external checks in parallel ─────────────────────────────────
  // All run simultaneously, each has its own timeout.
  // Failure in one never blocks others.
  const [goplusResult, safeBrowsingResult, scamSnifferResult] = await Promise.allSettled([
    checkGoPlus(website_url),
    checkGoogleSafeBrowsing(website_url),
    checkScamSniffer(domain),
  ])

  if (goplusResult.status === 'fulfilled')      signals.goplus_flagged        = goplusResult.value.flagged
  if (safeBrowsingResult.status === 'fulfilled') signals.safe_browsing_flagged = safeBrowsingResult.value.flagged
  if (scamSnifferResult.status === 'fulfilled')  signals.scamsniffer_flagged   = scamSnifferResult.value.flagged

  // If ANY threat database flags it, mark as phishing immediately
  if (signals.goplus_flagged || signals.safe_browsing_flagged || signals.scamsniffer_flagged) {
    signals.phishing_detected = true
  }

  // ── Fetch website HTML ───────────────────────────────────────────────────
  let html = ''
  try {
    const res = await fetchWithTimeout(website_url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml',
      },
      redirect: 'follow',
    }, 12000)

    html = await res.text()
    signals.website_html = html.slice(0, 5000)

    // Check how many redirects happened
    const finalUrl = res.url
    if (finalUrl && finalUrl !== website_url) {
      try {
        const origDomain  = new URL(website_url).hostname
        const finalDomain = new URL(finalUrl).hostname
        if (origDomain !== finalDomain) signals.redirect_chain_length = 1
      } catch {}
    }
  } catch {
    signals.website_unreachable = true
  }

  // ── Deep HTML analysis ───────────────────────────────────────────────────
  if (!signals.website_unreachable && html) {
    const analysis = analyzeHTML(html)
    // Only override phishing if not already flagged by threat databases
    if (!signals.phishing_detected) signals.phishing_detected = analysis.phishing_detected
    signals.wallet_present          = analysis.wallet_present
    signals.unsafe_wallet_behavior  = analysis.unsafe_wallet_behavior
    signals.suspicious_scripts      = analysis.suspicious_scripts
    signals.hidden_redirects        = analysis.hidden_redirects
    signals.has_honeypot_patterns   = analysis.has_honeypot_patterns
    signals.external_script_count   = analysis.external_script_count
  }

  // ── GitHub deep check ────────────────────────────────────────────────────
  if (github_url && github_url.startsWith('http')) {
    try {
      const match = github_url.match(/github\.com\/([^/]+)\/([^/?#\s]+)/)
      if (match) {
        const [, owner, repo] = match
        const cleanRepo = repo.replace(/\.git$/, '')
        const repoRes = await fetchWithTimeout(
          `https://api.github.com/repos/${owner}/${cleanRepo}`,
          { headers: { 'Accept': 'application/vnd.github.v3+json', 'User-Agent': 'GenRadarBot' } },
          8000
        )
        if (repoRes.ok) {
          const data = await repoRes.json()
          signals.has_github    = true  // confirmed real repo
          const daysSince       = (Date.now() - new Date(data.pushed_at).getTime()) / 86400000
          signals.recently_active = daysSince < 180
          signals.github_summary = [
            `Stars: ${data.stargazers_count}`,
            `Forks: ${data.forks_count}`,
            `Last push: ${Math.round(daysSince)} days ago`,
            `Language: ${data.language || 'unknown'}`,
            `Open issues: ${data.open_issues_count}`,
            data.license ? `License: ${data.license.spdx_id}` : 'No license',
          ].join('. ')
        } else if (repoRes.status === 404) {
          // Repo not found or private — but user DID submit a URL, so keep has_github = true
          // Don't penalize for private repos. Only penalize if no URL was submitted at all.
          signals.github_summary = 'GitHub repo is private or not publicly accessible'
        }
      }
    } catch {
      signals.github_summary = 'GitHub check failed'
    }
  }

  // ── Pre-calculate pillar scores (mirrors contract logic) ─────────────────
  const sec_goplus   = signals.goplus_flagged        ? 0 : 20
  const sec_sb       = signals.safe_browsing_flagged ? 0 : 20
  const sec_scam     = signals.scamsniffer_flagged   ? 0 : 20
  const sec_wallet   = (signals.unsafe_wallet_behavior || signals.phishing_detected) ? 0 : 15
  const sec_honeypot = signals.has_honeypot_patterns ? 0 : 10
  const sec_ssl      = signals.ssl_valid !== false    ? 10 : 0
  const sec_scripts  = signals.suspicious_scripts     ? 0 : 5
  const security_score = Math.min(100, sec_goplus + sec_sb + sec_scam + sec_wallet + sec_honeypot + sec_ssl + sec_scripts)

  const tr_website  = 25
  const tr_github   = signals.has_github   ? 20 : 0
  const tr_docs     = signals.has_docs     ? 20 : 0
  const tr_twitter  = signals.has_twitter  ? 15 : 0
  const tr_telegram = signals.has_telegram ? 10 : 0
  const tr_discord  = signals.has_discord  ? 10 : 0
  const transparency_score = Math.min(100, tr_website + tr_github + tr_docs + tr_twitter + tr_telegram + tr_discord)

  signals.security_score     = security_score
  signals.transparency_score = transparency_score

  // ── Log scan summary ─────────────────────────────────────────────────────
  console.log(`[Scanner] ${domain}`, {
    goplus:       signals.goplus_flagged,
    safeBrowsing: signals.safe_browsing_flagged,
    scamSniffer:  signals.scamsniffer_flagged,
    phishing:     signals.phishing_detected,
    wallet:       signals.wallet_present,
    unsafe:       signals.unsafe_wallet_behavior,
    scripts:      signals.suspicious_scripts,
    honeypot:     signals.has_honeypot_patterns,
    has_twitter:  signals.has_twitter,
    has_github:   signals.has_github,
    has_docs:     signals.has_docs,
    security_score,
    transparency_score,
  })

  return signals
}
