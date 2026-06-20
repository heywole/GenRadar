// lib/genlayerAI.ts
//
// IMPORTANT DESIGN RULE: GenLayer is the only source of a score.
// submitEvaluation() sends the transaction and returns immediately
// (it does NOT wait for validator consensus). pollEvaluation() does a
// single fast check for a result. Neither function ever invents a score —
// if GenLayer hasn't produced one, callers get `null` (poll) or a thrown
// error (submit failure), never a fake number.

import type { AIScore, SubmitProjectPayload } from '@/types'
import { scanProject, type ScannerSignals } from './scanner'

function clean(s: string, max: number) {
  return (s || '').replace(/[<>{}[\]]/g, '').trim().slice(0, max)
}

function sanitizeAddress(addr: string): `0x${string}` {
  const match = addr.match(/0x[0-9a-fA-F]{40}/)
  if (match) return match[0] as `0x${string}`
  const hex = addr.replace(/^0+x/, '').replace(/[^0-9a-fA-F]/g, '')
  return `0x${hex}` as `0x${string}`
}

// genlayer-js currently (v1.x) exports: localnet, studionet, testnetAsimov,
// testnetBradbury. Older guides/scripts reference a plain "testnet" export
// that no longer exists — that mismatch silently falls back to localnet
// (127.0.0.1), which is why this needed fixing. GENLAYER_NETWORK in your
// .env was already being set but the old code never read it.
const NETWORK_ALIASES: Record<string, string> = {
  studionet:          'studionet',
  localnet:           'localnet',
  testnet:            'testnetBradbury', // legacy alias some docs/scripts used
  'testnet-asimov':   'testnetAsimov',
  testnetasimov:      'testnetAsimov',
  'testnet-bradbury': 'testnetBradbury',
  testnetbradbury:    'testnetBradbury',
}

export function resolveNetworkKey(): string {
  return (process.env.GENLAYER_NETWORK || 'studionet').trim().toLowerCase()
}

async function getChain() {
  const chains = await import('genlayer-js/chains')
  const key        = resolveNetworkKey()
  const exportName = NETWORK_ALIASES[key]
  const chain       = exportName ? (chains as any)[exportName] : undefined
  if (!chain) {
    throw new Error(
      `Unknown GENLAYER_NETWORK "${process.env.GENLAYER_NETWORK}". ` +
      `Valid values: studionet, testnet-asimov, testnet-bradbury, localnet.`
    )
  }
  return chain
}

async function getClient() {
  const privateKeyRaw = process.env.GENLAYER_PRIVATE_KEY
  if (!privateKeyRaw) throw new Error('GENLAYER_PRIVATE_KEY is not set.')
  const privateKey = (privateKeyRaw.startsWith('0x') ? privateKeyRaw : `0x${privateKeyRaw}`) as `0x${string}`

  const gljs  = await import('genlayer-js')
  const chain = await getChain()
  const { createClient, createAccount } = gljs
  const account = createAccount(privateKey)
  return createClient({ chain, account })
}

function getContractAddress(): `0x${string}` {
  const raw = process.env.GENLAYER_CONTRACT_ADDRESS
  if (!raw) throw new Error('GENLAYER_CONTRACT_ADDRESS is not set.')
  return sanitizeAddress(raw)
}

type ProjectInput = SubmitProjectPayload & {
  telegram_url?: string
  twitter_url?:  string
  discord_url?:  string
  docs_url?:     string
}

