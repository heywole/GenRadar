import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const user_id = searchParams.get('user_id')
  if (!user_id) return NextResponse.json({ error: 'Missing user_id' }, { status: 400 })

  // Same client used by /api/builders, so the name shown here always
  // matches the name shown on the builders list — previously this route
  // returned the raw builder_profiles.name field with no fallback, while
  // the list page resolved a real name from GitHub metadata, so the two
  // pages disagreed whenever a builder never typed a name into the form.
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { auth: { persistSession: false } }
  )

  // Run profile + projects fetch in parallel
  const [{ data: profile }, { data: projects }] = await Promise.all([
    supabase.from('builder_profiles').select('*').eq('user_id', user_id).maybeSingle(),
    supabase.from('projects')
      .select('id, name, description, category, logo_url, website_url, github_url, twitter_url, status, created_at')
      .eq('created_by', user_id).eq('status', 'active')
      .order('created_at', { ascending: false }),
  ])

  const projectIds = (projects ?? []).map(p => p.id)

  // Run scores + interactions + messages in parallel
  const [{ data: scores }, { data: ints }, { data: msgs }] = await Promise.all([
    projectIds.length
      ? supabase.from('ai_scores').select('project_id, score').in('project_id', projectIds)
      : Promise.resolve({ data: [] }),
    projectIds.length
      ? supabase.from('interactions').select('project_id, type').in('project_id', projectIds)
      : Promise.resolve({ data: [] }),
    projectIds.length
      ? supabase.from('messages').select('project_id').in('project_id', projectIds)
      : Promise.resolve({ data: [] }),
  ])

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

  // Resolve a real display name and avatar the same way /api/builders does,
  // without touching profile.name/profile.avatar_url directly — those stay
  // exactly as stored, since the profile edit form on the profile page
  // pre-fills its inputs from those two fields and shouldn't suddenly see
  // a GitHub name in there that the builder never actually typed in.
  let displayName = profile?.name || null
  let displayAvatar = profile?.avatar_url || null
  if (!displayName || !displayAvatar) {
    const { data: authData } = await supabase.auth.admin.getUserById(user_id)
    const authUser = authData?.user
    displayName = displayName ||
      authUser?.user_metadata?.full_name ||
      authUser?.user_metadata?.name ||
      authUser?.user_metadata?.user_name ||
      authUser?.user_metadata?.preferred_username ||
      authUser?.email?.split('@')[0] ||
      'Builder'
    displayAvatar = displayAvatar ||
      authUser?.user_metadata?.avatar_url ||
      authUser?.user_metadata?.picture ||
      null
  }

  return NextResponse.json({
    profile: profile ? { ...profile, display_name: displayName, display_avatar_url: displayAvatar } : profile,
    projects: projectsWithScores,
    stats: { totalProjects: projectIds.length, totalViews, totalFeedback, avgScore },
    isVerified,
  })
}

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

  // Restored: a builder profile is only meaningful once someone has
  // actually submitted a project — without this, anyone could fill in a
  // profile with no project behind it at all.
  const { count: projectCount } = await supabase
    .from('projects')
    .select('id', { count: 'exact', head: true })
    .eq('created_by', user.id)
    .eq('status', 'active')

  if (!projectCount || projectCount < 1) {
    return NextResponse.json(
      { error: 'Submit a project first before setting up your builder profile.' },
      { status: 403 }
    )
  }

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
    avatar_url:   avatar_url   || user.user_metadata?.avatar_url || null,
    country:      country      || null,
    updated_at:   new Date().toISOString(),
  }, { onConflict: 'user_id' })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true, data })
}
