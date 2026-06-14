import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export const maxDuration = 60
export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  let project_id: string | undefined
  try { project_id = (await req.json())?.project_id } catch {}
  if (!project_id) return NextResponse.json({ error: 'Missing project_id' }, { status: 400 })

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { auth: { persistSession: false } }
  )

  const { data: project } = await supabase
    .from('projects').select('id').eq('id', project_id).single()
  if (!project) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  // Set to 'pending' — this triggers the database webhook which calls the edge function
  // The edge function does the actual GenLayer evaluation
  const { error } = await supabase
    .from('projects')
    .update({ evaluation_status: 'pending' })
    .eq('id', project_id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  console.log(`[re-evaluate] set pending for ${project_id} — webhook will trigger edge function`)
  return NextResponse.json({ success: true, message: 'Evaluation queued' })
}