async function buildSignalPayload(project: ProjectInput): Promise<{ payload: string; signals: ScannerSignals }> {
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
  } catch (e: any) {
    console.warn('[Scanner] failed, using neutral defaults:', e?.message || e)
    signals = {
      phishing_detected: false, suspicious_scripts: false, wallet_present: false,
      unsafe_wallet_behavior: false, hidden_redirects: false,
      has_github:   !!project.github_url,
      has_docs:     !!project.docs_url,
      has_twitter:  !!project.twitter_url,
      has_telegram: !!project.telegram_url,
      has_discord:  !!project.discord_url,
      recently_active: false, domain_age_days: null,
      website_unreachable: true, website_html: '', github_summary: '',
      goplus_flagged: false, safe_browsing_flagged: false, scamsniffer_flagged: false,
      ssl_valid: project.website_url.startsWith('https://'),
      redirect_chain_length: 0, external_script_count: 0,
      has_honeypot_patterns: false,
      security_score: 80,
      transparency_score:
        20 + (project.github_url ? 20 : 0) + (project.docs_url ? 20 : 0) +
        (project.twitter_url ? 15 : 0) + (project.telegram_url ? 12 : 0) + (project.discord_url ? 13 : 0),
    }
  }

  const payload = JSON.stringify({
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

  return { payload, signals }
}

/**
 * Scans the project and submits the evaluate_project transaction.
 * Resolves in a few seconds (scanner has its own internal timeouts,
 * writeContract is just sending a tx) — it does NOT wait for validator
 * consensus. Call pollEvaluation() afterwards to check for a result.
 *
 * Throws on any real failure (bad config, tx rejected, etc) — callers
 * must NOT catch this and substitute a fake score.
 */
export async function submitEvaluation(project: ProjectInput, projectId: string): Promise<{ txHash: string; signals: ScannerSignals }> {
  const contractAddr = getContractAddress()
  const client        = await getClient()

  console.log(`[GenLayer] submitting project=${projectId} contract=${contractAddr} network=${resolveNetworkKey()}`)

  const { payload: signalPayload, signals } = await buildSignalPayload(project)

  try {
    const txHash = await client.writeContract({
      address:      contractAddr,
      functionName: 'evaluate_project',
      args: [
        projectId,
        clean(project.name, 100),
        clean(project.description, 800),
        clean(project.website_url, 200),
        clean(project.github_url   ?? '', 200),
        clean(project.twitter_url  ?? '', 200),
        clean(project.telegram_url ?? '', 200),
        clean(project.discord_url  ?? '', 200),
        clean(project.docs_url     ?? '', 200),
        clean(project.category, 50),
        clean(signalPayload, 2000),
      ],
      value: BigInt(0),
    })
    console.log(`[GenLayer] tx submitted for ${projectId}: ${txHash}`)
    return { txHash: txHash as string, signals }
  } catch (e: any) {
    const message = e?.message || e?.shortMessage || 'unknown error'
    console.error(`[GenLayer] writeContract failed for ${projectId}:`, message)
    throw new Error(`GenLayer transaction failed: ${message}`)
  }
}

/**
 * One fast read of get_evaluation. Returns:
 *   - an AIScore  if validators have reached consensus
 *   - null        if not ready yet (keep waiting — NOT an error)
 * Throws only on real configuration errors (bad address/network/key) so
 * the caller can tell "still waiting" apart from "this will never work".
 */
export async function pollEvaluation(projectId: string): Promise<AIScore | null> {
  const contractAddr = getContractAddress()
  const client        = await getClient()

  let raw: unknown
  try {
    raw = await client.readContract({
      address:      contractAddr,
      functionName: 'get_evaluation',
      args:         [projectId],
    })
  } catch (e: any) {
    // Transient RPC hiccup — don't fail the project over this, just retry later.
    console.warn(`[GenLayer] readContract attempt failed for ${projectId}:`, e?.message || e)
    return null
  }

  if (!raw || raw === '{}' || raw === 'null' || String(raw).length <= 5) return null

  let data: any
  try {
    data = typeof raw === 'string' ? JSON.parse(raw) : raw
  } catch {
    return null
  }

  const score = Number(data.score ?? 0)
  if (!score) return null // contract hasn't written a real result yet

  const secScore   = Number(data.security_score     ?? data.breakdown?.security     ?? 0)
  const transScore = Number(data.transparency_score ?? data.breakdown?.transparency ?? 0)
  const risk        = data.risk ?? (score >= 75 ? 'Low' : score >= 50 ? 'Medium' : 'High')

  return {
    score,
    risk,
    confidence:  data.confidence ?? 'Medium',
    positives:   Array.isArray(data.positives) ? data.positives.slice(0, 5) : [],
    risks:       Array.isArray(data.risks)     ? data.risks.slice(0, 5)     : [],
    findings:    Array.isArray(data.findings)  ? data.findings.slice(0, 5)  : [],
    explanation: data.explanation ?? '',
    breakdown: {
      security: secScore,
      transparency: transScore,
      community: 0,
      ...(data.breakdown ?? {}),
    },
    tx_hash: null, // the caller (lib/runEvaluation.ts) fills in the stored tx hash
    ...(data.security_explanation     ? { security_explanation:     data.security_explanation }     : {}),
    ...(data.transparency_explanation ? { transparency_explanation: data.transparency_explanation } : {}),
  } as AIScore
}
