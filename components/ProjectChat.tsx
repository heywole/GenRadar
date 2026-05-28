'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { Send, Loader2, User } from 'lucide-react'
import { supabase } from '@/lib/supabase'

interface Message {
  id:          string
  user_name:   string
  user_avatar: string | null
  content:     string
  created_at:  string
}

export function ProjectChat({ projectId }: { projectId: string }) {
  const [messages, setMessages] = useState<Message[]>([])
  const [input,    setInput]    = useState('')
  const [loading,  setLoading]  = useState(false)
  const [fetching, setFetching] = useState(true)
  const bottomRef    = useRef<HTMLDivElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  const fetchMessages = useCallback(async () => {
    try {
      const res  = await fetch(`/api/messages?project_id=${projectId}&t=${Date.now()}`, {
        cache: 'no-store'
      })
      const data = await res.json()
      const msgs: Message[] = (data.messages || []).filter(
        (m: Message) => !m.content.startsWith('⚠️ Downvote feedback:')
      )
      setMessages(msgs)
    } catch {}
    setFetching(false)
  }, [projectId])

  useEffect(() => {
    fetchMessages()
    const id = setInterval(fetchMessages, 10000)  // poll every 10s
    return () => clearInterval(id)
  }, [fetchMessages])

  // Auto-scroll to bottom when messages arrive
  useEffect(() => {
    if (messages.length > 0) {
      setTimeout(() => {
        bottomRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
      }, 50)
    }
  }, [messages.length])

  async function handleSend(e: React.FormEvent) {
    e.preventDefault()
    const trimmed = input.trim()
    if (!trimmed || loading) return

    const { data: { session } } = await supabase.auth.getSession()
    if (!session) { window.location.href = '/auth'; return }

    setLoading(true)
    setInput('')

    // Optimistic: show message immediately so UI feels instant
    const tempId = `opt-${Date.now()}`
    const optimistic: Message = {
      id:          tempId,
      user_name:   session.user.user_metadata?.full_name || session.user.email?.split('@')[0] || 'You',
      user_avatar: session.user.user_metadata?.avatar_url || null,
      content:     trimmed,
      created_at:  new Date().toISOString(),
    }
    setMessages(prev => [...prev, optimistic])

    try {
      const res = await fetch('/api/messages', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
        body:    JSON.stringify({ project_id: projectId, content: trimmed }),
      })

      if (!res.ok) {
        // Remove optimistic message on server error
        setMessages(prev => prev.filter(m => m.id !== tempId))
        setInput(trimmed)
        setLoading(false)
        return
      }

      // Replace optimistic with real data from server
      const saved = await res.json()
      if (saved.message) {
        setMessages(prev => prev.map(m => m.id === tempId ? saved.message : m))
      } else {
        // Fallback: full refresh
        await fetchMessages()
      }
    } catch {
      // Network error: remove optimistic message and restore input
      setMessages(prev => prev.filter(m => m.id !== tempId))
      setInput(trimmed)
    }

    setLoading(false)
  }

  function shortName(name: string) {
    if (!name) return 'User'
    if (name.includes('@')) return name.split('@')[0]
    return name
  }

  return (
    <div style={{
      padding: '20px 22px', borderRadius: 10,
      background: 'var(--bg-card)', border: '1px solid var(--border-hi)'
    }}>
      <p style={{
        fontSize: 11, fontWeight: 700, color: 'var(--text-3)',
        textTransform: 'uppercase', letterSpacing: '0.07em',
        marginBottom: 16, fontFamily: 'var(--font-mono)'
      }}>
        Community Feedback
      </p>

      {/* Messages list */}
      <div
        ref={containerRef}
        style={{
          minHeight: 80, maxHeight: 300, overflowY: 'auto',
          display: 'flex', flexDirection: 'column', gap: 14,
          marginBottom: 16, paddingRight: 4,
        }}
      >
        {fetching ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: '20px 0' }}>
            <Loader2 size={16} style={{ animation: 'spin 1s linear infinite', color: 'var(--text-3)' }} />
          </div>
        ) : messages.length === 0 ? (
          <p style={{ fontSize: 13, color: 'var(--text-3)', textAlign: 'center', padding: '20px 0', fontFamily: 'var(--font-mono)' }}>
            No feedback yet. Be the first.
          </p>
        ) : messages.map(msg => (
          <div key={msg.id} style={{ display: 'flex', gap: 10, opacity: msg.id.startsWith('opt-') ? 0.7 : 1, transition: 'opacity 0.2s' }}>
            {/* Avatar */}
            <div style={{
              width: 30, height: 30, borderRadius: '50%',
              background: 'var(--bg-secondary)', border: '1px solid var(--border-hi)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              flexShrink: 0, overflow: 'hidden'
            }}>
              {msg.user_avatar
                ? <img src={msg.user_avatar} alt={msg.user_name}
                    style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                    onError={e => { (e.target as HTMLImageElement).style.display = 'none' }} />
                : <User size={12} color="var(--text-3)" />
              }
            </div>

            {/* Content */}
            <div style={{ flex: 1 }}>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 3 }}>
                <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--brand)' }}>
                  {shortName(msg.user_name)}
                </span>
                <span style={{ fontSize: 10, color: 'var(--text-3)', fontFamily: 'var(--font-mono)' }}>
                  {new Date(msg.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                </span>
              </div>
              <p style={{ fontSize: 13, color: 'var(--text-2)', lineHeight: 1.6, margin: 0 }}>
                {msg.content}
              </p>
            </div>
          </div>
        ))}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <form onSubmit={handleSend} style={{ display: 'flex', gap: 8 }}>
        <input
          value={input}
          onChange={e => setInput(e.target.value)}
          placeholder="Share your experience..."
          disabled={loading}
          style={{
            flex: 1, padding: '10px 14px',
            background: 'var(--bg-secondary)',
            border: '1px solid var(--border-hi)',
            borderRadius: 8, color: 'var(--text-1)',
            fontSize: 13, fontFamily: 'var(--font-sans)', outline: 'none'
          }}
        />
        <button
          type="submit"
          disabled={loading || !input.trim()}
          style={{
            padding: '10px 14px', background: loading || !input.trim() ? 'var(--bg-tertiary)' : 'var(--brand)',
            color: loading || !input.trim() ? 'var(--text-3)' : '#fff',
            border: 'none', borderRadius: 8,
            cursor: loading || !input.trim() ? 'not-allowed' : 'pointer',
            display: 'flex', alignItems: 'center', gap: 6,
            fontSize: 13, fontWeight: 600,
            transition: 'all 0.15s',
          }}
        >
          {loading
            ? <Loader2 size={13} style={{ animation: 'spin 1s linear infinite' }} />
            : <Send size={13} />
          }
        </button>
      </form>
    </div>
  )
}
