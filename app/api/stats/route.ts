import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export const dynamic = 'force-dynamic'

export async function GET() {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { auth: { persistSession: false } }
  )

  const [
    { count: projects },
    { count: evaluations },
    { data: usersData },
  ] = await Promise.all([
    supabase.from('projects').select('*', { count: 'exact', head: true }).eq('status', 'active'),
    supabase.from('ai_scores').select('*', { count: 'exact', head: true }),
    supabase.auth.admin.listUsers(),
  ])

  const users = (usersData as any)?.users?.length ?? 0

  return NextResponse.json({ users, projects: projects ?? 0, evaluations: evaluations ?? 0 })
}
