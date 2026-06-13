import { notFound } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, ExternalLink, CheckCircle, AlertTriangle, BookOpen } from 'lucide-react'
import { createClient } from '@supabase/supabase-js'
import { ProjectChat }               from '@/components/ProjectChat'
import { SaveButton }                from '@/components/SaveButton'
import { ProjectDetailClient }       from '@/components/ProjectDetailClient'
import { ProjectTabs }               from '@/components/ProjectTabs'
import { ProjectPageAutoRefresh }    from '@/components/ProjectPageAutoRefresh'
import { ProjectScorePanelWrapper }  from '@/components/ProjectScorePanelWrapper'
import { AIEvaluationPanel }         from '@/components/AIEvaluationPanel'

async function getProject(id: string) {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { auth: { persistSession: false } }
  )
  const { data: project, error } = await supabase
    .from('projects').select('*').eq('id', id).eq('status', 'active').single()
  if (error || !project) return null

  // Always pick only the most recent score row
  const { data: scores } = await supabase
    .from('ai_scores').select('*').eq('project_id', id)
    .order('created_at', { ascending: false }).limit(1)
  const scoreRow = scores?.[0] ?? null

  const { data: ints } = await supabase
    .from('interactions').select('type').eq('project_id', id)
  const counts = { views: 0, saves: 0 }
  for (const { type } of ints ?? []) {
    if (type === 'view') counts.views++
    if (type === 'save') counts.saves++
  }
  return { ...project, ai_score: scoreRow, _count: counts }
}

export const dynamic    = 'force-dynamic'
export const revalidate = 0

export default async function ProjectPage({ params }: { params: { id: string } }) {
  const project = await getProject(params.id)
  if (!project) notFound()

  const scoreRow   = project.ai_score as any
  const hasScore   = !!(scoreRow && Number(scoreRow.score) > 0)
  const isVerified = hasScore && Number(scoreRow.score) >= 75 && scoreRow.risk === 'Low'

  const projectDetailsPanel = (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 290px', gap: 32, alignItems: 'start' }} className="proj-detail-grid">
      {/* LEFT */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 28 }}>
        <div>
          <p style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 12, fontFamily: 'var(--font-mono)' }}>About</p>
          <p style={{ fontSize: 15, color: 'var(--text-2)', lineHeight: 1.85 }}>{project.description}</p>
          <ProjectDetailClient projectId={project.id} initialViews={project._count.views} initialSaves={project._count.saves} />
        </div>
        <ProjectChat projectId={project.id} />
      </div>

      {/* RIGHT — score panel */}
      <div style={{ position: 'sticky', top: 20 }} className="proj-detail-sidebar">
        <ProjectScorePanelWrapper projectId={project.id} initialScore={scoreRow} />
      </div>
    </div>
  )

  const aiEvaluationPanel = <AIEvaluationPanel score={scoreRow} project={project} />

  return (
    <>
      <ProjectPageAutoRefresh hasScore={hasScore} projectId={project.id} />
      <div style={{ maxWidth: 1100, margin: '0 auto', padding: '28px 20px 80px' }}>

        <Link href="/explore" style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 12, color: 'var(--text-3)', textDecoration: 'none', marginBottom: 18, fontFamily: 'var(--font-mono)' }}>
          <ArrowLeft size={12} /> back to projects
        </Link>

        <div style={{ display: 'flex', gap: 10, padding: '10px 14px', borderRadius: 9, marginBottom: 24, background: 'var(--yellow-bg)', fontSize: 13, color: 'var(--yellow)', lineHeight: 1.5 }}>
          <AlertTriangle size={14} style={{ flexShrink: 0, marginTop: 1 }} />
          <span><strong>Community-submitted.</strong> GenRadar does not endorse any project. Always do your own research.</span>
        </div>

        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: 14, marginBottom: 28 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <div style={{ width: 64, height: 64, borderRadius: 14, background: 'var(--bg-secondary)', border: '1px solid var(--border)', overflow: 'hidden', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              {project.logo_url
                ? <img src={project.logo_url} alt={project.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                : <span style={{ fontWeight: 800, fontSize: 20, color: 'var(--text-3)' }}>{project.name.slice(0, 2).toUpperCase()}</span>
              }
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6, flexWrap: 'wrap' }}>
                <h1 style={{ fontWeight: 900, fontSize: 24, color: 'var(--text-1)', letterSpacing: '-0.03em', lineHeight: 1, margin: 0 }}>{project.name}</h1>
                {isVerified && (
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '2px 8px', borderRadius: 999, background: 'var(--green-bg)', border: '1px solid var(--green-bd)', fontSize: 10, fontWeight: 700, color: 'var(--green)', fontFamily: 'var(--font-mono)' }}>
                    <CheckCircle size={9} /> VERIFIED
                  </span>
                )}
              </div>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', marginBottom: 4 }}>
                <span style={{ padding: '2px 9px', borderRadius: 999, fontSize: 11, background: 'var(--bg-secondary)', color: 'var(--text-3)', fontFamily: 'var(--font-mono)' }}>{project.category}</span>
                {project.twitter_url  && <a href={project.twitter_url}  target="_blank" rel="noopener noreferrer" style={{ display: 'flex', alignItems: 'center', color: 'var(--text-3)', textDecoration: 'none' }}><svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.744l7.737-8.835L1.254 2.25H8.08l4.253 5.622 5.91-5.622zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg></a>}
                {project.github_url   && <a href={project.github_url}   target="_blank" rel="noopener noreferrer" style={{ display: 'flex', alignItems: 'center', color: 'var(--text-3)', textDecoration: 'none' }}><svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z"/></svg></a>}
                {project.discord_url  && <a href={project.discord_url}  target="_blank" rel="noopener noreferrer" style={{ display: 'flex', alignItems: 'center', color: 'var(--text-3)', textDecoration: 'none' }}><svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057c.002.022.014.043.03.056a19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028c.462-.63.874-1.295 1.226-1.994a.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03z"/></svg></a>}
                {project.telegram_url && <a href={project.telegram_url} target="_blank" rel="noopener noreferrer" style={{ display: 'flex', alignItems: 'center', color: 'var(--text-3)', textDecoration: 'none' }}><svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.244-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z"/></svg></a>}
                {project.docs_url     && <a href={project.docs_url}     target="_blank" rel="noopener noreferrer" style={{ display: 'flex', alignItems: 'center', color: 'var(--text-3)', textDecoration: 'none' }}><BookOpen size={14} /></a>}
              </div>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <a href={project.website_url} target="_blank" rel="noopener noreferrer"
              style={{ display: 'inline-flex', alignItems: 'center', gap: 7, padding: '10px 18px', borderRadius: 9, background: 'var(--brand)', color: '#fff', fontWeight: 700, fontSize: 13, textDecoration: 'none' }}>
              <ExternalLink size={13} /> Visit Website
            </a>
            <SaveButton projectId={project.id} />
          </div>
        </div>

        <ProjectTabs
          projectDetailsPanel={projectDetailsPanel}
          aiEvaluationPanel={aiEvaluationPanel}
          builderId={project.created_by ?? ''}
        />
      </div>
    </>
  )
}
