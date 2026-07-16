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
    .from('projects').select('*').eq('id', project_id).single()
  if (!project) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  // Set processing — but DO NOT delete the old score
  // Old score stays visible in the card while new evaluation runs
  await supabase.from('projects')
    .update({ evaluation_status: 'processing' })
    .eq('id', project_id)

  // Return immediately — don't wait for GenLayer
  // The evaluation runs in background via the internal API call
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://genradar.xyz'

  // Kick off background evaluation by calling our own internal endpoint
  // This runs independently and won't be killed when this response returns
  fetch(`${baseUrl}/api/run-evaluation`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ project_id }),
  }).catch(() => {}) // fire and forget

  return NextResponse.json({ success: true, message: 'Evaluation started' })
}
