import { notFound } from 'next/navigation'
import Link from 'next/link'
import {
  ArrowLeft, ExternalLink, CheckCircle, XCircle,
  AlertTriangle, Github, Eye, MessageCircle,
  BookOpen, ChevronDown
} from 'lucide-react'
import { createClient } from '@supabase/supabase-js'
import { ProjectChat }        from '@/components/ProjectChat'
import { VoteButtons }        from '@/components/VoteButtons'
import { SaveButton }         from '@/components/SaveButton'
import { ProjectDetailClient } from '@/components/ProjectDetailClient'
import { ProjectTabs }        from '@/components/ProjectTabs'

async function getProject(id: string) {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { auth: { persistSession: false } }
  )
  const { data: project, error } = await supabase
    .from('projects').select('*').eq('id', id).eq('status', 'active').single()
  if (error || !project) return null

  const { data: scores } = await supabase.from('ai_scores').select('*').eq('project_id', id)
  const scoreRow = scores?.length
    ? scores.reduce((best, s) => Number(s.score) >= Number(best.score) ? s : best, scores[0])
    : null

  const { data: ints } = await supabase.from('interactions').select('type').eq('project_id', id)
  const counts = { views: 0, saves: 0 }
  for (const { type } of ints ?? []) {
    if (type === 'view') counts.views++
    if (type === 'save') counts.saves++
  }
  return { ...project, ai_score: scoreRow, _count: counts }
}

function riskColors(risk: string) {
  if (risk === 'Low')    return { c: 'var(--green)',  bg: 'var(--green-bg)',  bd: 'var(--green-bd)'  }
  if (risk === 'Medium') return { c: 'var(--yellow)', bg: 'var(--yellow-bg)', bd: 'var(--yellow-bd)' }
  return                        { c: 'var(--red)',    bg: 'var(--red-bg)',    bd: 'var(--red-bd)'    }
}

function scoreColor(s: number) {
  if (s >= 75) return 'var(--green)'
  if (s >= 50) return 'var(--yellow)'
  return 'var(--red)'
}

export const dynamic    = 'force-dynamic'
export const revalidate = 0

