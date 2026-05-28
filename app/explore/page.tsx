'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { Search, X, SlidersHorizontal, RefreshCw } from 'lucide-react'
import { ProjectCard } from '@/components/ProjectCard'
import { PROJECT_CATEGORIES } from '@/types'
import type { Project } from '@/types'

const SORTS = [
  { value: 'score',  label: 'By AI Score'  },
  { value: 'newest', label: 'Newest First' },
  { value: 'views',  label: 'Most Viewed'  },
]

async function fetchFresh(params: URLSearchParams): Promise<Project[]> {
  params.set('t', String(Date.now()))
  const res = await fetch(`/api/projects?${params}`, {
    cache: 'no-store',
    headers: { 'Cache-Control': 'no-cache, no-store' },
  })
  const data = await res.json()
  return data.projects ?? []
}

export default function ExplorePage() {
  const [projects,    setProjects]    = useState<Project[]>([])
  const [loading,     setLoading]     = useState(true)
  const [search,      setSearch]      = useState('')
  const [category,    setCategory]    = useState('All')
  const [risk,        setRisk]        = useState('All')
  const [sort,        setSort]        = useState('score')
  const [showFilters, setShowFilters] = useState(false)
  const debounceRef = useRef<any>(null)

  const load = useCallback(async (s: string, cat: string, r: string, srt: string, silent = false) => {
    if (!silent) setLoading(true)
    const p = new URLSearchParams({ sort: srt, limit: '50' })
    if (cat !== 'All') p.set('category', cat)
    if (r   !== 'All') p.set('risk', r)
    if (s)             p.set('search', s)
    const list = await fetchFresh(p).catch(() => [])
    setProjects(list)
    setLoading(false)
  }, [])

  // Initial load + 20s live refresh
  useEffect(() => {
    load('', 'All', 'All', 'score')
    const id = setInterval(() => load(search, category, risk, sort, true), 20000)
    return () => clearInterval(id)
  }, [])

  function trigger(s: string, cat: string, r: string, srt: string) {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => load(s, cat, r, srt), s ? 400 : 0)
  }

  function onSearch(v: string)   { setSearch(v);   trigger(v,      category, risk, sort) }
  function onCategory(v: string) { setCategory(v); trigger(search, v,        risk, sort) }
  function onRisk(v: string)     { setRisk(v);     trigger(search, category, v,    sort) }
  function onSort(v: string)     { setSort(v);     trigger(search, category, risk, v)    }

  const inputStyle: React.CSSProperties = {
    padding: '0 12px', height: 38, background: 'var(--bg-secondary)',
    border: '1px solid var(--border-hi)', color: 'var(--text-2)',
    fontFamily: 'var(--font-mono)', fontSize: 12, cursor: 'pointer',
    outline: 'none', borderRadius: 9,
  }
  const pillStyle = (active: boolean): React.CSSProperties => ({
    padding: '5px 13px', border: '1px solid var(--border-hi)', cursor: 'pointer',
    fontFamily: 'var(--font-mono)', fontSize: 11, borderRadius: 7,
    background: active ? 'var(--brand)' : 'transparent',
    color: active ? '#fff' : 'var(--text-2)', transition: 'all 0.12s',
  })

  return (
    <div style={{ padding: '36px 28px', maxWidth: 1140, margin: '0 auto' }}>

      <div style={{ marginBottom: 28 }}>
        <p style={{ fontFamily: 'var(--font-mono)', fontSize: 10, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--text-3)', marginBottom: 6 }}>Explore</p>
        <h1 style={{ fontWeight: 900, fontSize: 30, letterSpacing: '-0.03em', color: 'var(--text-1)', marginBottom: 4 }}>All Projects</h1>
        <p style={{ fontSize: 13, color: 'var(--text-3)' }}>
          {loading ? 'Loading...' : `${projects.length} active project${projects.length !== 1 ? 's' : ''} — evaluated by GenLayer AI Consensus`}
        </p>
      </div>

      {/* Controls */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 18, flexWrap: 'wrap', alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '0 12px', height: 38, background: 'var(--bg-secondary)', border: '1px solid var(--border-hi)', borderRadius: 9, width: 260 }}>
          <Search size={13} color="var(--text-3)" style={{ flexShrink: 0 }} />
          <input value={search} onChange={e => onSearch(e.target.value)} placeholder="Search projects..."
            style={{ flex: 1, border: 'none', background: 'transparent', outline: 'none', fontSize: 13, color: 'var(--text-1)' }} />
          {search && <button onClick={() => onSearch('')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-3)', display: 'flex' }}><X size={13} /></button>}
        </div>

        <select value={sort} onChange={e => onSort(e.target.value)} style={inputStyle}>
          {SORTS.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
        </select>

        <button onClick={() => setShowFilters(!showFilters)} style={{ ...inputStyle, display: 'flex', alignItems: 'center', gap: 6, background: showFilters ? 'var(--green-bg)' : 'var(--bg-secondary)', color: showFilters ? 'var(--green)' : 'var(--text-2)' }}>
          <SlidersHorizontal size={12} /> Filters
        </button>

        <button onClick={() => load(search, category, risk, sort)} style={{ ...inputStyle, display: 'flex', alignItems: 'center', gap: 6 }}>
          <RefreshCw size={12} /> Refresh
        </button>
      </div>

      {/* Filter panel */}
      {showFilters && (
        <div style={{ padding: '20px 24px', borderRadius: 12, marginBottom: 20, background: 'var(--bg-secondary)' }}>
          <div style={{ marginBottom: 16 }}>
            <p style={{ fontFamily: 'var(--font-mono)', fontSize: 10, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--text-3)', marginBottom: 10 }}>Category</p>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {['All', ...PROJECT_CATEGORIES].map(cat => (
                <button key={cat} onClick={() => onCategory(cat)} style={pillStyle(category === cat)}>{cat}</button>
              ))}
            </div>
          </div>
          <div>
            <p style={{ fontFamily: 'var(--font-mono)', fontSize: 10, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--text-3)', marginBottom: 10 }}>Risk Level</p>
            <div style={{ display: 'flex', gap: 6 }}>
              {['All', 'Low', 'Medium', 'High'].map(r => (
                <button key={r} onClick={() => onRisk(r)} style={pillStyle(risk === r)}>{r}</button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Grid — no skeleton, just nothing while loading */}
      {loading ? null : projects.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '80px 0' }}>
          <p style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
            {search || category !== 'All' ? 'No projects match your filters' : 'No projects yet — be the first to submit!'}
          </p>
        </div>
      ) : (
        <div className="proj-grid-home" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 14 }}>
          {projects.map(p => <ProjectCard key={p.id} project={p} />)}
        </div>
      )}
    </div>
  )
}
