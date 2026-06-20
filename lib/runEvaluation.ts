// lib/runEvaluation.ts
//
// Single place that knows how to (re)start an evaluation and how to check
// on one in progress. Used by /api/submit-project, /api/re-evaluate,
// /api/admin (re-evaluate action) and /api/cron — so there is exactly one
// code path that talks to GenLayer and writes ai_scores, instead of three
// slightly different copies.

import { createClient, SupabaseClient } from '@supabase/supabase-js'
import { submitEvaluation, pollEvaluation } from './genlayerAI'

function serviceClient(): SupabaseClient {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  )
}

type StartResult = { started: true } | { error: string }

/**
 * Kicks off (or restarts) evaluation for a project:
 *  1. clears any existing score immediately, so the UI never shows a
 *     stale result while a fresh evaluation is in flight
 *  2. scans the project and submits the tx to GenLayer
 *  3. stores the tx hash and marks the project "processing"
 *
 * Resolves in a few seconds. Does NOT wait for consensus —
 * checkEvaluation() (below) handles that, called repeatedly later.
 */
export async function startEvaluation(projectId: string): Promise<StartResult> {
  const supabase = serviceClient()

  const { data: project, error } = await supabase.from('projects').select('*').eq('id', projectId).single()
  if (error || !project) return { error: 'Project not found' }

  await supabase.from('ai_scores').delete().eq('project_id', projectId)
  await supabase.from('projects').update({
    evaluation_status:         'processing',
    evaluation_error:          null,
    evaluation_tx_hash:        null,
    evaluation_started_at:     new Date().toISOString(),
    evaluation_last_polled_at: null,
  }).eq('id', projectId)

  try {
    const { txHash, signals } = await submitEvaluation({
      name:         project.name,
      description:  project.description  ?? '',
      website_url:  project.website_url  ?? '',
      github_url:   project.github_url   ?? '',
      twitter_url:  project.twitter_url  ?? '',
      discord_url:  project.discord_url  ?? '',
      docs_url:     project.docs_url     ?? '',
      telegram_url: project.telegram_url ?? '',
      category:     project.category     ?? '',
    }, projectId)

    await supabase.from('projects').update({
      evaluation_tx_hash:  txHash,
      last_scan_signals:   signals,
    }).eq('id', projectId)
    console.log(`[runEvaluation] submitted ${projectId} tx=${txHash}`)
    return { started: true }
  } catch (err: any) {
    const message = err?.message || 'Unknown error submitting to GenLayer'
    console.error(`[runEvaluation] submit failed for ${projectId}: ${message}`)
    await supabase.from('projects').update({
      evaluation_status: 'failed',
      evaluation_error:  message.slice(0, 500),
    }).eq('id', projectId)
    return { error: message }
  }
}

/**
 * One fast check of whether GenLayer has finished evaluating this project.
 * Safe to call often (e.g. on every page view) — does a single read.
 * Never writes a score unless GenLayer actually returned one.
 */
export async function checkEvaluation(
  projectId: string
): Promise<'completed' | 'waiting' | 'failed' | 'skipped'> {
  const supabase = serviceClient()

  const { data: project } = await supabase.from('projects').select('*').eq('id', projectId).single()
  if (!project || project.evaluation_status !== 'processing') return 'skipped'

  await supabase.from('projects').update({ evaluation_last_polled_at: new Date().toISOString() }).eq('id', projectId)

  let result
  try {
    result = await pollEvaluation(projectId)
  } catch (err: any) {
    const message = err?.message || 'Unknown error reading GenLayer contract'
    console.error(`[runEvaluation] poll config error for ${projectId}: ${message}`)
    await supabase.from('projects').update({
      evaluation_status: 'failed',
      evaluation_error:  message.slice(0, 500),
    }).eq('id', projectId)
    return 'failed'
  }

  if (!result) {
    const startedAt = project.evaluation_started_at || project.created_at
    const minutesWaiting = (Date.now() - new Date(startedAt).getTime()) / 60000
    if (minutesWaiting > 20) {
      await supabase.from('projects').update({
        evaluation_status: 'failed',
        evaluation_error:
          'GenLayer consensus timed out after 20 minutes. No score was returned, so nothing was saved. Use Re-evaluate to try again.',
      }).eq('id', projectId)
      return 'failed'
    }
    return 'waiting'
  }

  await supabase.from('ai_scores').insert({
    project_id:               projectId,
    score:                    result.score,
    security_score:           result.breakdown?.security     ?? null,
    transparency_score:       result.breakdown?.transparency ?? null,
    risk:                     result.risk,
    confidence:               result.confidence,
    positives:                result.positives  ?? [],
    risks:                    result.risks      ?? [],
    findings:                 result.findings   ?? [],
    breakdown:                result.breakdown  ?? null,
    explanation:               result.explanation ?? null,
    security_explanation:      (result as any).security_explanation     ?? null,
    transparency_explanation:  (result as any).transparency_explanation ?? null,
    tx_hash:                  project.evaluation_tx_hash ?? null,
    scanner_signals:          project.last_scan_signals  ?? null,
    created_at:                new Date().toISOString(),
  })

  await supabase.from('projects').update({
    evaluation_status: 'completed',
    evaluation_error:  null,
  }).eq('id', projectId)

  console.log(`[runEvaluation] completed ${projectId} score=${result.score}`)
  return 'completed'
}
