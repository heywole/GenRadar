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

  // Mark as processing immediately
  await supabase.from('projects')
    .update({ evaluation_status: 'processing' })
    .eq('id', project_id)

  // Return immediately — run evaluation in background (fire-and-forget)
  // Node.js keeps running after response is sent
  setImmediate(async () => {
    try {
      const { evaluateProject } = await import('@/lib/genlayerAI')

      const aiScore = await evaluateProject({
        name:         project.name,
        description:  project.description     ?? '',
        website_url:  project.website_url     ?? '',
        github_url:   project.github_url      ?? '',
        twitter_url:  project.twitter_url     ?? '',
        discord_url:  project.discord_url     ?? '',
        docs_url:     project.docs_url        ?? '',
        telegram_url: project.telegram_url    ?? '',
        category:     project.category        ?? '',
      }, project_id!)

      // Save score
      await supabase.from('ai_scores').delete().eq('project_id', project_id)
      await supabase.from('ai_scores').insert({
        project_id,
        score:              aiScore.score,
        security_score:     aiScore.breakdown?.security     ?? null,
        transparency_score: aiScore.breakdown?.transparency ?? null,
        risk:               aiScore.risk,
        confidence:         aiScore.confidence,
        positives:          aiScore.positives    ?? [],
        risks:              aiScore.risks         ?? [],
        findings:           aiScore.findings     ?? [],
        breakdown:          aiScore.breakdown    ?? null,
        explanation:        aiScore.explanation  ?? null,
        security_explanation:     (aiScore as any).security_explanation     ?? null,
        transparency_explanation: (aiScore as any).transparency_explanation ?? null,
        tx_hash:            aiScore.tx_hash      ?? null,
        created_at:         new Date().toISOString(),
      })

      await supabase.from('projects')
        .update({ evaluation_status: 'completed' })
        .eq('id', project_id)

      console.log(`[re-evaluate] done: ${project_id} score=${aiScore.score}`)
    } catch (err: any) {
      console.error(`[re-evaluate] failed: ${err.message}`)
      await supabase.from('projects')
        .update({ evaluation_status: 'failed' })
        .eq('id', project_id)
    }
  })

  return NextResponse.json({ success: true, message: 'Evaluation started' })
}
