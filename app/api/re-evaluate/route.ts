import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { evaluateProject } from '@/lib/genlayerAI'

export async function POST(req: NextRequest) {
  let project_id: string | undefined
  try {
    const body = await req.json()
    project_id = body?.project_id
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }
  if (!project_id) return NextResponse.json({ error: 'Missing project_id' }, { status: 400 })

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { auth: { persistSession: false } }
  )

  const { data: project } = await supabase.from('projects').select('*').eq('id', project_id).single()
  if (!project) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  try {
    const aiScore = await evaluateProject({
      name:         project.name,
      description:  project.description,
      website_url:  project.website_url,
      github_url:   project.github_url   || '',
      twitter_url:  project.twitter_url  || '',
      discord_url:  project.discord_url  || '',
      docs_url:     project.docs_url     || '',
      telegram_url: project.telegram_url || '',
      category:     project.category,
    }, project.id)

    // Insert new row (don't upsert — keep history, API reads latest by created_at)
    await supabase.from('ai_scores').insert({
      project_id:         project.id,
      score:              aiScore.score,
      risk:               aiScore.risk,
      confidence:         aiScore.confidence,
      positives:          aiScore.positives,
      risks:              aiScore.risks,
      findings:           aiScore.findings    || [],
      breakdown:          aiScore.breakdown   || null,
      explanation:        (aiScore as any).explanation || null,
      security_score:     aiScore.breakdown?.security     ?? null,
      transparency_score: aiScore.breakdown?.transparency ?? null,
      created_at:         new Date().toISOString(),
    })

    return NextResponse.json({ success: true, ai_score: aiScore })
  } catch (err: any) {
    console.error('[re-evaluate] Error:', err.message)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