export default async function ProjectPage({ params }: { params: { id: string } }) {
  const project = await getProject(params.id)
  if (!project) notFound()

  const ai    = project.ai_score as any
  const score = ai ? Number(ai.score) : null
  const color = score !== null ? scoreColor(score) : 'var(--text-3)'
  const isVerified  = ai && score !== null && score >= 75 && ai.risk === 'Low'
  const rc          = ai ? riskColors(ai.risk) : null
  const txHash      = ai?.tx_hash ?? null
  const explorerUrl = txHash ? `https://studio.genlayer.com/transactions/${txHash}` : null

  const R = 30, circ = 2 * Math.PI * R
  const offset = score !== null ? circ * (1 - score / 100) : circ

  // Build the project details panel (server rendered)
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

      {/* RIGHT */}
      <div style={{ position: 'sticky', top: 20 }} className="proj-detail-sidebar">
        {ai ? (
          <div style={{ background: 'var(--bg-secondary)', borderRadius: 16, overflow: 'hidden', border: '1px solid var(--border)' }}>
            {/* Score */}
            <div style={{ padding: '20px', textAlign: 'center', borderBottom: '1px solid var(--border)' }}>
              <p style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 14, fontFamily: 'var(--font-mono)' }}>AI Trust Score</p>
              <div style={{ position: 'relative', width: 80, height: 80, margin: '0 auto 10px' }}>
                <svg width="80" height="80" style={{ transform: 'rotate(-90deg)' }}>
                  <circle cx="40" cy="40" r={R} fill="none" stroke="var(--bg-tertiary)" strokeWidth="5" />
                  <circle cx="40" cy="40" r={R} fill="none" stroke={color} strokeWidth="5"
                    strokeDasharray={circ} strokeDashoffset={offset} strokeLinecap="round" />
                </svg>
                <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
                  <span style={{ fontWeight: 900, fontSize: 24, color, letterSpacing: '-0.04em', lineHeight: 1 }}>{ai.score}</span>
                  <span style={{ fontSize: 9, color: 'var(--text-3)', fontFamily: 'var(--font-mono)' }}>/100</span>
                </div>
              </div>
              {rc && (
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, marginBottom: 4 }}>
                  <span style={{ padding: '2px 8px', borderRadius: 999, fontSize: 10, fontWeight: 600, background: rc.bg, color: rc.c, border: `1px solid ${rc.bd}` }}>
                    Trust: {ai.risk === 'Low' ? 'High' : ai.risk === 'Medium' ? 'Moderate' : 'Low'}
                  </span>
                  <span style={{ padding: '2px 8px', borderRadius: 999, fontSize: 10, fontWeight: 600, background: rc.bg, color: rc.c, border: `1px solid ${rc.bd}` }}>
                    {ai.risk} Risk
                  </span>
                </div>
              )}
              <p style={{ fontSize: 11, color: 'var(--text-3)', fontFamily: 'var(--font-mono)' }}>Confidence: {ai.confidence}</p>
            </div>

            {explorerUrl && (
              <div style={{ padding: '10px 14px', borderBottom: '1px solid var(--border)', background: 'var(--blue-bg)' }}>
                <a href={explorerUrl} target="_blank" rel="noopener noreferrer"
                  style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 11, color: 'var(--blue)', textDecoration: 'none', fontFamily: 'var(--font-mono)' }}>
                  <ExternalLink size={10} /> {txHash.slice(0, 10)}...{txHash.slice(-6)} → GenLayer
                </a>
              </div>
            )}

            {/* AI Explanation — collapsible */}
            {(ai.explanation || ai.findings?.[0]) && (
              <details open style={{ borderBottom: '1px solid var(--border)' }}>
                <summary style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '11px 14px', cursor: 'pointer', listStyle: 'none', fontSize: 10, fontWeight: 700, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.08em', fontFamily: 'var(--font-mono)' }}>
                  AI Explanation <ChevronDown size={11} style={{ marginLeft: 'auto' }} />
                </summary>
                <div style={{ padding: '2px 14px 12px' }}>
                  <p style={{ fontSize: 12, color: 'var(--text-2)', lineHeight: 1.7 }}>{ai.explanation || ai.findings?.[0]}</p>
                </div>
              </details>
            )}

            {/* Positive signals */}
            {Array.isArray(ai.positives) && ai.positives.length > 0 && (
              <details style={{ borderBottom: '1px solid var(--border)' }}>
                <summary style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '11px 14px', cursor: 'pointer', listStyle: 'none', fontSize: 10, fontWeight: 700, color: 'var(--green)', textTransform: 'uppercase', letterSpacing: '0.08em', fontFamily: 'var(--font-mono)' }}>
                  <CheckCircle size={10} color="var(--green)" /> Positive Signals <ChevronDown size={11} style={{ marginLeft: 'auto' }} />
                </summary>
                <div style={{ padding: '2px 14px 12px' }}>
                  {ai.positives.map((pos: string, i: number) => (
                    <div key={i} style={{ display: 'flex', gap: 8, fontSize: 12, color: 'var(--text-2)', marginBottom: 6, lineHeight: 1.55 }}>
                      <span style={{ width: 3, height: 3, borderRadius: '50%', background: 'var(--green)', flexShrink: 0, marginTop: 7 }} />
                      {pos}
                    </div>
                  ))}
                </div>
              </details>
            )}

            {/* Risk signals */}
            {Array.isArray(ai.risks) && ai.risks.length > 0 && (
              <details style={{ borderBottom: '1px solid var(--border)' }}>
                <summary style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '11px 14px', cursor: 'pointer', listStyle: 'none', fontSize: 10, fontWeight: 700, color: 'var(--red)', textTransform: 'uppercase', letterSpacing: '0.08em', fontFamily: 'var(--font-mono)' }}>
                  <XCircle size={10} color="var(--red)" /> Risk Signals <ChevronDown size={11} style={{ marginLeft: 'auto' }} />
                </summary>
                <div style={{ padding: '2px 14px 12px' }}>
                  {ai.risks.map((r: string, i: number) => (
                    <div key={i} style={{ display: 'flex', gap: 8, fontSize: 12, color: 'var(--text-2)', marginBottom: 6, lineHeight: 1.55 }}>
                      <span style={{ width: 3, height: 3, borderRadius: '50%', background: 'var(--red)', flexShrink: 0, marginTop: 7 }} />
                      {r}
                    </div>
                  ))}
                </div>
              </details>
            )}

            {/* Community vote — same style as community feedback, no colored border */}
            <div style={{ padding: '14px', background: 'var(--bg-card)', borderTop: '1px solid var(--border)' }}>
              <p style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 12, fontFamily: 'var(--font-mono)' }}>Community Trust</p>
              <VoteButtons projectId={project.id} />
            </div>
          </div>
        ) : (
          <div style={{ background: 'var(--bg-secondary)', borderRadius: 16, padding: '32px 20px', textAlign: 'center', border: '1px solid var(--border)' }}>
            <div style={{ width: 32, height: 32, border: '3px solid var(--brand)', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 1s linear infinite', margin: '0 auto 12px' }} />
            <p style={{ fontSize: 13, color: 'var(--text-2)', fontWeight: 600 }}>Undergoing AI Evaluation</p>
            <p style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 4 }}>Score will appear shortly...</p>
          </div>
        )}
      </div>
    </div>
  )

  return (
    <div style={{ maxWidth: 1100, margin: '0 auto', padding: '28px 20px 80px' }}>

      <Link href="/explore" style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 12, color: 'var(--text-3)', textDecoration: 'none', marginBottom: 18, fontFamily: 'var(--font-mono)' }}>
        <ArrowLeft size={12} /> back to projects
      </Link>

      <div style={{ display: 'flex', gap: 10, padding: '10px 14px', borderRadius: 9, marginBottom: 24, background: 'var(--yellow-bg)', fontSize: 13, color: 'var(--yellow)', lineHeight: 1.5 }}>
        <AlertTriangle size={14} style={{ flexShrink: 0, marginTop: 1 }} />
        <span><strong>Community-submitted.</strong> GenScout does not endorse any project. Always do your own research.</span>
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
            {/* Category pill first, then socials after it */}
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', marginBottom: 4 }}>
              <span style={{ padding: '2px 9px', borderRadius: 999, fontSize: 11, background: 'var(--bg-secondary)', color: 'var(--text-3)', fontFamily: 'var(--font-mono)' }}>{project.category}</span>
              {project.twitter_url  && <a href={project.twitter_url}  target="_blank" rel="noopener noreferrer" title="X / Twitter" style={{ display: 'flex', alignItems: 'center', color: 'var(--text-3)', textDecoration: 'none' }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.744l7.737-8.835L1.254 2.25H8.08l4.253 5.622 5.91-5.622zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>
              </a>}
              {project.github_url   && <a href={project.github_url}   target="_blank" rel="noopener noreferrer" title="GitHub" style={{ display: 'flex', alignItems: 'center', color: 'var(--text-3)', textDecoration: 'none' }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z"/></svg>
              </a>}
              {project.discord_url  && <a href={project.discord_url}  target="_blank" rel="noopener noreferrer" title="Discord" style={{ display: 'flex', alignItems: 'center', color: 'var(--text-3)', textDecoration: 'none' }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057c.002.022.014.043.03.056a19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028c.462-.63.874-1.295 1.226-1.994a.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03z"/></svg>
              </a>}
              {project.telegram_url && <a href={project.telegram_url} target="_blank" rel="noopener noreferrer" title="Telegram" style={{ display: 'flex', alignItems: 'center', color: 'var(--text-3)', textDecoration: 'none' }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.244-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z"/></svg>
              </a>}
              {project.docs_url && <a href={project.docs_url} target="_blank" rel="noopener noreferrer" title="Docs" style={{ display: 'flex', alignItems: 'center', color: 'var(--text-3)', textDecoration: 'none' }}>
                <BookOpen size={14} />
              </a>}
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

      {/* ── TABS: Project Details | Builder Profile ── */}
      <ProjectTabs
        projectDetailsPanel={projectDetailsPanel}
        builderId={project.created_by ?? ''}
      />
    </div>
  )
}
