import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { submitProjectSchema } from '@/lib/validation'
import { checkRateLimit } from '@/lib/rateLimit'

export const maxDuration = 60
export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  const token = req.headers.get('Authorization')?.replace('Bearer ', '')
  if (!token) return NextResponse.json({ error: 'Sign in to submit' }, { status: 401 })

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { global: { headers: { Authorization: `Bearer ${token}` } }, auth: { persistSession: false } }
  )

  const { data: { user } } = await supabase.auth.getUser(token)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { allowed, remaining } = checkRateLimit(`submit:${user.id}`, 5, 86400000)
  if (!allowed) return NextResponse.json({ error: 'Daily limit reached. Try again tomorrow.' }, { status: 429 })

  let body: unknown
  try { body = await req.json() }
  catch { return NextResponse.json({ error: 'Invalid request body' }, { status: 400 }) }

  const parsed = submitProjectSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: 'Validation failed', details: parsed.error.flatten().fieldErrors }, { status: 422 })

  const p = parsed.data

  const { data: existing } = await supabase.from('projects').select('id').eq('website_url', p.website_url).maybeSingle()
  if (existing) return NextResponse.json({ error: 'A project with this URL already exists.' }, { status: 409 })

  // Insert project as 'pending' — the database webhook will trigger the edge function
  const { data: project, error: insertErr } = await supabase
    .from('projects')
    .insert({
      name:                p.name,
      description:         p.description,
      website_url:         p.website_url,
      github_url:          p.github_url        || null,
      twitter_url:         p.twitter_url       || null,
      discord_url:         p.discord_url       || null,
      telegram_url:        (p as any).telegram_url || null,
      docs_url:            p.docs_url          || null,
      category:            p.category,
      logo_url:            p.logo_url          || null,
      created_by:          user.id,
      status:              'active',
      evaluation_status:   'pending',   // webhook fires on INSERT with this value
      evaluation_attempts: 0,
    })
    .select().single()

  if (insertErr || !project) {
    console.error('[submit] insert error:', insertErr?.message)
    return NextResponse.json({ error: 'Failed to save project. Please try again.' }, { status: 500 })
  }

  console.log(`[submit] project created: ${project.id} — webhook will trigger evaluation`)
  return NextResponse.json({
    success: true,
    project,
    message: 'Project submitted! AI evaluation starting...',
    remaining_submissions: remaining,
  }, { status: 201 })
}
