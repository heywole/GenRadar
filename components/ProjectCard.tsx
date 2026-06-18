'use client'

import { useRouter } from 'next/navigation'
import { Eye, Bookmark, Loader2, Shield, AlertTriangle, CheckCircle, ThumbsUp } from 'lucide-react'
import { useState, useEffect, useRef } from 'react'
import { supabase } from '@/lib/supabase'
import { isEvaluating, clearEvaluating } from '@/lib/evaluatingState'
import type { Project } from '@/types'

function XIcon()        { return <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.744l7.737-8.835L1.254 2.25H8.08l4.253 5.622 5.91-5.622zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg> }
function GithubIcon()   { return <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z"/></svg> }
function DiscordIcon()  { return <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor"><path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057c.002.022.014.043.03.056a19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028c.462-.63.874-1.295 1.226-1.994a.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03z"/></svg> }
function TelegramIcon() { return <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor"><path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.244-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z"/></svg> }

function scoreColor(s: number) {
  if (s >= 75) return { main: '#22C55E', bg: 'rgba(34,197,94,0.08)', track: 'rgba(34,197,94,0.15)' }
  if (s >= 50) return { main: '#D97706', bg: 'rgba(217,119,6,0.08)',  track: 'rgba(217,119,6,0.15)'  }
  return              { main: '#EF4444', bg: 'rgba(239,68,68,0.08)',  track: 'rgba(239,68,68,0.15)'  }
}

function CircleScore({ score }: { score: number }) {
  const { main, track } = scoreColor(score)
  const r = 22, circ = 2 * Math.PI * r
  return (
    <div style={{ position: 'relative', width: 56, height: 56, flexShrink: 0 }}>
      <svg width="56" height="56" style={{ transform: 'rotate(-90deg)' }}>
        <circle cx="28" cy="28" r={r} fill="none" stroke={track} strokeWidth="4" />
        <circle cx="28" cy="28" r={r} fill="none" stroke={main} strokeWidth="4"
          strokeDasharray={circ} strokeDashoffset={circ * (1 - score / 100)} strokeLinecap="round" />
      </svg>
      <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
        <span style={{ fontWeight: 800, fontSize: 14, color: main, lineHeight: 1 }}>{score}</span>
        <span style={{ fontSize: 7, color: 'var(--text-3)', marginTop: 1 }}>/100</span>
      </div>
    </div>
  )
}

interface Props {
  project: Project
  showEditControls?: boolean
  onEdit?: (p: Project) => void
  onDelete?: (p: Project) => void
}

export function ProjectCard({ project, showEditControls, onEdit, onDelete }: Props) {
  const router   = useRouter()
  const timerRef = useRef<NodeJS.Timeout | null>(null)
  const initialTxHash = useRef<string | null>(project.ai_score?.tx_hash ?? null)

  const [liveScore, setLiveScore] = useState<any>(() => {
    const s = project.ai_score
    return (s && Number(s.score) > 0) ? s : null
  })
  const [liveViews, setLiveViews] = useState<number>(project._count?.views ?? 0)
  const [liveSaves, setLiveSaves] = useState<number>(project._count?.saves ?? 0)
  const [upvotes,   setUpvotes]   = useState<number>((project as any)._votes?.up ?? 0)
  const [saved,     setSaved]     = useState(false)
  const [hov,       setHov]       = useState(false)
  const [evaluating, setEvaluating] = useState(() => isEvaluating(project.id))
  const evaluatingRef = useRef(evaluating)
  evaluatingRef.current = evaluating

  const ai     = evaluating ? null : liveScore
  const colors = ai ? scoreColor(Number(ai.score)) : null
  const isVerified = ai && Number(ai.score) >= 75 && ai.risk === 'Low'
  const tw = (project as any).twitter_url
  const gh = (project as any).github_url || project.github_url
  const dc = (project as any).discord_url
  const tg = (project as any).telegram_url

  async function fetchData() {
    try {
      // Fetch project + score from API (includes evaluation_status)
      const res = await fetch(`/api/projects?id=${project.id}`)
      const d   = await res.json()
      const found = (d.projects ?? [])[0] ?? null

      if (found) {
        const evStatus = found.evaluation_status
        const scoreRow = found.ai_score
        const score    = scoreRow && Number(scoreRow.score) > 0 ? scoreRow : null

        // Status always wins over a possibly-stale score. Previously a
        // leftover score from before a re-evaluation could make this think
        // the (stale) result was final while GenLayer was still working —
        // that's what caused the card to flicker between "evaluating" and
        // an old score. Now: still processing/pending → always evaluating.
        if (evStatus === 'processing' || evStatus === 'pending') {
          setEvaluating(true)
        } else {
          setEvaluating(false)
          clearEvaluating(project.id)
        }

        setLiveScore(score)
        setLiveViews(found._count?.views ?? liveViews)
        setLiveSaves(found._count?.saves ?? liveSaves)
        setUpvotes(found._votes?.up ?? upvotes)
        return !!score
      }
      return false
    } catch {
      return false
    }
  }

  function startPolling() {
    if (timerRef.current) return // already polling
    timerRef.current = setInterval(async () => {
      await fetchData()
      // Stop polling once evaluation_status = completed (fetchData handles that)
      if (!evaluatingRef.current) stopPolling()
    }, 4000)
  }

  function stopPolling() {
    if (timerRef.current) {
      clearInterval(timerRef.current)
      timerRef.current = null
    }
  }

  useEffect(() => {
    // Fetch immediately on mount
    fetchData().then(() => {
      // fetchData sets evaluatingRef if DB shows processing/pending
      // startPolling if already evaluating or no score yet
      if (evaluatingRef.current || !liveScore) startPolling()
    })

    // Listen for evaluation-started events (from re-evaluate button / admin bulk actions)
    function handleEvalStart(e: any) {
      if (e.detail?.projectId !== project.id) return
      setEvaluating(true)
      startPolling()
    }
    window.addEventListener('evaluation-started', handleEvalStart)

    // Page-level refresh event from explore/home page
    function handleRefresh(e: any) {
      const found = (e.detail?.projects || []).find((p: any) => p.id === project.id)
      if (!found) return
      const score = found.ai_score && Number(found.ai_score.score) > 0 ? found.ai_score : null
      const evStatus = found.evaluation_status

      if (evStatus === 'processing' || evStatus === 'pending') {
        setEvaluating(true)
        startPolling()
      } else if (evStatus === 'completed' && evaluatingRef.current) {
        setEvaluating(false)
        clearEvaluating(project.id)
      }

      setLiveScore(score)
      setLiveViews(found._count?.views ?? 0)
      setLiveSaves(found._count?.saves ?? 0)
      setUpvotes(found._votes?.up ?? 0)
    }

    function handleVoteUpdate(e: any) {
      if (e.detail?.projectId !== project.id) return
      fetchData()
    }

    window.addEventListener('projects-refreshed', handleRefresh)
    window.addEventListener('vote-updated', handleVoteUpdate)
    return () => {
      stopPolling()
      window.removeEventListener('projects-refreshed', handleRefresh)
      window.removeEventListener('vote-updated', handleVoteUpdate)
      window.removeEventListener('evaluation-started', handleEvalStart)
    }
  }, [project.id])

  async function handleSave(e: React.MouseEvent) {
    e.stopPropagation()
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) { window.location.href = '/auth'; return }
    const res  = await fetch('/api/interact', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
      body: JSON.stringify({ project_id: project.id, type: 'save' }),
    })
    const data = await res.json()
    const added = data.action === 'added'
    setSaved(added)
    setLiveSaves(s => added ? s + 1 : Math.max(0, s - 1))
  }

  return (
    <div
      onClick={() => router.push(`/project/${project.id}`)}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        background: 'var(--bg-card)',
        border: `1px solid ${hov ? 'var(--border-hi)' : 'var(--border)'}`,
        borderRadius: 16, overflow: 'hidden', cursor: 'pointer',
        transform: hov ? 'translateY(-2px)' : 'none',
        boxShadow: hov ? '0 8px 24px rgba(0,0,0,0.07)' : 'none',
        transition: 'all 0.15s',
      }}
    >
      <div style={{ padding: '16px' }}>
        {/* Header */}
        <div style={{ display: 'flex', gap: 12, marginBottom: 12 }}>
          <div style={{ width: 56, height: 56, borderRadius: 12, flexShrink: 0, background: 'var(--bg-secondary)', border: '1px solid var(--border)', overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            {project.logo_url
              ? <img src={project.logo_url} alt={project.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} onError={e => { (e.target as HTMLImageElement).style.display = 'none' }} />
              : <span style={{ fontWeight: 800, fontSize: 15, color: 'var(--text-2)' }}>{project.name.slice(0, 2).toUpperCase()}</span>
            }
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2, flexWrap: 'wrap' }}>
              <h3 style={{ fontWeight: 700, fontSize: 14, letterSpacing: '-0.01em', color: 'var(--text-1)', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{project.name}</h3>
              {isVerified && (
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3, padding: '2px 7px', borderRadius: 999, background: 'rgba(34,197,94,0.1)', border: '1px solid rgba(34,197,94,0.3)', flexShrink: 0 }}>
                  <CheckCircle size={8} color="#22C55E" />
                  <span style={{ fontSize: 9, fontWeight: 700, color: '#22C55E', fontFamily: 'var(--font-mono)' }}>VERIFIED</span>
                </span>
              )}
            </div>
            <span style={{ fontSize: 11, color: 'var(--text-3)', fontFamily: 'var(--font-mono)', display: 'block', marginBottom: 4 }}>{project.category}</span>
            <p style={{ fontSize: 12, color: 'var(--text-2)', lineHeight: 1.55, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden', margin: 0 }}>{project.description}</p>
          </div>
        </div>

        {/* AI Score */}
        {ai && colors ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 12px', background: colors.bg, borderRadius: 12, marginBottom: 12 }}>
            <CircleScore score={Number(ai.score)} />
            <div style={{ width: 1, height: 36, background: 'rgba(0,0,0,0.08)', flexShrink: 0 }} />
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 10, color: 'var(--text-3)', fontFamily: 'var(--font-mono)', marginBottom: 5 }}>AI Score</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: 3, fontSize: 13, fontWeight: 600, color: 'var(--text-2)' }}>
                  <Shield size={11} color={colors.main} />
                  Trust: <strong style={{ color: colors.main, marginLeft: 2 }}>{Number(ai.score) >= 75 ? 'High' : Number(ai.score) >= 50 ? 'Moderate' : 'Low'}</strong>
                </span>
                <span style={{ display: 'flex', alignItems: 'center', gap: 3, fontSize: 13, fontWeight: 600, color: 'var(--text-2)' }}>
                  <AlertTriangle size={11} color={colors.main} />
                  Risk: <strong style={{ color: colors.main, marginLeft: 2 }}>{ai.risk ?? 'Unknown'}</strong>
                </span>
              </div>
            </div>
          </div>
        ) : (
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', borderRadius: 12, background: 'var(--bg-secondary)', marginBottom: 12 }}>
            <Loader2 size={13} color="var(--brand)" style={{ animation: 'spin 1s linear infinite', flexShrink: 0 }} />
            <div>
              <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-2)', marginBottom: 1 }}>AI Evaluating</div>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--text-3)' }}>GenLayer validators running...</div>
            </div>
          </div>
        )}

        {/* Bottom row */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, flexWrap: 'wrap', padding: '8px 10px', background: 'var(--bg-secondary)', borderRadius: 10 }}>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '3px 8px', borderRadius: 999, background: 'var(--bg-tertiary)', fontSize: 11, color: 'var(--text-2)', fontFamily: 'var(--font-mono)' }}>
            <Eye size={11} /> {liveViews >= 1000 ? `${(liveViews/1000).toFixed(1)}K` : liveViews}
          </span>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '3px 8px', borderRadius: 999, background: 'var(--bg-tertiary)', fontSize: 11, color: 'var(--text-2)', fontFamily: 'var(--font-mono)' }}>
            <Bookmark size={11} /> {liveSaves}
          </span>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '3px 8px', borderRadius: 999, background: 'var(--bg-tertiary)', fontSize: 11, color: 'var(--text-2)', fontFamily: 'var(--font-mono)' }}>
            <ThumbsUp size={11} /> {upvotes}
          </span>
          {tw && <a href={tw} onClick={e => e.stopPropagation()} target="_blank" rel="noopener noreferrer" style={{ display: 'inline-flex', alignItems: 'center', padding: '3px 7px', borderRadius: 999, background: 'var(--bg-tertiary)', color: 'var(--text-2)', textDecoration: 'none' }}><XIcon /></a>}
          {gh && <a href={gh} onClick={e => e.stopPropagation()} target="_blank" rel="noopener noreferrer" style={{ display: 'inline-flex', alignItems: 'center', padding: '3px 7px', borderRadius: 999, background: 'var(--bg-tertiary)', color: 'var(--text-2)', textDecoration: 'none' }}><GithubIcon /></a>}
          {dc && <a href={dc} onClick={e => e.stopPropagation()} target="_blank" rel="noopener noreferrer" style={{ display: 'inline-flex', alignItems: 'center', padding: '3px 7px', borderRadius: 999, background: 'var(--bg-tertiary)', color: 'var(--text-2)', textDecoration: 'none' }}><DiscordIcon /></a>}
          {tg && <a href={tg} onClick={e => e.stopPropagation()} target="_blank" rel="noopener noreferrer" style={{ display: 'inline-flex', alignItems: 'center', padding: '3px 7px', borderRadius: 999, background: 'var(--bg-tertiary)', color: 'var(--text-2)', textDecoration: 'none' }}><TelegramIcon /></a>}
          <div style={{ width: 1, height: 14, background: 'var(--border-hi)' }} />
          <button onClick={handleSave} style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', padding: '3px 8px', borderRadius: 999, border: '1px solid var(--border-hi)', background: saved ? 'rgba(34,197,94,0.1)' : 'transparent', color: saved ? '#22C55E' : 'var(--text-3)', cursor: 'pointer', transition: 'all 0.15s' }}>
            <Bookmark size={11} fill={saved ? 'currentColor' : 'none'} />
          </button>
          {showEditControls && (
            <>
              <div style={{ width: 1, height: 14, background: 'var(--border-hi)' }} />
              <button onClick={e => { e.stopPropagation(); onEdit?.(project) }} style={{ padding: '3px 9px', borderRadius: 999, border: '1px solid var(--border-hi)', background: 'transparent', color: 'var(--text-2)', cursor: 'pointer', fontSize: 11 }}>Edit</button>
              <button onClick={e => { e.stopPropagation(); onDelete?.(project) }} style={{ padding: '3px 9px', borderRadius: 999, border: '1px solid var(--red-bd)', background: 'var(--red-bg)', color: 'var(--red)', cursor: 'pointer', fontSize: 11 }}>Delete</button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
