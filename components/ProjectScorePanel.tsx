'use client'

import { useEffect, useRef, useState } from 'react'
import { ExternalLink } from 'lucide-react'
import { VoteButtons } from '@/components/VoteButtons'

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
function trustLabel(risk: string) {
  if (risk === 'Low')    return 'High'
  if (risk === 'Medium') return 'Moderate'
  return 'Low'
}

interface Props {
  projectId:          string
  initialScore:       any
  initialEvalStatus?: string | null
  onSeeMore?:         () => void
}

export function ProjectScorePanel({ projectId, initialScore, initialEvalStatus, onSeeMore }: Props) {
  const hasInitialScore = !!(initialScore && Number(initialScore.score) > 0)

  // Only show evaluating spinner if status is processing/pending AND no score yet
  const isInitiallyEvaluating = (
    (initialEvalStatus === 'processing' || initialEvalStatus === 'pending') && !hasInitialScore
  )

  const [score,      setScore]      = useState<any>(hasInitialScore ? initialScore : null)
  const [evaluating, setEvaluating] = useState(isInitiallyEvaluating)
  const evaluatingRef               = useRef(evaluating)
  evaluatingRef.current             = evaluating
  const timerRef                    = useRef<NodeJS.Timeout | null>(null)

  async function checkStatus() {
    try {
      const res  = await fetch(`/api/projects?id=${projectId}`)
      const d    = await res.json()
      const proj = (d.projects ?? [])[0]
      if (!proj) return

      const evStatus = proj.evaluation_status
      const row      = proj.ai_score
      const hasScore = !!(row && Number(row.score) > 0)

      if (hasScore) {
        // Always show score if we have one
        setScore(row)
        setEvaluating(false)
        stopPolling()
      } else if (evStatus === 'processing' || evStatus === 'pending') {
        setEvaluating(true)
      } else if (evStatus === 'failed') {
        setEvaluating(false)
        stopPolling()
      }
    } catch {}
  }

  function startPolling() {
    if (timerRef.current) return
    timerRef.current = setInterval(checkStatus, 4000)
  }

  function stopPolling() {
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null }
  }

  useEffect(() => {
    if (evaluating || !score) startPolling()

    function handleEvalStart(e: any) {
      if (e.detail?.projectId !== projectId) return
      // Only show evaluating if no score yet
      if (!score) setEvaluating(true)
      startPolling()
    }
    window.addEventListener('evaluation-started', handleEvalStart)
    return () => {
      stopPolling()
      window.removeEventListener('evaluation-started', handleEvalStart)
    }
  }, [projectId])

  const ai    = evaluating ? null : score
  const s     = ai ? Number(ai.score) : null
  const color = s !== null ? scoreColor(s) : 'var(--text-3)'
  const rc    = ai ? riskColors(ai.risk) : null
  const R = 30, circ = 2 * Math.PI * R
  const offset      = s !== null ? circ * (1 - s / 100) : circ
  const txHash      = ai?.tx_hash ?? null
  const explorerUrl = txHash
    ? `https://explorer-studio.genlayer.com/tx/${txHash}`
    : 'https://explorer-studio.genlayer.com/txs'

  if (!ai) {
    return (
      <div style={{ background: 'var(--bg-secondary)', borderRadius: 16, padding: '32px 20px', textAlign: 'center', border: '1px solid var(--border)' }}>
        <div style={{ width: 32, height: 32, border: '3px solid var(--brand)', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 1s linear infinite', margin: '0 auto 12px' }} />
        <p style={{ fontSize: 13, color: 'var(--text-2)', fontWeight: 600 }}>Undergoing AI Evaluation</p>
        <p style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 4 }}>GenLayer validators running...</p>
      </div>
    )
  }

  const briefPositives = (ai.positives ?? []).slice(0, 2)
  const briefRisks     = (ai.risks     ?? []).slice(0, 2)

  return (
    <div style={{ background: 'var(--bg-secondary)', borderRadius: 16, overflow: 'hidden', border: '1px solid var(--border)' }}>
      <div style={{ padding: '20px', textAlign: 'center', borderBottom: '1px solid var(--border)' }}>
        <p style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 14, fontFamily: 'var(--font-mono)' }}>AI Trust Score</p>
        <div style={{ position: 'relative', width: 80, height: 80, margin: '0 auto 14px' }}>
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
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, marginBottom: 8 }}>
            <span style={{ padding: '4px 12px', borderRadius: 999, fontSize: 12, fontWeight: 700, background: rc.bg, color: rc.c, border: `1px solid ${rc.bd}` }}>
              Trust: <strong>{trustLabel(ai.risk)}</strong>
            </span>
            <span style={{ padding: '4px 12px', borderRadius: 999, fontSize: 12, fontWeight: 700, background: rc.bg, color: rc.c, border: `1px solid ${rc.bd}` }}>
              Risk: <strong>{ai.risk}</strong>
            </span>
          </div>
        )}
        <p style={{ fontSize: 11, color: 'var(--text-3)', fontFamily: 'var(--font-mono)' }}>Confidence: {ai.confidence ?? 'Medium'}</p>
      </div>

      <div style={{ padding: '10px 14px', borderBottom: '1px solid var(--border)', background: 'var(--blue-bg)' }}>
        <a href={explorerUrl} target="_blank" rel="noopener noreferrer"
          style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 11, color: 'var(--blue)', textDecoration: 'none', fontFamily: 'var(--font-mono)' }}>
          <ExternalLink size={10} />
          {txHash ? `TX: ${txHash.slice(0, 10)}...${txHash.slice(-6)}` : 'View on GenLayer Explorer'}
        </a>
      </div>

      {briefPositives.length > 0 && (
        <div style={{ padding: '10px 14px', borderBottom: '1px solid var(--border)' }}>
          <p style={{ fontSize: 10, fontWeight: 700, color: 'var(--green)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 6, fontFamily: 'var(--font-mono)' }}>✓ Positive Signals</p>
          {briefPositives.map((pos: string, i: number) => (
            <div key={i} style={{ display: 'flex', gap: 6, fontSize: 11, color: 'var(--text-2)', marginBottom: 4, lineHeight: 1.5 }}>
              <span style={{ color: 'var(--green)', flexShrink: 0 }}>•</span>{pos}
            </div>
          ))}
        </div>
      )}

      {briefRisks.length > 0 && (
        <div style={{ padding: '10px 14px', borderBottom: '1px solid var(--border)' }}>
          <p style={{ fontSize: 10, fontWeight: 700, color: 'var(--red)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 6, fontFamily: 'var(--font-mono)' }}>⚠ Risk Signals</p>
          {briefRisks.map((r: string, i: number) => (
            <div key={i} style={{ display: 'flex', gap: 6, fontSize: 11, color: 'var(--text-2)', marginBottom: 4, lineHeight: 1.5 }}>
              <span style={{ color: 'var(--red)', flexShrink: 0 }}>•</span>{r}
            </div>
          ))}
        </div>
      )}

      {onSeeMore && (
        <div style={{ padding: '10px 14px', borderBottom: '1px solid var(--border)' }}>
          <button onClick={onSeeMore} style={{
            background: 'var(--brand-bg)', border: '1px solid var(--brand-bd)',
            color: 'var(--brand)', borderRadius: 8, padding: '7px 16px',
            fontSize: 12, fontWeight: 700, cursor: 'pointer', width: '100%',
          }}>
            See Full AI Evaluation →
          </button>
        </div>
      )}

      <div style={{ padding: '14px', background: 'var(--bg-card)' }}>
        <p style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 12, fontFamily: 'var(--font-mono)' }}>Community Trust</p>
        <VoteButtons projectId={projectId} />
      </div>
    </div>
  )
}
