import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { checkRateLimit } from '@/lib/rateLimit'

export async function POST(req: NextRequest) {
  const authHeader = req.headers.get('Authorization')
  const token = authHeader?.replace('Bearer ', '')

  if (!token) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { global: { headers: { Authorization: `Bearer ${token}` } }, auth: { persistSession: false } }
  )

  const { data: { user } } = await supabase.auth.getUser(token)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let body: any
  try { body = await req.json() }
  catch { return NextResponse.json({ error: 'Invalid body' }, { status: 400 }) }

  const { project_id, type } = body
  if (!project_id || !['view', 'save', 'report'].includes(type)) {
    return NextResponse.json({ error: 'Invalid input' }, { status: 422 })
  }

  if (type === 'report') {
    const { allowed } = checkRateLimit(`report:${user.id}:${project_id}`, 1, 24 * 60 * 60 * 1000)
    if (!allowed) return NextResponse.json({ error: 'Already reported' }, { status: 429 })
  }

  // Check if interaction already exists
  const { data: existing } = await supabase
    .from('interactions')
    .select('id')
    .eq('project_id', project_id)
    .eq('user_id', user.id)
    .eq('type', type)
    .maybeSingle()

  if (type === 'save' && existing) {
    // Toggle — remove bookmark
    await supabase.from('interactions').delete()
      .eq('project_id', project_id).eq('user_id', user.id).eq('type', 'save')
    return NextResponse.json({ success: true, action: 'removed' })
  }

  if (!existing) {
    await supabase.from('interactions').insert({ project_id, user_id: user.id, type })
  }

  // Auto-flag if 5+ reports
  if (type === 'report') {
    const { count } = await supabase
      .from('interactions').select('*', { count: 'exact', head: true })
      .eq('project_id', project_id).eq('type', 'report')
    if ((count ?? 0) >= 5) {
      await supabase.from('projects').update({ status: 'flagged' }).eq('id', project_id)
    }
  }

  return NextResponse.json({ success: true, action: 'added' })
}
