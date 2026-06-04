import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { evaluateProject } from '@/lib/genlayerAI'

export const maxDuration = 300 // 5 minutes — requires Vercel Pro plan
export const dynamic = 'force-dynamic'

function cleanRisks(risks: string[], project: any): string[] {
  return risks.filter(risk => {
    const r = risk.toLowerCase()
    if (project.twitter_url  && (r.includes('twitter') || r.includes('x/twitter') || r.includes('x account'))) return false
    if (project.telegram_url && r.includes('telegram'))   return false
    if (project.discord_url  && r.includes('discord'))    return false
    if (project.github_url   && (r.includes('github') || r.includes('repository'))) return false
    if (project.docs_url     && (r.includes('documentation') || r.includes('docs'))) return false
    return true
  })
}

function cleanPositives(positives: string[], project: any): string[] {
  const result = [...positives]
  if (project.twitter_url  && !result.some(p => p.toLowerCase().includes('twitter')))  result.push('Twitter/X account is linked')
  if (project.github_url   && !result.some(p => p.toLowerCase().includes('github')))   result.push('Public GitHub repository is linked')
  if (project.telegram_url && !result.some(p => p.toLowerCase().includes('telegram'))) result.push('Telegram community is linked')
  if (project.discord_url  && !result.some(p => p.toLowerCase().includes('discord')))  result.push('Discord server is linked')
  return result.slice(0, 5)
}

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

  try {
    // Delete ALL old scores + set status — cards poll and will see null = evaluating
    await supabase.from('ai_scores').delete().eq('project_id', project.id)
    await supabase.from('projects').update({ evaluation_status: 'pending' }).eq('id', project.id)

    // Run evaluation
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

    const cleanedRisks     = cleanRisks(aiScore.risks || [], project)
    const cleanedPositives = cleanPositives(aiScore.positives || [], project)

    // Delete any placeholder, insert single final row
    await supabase.from('ai_scores').delete().eq('project_id', project.id)
    const { error: insertErr } = await supabase.from('ai_scores').insert({
      project_id:         project.id,
      score:              aiScore.score,
      risk:               aiScore.risk,
      confidence:         aiScore.confidence,
      positives:          cleanedPositives,
      risks:              cleanedRisks,
      findings:           aiScore.findings    || [],
      breakdown:          aiScore.breakdown   || null,
      explanation:        aiScore.explanation || null,
      tx_hash:            aiScore.tx_hash     || null,
      security_score:     aiScore.breakdown?.security     ?? null,
      transparency_score: aiScore.breakdown?.transparency ?? null,
      created_at:         new Date().toISOString(),
    })

    if (insertErr) return NextResponse.json({ error: insertErr.message }, { status: 500 })
    await supabase.from('projects').update({ evaluation_status: 'completed' }).eq('id', project.id)
    return NextResponse.json({ success: true, ai_score: { ...aiScore, risks: cleanedRisks, positives: cleanedPositives } })

  } catch (err: any) {
    await supabase.from('projects').update({ evaluation_status: 'failed' }).eq('id', project.id)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
