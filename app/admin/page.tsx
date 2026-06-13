'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import {
  ShieldCheck, RefreshCw, Trash2, CheckCircle, XCircle,
  AlertTriangle, Users, FolderOpen, Zap, MessageSquare,
  TrendingUp, Clock, ExternalLink, Search, ChevronDown
} from 'lucide-react'

const ADMIN_EMAILS = ['wolegold247@gmail.com']

function StatCard({ icon: Icon, label, value, color = 'var(--brand)' }: any) {
  return (
    <div style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)', borderRadius: 14, padding: '20px', display: 'flex', alignItems: 'center', gap: 14 }}>
      <div style={{ width: 44, height: 44, borderRadius: 12, background: 'var(--bg-tertiary)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
        <Icon size={20} color={color} />
      </div>
      <div>
        <div style={{ fontSize: 26, fontWeight: 900, color: 'var(--text-1)', letterSpacing: '-0.04em', lineHeight: 1 }}>{value ?? '—'}</div>
        <div style={{ fontSize: 12, color: 'var(--text-3)', marginTop: 3 }}>{label}</div>
      </div>
    </div>
  )
}

function Badge({ text, color, bg }: any) {
  return (
    <span style={{ padding: '3px 10px', borderRadius: 999, fontSize: 11, fontWeight: 600, background: bg, color, border: `1px solid ${color}22` }}>
      {text}
    </span>
  )
}

export default function AdminPage() {
  const router = useRouter()
  const [authed,    setAuthed]    = useState(false)
  const [loading,   setLoading]   = useState(true)
  const [data,      setData]      = useState<any>(null)
  const [token,     setToken]     = useState<string | null>(null)
  const [tab,       setTab]       = useState<'projects' | 'evaluations' | 'users'>('projects')
  const [search,    setSearch]    = useState('')
  const [filter,    setFilter]    = useState('all')
  const [acting,    setActing]    = useState<string | null>(null)
  const [msg,       setMsg]       = useState<{ type: 'success' | 'error'; text: string } | null>(null)
  const [selected,  setSelected]  = useState<Set<string>>(new Set())
  const [bulkBusy,  setBulkBusy]  = useState(false)
  const [bulkProgress, setBulkProgress] = useState<{ done: number; total: number } | null>(null)

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (!session || !ADMIN_EMAILS.includes(session.user.email ?? '')) {
        router.replace('/')
        return
      }
      setToken(session.access_token)
      setAuthed(true)
      await fetchData(session.access_token)
      setLoading(false)
    })
  }, [])

  const fetchData = useCallback(async (tk?: string) => {
    const t = tk || token
    if (!t) return
    try {
      const res = await fetch('/api/admin', {
        headers: { Authorization: `Bearer ${t}` }
      })
      const d = await res.json()
      setData(d)
    } catch {}
  }, [token])

  async function doAction(action: string, project_id: string, name: string) {
    if (!token) return
    const confirmMsg = action === 'delete'
      ? `Delete "${name}" permanently? This cannot be undone.`
      : action === 're-evaluate'
      ? `Force re-evaluate "${name}"?`
      : null
    if (confirmMsg && !window.confirm(confirmMsg)) return

    setActing(project_id + action)
    setMsg(null)
    try {
      const res = await fetch('/api/admin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ action, project_id }),
      })
      const d = await res.json()
      if (d.error) setMsg({ type: 'error', text: d.error })
      else {
        setMsg({ type: 'success', text: `${action} successful for "${name}"` })
        await fetchData()
      }
    } catch (e: any) {
      setMsg({ type: 'error', text: e.message })
    }
    setActing(null)
  }

  // Raw action call without confirm/message — used by bulk runner
  async function rawAction(action: string, project_id: string) {
    if (!token) return { error: 'No token' }
    try {
      const res = await fetch('/api/admin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ action, project_id }),
      })
      return await res.json()
    } catch (e: any) {
      return { error: e.message }
    }
  }

  function toggleSelect(id: string) {
    setSelected(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function toggleSelectAll() {
    setSelected(prev => {
      if (prev.size === filteredProjects.length) return new Set()
      return new Set(filteredProjects.map((p: any) => p.id))
    })
  }

  async function bulkReevaluate() {
    if (selected.size === 0) return
    if (!window.confirm(`Re-evaluate ${selected.size} selected project(s)? This runs one at a time and may take a while.`)) return
    setBulkBusy(true)
    setMsg(null)
    const ids = [...selected]
    setBulkProgress({ done: 0, total: ids.length })
    let okCount = 0, errCount = 0
    for (let i = 0; i < ids.length; i++) {
      const r = await rawAction('re-evaluate', ids[i])
      if (r?.error) errCount++; else okCount++
      setBulkProgress({ done: i + 1, total: ids.length })
      await fetchData()
    }
    setBulkBusy(false)
    setBulkProgress(null)
    setSelected(new Set())
    setMsg({ type: errCount ? 'error' : 'success', text: `Re-evaluated ${okCount} project(s)${errCount ? `, ${errCount} failed` : ''}.` })
  }

  async function bulkDelete() {
    if (selected.size === 0) return
    if (!window.confirm(`Permanently delete ${selected.size} selected project(s)? This cannot be undone.`)) return
    setBulkBusy(true)
    setMsg(null)
    const ids = [...selected]
    setBulkProgress({ done: 0, total: ids.length })
    let okCount = 0, errCount = 0
    for (let i = 0; i < ids.length; i++) {
      const r = await rawAction('delete', ids[i])
      if (r?.error) errCount++; else okCount++
      setBulkProgress({ done: i + 1, total: ids.length })
    }
    await fetchData()
    setBulkBusy(false)
    setBulkProgress(null)
    setSelected(new Set())
    setMsg({ type: errCount ? 'error' : 'success', text: `Deleted ${okCount} project(s)${errCount ? `, ${errCount} failed` : ''}.` })
  }

  async function reevaluateAll() {
    const ids = filteredProjects.map((p: any) => p.id)
    if (ids.length === 0) return
    if (!window.confirm(`Re-evaluate ALL ${ids.length} project(s) currently shown? This runs one at a time and may take a while.`)) return
    setBulkBusy(true)
    setMsg(null)
    setBulkProgress({ done: 0, total: ids.length })
    let okCount = 0, errCount = 0
    for (let i = 0; i < ids.length; i++) {
      const r = await rawAction('re-evaluate', ids[i])
      if (r?.error) errCount++; else okCount++
      setBulkProgress({ done: i + 1, total: ids.length })
      await fetchData()
    }
    setBulkBusy(false)
    setBulkProgress(null)
    setMsg({ type: errCount ? 'error' : 'success', text: `Re-evaluated ${okCount} project(s)${errCount ? `, ${errCount} failed` : ''}.` })
  }

  if (!authed || loading) {
    return (
      <div style={{ minHeight: '80vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ width: 32, height: 32, border: '3px solid var(--brand)', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
      </div>
    )
  }

  const { projects = [], stats = {}, recentScores = [] } = data || {}

  const filteredProjects = projects.filter((p: any) => {
    const matchSearch = !search || p.name?.toLowerCase().includes(search.toLowerCase())
    const matchFilter = filter === 'all' || (filter === 'evaluated' && p.ai_score) || (filter === 'pending' && !p.ai_score) || (filter === 'active' && p.status === 'active') || (filter === 'rejected' && p.status === 'rejected')
    return matchSearch && matchFilter
  })

  return (
    <div style={{ padding: '28px 24px', maxWidth: 1200, margin: '0 auto' }}>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 28 }}>
        <div style={{ width: 40, height: 40, borderRadius: 10, background: 'var(--brand-bg)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <ShieldCheck size={20} color="var(--brand)" />
        </div>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 900, color: 'var(--text-1)', margin: 0, letterSpacing: '-0.03em' }}>Admin Panel</h1>
          <p style={{ fontSize: 12, color: 'var(--text-3)', margin: 0 }}>GenRadar internal management</p>
        </div>
        <button onClick={() => fetchData()} style={{
          marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 6,
          padding: '8px 14px', borderRadius: 8, border: '1px solid var(--border)',
          background: 'var(--bg-secondary)', color: 'var(--text-2)', cursor: 'pointer', fontSize: 13,
        }}>
          <RefreshCw size={13} /> Refresh
        </button>
      </div>

      {/* Message */}
      {msg && (
        <div style={{
          padding: '12px 16px', borderRadius: 10, marginBottom: 20,
          background: msg.type === 'success' ? 'var(--green-bg)' : 'var(--red-bg)',
          border: `1px solid ${msg.type === 'success' ? 'var(--green-bd)' : 'var(--red-bd)'}`,
          color: msg.type === 'success' ? 'var(--green)' : 'var(--red)',
          fontSize: 13, display: 'flex', alignItems: 'center', gap: 8,
        }}>
          {msg.type === 'success' ? <CheckCircle size={14} /> : <AlertTriangle size={14} />}
          {msg.text}
        </div>
      )}

      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 14, marginBottom: 28 }}>
        <StatCard icon={FolderOpen}    label="Total Projects"   value={stats.totalProjects}  color="var(--brand)" />
        <StatCard icon={Zap}           label="Evaluated"        value={stats.totalEvaluated} color="var(--green)" />
        <StatCard icon={Clock}         label="Pending Eval"     value={stats.totalStuck}     color="var(--yellow)" />
        <StatCard icon={Users}         label="Builders"         value={stats.totalUsers}     color="var(--blue)" />
        <StatCard icon={MessageSquare} label="Messages"         value={stats.totalMessages}  color="var(--text-3)" />
        <StatCard icon={TrendingUp}    label="Avg Score"        value={stats.avgScore ? `${stats.avgScore}/100` : null} color="var(--brand)" />
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 4, borderBottom: '1px solid var(--border)', marginBottom: 20 }}>
        {(['projects', 'evaluations', 'users'] as const).map(t => (
          <button key={t} onClick={() => setTab(t)} style={{
            padding: '10px 18px', border: 'none', background: 'transparent', cursor: 'pointer',
            fontSize: 13, fontWeight: tab === t ? 700 : 400,
            color: tab === t ? 'var(--brand)' : 'var(--text-3)',
            borderBottom: tab === t ? '2px solid var(--brand)' : '2px solid transparent',
            marginBottom: -1, textTransform: 'capitalize',
          }}>
            {t}
          </button>
        ))}
      </div>

      {/* Projects Tab */}
      {tab === 'projects' && (
        <div>
          {/* Controls */}
          <div style={{ display: 'flex', gap: 10, marginBottom: 16, flexWrap: 'wrap' }}>
            <div style={{ position: 'relative', flex: 1, minWidth: 200 }}>
              <Search size={13} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-3)' }} />
              <input
                value={search} onChange={e => setSearch(e.target.value)}
                placeholder="Search projects..."
                style={{ width: '100%', padding: '8px 12px 8px 32px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg-secondary)', color: 'var(--text-1)', fontSize: 13, boxSizing: 'border-box' }}
              />
            </div>
            <select value={filter} onChange={e => setFilter(e.target.value)} style={{
              padding: '8px 12px', borderRadius: 8, border: '1px solid var(--border)',
              background: 'var(--bg-secondary)', color: 'var(--text-1)', fontSize: 13, cursor: 'pointer',
            }}>
              <option value="all">All ({projects.length})</option>
              <option value="evaluated">Evaluated ({stats.totalEvaluated})</option>
              <option value="pending">Pending ({stats.totalStuck})</option>
              <option value="active">Active</option>
              <option value="rejected">Rejected</option>
            </select>
          </div>

          {/* Bulk action toolbar */}
          <div style={{
            display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap',
            marginBottom: 14, padding: '10px 14px', borderRadius: 10,
            background: 'var(--bg-secondary)', border: '1px solid var(--border)',
          }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: 13, color: 'var(--text-2)', cursor: 'pointer', fontWeight: 600 }}>
              <input
                type="checkbox"
                checked={filteredProjects.length > 0 && selected.size === filteredProjects.length}
                onChange={toggleSelectAll}
                style={{ width: 15, height: 15, cursor: 'pointer' }}
              />
              {selected.size > 0 ? `${selected.size} selected` : 'Select all'}
            </label>

            <div style={{ flex: 1 }} />

            {bulkProgress && (
              <span style={{ fontSize: 12, color: 'var(--brand)', fontFamily: 'var(--font-mono)' }}>
                Processing {bulkProgress.done}/{bulkProgress.total}...
              </span>
            )}

            <button
              onClick={bulkReevaluate}
              disabled={selected.size === 0 || bulkBusy}
              style={{
                display: 'flex', alignItems: 'center', gap: 5,
                padding: '6px 12px', borderRadius: 8, border: '1px solid var(--brand-bd)',
                background: 'var(--brand-bg)', color: 'var(--brand)',
                cursor: (selected.size === 0 || bulkBusy) ? 'not-allowed' : 'pointer',
                fontSize: 12, fontWeight: 600,
                opacity: (selected.size === 0 || bulkBusy) ? 0.5 : 1,
              }}
            >
              <Zap size={12} /> Re-evaluate Selected
            </button>

            <button
              onClick={bulkDelete}
              disabled={selected.size === 0 || bulkBusy}
              style={{
                display: 'flex', alignItems: 'center', gap: 5,
                padding: '6px 12px', borderRadius: 8, border: '1px solid var(--red-bd)',
                background: 'var(--red-bg)', color: 'var(--red)',
                cursor: (selected.size === 0 || bulkBusy) ? 'not-allowed' : 'pointer',
                fontSize: 12, fontWeight: 600,
                opacity: (selected.size === 0 || bulkBusy) ? 0.5 : 1,
              }}
            >
              <Trash2 size={12} /> Delete Selected
            </button>

            <button
              onClick={reevaluateAll}
              disabled={filteredProjects.length === 0 || bulkBusy}
              style={{
                display: 'flex', alignItems: 'center', gap: 5,
                padding: '6px 12px', borderRadius: 8, border: '1px solid var(--border-hi)',
                background: 'var(--bg-tertiary)', color: 'var(--text-2)',
                cursor: (filteredProjects.length === 0 || bulkBusy) ? 'not-allowed' : 'pointer',
                fontSize: 12, fontWeight: 600,
                opacity: (filteredProjects.length === 0 || bulkBusy) ? 0.5 : 1,
              }}
            >
              <RefreshCw size={12} /> Re-evaluate All Shown ({filteredProjects.length})
            </button>
          </div>

          {/* Project list */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {filteredProjects.map((p: any) => (
              <div key={p.id} style={{
                background: 'var(--bg-secondary)', border: '1px solid var(--border)',
                borderRadius: 12, padding: '16px',
              }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, flexWrap: 'wrap' }}>
                  {/* Select checkbox */}
                  <input
                    type="checkbox"
                    checked={selected.has(p.id)}
                    onChange={() => toggleSelect(p.id)}
                    style={{ width: 15, height: 15, marginTop: 12, cursor: 'pointer', flexShrink: 0 }}
                  />
                  {/* Logo */}
                  <div style={{ width: 40, height: 40, borderRadius: 10, overflow: 'hidden', background: 'var(--bg-tertiary)', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    {p.logo_url
                      ? <img src={p.logo_url} alt={p.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                      : <FolderOpen size={16} color="var(--text-3)" />
                    }
                  </div>

                  {/* Info */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 4 }}>
                      <span style={{ fontWeight: 700, fontSize: 14, color: 'var(--text-1)' }}>{p.name}</span>
                      <Badge
                        text={p.status}
                        color={p.status === 'active' ? 'var(--green)' : p.status === 'rejected' ? 'var(--red)' : 'var(--yellow)'}
                        bg={p.status === 'active' ? 'var(--green-bg)' : p.status === 'rejected' ? 'var(--red-bg)' : 'var(--yellow-bg)'}
                      />
                      <Badge text={p.category} color="var(--text-3)" bg="var(--bg-tertiary)" />
                      {p.ai_score
                        ? <Badge text={`Score: ${p.ai_score.score}`} color="var(--brand)" bg="var(--brand-bg)" />
                        : <Badge text="No score" color="var(--yellow)" bg="var(--yellow-bg)" />
                      }
                    </div>
                    <div style={{ fontSize: 12, color: 'var(--text-3)', marginBottom: 4 }}>
                      {new Date(p.created_at).toLocaleDateString()} · {p.website_url}
                    </div>
                    {p.ai_score?.tx_hash && (
                      <a href={`https://explorer-studio.genlayer.com/tx/${p.ai_score.tx_hash}`} target="_blank" rel="noopener noreferrer"
                        style={{ fontSize: 11, color: 'var(--blue)', fontFamily: 'var(--font-mono)', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                        <ExternalLink size={10} /> TX: {p.ai_score.tx_hash.slice(0, 12)}...
                      </a>
                    )}
                  </div>

                  {/* Actions */}
                  <div style={{ display: 'flex', gap: 8, flexShrink: 0, flexWrap: 'wrap' }}>
                    <button
                      onClick={() => doAction('re-evaluate', p.id, p.name)}
                      disabled={!!acting}
                      style={{
                        display: 'flex', alignItems: 'center', gap: 5,
                        padding: '6px 12px', borderRadius: 8, border: '1px solid var(--border)',
                        background: 'var(--bg-tertiary)', color: 'var(--brand)',
                        cursor: acting ? 'not-allowed' : 'pointer', fontSize: 12, fontWeight: 600,
                        opacity: acting === p.id + 're-evaluate' ? 0.6 : 1,
                      }}
                    >
                      <Zap size={12} />
                      {acting === p.id + 're-evaluate' ? 'Evaluating...' : 'Re-evaluate'}
                    </button>

                    {p.status !== 'rejected' && (
                      <button
                        onClick={() => doAction('reject', p.id, p.name)}
                        disabled={!!acting}
                        style={{
                          display: 'flex', alignItems: 'center', gap: 5,
                          padding: '6px 12px', borderRadius: 8, border: '1px solid var(--red-bd)',
                          background: 'var(--red-bg)', color: 'var(--red)',
                          cursor: acting ? 'not-allowed' : 'pointer', fontSize: 12, fontWeight: 600,
                        }}
                      >
                        <XCircle size={12} /> Reject
                      </button>
                    )}

                    {p.status === 'rejected' && (
                      <button
                        onClick={() => doAction('approve', p.id, p.name)}
                        disabled={!!acting}
                        style={{
                          display: 'flex', alignItems: 'center', gap: 5,
                          padding: '6px 12px', borderRadius: 8, border: '1px solid var(--green-bd)',
                          background: 'var(--green-bg)', color: 'var(--green)',
                          cursor: acting ? 'not-allowed' : 'pointer', fontSize: 12, fontWeight: 600,
                        }}
                      >
                        <CheckCircle size={12} /> Approve
                      </button>
                    )}

                    <button
                      onClick={() => doAction('delete', p.id, p.name)}
                      disabled={!!acting}
                      style={{
                        display: 'flex', alignItems: 'center', gap: 5,
                        padding: '6px 12px', borderRadius: 8, border: '1px solid var(--border)',
                        background: 'var(--bg-tertiary)', color: 'var(--red)',
                        cursor: acting ? 'not-allowed' : 'pointer', fontSize: 12, fontWeight: 600,
                      }}
                    >
                      <Trash2 size={12} /> Delete
                    </button>
                  </div>
                </div>
              </div>
            ))}
            {filteredProjects.length === 0 && (
              <p style={{ textAlign: 'center', color: 'var(--text-3)', padding: '40px 0' }}>No projects found.</p>
            )}
          </div>
        </div>
      )}

      {/* Evaluations Tab */}
      {tab === 'evaluations' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <p style={{ fontSize: 13, color: 'var(--text-3)', marginBottom: 8 }}>Last 20 evaluations — most recent first.</p>
          {recentScores.map((s: any) => {
            const proj = projects.find((p: any) => p.id === s.project_id)
            return (
              <div key={s.id} style={{
                background: 'var(--bg-secondary)', border: '1px solid var(--border)',
                borderRadius: 12, padding: '14px 16px',
                display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap',
              }}>
                <div style={{ width: 44, height: 44, borderRadius: '50%', background: 'var(--bg-tertiary)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <span style={{ fontSize: 16, fontWeight: 900, color: Number(s.score) >= 75 ? 'var(--green)' : Number(s.score) >= 50 ? 'var(--yellow)' : 'var(--red)' }}>{s.score}</span>
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 700, fontSize: 14, color: 'var(--text-1)' }}>{proj?.name ?? s.project_id.slice(0, 8)}</div>
                  <div style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 2 }}>
                    {new Date(s.created_at).toLocaleString()} · Risk: {s.risk} · Confidence: {s.confidence}
                  </div>
                  {s.tx_hash && (
                    <a href={`https://explorer-studio.genlayer.com/tx/${s.tx_hash}`} target="_blank" rel="noopener noreferrer"
                      style={{ fontSize: 11, color: 'var(--blue)', fontFamily: 'var(--font-mono)', display: 'inline-flex', alignItems: 'center', gap: 4, marginTop: 2 }}>
                      <ExternalLink size={10} /> {s.tx_hash.slice(0, 14)}...{s.tx_hash.slice(-6)}
                    </a>
                  )}
                </div>
                <button
                  onClick={() => doAction('re-evaluate', s.project_id, proj?.name ?? 'this project')}
                  disabled={!!acting}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 5,
                    padding: '6px 12px', borderRadius: 8, border: '1px solid var(--border)',
                    background: 'var(--bg-tertiary)', color: 'var(--brand)',
                    cursor: 'pointer', fontSize: 12, fontWeight: 600,
                  }}
                >
                  <Zap size={12} /> Re-evaluate
                </button>
              </div>
            )
          })}
        </div>
      )}

      {/* Users Tab */}
      {tab === 'users' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <p style={{ fontSize: 13, color: 'var(--text-3)', marginBottom: 8 }}>{stats.totalUsers} builders with profiles.</p>
          {(data?.projects ?? [])
            .filter((p: any, i: number, arr: any[]) => arr.findIndex(x => x.created_by === p.created_by) === i)
            .map((p: any) => {
              const userProjects = projects.filter((x: any) => x.created_by === p.created_by)
              const scores = userProjects.filter((x: any) => x.ai_score).map((x: any) => Number(x.ai_score.score))
              const avg = scores.length ? Math.round(scores.reduce((a: number, b: number) => a + b, 0) / scores.length) : null
              return (
                <div key={p.created_by} style={{
                  background: 'var(--bg-secondary)', border: '1px solid var(--border)',
                  borderRadius: 12, padding: '14px 16px',
                  display: 'flex', alignItems: 'center', gap: 14,
                }}>
                  <div style={{ width: 36, height: 36, borderRadius: '50%', background: 'var(--brand-bg)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <Users size={16} color="var(--brand)" />
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 600, fontSize: 13, color: 'var(--text-1)', fontFamily: 'var(--font-mono)' }}>{p.created_by}</div>
                    <div style={{ fontSize: 12, color: 'var(--text-3)', marginTop: 2 }}>
                      {userProjects.length} project{userProjects.length !== 1 ? 's' : ''}
                      {avg !== null ? ` · Avg score: ${avg}/100` : ''}
                    </div>
                  </div>
                </div>
              )
            })
          }
        </div>
      )}
    </div>
  )
}
