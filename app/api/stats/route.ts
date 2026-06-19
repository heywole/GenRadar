import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export const dynamic = 'force-dynamic'
export const revalidate = 0
export const fetchCache = 'force-no-store'

function noCacheJson(body: unknown) {
  const res = NextResponse.json(body)
  res.headers.set('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0')
  res.headers.set('CDN-Cache-Control', 'no-store')
  res.headers.set('Vercel-CDN-Cache-Control', 'no-store')
  res.headers.set('Pragma', 'no-cache')
  res.headers.set('Expires', '0')
  return res
}

export async function GET() {
  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      { auth: { persistSession: false } }
    )

    const [
      { count: projects },
      { count: evaluations },
      { data: usersData, error: usersError },
    ] = await Promise.all([
      supabase.from('projects').select('*', { count: 'exact', head: true }).eq('status', 'active'),
      supabase.from('projects').select('*', { count: 'exact', head: true })
        .eq('status', 'active')
        .eq('evaluation_status', 'completed'),
      supabase.auth.admin.listUsers({ perPage: 1000, page: 1 }),
    ])

    const users = usersError ? 0 : (usersData?.users?.length ?? 0)
    return noCacheJson({ users, projects: projects ?? 0, evaluations: evaluations ?? 0 })
  } catch (e) {
    console.error('[stats]', e)
    return noCacheJson({ users: 0, projects: 0, evaluations: 0 })
  }
}
