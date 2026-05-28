'use client'

import { useState, useEffect } from 'react'
import { ThumbsUp, ThumbsDown, ChevronDown, ChevronUp } from 'lucide-react'
import { supabase } from '@/lib/supabase'

interface Props { projectId: string }

export function VoteButtons({ projectId }: Props) {
  const [up,          setUp]          = useState(0)
  const [down,        setDown]        = useState(0)
  const [userVote,    setUserVote]    = useState<'up' | 'down' | null>(null)
  const [loading,     setLoading]     = useState(false)
  const [showPrompt,  setShowPrompt]  = useState(false)
  const [feedback,    setFeedback]    = useState('')
  const [reports,     setReports]     = useState<string[]>([])
  const [showReports, setShowReports] = useState(false)

  // Always fetch fresh counts from DB on mount and after actions
  async function fetchVotes() {
    try {
      // Fetch aggregate counts from API (reads from votes table in DB)
      const res  = await fetch(`/api/vote?project_id=${projectId}&t=${Date.now()}`)
      const data = await res.json()
      setUp(data.up ?? 0)
      setDown(data.down ?? 0)

      // Fetch report messages
      const { data: msgs } = await supabase
        .from('messages')
        .select('content, created_at')
        .eq('project_id', projectId)
        .like('content', '⚠️ Downvote feedback:%')
        .order('created_at', { ascending: false })
      setReports((msgs ?? []).map((m: any) => m.content.replace('⚠️ Downvote feedback: ', '')))

      // Fetch THIS user's vote from DB directly
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) { setUserVote(null); return }
      const { data: v } = await supabase
        .from('votes')
        .select('vote_type')
        .eq('project_id', projectId)
        .eq('user_id', session.user.id)
        .maybeSingle()
      setUserVote(v?.vote_type ?? null)
    } catch (e) {
      console.error('[VoteButtons] fetchVotes error', e)
    }
  }

  useEffect(() => { fetchVotes() }, [projectId])

  async function handleVote(type: 'up' | 'down') {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) { window.location.href = '/auth'; return }
    if (type === 'down' && userVote !== 'down') { setShowPrompt(true); return }
    await submitVote(type)
  }

  async function submitVote(type: 'up' | 'down') {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) return
    setLoading(true)
    try {
      await fetch('/api/vote', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({ project_id: projectId, vote_type: type }),
      })
      // Always re-fetch from DB to get true persisted state
      await fetchVotes()
    } catch (e) {
      console.error('[VoteButtons] submitVote error', e)
    }
    setLoading(false)
  }

  async function handleReportSubmit() {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) return
    if (feedback.trim()) {
      await fetch('/api/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({ project_id: projectId, content: `⚠️ Downvote feedback: ${feedback.trim()}` }),
      })
    }
    await submitVote('down')
    setShowPrompt(false)
    setFeedback('')
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {/* Trust / Report buttons */}
      <div style={{ display: 'flex', gap: 8 }}>
        <button onClick={() => handleVote('up')} disabled={loading} style={{
          flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7,
          padding: '9px', borderRadius: 8, cursor: loading ? 'not-allowed' : 'pointer', fontSize: 13, fontWeight: 600,
          border: `1px solid ${userVote === 'up' ? 'var(--green-bd)' : 'var(--border-hi)'}`,
          background: userVote === 'up' ? 'var(--green-bg)' : 'transparent',
          color: userVote === 'up' ? 'var(--green)' : 'var(--text-2)', transition: 'all 0.15s',
          opacity: loading ? 0.6 : 1,
        }}>
          <ThumbsUp size={13} /> {up} Trust
        </button>
        <button onClick={() => handleVote('down')} disabled={loading} style={{
          flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7,
          padding: '9px', borderRadius: 8, cursor: loading ? 'not-allowed' : 'pointer', fontSize: 13, fontWeight: 600,
          border: `1px solid ${userVote === 'down' ? 'var(--red-bd)' : 'var(--border-hi)'}`,
          background: userVote === 'down' ? 'var(--red-bg)' : 'transparent',
          color: userVote === 'down' ? 'var(--red)' : 'var(--text-2)', transition: 'all 0.15s',
          opacity: loading ? 0.6 : 1,
        }}>
          <ThumbsDown size={13} /> {down} Report
        </button>
      </div>

      {/* Report feedback prompt */}
      {showPrompt && (
        <div style={{ padding: '12px', borderRadius: 10, background: 'var(--bg-secondary)', border: '1px solid var(--border-hi)' }}>
          <p style={{ fontSize: 12, color: 'var(--text-2)', marginBottom: 8, lineHeight: 1.5 }}>
            Why are you reporting this project?
          </p>
          <textarea value={feedback} onChange={e => setFeedback(e.target.value)}
            placeholder="e.g. Phishing site, fake project, wallet drainer..."
            rows={3}
            style={{ width: '100%', padding: '8px 10px', background: 'var(--bg-card)', border: '1px solid var(--border-hi)', borderRadius: 7, color: 'var(--text-1)', fontSize: 12, fontFamily: 'var(--font-sans)', outline: 'none', resize: 'none', boxSizing: 'border-box' }} />
          <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
            <button onClick={() => { setShowPrompt(false); setFeedback('') }}
              style={{ flex: 1, padding: '7px', border: '1px solid var(--border-hi)', background: 'transparent', color: 'var(--text-2)', borderRadius: 7, cursor: 'pointer', fontSize: 12 }}>
              Cancel
            </button>
            <button onClick={handleReportSubmit}
              style={{ flex: 1, padding: '7px', background: 'var(--red)', color: '#fff', border: 'none', borderRadius: 7, cursor: 'pointer', fontSize: 12, fontWeight: 600 }}>
              Submit Report
            </button>
          </div>
        </div>
      )}

      {/* Community reports */}
      {reports.length > 0 && (
        <div style={{ borderRadius: 10, overflow: 'hidden', border: '1px solid var(--red-bd)', background: 'var(--red-bg)' }}>
          <button onClick={() => setShowReports(!showReports)} style={{
            width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            padding: '10px 12px', background: 'transparent', border: 'none',
            cursor: 'pointer', fontSize: 12, fontWeight: 600, color: 'var(--red)',
          }}>
            <span>⚠️ {reports.length} community report{reports.length !== 1 ? 's' : ''}</span>
            {reports.length >= 2
              ? (showReports ? <ChevronUp size={13} /> : <ChevronDown size={13} />)
              : null
            }
          </button>
          {(showReports || reports.length === 1) && (
            <div style={{ padding: '0 12px 10px', display: 'flex', flexDirection: 'column', gap: 6 }}>
              {reports.map((r, i) => (
                <p key={i} style={{ fontSize: 12, color: 'var(--text-2)', lineHeight: 1.5, paddingTop: 6, borderTop: i > 0 ? '1px solid var(--red-bd)' : 'none' }}>
                  "{r}"
                </p>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
