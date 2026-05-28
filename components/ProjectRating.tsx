'use client'

import { useState } from 'react'
import { Star, Loader2 } from 'lucide-react'
import { supabase } from '@/lib/supabase'

interface Props {
  projectId:      string
  communityScore: number | null
  ratingCount:    number
}

export function ProjectRating({ projectId, communityScore, ratingCount }: Props) {
  const [hover,    setHover]    = useState(0)
  const [selected, setSelected] = useState(0)
  const [review,   setReview]   = useState('')
  const [loading,  setLoading]  = useState(false)
  const [done,     setDone]     = useState(false)
  const [error,    setError]    = useState('')

  async function handleRate(score: number) {
    setSelected(score)
  }

  async function handleSubmit() {
    if (!selected) { setError('Please select a star rating'); return }
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) { window.location.href = '/auth'; return }

    setLoading(true); setError('')
    const res = await fetch('/api/rate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session.access_token}` },
      body: JSON.stringify({ project_id: projectId, score: selected, review }),
    })
    if (res.ok) { setDone(true) }
    else { const d = await res.json(); setError(d.error || 'Failed to submit rating') }
    setLoading(false)
  }

  return (
    <div style={{ padding: '22px 24px', borderRadius: 10, background: 'var(--bg-card)', border: '1px solid var(--border-hi)' }}>
      <p style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 16, fontFamily: 'var(--font-mono)' }}>
        Rate This Project
      </p>

      {done ? (
        <p style={{ fontSize: 14, color: 'var(--green)', fontFamily: 'var(--font-mono)' }}>✅ Thanks for your rating!</p>
      ) : (
        <>
          <p style={{ fontSize: 13, color: 'var(--text-2)', marginBottom: 14, lineHeight: 1.6 }}>
            Have you tested this project? Your rating helps the community evaluate its trustworthiness.
          </p>

          {/* Stars */}
          <div style={{ display: 'flex', gap: 6, marginBottom: 14 }}>
            {[1,2,3,4,5].map(s => (
              <button key={s} onClick={() => handleRate(s)} onMouseEnter={() => setHover(s)} onMouseLeave={() => setHover(0)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 2 }}>
                <Star size={24} fill={(hover || selected) >= s ? 'var(--yellow)' : 'transparent'} color={(hover || selected) >= s ? 'var(--yellow)' : 'var(--text-3)'} />
              </button>
            ))}
            {selected > 0 && (
              <span style={{ fontSize: 12, color: 'var(--text-3)', marginLeft: 8, alignSelf: 'center', fontFamily: 'var(--font-mono)' }}>
                {['', 'Poor', 'Fair', 'Good', 'Great', 'Excellent'][selected]}
              </span>
            )}
          </div>

          {/* Optional review */}
          <textarea
            value={review}
            onChange={e => setReview(e.target.value)}
            placeholder="Optional: Share your experience with this project..."
            rows={3}
            style={{ width: '100%', padding: '10px 14px', background: 'var(--bg-secondary)', border: '1px solid var(--border-hi)', borderRadius: 6, color: 'var(--text-1)', fontSize: 13, fontFamily: 'var(--font-sans)', outline: 'none', resize: 'vertical', marginBottom: 12 }}
          />

          {error && <p style={{ fontSize: 12, color: 'var(--red)', marginBottom: 8 }}>{error}</p>}

          <button onClick={handleSubmit} disabled={loading} style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '9px 20px', background: 'var(--text-1)', color: 'var(--bg)', border: 'none', borderRadius: 6, cursor: loading ? 'not-allowed' : 'pointer', fontSize: 13, fontWeight: 600, fontFamily: 'var(--font-sans)', opacity: loading ? 0.7 : 1 }}>
            {loading ? <><Loader2 size={13} style={{ animation: 'spin 1s linear infinite' }} /> Submitting...</> : 'Submit Rating'}
          </button>
        </>
      )}
    </div>
  )
}
