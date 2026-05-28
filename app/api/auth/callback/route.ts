import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(req: NextRequest) {
  const { searchParams, origin } = new URL(req.url)
  const code  = searchParams.get('code')
  const error = searchParams.get('error')

  if (error) {
    return NextResponse.redirect(`${origin}/auth?message=${encodeURIComponent(error)}`)
  }

  if (code) {
    const supabase = createRouteHandlerClient({ cookies })
    const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code)
    if (!exchangeError) {
      return NextResponse.redirect(`${origin}/`)
    }
    return NextResponse.redirect(`${origin}/auth?message=${encodeURIComponent(exchangeError.message)}`)
  }

  return NextResponse.redirect(`${origin}/`)
}
