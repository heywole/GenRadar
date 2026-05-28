import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export async function POST(req: NextRequest) {
  const token = req.headers.get('Authorization')?.replace('Bearer ', '')
  if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { global: { headers: { Authorization: `Bearer ${token}` } }, auth: { persistSession: false } }
  )

  const { data: { user } } = await supabase.auth.getUser(token)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { project_id, vote_type } = await req.json()
  if (!project_id || !['up', 'down'].includes(vote_type)) {
    return NextResponse.json({ error: 'Invalid input' }, { status: 422 })
  }

  // Check existing vote
  const { data: existing } = await supabase
    .from('votes').select('id, vote_type').eq('project_id', project_id).eq('user_id', user.id).maybeSingle()

  if (existing) {
    if (existing.vote_type === vote_type) {
      // Remove vote (toggle off)
      await supabase.from('votes').delete().eq('id', existing.id)
      return NextResponse.json({ action: 'removed', vote_type })
    } else {
      // Switch vote
      await supabase.from('votes').update({ vote_type }).eq('id', existing.id)
      return NextResponse.json({ action: 'switched', vote_type })
    }
  }

  await supabase.from('votes').insert({ project_id, user_id: user.id, vote_type })
  return NextResponse.json({ action: 'added', vote_type })
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const project_id = searchParams.get('project_id')
  if (!project_id) return NextResponse.json({ error: 'Missing project_id' }, { status: 400 })

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { auth: { persistSession: false } }
  )

  const { data } = await supabase.from('votes').select('vote_type').eq('project_id', project_id)
  const up   = (data || []).filter(v => v.vote_type === 'up').length
  const down = (data || []).filter(v => v.vote_type === 'down').length

  return NextResponse.json({ up, down })
}
