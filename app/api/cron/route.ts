import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { startEvaluation, checkEvaluation } from '@/lib/runEvaluation'

export const maxDuration = 60
export const dynamic = 'force-dynamic'

function serviceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  )
}

// Safety net only — normal submissions already call startEvaluation()
// directly from /api/submit-project, and normal "processing" projects
// already get checked opportunistically by /api/projects whenever
// someone has the card/page open. This just catches anything that
// slipped through (e.g. the direct call failed transiently, or nobody
// viewed the page while it was processing).
export async function GET(req: NextRequest) {
  const authHeader = req.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = serviceClient()
  const results = { submitted: [] as string[], checked: [] as string[], completed: [] as string[], failed: [] as string[] }

  const { data: pending } = await supabase
    .from('projects')
    .select('id')
    .eq('evaluation_status', 'pending')
    .eq('status', 'active')
    .order('created_at', { ascending: true })
    .limit(3)

  for (const p of pending ?? []) {
    const r = await startEvaluation(p.id)
    results.submitted.push(p.id)
    if ('error' in r) results.failed.push(p.id)
  }

  const cutoff = new Date(Date.now() - 50_000).toISOString()
  const { data: processing } = await supabase
    .from('projects')
    .select('id')
    .eq('evaluation_status', 'processing')
    .eq('status', 'active')
    .or(`evaluation_last_polled_at.is.null,evaluation_last_polled_at.lt.${cutoff}`)
    .order('evaluation_started_at', { ascending: true })
    .limit(8)

  for (const p of processing ?? []) {
    const outcome = await checkEvaluation(p.id)
    results.checked.push(p.id)
    if (outcome === 'completed') results.completed.push(p.id)
    if (outcome === 'failed')    results.failed.push(p.id)
  }

  return NextResponse.json({ success: true, ...results })
}
