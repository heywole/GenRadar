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

  const { project_id, score, review } = await req.json()
  if (!project_id || !score || score < 1 || score > 5) {
    return NextResponse.json({ error: 'Invalid rating' }, { status: 422 })
  }

  await supabase.from('ratings').upsert(
    { project_id, user_id: user.id, score, review: review || null },
    { onConflict: 'project_id,user_id' }
  )

  // Update community score on project
  const { data: ratings } = await supabase
    .from('ratings').select('score').eq('project_id', project_id)

  if (ratings && ratings.length > 0) {
    const avg = ratings.reduce((sum: number, r: any) => sum + r.score, 0) / ratings.length
    await supabase.from('projects').update({
      community_score: Math.round(avg * 20), // convert 1-5 to 0-100
    }).eq('id', project_id)
  }

  return NextResponse.json({ success: true })
}
