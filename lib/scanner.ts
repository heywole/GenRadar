// Scanner: scans the project website and GitHub, returns raw signals ONLY.
// No scoring here — scoring lives entirely inside the GenLayer contract.

export interface ScannerSignals {
  phishing_detected:      boolean
  suspicious_scripts:     boolean
  wallet_present:         boolean
  unsafe_wallet_behavior: boolean
  hidden_redirects:       boolean
  has_github:             boolean
  has_docs:               boolean
  has_twitter:            boolean
  has_telegram:           boolean
  has_discord:            boolean
  recently_active:        boolean
  domain_age_days:        number | null
  website_unreachable:    boolean
  website_html:           string
  github_summary:         string
}

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
    has_github:             !!(github_url && github_url.startsWith('http')),
    has_docs:               !!(docs_url),
    has_twitter:            !!(twitter_url),
    has_telegram:           !!(telegram_url),
    has_discord:            !!(discord_url),
    recently_active:        false,
    domain_age_days:        null,
    website_unreachable:    false,
    website_html:           '',
    github_summary:         '',
  }

  // ── 1. Fetch website ──────────────────────────────────
  let html = ''
  try {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 10000)
    const res = await fetch(website_url, {
      signal: controller.signal,
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; GenScoutBot/1.0)' },
    })
    clearTimeout(timeout)
    html = await res.text()
    signals.website_html = html.slice(0, 4000)
  } catch {
    signals.website_unreachable = true
  }

  if (!signals.website_unreachable && html) {
    const h = html.toLowerCase()

    // Phishing — strict patterns only
    const phishingPatterns = [
      /enter.*private.*key/i,
      /enter.*seed.*phrase/i,
      /enter.*mnemonic/i,
      /confirm.*recovery.*phrase/i,
      /wallet.*drained/i,
      /claim.*free.*token.*now/i,
    ]
    signals.phishing_detected = phishingPatterns.some(p => p.test(html))

    // Wallet detection
    const walletPatterns = [
      'window.ethereum', 'connectwallet', 'connect wallet',
      'wagmi', 'ethers.js', 'web3.js', 'walletconnect',
      'metamask', 'coinbase wallet',
    ]
    signals.wallet_present = walletPatterns.some(p => h.includes(p.toLowerCase()))

    // Unsafe wallet — only if wallet is present AND has suspicious patterns
    if (signals.wallet_present) {
      const unsafePatterns = [
        /approve\s*\(\s*[^)]*0xffffffff/i,
        /eth_sign/i,
        /personal_sign.*auto/i,
      ]
      signals.unsafe_wallet_behavior = unsafePatterns.some(p => p.test(html))
    }

    // Obfuscated scripts — truly obfuscated only, not just minified
    const obfuscatedPatterns = [
      /eval\s*\(\s*atob\s*\(/i,
      /eval\s*\(\s*function\s*\(p,a,c,k,e,d\)/i,
      /String\.fromCharCode\([0-9,\s]{50,}\)/i,
    ]
    signals.suspicious_scripts = obfuscatedPatterns.some(p => p.test(html))

    // Hidden redirects — immediate, not user-triggered
    const bodyContent = html.replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
    const redirectPatterns = [
      /window\.location\s*=\s*['"]/i,
      /meta.*http-equiv.*refresh.*0\s*;/i,
    ]
    signals.hidden_redirects = redirectPatterns.some(p => p.test(bodyContent))
  }

  // ── 2. GitHub check ───────────────────────────────────
  if (github_url && github_url.startsWith('http')) {
    try {
      const match = github_url.match(/github\.com\/([^/]+)\/([^/?\s]+)/)
      if (match) {
        const [, owner, repo] = match
        const apiUrl = `https://api.github.com/repos/${owner}/${repo.replace(/\.git$/, '')}`
        const res = await fetch(apiUrl, {
          headers: { 'Accept': 'application/vnd.github.v3+json' },
        })
        if (res.ok) {
          const data = await res.json()
          signals.has_github    = true
          const lastPush        = new Date(data.pushed_at)
          const daysSince       = (Date.now() - lastPush.getTime()) / 86400000
          signals.recently_active = daysSince < 180
          signals.github_summary  = `Stars: ${data.stargazers_count}. Last push: ${Math.round(daysSince)} days ago. Language: ${data.language || 'unknown'}.`
        }
      }
    } catch {
      signals.github_summary = 'GitHub fetch failed'
    }
  }

  return signals
}
