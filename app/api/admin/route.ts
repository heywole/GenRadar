import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { startEvaluation } from '@/lib/runEvaluation'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

const ADMIN_EMAILS = ['wolegold247@gmail.com']

async function verifyAdmin(req: NextRequest) {
  const auth = req.headers.get('Authorization')
  if (!auth) return null
  const token = auth.replace('Bearer ', '')
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { global: { headers: { Authorization: `Bearer ${token}` } }, auth: { persistSession: false } }
  )
  const { data: { user }, error } = await supabase.auth.getUser()
  if (error || !user) return null
  if (!ADMIN_EMAILS.includes(user.email ?? '')) return null
  return user
}

function serviceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  )
}

export async function GET(req: NextRequest) {
  const user = await verifyAdmin(req)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const supabase = serviceClient()

  const [
    { data: projects, error: pErr },
    { data: scores },
    { data: usersData },
    { count: msgCount },
  ] = await Promise.all([
    supabase.from('projects').select('*').order('created_at', { ascending: false }),
    supabase.from('ai_scores').select('*').order('created_at', { ascending: false }),
    supabase.auth.admin.listUsers({ perPage: 1000 }),
    supabase.from('messages').select('*', { count: 'exact', head: true }),
  ])

  if (pErr) console.error('[admin] projects error:', pErr.message)

  const scoreMap: Record<string, any> = {}
  for (const s of scores ?? []) {
    if (!scoreMap[s.project_id]) scoreMap[s.project_id] = s
  }

  const projectsWithScores = (projects ?? []).map(p => ({
    ...p,
    ai_score: scoreMap[p.id] ?? null,
  }))

  const active      = projectsWithScores.filter(p => p.status === 'active')
  const evaluated   = active.filter(p => p.evaluation_status === 'completed' && p.ai_score)
  const stuck       = active.filter(p => p.evaluation_status === 'processing' || p.evaluation_status === 'pending' || p.evaluation_status === 'failed')
  const allScores   = evaluated.map(p => Number(p.ai_score.score)).filter(Boolean)
  const avgScore    = allScores.length ? Math.round(allScores.reduce((a, b) => a + b, 0) / allScores.length) : null
  const totalUsers  = usersData?.users?.length ?? 0

  return NextResponse.json({
    projects: projectsWithScores,
    stats: {
      totalProjects:  active.length,
      totalEvaluated: evaluated.length,
      totalStuck:     stuck.length,
      totalUsers,
      totalMessages:  msgCount ?? 0,
      avgScore,
    },
    recentScores: (scores ?? []).slice(0, 20),
  })
}

export async function POST(req: NextRequest) {
  const user = await verifyAdmin(req)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { action, project_id } = await req.json()
  const supabase = serviceClient()

  if (action === 'delete') {
    await Promise.all([
      supabase.from('ai_scores').delete().eq('project_id', project_id),
      supabase.from('messages').delete().eq('project_id', project_id),
      supabase.from('interactions').delete().eq('project_id', project_id),
      supabase.from('votes').delete().eq('project_id', project_id),
    ])
    const { error } = await supabase.from('projects').delete().eq('id', project_id)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ success: true })
  }

  if (action === 'approve') {
    await supabase.from('projects').update({ status: 'active' }).eq('id', project_id)
    return NextResponse.json({ success: true })
  }

  if (action === 'reject') {
    await supabase.from('projects').update({ status: 'rejected' }).eq('id', project_id)
    return NextResponse.json({ success: true })
  }

  if (action === 're-evaluate') {
    // Was: an HTTP fetch from this serverless function back to its own
    // public URL (/api/re-evaluate). That hop silently breaks whenever
    // NEXT_PUBLIC_APP_URL doesn't exactly match the live deployment URL,
    // and gave no real error back to the admin panel. Now it calls the
    // same evaluation logic directly, in-process.
    const result = await startEvaluation(project_id)
    if ('error' in result) return NextResponse.json({ error: result.error }, { status: 502 })
    return NextResponse.json({ success: true, message: 'Submitted to GenLayer — waiting for validators.' })
  }

  return NextResponse.json({ error: 'Unknown action' }, { status: 400 })
}
