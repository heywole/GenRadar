import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const sort     = searchParams.get('sort')     || 'score'
  const limit    = parseInt(searchParams.get('limit') || '50')
  const category = searchParams.get('category') || ''
  const search   = searchParams.get('search')   || ''
  const risk     = searchParams.get('risk')      || ''

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { auth: { persistSession: false } }
  )

  try {
    let query = supabase
      .from('projects')
      .select('id, name, description, website_url, github_url, twitter_url, discord_url, telegram_url, docs_url, category, logo_url, created_at, status')
      .eq('status', 'active')
      .limit(limit)

    if (category && category !== 'All') query = query.eq('category', category)
    if (search) query = query.ilike('name', `%${search}%`)

    const { data: projects, error: pErr } = await query
    if (pErr) return NextResponse.json({ projects: [] })
    if (!projects || projects.length === 0) return NextResponse.json({ projects: [] })

    const ids = projects.map(p => p.id)

    // AI scores — pick highest per project
    const { data: scores, error: sErr } = await supabase
      .from('ai_scores')
      .select('project_id, score, risk, confidence, positives, risks, findings, breakdown, explanation')
      .in('project_id', ids)

    if (sErr) console.error('[api/projects] ai_scores error:', sErr.message)

    const scoreMap: Record<string, any> = {}
    for (const s of scores || []) {
      const existing = scoreMap[s.project_id]
      if (!existing || Number(s.score) > Number(existing.score)) {
        scoreMap[s.project_id] = s
      }
    }

    // Interaction counts (views, saves, reports)
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

    // Vote counts (up / down)
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
      ai_score:   scoreMap[p.id] ?? null,
      _count:     countMap[p.id] ?? { views: 0, saves: 0, reports: 0 },
      _votes:     voteMap[p.id]  ?? { up: 0, down: 0 },
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
