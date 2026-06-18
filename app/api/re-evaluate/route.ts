import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { startEvaluation } from '@/lib/runEvaluation'

export const maxDuration = 60
export const dynamic = 'force-dynamic'

const ADMIN_EMAILS = ['wolegold247@gmail.com']

export async function POST(req: NextRequest) {
  const token = req.headers.get('Authorization')?.replace('Bearer ', '')
  if (!token) return NextResponse.json({ error: 'Sign in to re-evaluate' }, { status: 401 })

  let project_id: string | undefined
  try {
    const body = await req.json()
    project_id = body?.project_id
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
  }
  if (!project_id) return NextResponse.json({ error: 'Missing project_id' }, { status: 400 })

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { global: { headers: { Authorization: `Bearer ${token}` } }, auth: { persistSession: false } }
  )

  const { data: { user } } = await supabase.auth.getUser(token)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: project } = await supabase.from('projects').select('id, created_by').eq('id', project_id).maybeSingle()
  if (!project) return NextResponse.json({ error: 'Project not found' }, { status: 404 })

  const isOwner = project.created_by === user.id
  const isAdmin = ADMIN_EMAILS.includes(user.email ?? '')
  if (!isOwner && !isAdmin) {
    return NextResponse.json({ error: 'You are not allowed to re-evaluate this project' }, { status: 403 })
  }

  const result = await startEvaluation(project_id)
  if ('error' in result) {
    return NextResponse.json({ error: result.error }, { status: 502 })
  }
  return NextResponse.json({ success: true, message: 'Submitted to GenLayer — waiting for validators.' })
}
