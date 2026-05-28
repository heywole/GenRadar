'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Upload, ArrowRight, CheckCircle, AlertCircle, Loader2, Link2, Github, FileText, Tag, Twitter, MessageCircle, LogIn, BookOpen, Send } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { PROJECT_CATEGORIES } from '@/types'
import type { Session } from '@supabase/supabase-js'

const inp = (err?: boolean): React.CSSProperties => ({
  width: '100%', padding: '10px 14px',
  background: 'var(--bg-secondary)',
  border: `1px solid ${err ? 'var(--red)' : 'var(--border-hi)'}`,
  borderRadius: 8, color: 'var(--text-1)',
  fontSize: 13.5, fontFamily: 'var(--font-sans)', outline: 'none',
  boxSizing: 'border-box',
})

const label = (text: string, required = false, optional = false): React.ReactNode => (
  <label style={{ fontFamily: 'var(--font-mono)', fontSize: 11, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--text-3)', marginBottom: 7, display: 'flex', alignItems: 'center', gap: 5 }}>
    {text}
    {required && <span style={{ color: 'var(--red)' }}>*</span>}
    {optional && <span style={{ fontSize: 10, color: 'var(--text-3)', textTransform: 'none', letterSpacing: 0 }}>(optional)</span>}
  </label>
)

export default function SubmitPage() {
  const router = useRouter()
  const [session,     setSession]     = useState<Session | null>(null)
  const [authLoading, setAuthLoading] = useState(true)
  const [loading,     setLoading]     = useState(false)
  const [success,     setSuccess]     = useState(false)
  const [logoPreview, setLogoPreview] = useState<string | null>(null)
  const [logoFile,    setLogoFile]    = useState<File | null>(null)
  const [errors,      setErrors]      = useState<Record<string, string>>({})
  const [form, setForm] = useState({
    name: '', description: '', website_url: '', github_url: '',
    twitter_url: '', discord_url: '', telegram_url: '', docs_url: '', category: '',
  })

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session: s } }) => { setSession(s); setAuthLoading(false) })
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, s) => { setSession(s); setAuthLoading(false) })
    return () => subscription.unsubscribe()
  }, [])

  function set(key: string, val: string) { setForm(f => ({ ...f, [key]: val })) }

  function handleLogo(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    if (file.size > 2 * 1024 * 1024) { setErrors(p => ({ ...p, logo: 'Logo must be under 2MB' })); return }
    setLogoFile(file); setLogoPreview(URL.createObjectURL(file))
  }

  async function uploadLogo(projectId: string): Promise<string | null> {
    if (!logoFile) return null
    const ext  = logoFile.name.split('.').pop()
    const path = `logos/${projectId}.${ext}`
    const { error } = await supabase.storage.from('project-logos').upload(path, logoFile, { upsert: true })
    if (error) return null
    return supabase.storage.from('project-logos').getPublicUrl(path).data.publicUrl
  }

  function validate() {
    const e: Record<string, string> = {}
    if (!form.name.trim() || form.name.length < 3) e.name = 'At least 3 characters'
    if (form.description.length < 50) e.description = 'At least 50 characters'
    if (!form.website_url || !/^https?:\/\//.test(form.website_url)) e.website_url = 'Enter a valid URL starting with https://'
    if (!form.category) e.category = 'Please select a category'
    return e
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const errs = validate()
    if (Object.keys(errs).length > 0) { setErrors(errs); return }
    setErrors({}); setLoading(true)

    try {
      const { data: { session: s } } = await supabase.auth.getSession()
      if (!s?.access_token) { setErrors({ submit: 'Session expired. Please sign in again.' }); setLoading(false); return }

      const payload: any = { ...form }
      Object.keys(payload).forEach(k => { if (!payload[k]) delete payload[k] })

      const res = await fetch('/api/submit-project', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${s.access_token}` },
        body: JSON.stringify(payload),
      })
      const data = await res.json()
      if (!res.ok) { setErrors({ submit: data.error || 'Submission failed.' }); setLoading(false); return }

      if (logoFile && data.project?.id) {
        const url = await uploadLogo(data.project.id)
        if (url) await supabase.from('projects').update({ logo_url: url }).eq('id', data.project.id)
      }

      setSuccess(true)
    } catch { setErrors({ submit: 'Network error. Please try again.' }) }
    setLoading(false)
  }

  if (authLoading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '60vh' }}>
      <Loader2 size={24} style={{ animation: 'spin 1s linear infinite', color: 'var(--text-3)' }} />
    </div>
  )

  if (!session) return (
    <div style={{ minHeight: 'calc(100vh - 60px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
      <div style={{ maxWidth: 400, width: '100%', textAlign: 'center', padding: '40px 32px', background: 'var(--bg-card)', border: '1px solid var(--border-hi)', borderRadius: 12 }}>
        <div style={{ fontSize: 40, marginBottom: 16 }}>🔒</div>
        <h2 style={{ fontFamily: 'var(--font-sans)', fontWeight: 700, fontSize: 20, color: 'var(--text-1)', marginBottom: 10 }}>Sign in to Submit</h2>
        <p style={{ fontSize: 14, color: 'var(--text-2)', marginBottom: 24 }}>You need to be signed in to submit a project.</p>
        <button onClick={() => router.push('/auth?next=/submit')} style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '11px 24px', background: 'var(--text-1)', color: 'var(--bg)', fontFamily: 'var(--font-sans)', fontWeight: 600, fontSize: 14, border: 'none', cursor: 'pointer', borderRadius: 8 }}>
          <LogIn size={15} /> Sign in to continue
        </button>
      </div>
    </div>
  )

  if (success) return (
    <div style={{ maxWidth: 520, margin: '80px auto', padding: '0 24px', textAlign: 'center' }}>
      <CheckCircle size={48} color="var(--green)" style={{ marginBottom: 20 }} />
      <h2 style={{ fontFamily: 'var(--font-sans)', fontWeight: 800, fontSize: 26, marginBottom: 10, color: 'var(--text-1)' }}>Project Submitted!</h2>
      <p style={{ fontSize: 15, color: 'var(--text-2)', marginBottom: 8, lineHeight: 1.7 }}>
        Your project is live. GenLayer AI Consensus is evaluating it in the background.
      </p>
      <p style={{ fontSize: 13, color: 'var(--text-3)', marginBottom: 28 }}>
        The score will appear on the card within a few minutes.
      </p>
      <a href="/explore" style={{ display: 'inline-flex', alignItems: 'center', gap: 7, padding: '12px 24px', background: 'var(--text-1)', color: 'var(--bg)', fontFamily: 'var(--font-sans)', fontWeight: 600, fontSize: 14, textDecoration: 'none', borderRadius: 8 }}>
        View Projects <ArrowRight size={14} />
      </a>
    </div>
  )

  const grid2: React.CSSProperties = { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }

  return (
    <div style={{ maxWidth: 680, margin: '0 auto', padding: '40px 32px' }}>
      <div style={{ marginBottom: 28 }}>
        <h1 style={{ fontFamily: 'var(--font-sans)', fontWeight: 800, fontSize: 28, letterSpacing: '-0.02em', color: 'var(--text-1)', marginBottom: 6 }}>Submit a Project</h1>
        <p style={{ fontSize: 14, color: 'var(--text-2)' }}>Share a GenLayer ecosystem project. Evaluated by AI Consensus automatically.</p>
      </div>

      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>

        {/* Logo */}
        <div>
          {label('Project Logo')}
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <div style={{ width: 68, height: 68, overflow: 'hidden', background: 'var(--bg-secondary)', border: '1px dashed var(--border-hi)', borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              {logoPreview ? <img src={logoPreview} alt="logo" style={{ width: '100%', height: '100%', objectFit: 'contain' }} /> : <Upload size={18} color="var(--text-3)" />}
            </div>
            <div>
              <label style={{ display: 'inline-flex', alignItems: 'center', gap: 7, cursor: 'pointer', padding: '8px 14px', border: '1px solid var(--border-hi)', background: 'var(--bg-secondary)', fontSize: 13, color: 'var(--text-2)', borderRadius: 8 }}>
                <Upload size={13} /> Upload logo
                <input type="file" accept="image/*" onChange={handleLogo} style={{ display: 'none' }} />
              </label>
              <p style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 6 }}>SVG preferred (adapts to dark/light). PNG/JPG accepted. Max 2MB.</p>
            </div>
          </div>
          {errors.logo && <p style={{ fontSize: 12, color: 'var(--red)', marginTop: 4 }}>{errors.logo}</p>}
        </div>

        {/* Name */}
        <div>
          {label('Project Name', true)}
          <input value={form.name} onChange={e => set('name', e.target.value)} placeholder="e.g. ChainSnark" style={inp(!!errors.name)} />
          {errors.name && <p style={{ fontSize: 12, color: 'var(--red)', marginTop: 4 }}>{errors.name}</p>}
        </div>

        {/* Description */}
        <div>
          {label('Description', true)}
          <textarea value={form.description} onChange={e => set('description', e.target.value)} placeholder="Describe your project in detail. Min 50 characters." rows={4} style={{ ...inp(!!errors.description), resize: 'vertical' }} />
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 4 }}>
            {errors.description ? <p style={{ fontSize: 12, color: 'var(--red)' }}>{errors.description}</p> : <span />}
            <span style={{ fontSize: 11, color: form.description.length < 50 ? 'var(--red)' : 'var(--green)', fontFamily: 'var(--font-mono)' }}>{form.description.length}/2000</span>
          </div>
        </div>

        {/* Website + GitHub */}
        <div style={grid2}>
          <div>
            {label('Website', true)}
            <input value={form.website_url} onChange={e => set('website_url', e.target.value)} placeholder="https://yourproject.io" style={inp(!!errors.website_url)} />
            {errors.website_url && <p style={{ fontSize: 12, color: 'var(--red)', marginTop: 4 }}>{errors.website_url}</p>}
          </div>
          <div>
            {label('GitHub', false, true)}
            <input value={form.github_url} onChange={e => set('github_url', e.target.value)} placeholder="https://github.com/..." style={inp()} />
          </div>
        </div>

        {/* Twitter + Discord */}
        <div style={grid2}>
          <div>
            {label('X / Twitter', false, true)}
            <input value={form.twitter_url} onChange={e => set('twitter_url', e.target.value)} placeholder="https://x.com/yourproject" style={inp()} />
          </div>
          <div>
            {label('Discord', false, true)}
            <input value={form.discord_url} onChange={e => set('discord_url', e.target.value)} placeholder="https://discord.gg/..." style={inp()} />
          </div>
        </div>

        {/* Telegram + Docs */}
        <div style={grid2}>
          <div>
            {label('Telegram', false, true)}
            <input value={form.telegram_url} onChange={e => set('telegram_url', e.target.value)} placeholder="https://t.me/yourproject" style={inp()} />
          </div>
          <div>
            {label('Docs', false, true)}
            <input value={form.docs_url} onChange={e => set('docs_url', e.target.value)} placeholder="https://docs.yourproject.io" style={inp()} />
          </div>
        </div>

        {/* Category */}
        <div>
          {label('Category', true)}
          <select value={form.category} onChange={e => set('category', e.target.value)} style={{ ...inp(!!errors.category), cursor: 'pointer' }}>
            <option value="">Select a category...</option>
            {PROJECT_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
          {errors.category && <p style={{ fontSize: 12, color: 'var(--red)', marginTop: 4 }}>{errors.category}</p>}
        </div>

        <div style={{ padding: '12px 16px', background: 'var(--bg-secondary)', border: '1px solid var(--border-hi)', borderRadius: 8, fontSize: 12, color: 'var(--text-3)', lineHeight: 1.6, display: 'flex', gap: 8 }}>
          <AlertCircle size={13} style={{ flexShrink: 0, marginTop: 1 }} />
          Limited to 5 submissions per day. AI evaluation runs automatically via GenLayer AI Consensus.
        </div>

        {errors.submit && (
          <div style={{ padding: '12px 16px', background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 8, fontSize: 13, color: 'var(--red)' }}>
            {errors.submit}
          </div>
        )}

        <button type="submit" disabled={loading} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, padding: '13px 28px', alignSelf: 'flex-start', background: loading ? 'var(--bg-tertiary)' : 'var(--text-1)', color: loading ? 'var(--text-3)' : 'var(--bg)', fontFamily: 'var(--font-sans)', fontWeight: 700, fontSize: 14, border: 'none', cursor: loading ? 'not-allowed' : 'pointer', borderRadius: 8 }}>
          {loading
            ? <><Loader2 size={15} style={{ animation: 'spin 1s linear infinite' }} /> Submitting...</>
            : <><ArrowRight size={15} /> Submit for AI Evaluation</>
          }
        </button>
      </form>
    </div>
  )
}
