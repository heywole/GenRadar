import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { checkEvaluation } from '@/lib/runEvaluation'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const sort     = searchParams.get('sort')     || 'score'
  const limit    = parseInt(searchParams.get('limit') || '50')
  const category = searchParams.get('category') || ''
  const search   = searchParams.get('search')   || ''
  const risk     = searchParams.get('risk')      || ''
  const singleId = searchParams.get('id')        || ''

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { auth: { persistSession: false } }
  )

  try {
    // Opportunistic check: every open project card/page already polls this
    // endpoint every few seconds. If this project is "processing", piggyback
    // a single GenLayer check on that poll instead of depending solely on a
    // cron job to notice. Rate-limited via evaluation_last_polled_at so
    // concurrent viewers don't hammer the RPC.
    if (singleId) {
      try {
        const { data: cur } = await supabase
          .from('projects')
          .select('evaluation_status, evaluation_last_polled_at')
          .eq('id', singleId)
          .maybeSingle()

        if (cur?.evaluation_status === 'processing') {
          const lastPolled = cur.evaluation_last_polled_at ? new Date(cur.evaluation_last_polled_at).getTime() : 0
          if (Date.now() - lastPolled > 8000) {
            await checkEvaluation(singleId)
          }
        }
      } catch (e: any) {
        console.warn('[api/projects] opportunistic poll failed:', e?.message)
      }
    }

    let query = supabase
      .from('projects')
      .select('id, name, description, website_url, github_url, twitter_url, discord_url, telegram_url, docs_url, category, logo_url, created_at, status, evaluation_status, evaluation_error')
      .eq('status', 'active')
      .limit(singleId ? 1 : limit)

    if (singleId) query = query.eq('id', singleId)
    else {
      if (category && category !== 'All') query = query.eq('category', category)
      if (search) query = query.ilike('name', `%${search}%`)
    }

    const { data: projects, error: pErr } = await query
    if (pErr) return NextResponse.json({ projects: [] })
    if (!projects || projects.length === 0) return NextResponse.json({ projects: [] })

    const ids = projects.map(p => p.id)

    // AI scores — pick most recent per project
    const { data: scores, error: sErr } = await supabase
      .from('ai_scores')
      .select('project_id, score, risk, confidence, positives, risks, findings, breakdown, explanation, tx_hash')
      .in('project_id', ids)
      .order('created_at', { ascending: false })

    if (sErr) console.error('[api/projects] ai_scores error:', sErr.message)

    const scoreMap: Record<string, any> = {}
    for (const s of scores || []) {
      if (!scoreMap[s.project_id]) {
        scoreMap[s.project_id] = s
      }
    }

    const { data: ints } = await supabase
      .from('interactions')
      .select('project_id, type')
      .in('project_id', ids)

    const countMap: Record<string, { views: number; saves: number; reports: number }> = {}
    for (const id of ids) countMap[id] = { views: 0, saves: 0, reports: 0 }
    for (const { project_id, type } of ints || []) {
      if (!countMap[project_id]) continue
      if (type === 'view')   countMap[project_id].views++
      if (type === 'save')   countMap[project_id].saves++
      if (type === 'report') countMap[project_id].reports++
    }

    const { data: votes } = await supabase
      .from('votes')
      .select('project_id, vote_type')
      .in('project_id', ids)

    const voteMap: Record<string, { up: number; down: number }> = {}
    for (const id of ids) voteMap[id] = { up: 0, down: 0 }
    for (const { project_id, vote_type } of votes || []) {
      if (!voteMap[project_id]) continue
      if (vote_type === 'up')   voteMap[project_id].up++
      if (vote_type === 'down') voteMap[project_id].down++
    }

    let result = projects.map(p => ({
      ...p,
      ai_score:          scoreMap[p.id] ?? null,
      _count:            countMap[p.id] ?? { views: 0, saves: 0, reports: 0 },
      _votes:            voteMap[p.id]  ?? { up: 0, down: 0 },
      evaluation_status: p.evaluation_status ?? null,
      evaluation_error:  p.evaluation_error  ?? null,
    }))

    if (sort === 'score')  result.sort((a, b) => (b.ai_score?.score ?? -1) - (a.ai_score?.score ?? -1))
    if (sort === 'newest') result.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    if (sort === 'views')  result.sort((a, b) => b._count.views - a._count.views)
    if (risk && risk !== 'All') result = result.filter(p => p.ai_score?.risk === risk)

    const response = NextResponse.json({ projects: result })
    response.headers.set('Cache-Control', 'no-store, no-cache, must-revalidate')
    return response
  } catch (err: any) {
    console.error('[api/projects] crash:', err.message)
    return NextResponse.json({ projects: [] })
  }
}
