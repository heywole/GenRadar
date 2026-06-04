import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { submitProjectSchema } from '@/lib/validation'

export const maxDuration = 300
export const dynamic = 'force-dynamic'
import { checkRateLimit } from '@/lib/rateLimit'

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

  const { data: project, error: insertErr } = await supabase
    .from('projects')
    .insert({
      name:         p.name,
      description:  p.description,
      website_url:  p.website_url,
      github_url:   p.github_url   || null,
      twitter_url:  p.twitter_url  || null,
      discord_url:  p.discord_url  || null,
      telegram_url: (p as any).telegram_url || null,
      docs_url:     p.docs_url     || null,
      category:     p.category,
      logo_url:     p.logo_url     || null,
      created_by:   user.id,
      status:       'active',
      evaluation_status:   'pending',
      evaluation_attempts: 0,
    })
    .select().single()

  if (insertErr || !project) {
    console.error('[submit] insert error:', insertErr?.message)
    return NextResponse.json({ error: 'Failed to save project. Please try again.' }, { status: 500 })
  }

  runEvaluation(project, p, supabase).catch(e =>
    console.error('[submit] background eval error:', e.message)
  )

  return NextResponse.json({
    success: true,
    project,
    message: 'Project submitted! AI evaluation is running in the background.',
    remaining_submissions: remaining,
  }, { status: 201 })
}

async function runEvaluation(project: any, payload: any, supabase: any) {
  try {
    await supabase.from('projects').update({ evaluation_status: 'processing' }).eq('id', project.id)

    const { evaluateProject } = await import('@/lib/genlayerAI')
    const aiScore = await evaluateProject(payload, project.id)

    // Clean AI narrative — remove inaccurate social claims
    const cleanedRisks = (aiScore.risks || []).filter((r: string) => {
      const rl = r.toLowerCase()
      if (project.twitter_url  && (rl.includes('twitter') || rl.includes('x account'))) return false
      if (project.telegram_url && rl.includes('telegram'))  return false
      if (project.discord_url  && rl.includes('discord'))   return false
      if (project.github_url   && (rl.includes('github') || rl.includes('repository'))) return false
      if (project.docs_url     && (rl.includes('documentation') || rl.includes('docs'))) return false
      return true
    })
    const cleanedPositives = [...(aiScore.positives || [])]
    if (project.twitter_url  && !cleanedPositives.some((p: string) => p.toLowerCase().includes('twitter')))  cleanedPositives.push('Twitter/X account is linked')
    if (project.github_url   && !cleanedPositives.some((p: string) => p.toLowerCase().includes('github')))   cleanedPositives.push('Public GitHub repository is linked')
    if (project.telegram_url && !cleanedPositives.some((p: string) => p.toLowerCase().includes('telegram'))) cleanedPositives.push('Telegram community is linked')
    if (project.discord_url  && !cleanedPositives.some((p: string) => p.toLowerCase().includes('discord')))  cleanedPositives.push('Discord server is linked')

    await supabase.from('ai_scores').insert({
      project_id:         project.id,
      score:              aiScore.score,
      risk:               aiScore.risk,
      confidence:         aiScore.confidence,
      positives:          cleanedPositives.slice(0, 5),
      risks:              cleanedRisks.slice(0, 5),
      findings:           aiScore.findings        || [],
      breakdown:          aiScore.breakdown        || null,
      explanation:        aiScore.explanation      || null,
      tx_hash:            aiScore.tx_hash          || null,
      security_score:     aiScore.breakdown?.security     ?? null,
      transparency_score: aiScore.breakdown?.transparency ?? null,
      created_at:         new Date().toISOString(),
    })

    await supabase.from('projects').update({ evaluation_status: 'completed' }).eq('id', project.id)
    console.log(`[submit] eval complete for ${project.id}: score=${aiScore.score} tx=${aiScore.tx_hash ?? 'fallback'}`)
  } catch (e: any) {
    console.error('[submit] eval failed:', e.message)
    await supabase.from('projects').update({ evaluation_status: 'failed', evaluation_attempts: 1 }).eq('id', project.id)
  }
}
