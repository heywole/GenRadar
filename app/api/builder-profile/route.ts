import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export const dynamic = 'force-dynamic'

// GET /api/builder-profile?user_id=xxx
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const user_id = searchParams.get('user_id')
  if (!user_id) return NextResponse.json({ error: 'Missing user_id' }, { status: 400 })

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { auth: { persistSession: false } }
  )

  const { data: profile } = await supabase
    .from('builder_profiles').select('*').eq('user_id', user_id).maybeSingle()

  const { data: projects } = await supabase
    .from('projects')
    .select('id, name, description, category, logo_url, website_url, github_url, twitter_url, status, created_at')
    .eq('created_by', user_id).eq('status', 'active')
    .order('created_at', { ascending: false })

  const projectIds = (projects ?? []).map(p => p.id)

  const { data: scores } = projectIds.length
    ? await supabase.from('ai_scores').select('project_id, score').in('project_id', projectIds)
    : { data: [] }

  const { data: ints } = projectIds.length
    ? await supabase.from('interactions').select('project_id, type').in('project_id', projectIds)
    : { data: [] }

  const { data: msgs } = projectIds.length
    ? await supabase.from('messages').select('project_id').in('project_id', projectIds)
    : { data: [] }

  const scoreMap: Record<string, number> = {}
  for (const s of scores ?? []) scoreMap[s.project_id] = s.score

  let totalViews = 0, totalFeedback = 0
  for (const i of ints ?? []) {
    if (i.type === 'view') totalViews++
    if (i.type === 'report') totalFeedback++
  }
  totalFeedback += (msgs ?? []).length

  const allScores = Object.values(scoreMap)
  const avgScore  = allScores.length ? Math.round(allScores.reduce((a, b) => a + b, 0) / allScores.length) : null
  const isVerified = !!(profile?.github_url && projectIds.length >= 1 && avgScore !== null && avgScore >= 70)

  const projectsWithScores = (projects ?? []).map(p => ({
    ...p,
    ai_score: scoreMap[p.id] ? { score: scoreMap[p.id] } : null,
    _count: { views: 0, saves: 0, reports: 0 },
  }))

  return NextResponse.json({
    profile,
    projects: projectsWithScores,
    stats: { totalProjects: projectIds.length, totalViews, totalFeedback, avgScore },
    isVerified,
  })
}

// POST /api/builder-profile — create or update
export async function POST(req: NextRequest) {
  const authHeader = req.headers.get('Authorization')
  if (!authHeader) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const token = authHeader.replace('Bearer ', '')
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { global: { headers: { Authorization: `Bearer ${token}` } }, auth: { persistSession: false } }
  )

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const { bio, twitter_url, telegram_url, github_url, discord_url, website_url, other_links, avatar_url, country } = body

  const { data, error } = await supabase.from('builder_profiles').upsert({
    user_id:      user.id,
    bio:          bio          || null,
    twitter_url:  twitter_url  || null,
    telegram_url: telegram_url || null,
    github_url:   github_url   || null,
    discord_url:  discord_url  || null,
    website_url:  website_url  || null,
    other_links:  other_links  || null,
    // Use the uploaded avatar URL from the request body (not GitHub avatar)
    avatar_url:   avatar_url   || user.user_metadata?.avatar_url || null,
    country:      country      || null,
    updated_at:   new Date().toISOString(),
  }, { onConflict: 'user_id' })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true, data })
}
