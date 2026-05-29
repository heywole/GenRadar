'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { ProjectCard } from '@/components/ProjectCard'
import { Loader2, User, Bookmark, Eye, Flag, Package, X, Check, Clock, Pencil, Upload, Camera, LayoutGrid, List } from 'lucide-react'
import type { Project } from '@/types'
import { PROJECT_CATEGORIES } from '@/types'

type Tab = 'submitted' | 'saved' | 'viewed' | 'reported'
type CardView = 'grid' | 'list'
interface DeleteRequest { project_id: string; scheduled_at: string; reason: string; name: string }

export default function ProfilePage() {
  const router = useRouter()
  const [user,            setUser]            = useState<any>(null)
  const [loading,         setLoading]         = useState(true)
  const [tab,             setTab]             = useState<Tab>('submitted')
  const [cardView,        setCardView]        = useState<CardView>('grid')
  const [projects,        setProjects]        = useState<Project[]>([])
  const [fetching,        setFetching]        = useState(false)
  const [editProject,     setEditProject]     = useState<Project | null>(null)
  const [deleteModal,     setDeleteModal]     = useState<Project | null>(null)
  const [deleteReason,    setDeleteReason]    = useState('')
  const [delRequests,     setDelRequests]     = useState<DeleteRequest[]>([])
  const [saving,          setSaving]          = useState(false)
  const [editingName,     setEditingName]     = useState(false)
  const [displayName,     setDisplayName]     = useState('')
  const [savingName,      setSavingName]      = useState(false)
  const [editForm,        setEditForm]        = useState({ name: '', description: '', website_url: '', github_url: '', twitter_url: '', discord_url: '', docs_url: '', category: '' })
  const [builderProfile,  setBuilderProfile]  = useState<any>(null)
  const [showBuilderForm, setShowBuilderForm] = useState(false)
  const [builderForm,     setBuilderForm]     = useState({ bio: '', twitter_url: '', telegram_url: '', github_url: '', discord_url: '', website_url: '', other_links: '', avatar_url: '', country: '' })
  const [savingBuilder,   setSavingBuilder]   = useState(false)
  const [builderSaved,    setBuilderSaved]    = useState(false)
  const [avatarFile,      setAvatarFile]      = useState<File | null>(null)
  const [avatarPreview,   setAvatarPreview]   = useState<string | null>(null)
  const [uploadingAvatar, setUploadingAvatar] = useState(false)
  const [showEmail,       setShowEmail]       = useState(false)

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) { router.push('/auth'); return }
      setUser(session.user)
      setDisplayName(session.user.user_metadata?.full_name || session.user.email?.split('@')[0] || '')
      setLoading(false)
    })
  }, [router])

  useEffect(() => {
    if (!user) return
    fetchProjects(tab)
    loadDeleteRequests()
    loadBuilderProfile()
  }, [tab, user])

  async function loadBuilderProfile() {
    if (!user) return
    try {
      const res  = await fetch(`/api/builder-profile?user_id=${user.id}`)
      const data = await res.json()
      if (data.profile) {
        setBuilderProfile(data.profile)
        setBuilderForm({
          bio:          data.profile.bio          || '',
          twitter_url:  data.profile.twitter_url  || '',
          telegram_url: data.profile.telegram_url || '',
          github_url:   data.profile.github_url   || '',
          discord_url:  data.profile.discord_url  || '',
          website_url:  data.profile.website_url  || '',
          other_links:  data.profile.other_links  || '',
          avatar_url:   data.profile.avatar_url   || '',
          country:      data.profile.country      || '',
        })
      }
    } catch {}
  }

  function handleAvatarFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    if (file.size > 2 * 1024 * 1024) { alert('Image must be under 2MB'); return }
    setAvatarFile(file)
    setAvatarPreview(URL.createObjectURL(file))
  }

  async function uploadAvatar(userId: string): Promise<string | null> {
    if (!avatarFile) return builderForm.avatar_url || null
    setUploadingAvatar(true)
    try {
      const ext  = avatarFile.name.split('.').pop() || 'jpg'
      const path = `avatars/${userId}.${ext}`
      const { error } = await supabase.storage.from('project-logos').upload(path, avatarFile, { upsert: true })
      if (error) return builderForm.avatar_url || null
      return supabase.storage.from('project-logos').getPublicUrl(path).data.publicUrl
    } finally { setUploadingAvatar(false) }
  }

  async function saveBuilderProfile() {
    if (!user) return
    setSavingBuilder(true)
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) return
    const avatarUrl = await uploadAvatar(user.id)
    await fetch('/api/builder-profile', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
      body: JSON.stringify({ ...builderForm, avatar_url: avatarUrl }),
    })
    setSavingBuilder(false); setBuilderSaved(true); setShowBuilderForm(false)
    setAvatarFile(null); setAvatarPreview(null)
    loadBuilderProfile()
    setTimeout(() => setBuilderSaved(false), 3000)
  }

  async function saveDisplayName() {
    if (!user || !displayName.trim()) return
    setSavingName(true)
    await supabase.auth.updateUser({ data: { full_name: displayName.trim() } })
    setSavingName(false); setEditingName(false)
    setUser((u: any) => ({ ...u, user_metadata: { ...u.user_metadata, full_name: displayName.trim() } }))
  }

  function loadDeleteRequests() {
    try {
      const stored = localStorage.getItem(`del_${user?.id}`)
      if (stored) setDelRequests(JSON.parse(stored))
    } catch {}
  }

  function saveDeleteRequests(reqs: DeleteRequest[]) {
    setDelRequests(reqs)
    localStorage.setItem(`del_${user?.id}`, JSON.stringify(reqs))
  }

  const fetchProjects = useCallback(async (t: Tab) => {
    if (!user) return
    setFetching(true); setProjects([])
    try {
      // Always fetch via API to get real counts (views, saves, votes)
      const res = await fetch('/api/projects?sort=newest&limit=100&t=' + Date.now())
      const d = await res.json()
      const all: Project[] = d.projects || []

      if (t === 'submitted') {
        // Fetch submitted projects directly from supabase (API doesn't expose created_by)
        const { data } = await supabase
          .from('projects')
          .select('id')
          .eq('created_by', user.id)
          .order('created_at', { ascending: false })
        const submittedIds = new Set((data || []).map((p: any) => p.id))
        const filtered = all.filter((p: any) => submittedIds.has(p.id))
        setProjects(filtered)
      } else {
        const map: Record<Tab, string> = { saved: 'save', viewed: 'view', reported: 'report', submitted: '' }
        const { data: ints } = await supabase
          .from('interactions')
          .select('project_id')
          .eq('user_id', user.id)
          .eq('type', map[t])
        const ids = new Set((ints || []).map((i: any) => i.project_id))
        if (!ids.size) { setFetching(false); return }
        setProjects(all.filter((p: any) => ids.has(p.id)))
      }
    } catch (e) { console.error(e) }
    setFetching(false)
  }, [user])

  function shape(data: any[]): Project[] {
    return data.map(p => ({
      ...p,
      ai_score: Array.isArray(p.ai_scores) ? p.ai_scores[0] ?? null : p.ai_scores ?? null,
      _count: { views: 0, saves: 0, reports: 0 },
    }))
  }

  function openEdit(p: Project) {
    setEditProject(p)
    setEditForm({ name: p.name || '', description: p.description || '', website_url: p.website_url || '', github_url: (p as any).github_url || '', twitter_url: (p as any).twitter_url || '', discord_url: (p as any).discord_url || '', docs_url: (p as any).docs_url || '', category: p.category || '' })
  }

  async function handleSaveEdit() {
    if (!editProject || !user) return
    setSaving(true)
    await supabase.from('projects').update({
      ...editForm, github_url: editForm.github_url || null, twitter_url: editForm.twitter_url || null,
      discord_url: editForm.discord_url || null, docs_url: editForm.docs_url || null, evaluation_status: 'pending',
    }).eq('id', editProject.id).eq('created_by', user.id)
    fetch('/api/re-evaluate', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ project_id: editProject.id }) }).catch(() => {})
    setSaving(false); setEditProject(null); fetchProjects('submitted')
  }

  function scheduleDelete(p: Project) {
    if (!deleteReason.trim()) return
    const reqs = [...delRequests.filter(r => r.project_id !== p.id), { project_id: p.id, name: p.name, scheduled_at: new Date(Date.now() + 86400000).toISOString(), reason: deleteReason }]
    saveDeleteRequests(reqs); setDeleteModal(null); setDeleteReason('')
  }

  function cancelDelete(id: string) { saveDeleteRequests(delRequests.filter(r => r.project_id !== id)) }

  async function confirmDelete(id: string) {
    await supabase.from('projects').delete().eq('id', id).eq('created_by', user.id)
    cancelDelete(id); fetchProjects('submitted')
  }

  function countdown(at: string) {
    const ms = new Date(at).getTime() - Date.now()
    if (ms <= 0) return null
    return `${Math.floor(ms / 3600000)}h ${Math.floor((ms % 3600000) / 60000)}m`
  }

  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '60vh' }}>
      <Loader2 size={24} style={{ animation: 'spin 1s linear infinite', color: 'var(--text-3)' }} />
    </div>
  )

  const inp: React.CSSProperties = { width: '100%', padding: '9px 12px', background: 'var(--bg-secondary)', border: '1px solid var(--border-hi)', borderRadius: 8, color: 'var(--text-1)', fontSize: 13, fontFamily: 'var(--font-sans)', outline: 'none', boxSizing: 'border-box' as const }
  const currentName = user?.user_metadata?.full_name || user?.email?.split('@')[0] || 'User'
  const avatarUrl   = user?.user_metadata?.avatar_url
  const builderAvatarDisplay = avatarPreview || builderForm.avatar_url

  const TABS = [
    { key: 'submitted' as Tab, label: 'Submitted', icon: Package  },
    { key: 'saved'     as Tab, label: 'Saved',     icon: Bookmark },
    { key: 'viewed'    as Tab, label: 'Viewed',    icon: Eye      },
    { key: 'reported'  as Tab, label: 'Reported',  icon: Flag     },
  ]

  return (
    <div style={{ maxWidth: 1100, margin: '0 auto', padding: '40px 28px' }}>

      {/* Profile header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 20, marginBottom: 36, paddingBottom: 28, borderBottom: '1px solid var(--border-hi)' }}>
        <div style={{ width: 64, height: 64, borderRadius: '50%', background: 'var(--bg-secondary)', border: '2px solid var(--border-hi)', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', flexShrink: 0 }}>
          {avatarUrl
            ? <img src={avatarUrl} style={{ width: '100%', height: '100%', objectFit: 'cover' }} onError={e => { (e.target as HTMLImageElement).style.display = 'none' }} />
            : <User size={26} color="var(--text-3)" />
          }
        </div>

        <div style={{ flex: 1 }}>
          {editingName ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
              <input value={displayName} onChange={e => setDisplayName(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') saveDisplayName(); if (e.key === 'Escape') setEditingName(false) }}
                autoFocus style={{ ...inp, width: 220, height: 36, fontWeight: 700, fontSize: 17 }} />
              <button onClick={saveDisplayName} disabled={savingName} style={{ padding: '6px 12px', background: 'var(--text-1)', color: 'var(--bg)', border: 'none', borderRadius: 8, cursor: 'pointer', fontSize: 12, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 4 }}>
                {savingName ? <Loader2 size={11} style={{ animation: 'spin 1s linear infinite' }} /> : <Check size={11} />} Save
              </button>
              <button onClick={() => { setEditingName(false); setDisplayName(currentName) }} style={{ padding: '6px 10px', background: 'transparent', border: '1px solid var(--border-hi)', borderRadius: 8, cursor: 'pointer', color: 'var(--text-2)', fontSize: 12 }}>Cancel</button>
            </div>
          ) : (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
              <h1 style={{ fontWeight: 700, fontSize: 19, color: 'var(--text-1)', margin: 0 }}>{currentName}</h1>
              <button onClick={() => setEditingName(true)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-3)', display: 'flex', padding: 4, borderRadius: 6 }}>
                <Pencil size={13} />
              </button>
            </div>
          )}
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <p style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text-3)', margin: 0 }}>
              {showEmail ? user?.email : '••••••••@' + (user?.email?.split('@')[1] ?? '')}
            </p>
            <button onClick={() => setShowEmail(s => !s)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-3)', fontSize: 11, fontFamily: 'var(--font-mono)', padding: '0 4px' }}>
              {showEmail ? 'hide' : 'show'}
            </button>
          </div>
        </div>

        <button onClick={() => setShowBuilderForm(!showBuilderForm)} style={{ padding: '9px 18px', borderRadius: 9, border: '1px solid var(--border-hi)', background: showBuilderForm ? 'var(--bg-tertiary)' : 'var(--text-1)', color: showBuilderForm ? 'var(--text-1)' : 'var(--bg)', cursor: 'pointer', fontSize: 13, fontWeight: 700, fontFamily: 'var(--font-sans)', flexShrink: 0 }}>
          {builderProfile ? (showBuilderForm ? 'Cancel' : 'Edit Builder Profile') : (showBuilderForm ? 'Cancel' : '+ Builder Profile')}
          {builderSaved && ' ✓'}
        </button>
      </div>

      {/* Builder profile form */}
      {showBuilderForm && (
        <div style={{ marginBottom: 28, padding: '24px', background: 'var(--bg-secondary)', borderRadius: 14, border: '1px solid var(--border-hi)' }}>
          <h3 style={{ fontWeight: 700, fontSize: 15, color: 'var(--text-1)', margin: '0 0 4px' }}>Builder Profile</h3>
          <p style={{ fontSize: 12, color: 'var(--text-3)', margin: '0 0 20px' }}>Visible on your project pages</p>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
            <div style={{ gridColumn: '1 / -1' }}>
              <label style={{ fontFamily: 'var(--font-mono)', fontSize: 10, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--text-3)', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 5 }}>
                <Camera size={10} /> Profile Picture
              </label>
              <div style={{ display: 'flex', gap: 14, alignItems: 'center' }}>
                <div style={{ width: 56, height: 56, borderRadius: '50%', overflow: 'hidden', background: 'var(--bg-tertiary)', border: '2px solid var(--border-hi)', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  {builderAvatarDisplay
                    ? <img src={builderAvatarDisplay} style={{ width: '100%', height: '100%', objectFit: 'cover' }} onError={e => { (e.target as HTMLImageElement).style.display = 'none' }} />
                    : <User size={20} color="var(--text-3)" />
                  }
                </div>
                <label style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '9px 16px', borderRadius: 8, cursor: 'pointer', background: 'var(--bg-card)', border: '1px solid var(--border-hi)', fontSize: 13, fontWeight: 600, color: 'var(--text-1)' }}>
                  <Upload size={13} />
                  {avatarFile ? avatarFile.name.slice(0, 20) + '...' : 'Upload Photo'}
                  <input type="file" accept="image/png,image/jpeg,image/webp" onChange={handleAvatarFile} style={{ display: 'none' }} />
                </label>
              </div>
            </div>
            <div style={{ gridColumn: '1 / -1' }}>
              <label style={{ fontFamily: 'var(--font-mono)', fontSize: 10, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--text-3)', marginBottom: 6, display: 'block' }}>Bio</label>
              <textarea value={builderForm.bio} onChange={e => setBuilderForm(f => ({ ...f, bio: e.target.value }))} placeholder="Tell the community about yourself..." rows={3} style={{ ...inp, resize: 'vertical' }} />
            </div>
            <div style={{ gridColumn: '1 / -1' }}>
              <label style={{ fontFamily: 'var(--font-mono)', fontSize: 10, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--text-3)', marginBottom: 6, display: 'block' }}>Country</label>
              <select value={builderForm.country} onChange={e => setBuilderForm(f => ({ ...f, country: e.target.value }))} style={{ ...inp, cursor: 'pointer' }}>
                <option value="">Select country...</option>
                {[['NG','Nigeria'],['US','United States'],['GB','United Kingdom'],['GH','Ghana'],['KE','Kenya'],['ZA','South Africa'],['IN','India'],['DE','Germany'],['FR','France'],['CA','Canada'],['AU','Australia'],['BR','Brazil'],['JP','Japan'],['CN','China'],['SN','Senegal'],['ET','Ethiopia'],['EG','Egypt'],['MA','Morocco'],['TN','Tunisia'],['Other','Other']].map(([code, name]) => (
                  <option key={code} value={code}>{name}</option>
                ))}
              </select>
            </div>
            {(['twitter_url','github_url','telegram_url','discord_url','website_url','other_links'] as const).map(key => (
              <div key={key}>
                <label style={{ fontFamily: 'var(--font-mono)', fontSize: 10, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--text-3)', marginBottom: 6, display: 'block' }}>
                  {key.replace(/_url$/, '').replace(/_/g, ' ')}
                </label>
                <input type="text" value={(builderForm as any)[key]} onChange={e => setBuilderForm(f => ({ ...f, [key]: e.target.value }))} style={inp} />
              </div>
            ))}
          </div>
          <button onClick={saveBuilderProfile} disabled={savingBuilder || uploadingAvatar} style={{ marginTop: 18, width: '100%', padding: '11px', background: 'var(--text-1)', color: 'var(--bg)', border: 'none', borderRadius: 9, cursor: (savingBuilder || uploadingAvatar) ? 'not-allowed' : 'pointer', fontSize: 13, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, opacity: (savingBuilder || uploadingAvatar) ? 0.7 : 1 }}>
            {(savingBuilder || uploadingAvatar) ? <><Loader2 size={13} style={{ animation: 'spin 1s linear infinite' }} /> {uploadingAvatar ? 'Uploading...' : 'Saving...'}</> : 'Save Builder Profile'}
          </button>
        </div>
      )}

      {/* Tabs + view toggle */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid var(--border-hi)', marginBottom: 28 }}>
        <div style={{ display: 'flex' }}>
          {TABS.map(({ key, label, icon: Icon }) => (
            <button key={key} onClick={() => setTab(key)} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '10px 20px', border: 'none', cursor: 'pointer', fontFamily: 'var(--font-mono)', fontSize: 11, letterSpacing: '0.06em', textTransform: 'uppercase', background: 'transparent', color: tab === key ? 'var(--text-1)' : 'var(--text-3)', borderBottom: tab === key ? '2px solid var(--text-1)' : '2px solid transparent', marginBottom: -1, fontWeight: tab === key ? 600 : 400 }}>
              <Icon size={13} /> {label}
            </button>
          ))}
        </div>
        <div style={{ display: 'flex', gap: 4, paddingBottom: 4 }}>
          {(['grid','list'] as CardView[]).map(v => (
            <button key={v} onClick={() => setCardView(v)} style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '6px 12px', borderRadius: 8, border: '1px solid var(--border-hi)', cursor: 'pointer', background: cardView === v ? 'var(--text-1)' : 'transparent', color: cardView === v ? 'var(--bg)' : 'var(--text-2)', fontSize: 12, fontWeight: 600 }}>
              {v === 'grid' ? <LayoutGrid size={12} /> : <List size={12} />} {v.charAt(0).toUpperCase() + v.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {/* Deletion banner */}
      {delRequests.length > 0 && tab === 'submitted' && (
        <div style={{ marginBottom: 20, padding: '12px 16px', borderRadius: 8, background: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.25)' }}>
          {delRequests.map(req => {
            const cd = countdown(req.scheduled_at)
            return (
              <div key={req.project_id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 4 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: '#EF4444' }}>
                  <Clock size={13} />
                  <span><strong>{req.name}</strong> — {cd ? `Deleting in ${cd}` : 'Ready to delete'}</span>
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  {!cd && <button onClick={() => confirmDelete(req.project_id)} style={{ padding: '4px 12px', background: '#EF4444', color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer', fontSize: 12, fontWeight: 600 }}>Confirm Delete</button>}
                  <button onClick={() => cancelDelete(req.project_id)} style={{ padding: '4px 12px', background: 'transparent', color: 'var(--text-2)', border: '1px solid var(--border-hi)', borderRadius: 6, cursor: 'pointer', fontSize: 12 }}>Cancel</button>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Projects */}
      {fetching ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: '60px 0' }}>
          <Loader2 size={20} style={{ animation: 'spin 1s linear infinite', color: 'var(--text-3)' }} />
        </div>
      ) : projects.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '60px 0', borderRadius: 10 }}>
          <p style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>No {tab} projects yet</p>
        </div>
      ) : cardView === 'grid' ? (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 16 }}>
          {projects.map(p => {
            const del = delRequests.find(r => r.project_id === p.id)
            return (
              <div key={p.id} style={{ position: 'relative', opacity: del ? 0.6 : 1 }}>
                <ProjectCard project={p} showEditControls={tab === 'submitted'} onEdit={openEdit} onDelete={proj => setDeleteModal(proj)} />
                {del && (
                  <div style={{ position: 'absolute', inset: 0, borderRadius: 16, background: 'rgba(0,0,0,0.08)', display: 'flex', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none' }}>
                    <div style={{ background: 'var(--bg-card)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 8, padding: '10px 16px', textAlign: 'center' }}>
                      <Clock size={14} color="#EF4444" style={{ marginBottom: 4 }} />
                      <p style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: '#EF4444', fontWeight: 600 }}>
                        {countdown(del.scheduled_at) ? `Deletes in ${countdown(del.scheduled_at)}` : 'Ready to delete'}
                      </p>
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {projects.map(p => {
            const del = delRequests.find(r => r.project_id === p.id)
            const ai  = p.ai_score
            const scoreColor = ai ? (Number(ai.score) >= 75 ? '#22C55E' : Number(ai.score) >= 50 ? '#D97706' : '#EF4444') : 'var(--text-3)'
            return (
              <div key={p.id} style={{ position: 'relative', opacity: del ? 0.6 : 1 }}>
                <div onClick={() => window.location.href = `/project/${p.id}`}
                  style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '14px 16px', background: 'var(--bg-card)', border: '1px solid var(--border-hi)', borderRadius: 12, cursor: 'pointer' }}>
                  <div style={{ width: 44, height: 44, borderRadius: 10, overflow: 'hidden', background: 'var(--bg-secondary)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    {p.logo_url
                      ? <img src={p.logo_url} alt={p.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                      : <span style={{ fontWeight: 800, fontSize: 13, color: 'var(--text-2)' }}>{p.name.slice(0,2).toUpperCase()}</span>
                    }
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ fontWeight: 700, fontSize: 14, color: 'var(--text-1)', margin: 0, marginBottom: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.name}</p>
                    <p style={{ fontSize: 11, color: 'var(--text-3)', margin: 0, fontFamily: 'var(--font-mono)' }}>{p.category}</p>
                  </div>
                  {ai && (
                    <div style={{ flexShrink: 0, textAlign: 'right' }}>
                      <p style={{ fontWeight: 800, fontSize: 20, color: scoreColor, margin: 0 }}>{ai.score}</p>
                      <p style={{ fontSize: 9, color: 'var(--text-3)', margin: 0, fontFamily: 'var(--font-mono)' }}>/100</p>
                    </div>
                  )}
                  {tab === 'submitted' && (
                    <div style={{ display: 'flex', gap: 6, flexShrink: 0 }} onClick={e => e.stopPropagation()}>
                      <button onClick={() => openEdit(p)} style={{ padding: '5px 10px', borderRadius: 7, border: '1px solid var(--border-hi)', background: 'transparent', color: 'var(--text-2)', cursor: 'pointer', fontSize: 11 }}>Edit</button>
                      <button onClick={() => setDeleteModal(p)} style={{ padding: '5px 10px', borderRadius: 7, border: '1px solid rgba(239,68,68,0.3)', background: 'rgba(239,68,68,0.06)', color: '#EF4444', cursor: 'pointer', fontSize: 11 }}>Delete</button>
                    </div>
                  )}
                </div>
                {del && (
                  <div style={{ position: 'absolute', inset: 0, borderRadius: 12, background: 'rgba(0,0,0,0.06)', display: 'flex', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none' }}>
                    <p style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: '#EF4444', fontWeight: 600, background: 'var(--bg-card)', padding: '6px 12px', borderRadius: 6 }}>
                      {countdown(del.scheduled_at) ? `Deletes in ${countdown(del.scheduled_at)}` : 'Ready to delete'}
                    </p>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* Edit modal */}
      {editProject && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.65)', zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
          <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border-hi)', borderRadius: 14, padding: '28px', width: '100%', maxWidth: 520, maxHeight: '90vh', overflowY: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <h2 style={{ fontWeight: 700, fontSize: 17, color: 'var(--text-1)', margin: 0 }}>Edit Project</h2>
              <button onClick={() => setEditProject(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-2)' }}><X size={18} /></button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 13 }}>
              {(['name','website_url','github_url','twitter_url','discord_url','docs_url'] as const).map(key => (
                <div key={key}>
                  <label style={{ fontFamily: 'var(--font-mono)', fontSize: 10, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--text-3)', marginBottom: 5, display: 'block' }}>{key.replace(/_url$/, '').replace(/_/g, ' ')}</label>
                  <input value={(editForm as any)[key]} onChange={e => setEditForm(f => ({ ...f, [key]: e.target.value }))} style={inp} />
                </div>
              ))}
              <div>
                <label style={{ fontFamily: 'var(--font-mono)', fontSize: 10, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--text-3)', marginBottom: 5, display: 'block' }}>Description</label>
                <textarea value={editForm.description} onChange={e => setEditForm(f => ({ ...f, description: e.target.value }))} rows={4} style={{ ...inp, resize: 'vertical' }} />
              </div>
              <div>
                <label style={{ fontFamily: 'var(--font-mono)', fontSize: 10, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--text-3)', marginBottom: 5, display: 'block' }}>Category</label>
                <select value={editForm.category} onChange={e => setEditForm(f => ({ ...f, category: e.target.value }))} style={{ ...inp, cursor: 'pointer' }}>
                  {PROJECT_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
            </div>
            <div style={{ display: 'flex', gap: 10, marginTop: 20 }}>
              <button onClick={() => setEditProject(null)} style={{ flex: 1, padding: '10px', border: '1px solid var(--border-hi)', background: 'transparent', color: 'var(--text-2)', borderRadius: 8, cursor: 'pointer', fontSize: 13 }}>Cancel</button>
              <button onClick={handleSaveEdit} disabled={saving} style={{ flex: 1, padding: '10px', background: 'var(--text-1)', color: 'var(--bg)', border: 'none', borderRadius: 8, cursor: saving ? 'not-allowed' : 'pointer', fontSize: 13, fontWeight: 600, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
                {saving ? <><Loader2 size={13} style={{ animation: 'spin 1s linear infinite' }} /> Saving...</> : <><Check size={13} /> Save & Re-evaluate</>}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete modal */}
      {deleteModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.65)', zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
          <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border-hi)', borderRadius: 14, padding: '28px', width: '100%', maxWidth: 420 }}>
            <h2 style={{ fontWeight: 700, fontSize: 17, color: '#EF4444', marginBottom: 8 }}>Schedule Deletion</h2>
            <p style={{ fontSize: 13, color: 'var(--text-2)', marginBottom: 16, lineHeight: 1.6 }}>
              <strong>{deleteModal.name}</strong> will be permanently deleted after <strong>24 hours</strong>. You can cancel anytime.
            </p>
            <div style={{ marginBottom: 16 }}>
              <label style={{ fontFamily: 'var(--font-mono)', fontSize: 10, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--text-3)', marginBottom: 6, display: 'block' }}>Reason *</label>
              <textarea value={deleteReason} onChange={e => setDeleteReason(e.target.value)} placeholder="Why are you deleting this project?" rows={3} style={{ ...inp, resize: 'none' }} />
            </div>
            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={() => { setDeleteModal(null); setDeleteReason('') }} style={{ flex: 1, padding: '10px', border: '1px solid var(--border-hi)', background: 'transparent', color: 'var(--text-2)', borderRadius: 8, cursor: 'pointer', fontSize: 13 }}>Cancel</button>
              <button onClick={() => scheduleDelete(deleteModal)} disabled={!deleteReason.trim()} style={{ flex: 1, padding: '10px', background: '#EF4444', color: '#fff', border: 'none', borderRadius: 8, cursor: !deleteReason.trim() ? 'not-allowed' : 'pointer', fontSize: 13, fontWeight: 600, opacity: !deleteReason.trim() ? 0.6 : 1 }}>
                Schedule Deletion
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
