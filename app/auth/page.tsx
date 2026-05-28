'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Mail, Lock, Eye, EyeOff, ArrowRight, CheckCircle, AlertCircle, Loader2 } from 'lucide-react'
import { supabase } from '@/lib/supabase'

type Mode = 'signin' | 'signup'

export default function AuthPage() {
  const router = useRouter()
  const [mode,       setMode]       = useState<Mode>('signin')
  const [email,      setEmail]      = useState('')
  const [password,   setPassword]   = useState('')
  const [showPass,   setShowPass]   = useState(false)
  const [loading,    setLoading]    = useState(false)
  const [googleLoad, setGoogleLoad] = useState(false)
  const [message,    setMessage]    = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) router.replace('/')
    })
  }, [router])

  async function handleGoogle() {
    setGoogleLoad(true); setMessage(null)
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: `${location.origin}/api/auth/callback` },
    })
    if (error) { setMessage({ type: 'error', text: error.message }); setGoogleLoad(false) }
  }

  async function handleEmail(e: React.FormEvent) {
    e.preventDefault(); setMessage(null)
    if (!email || !password) { setMessage({ type: 'error', text: 'Please enter your email and password.' }); return }
    if (password.length < 6) { setMessage({ type: 'error', text: 'Password must be at least 6 characters.' }); return }
    setLoading(true)
    if (mode === 'signup') {
      const { error } = await supabase.auth.signUp({ email, password, options: { emailRedirectTo: `${location.origin}/api/auth/callback` } })
      if (error) setMessage({ type: 'error', text: error.message })
      else setMessage({ type: 'success', text: 'Account created! Check your email for a confirmation link.' })
    } else {
      const { error } = await supabase.auth.signInWithPassword({ email, password })
      if (error) setMessage({ type: 'error', text: error.message === 'Invalid login credentials' ? 'Wrong email or password.' : error.message })
      else { router.replace('/'); router.refresh() }
    }
    setLoading(false)
  }

  const inputStyle: React.CSSProperties = {
    width: '100%', height: 48, padding: '0 14px',
    background: 'var(--bg-secondary)',
    border: '1.5px solid var(--border-hi)',
    borderRadius: 10, fontSize: 14,
    color: 'var(--text-1)', outline: 'none',
    fontFamily: 'var(--font-sans)',
    transition: 'border-color 0.15s',
    boxSizing: 'border-box',
  }

  return (
    <div style={{ minHeight: 'calc(100vh - 64px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '40px 24px', background: 'var(--bg)' }}>
      <div style={{ width: '100%', maxWidth: 440, background: 'var(--bg-card)', border: '1px solid var(--border-hi)', borderRadius: 20, padding: '40px 36px' }}>

        {/* Header */}
        <div style={{ marginBottom: 28 }}>
          <p style={{ fontFamily: 'var(--font-mono)', fontSize: 10, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--brand)', marginBottom: 8 }}>§ Authentication</p>
          <h1 style={{ fontWeight: 900, fontSize: 28, letterSpacing: '-0.03em', color: 'var(--text-1)' }}>
            {mode === 'signin' ? 'Sign in.' : 'Create account.'}
          </h1>
        </div>

        {/* Tab switcher */}
        <div style={{ display: 'flex', borderBottom: '2px solid var(--border)', marginBottom: 28 }}>
          {(['signin', 'signup'] as Mode[]).map(m => (
            <button key={m} onClick={() => { setMode(m); setMessage(null) }} style={{
              flex: 1, padding: '10px 0',
              fontFamily: 'var(--font-mono)', fontSize: 11,
              letterSpacing: '0.06em', textTransform: 'uppercase',
              border: 'none', cursor: 'pointer', background: 'transparent',
              color: mode === m ? 'var(--text-1)' : 'var(--text-3)',
              borderBottom: mode === m ? '2px solid var(--text-1)' : '2px solid transparent',
              marginBottom: -2, fontWeight: mode === m ? 700 : 400,
              transition: 'all 0.12s',
            }}>
              {m === 'signin' ? 'Sign In' : 'Sign Up'}
            </button>
          ))}
        </div>

        {/* Google */}
        <button onClick={handleGoogle} disabled={googleLoad} style={{
          width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
          height: 48, marginBottom: 20, border: '1.5px solid var(--border-hi)',
          background: 'var(--bg-secondary)', color: 'var(--text-1)',
          fontSize: 14, fontWeight: 500, fontFamily: 'var(--font-sans)',
          cursor: googleLoad ? 'not-allowed' : 'pointer', borderRadius: 10,
          opacity: googleLoad ? 0.7 : 1, transition: 'background 0.12s',
        }}>
          {googleLoad
            ? <Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} />
            : <svg width="18" height="18" viewBox="0 0 24 24"><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/><path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/></svg>
          }
          Continue with Google
        </button>

        {/* Divider */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
          <div style={{ flex: 1, height: 1, background: 'var(--border-hi)' }} />
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>or email</span>
          <div style={{ flex: 1, height: 1, background: 'var(--border-hi)' }} />
        </div>

        {/* Form */}
        <form onSubmit={handleEmail} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div>
            <label style={{ display: 'flex', alignItems: 'center', gap: 5, fontFamily: 'var(--font-mono)', fontSize: 10, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--text-3)', marginBottom: 8 }}>
              <Mail size={11} /> Email
            </label>
            <input type="email" value={email} onChange={e => setEmail(e.target.value)}
              placeholder="you@example.com" autoComplete="email" style={inputStyle} />
          </div>

          <div>
            <label style={{ display: 'flex', alignItems: 'center', gap: 5, fontFamily: 'var(--font-mono)', fontSize: 10, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--text-3)', marginBottom: 8 }}>
              <Lock size={11} /> Password
            </label>
            <div style={{ position: 'relative' }}>
              <input type={showPass ? 'text' : 'password'} value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder={mode === 'signup' ? 'At least 6 characters' : ''}
                autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
                style={{ ...inputStyle, paddingRight: 48 }} />
              <button type="button" onClick={() => setShowPass(!showPass)} style={{
                position: 'absolute', right: 14, top: '50%', transform: 'translateY(-50%)',
                background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-3)', display: 'flex',
              }}>
                {showPass ? <EyeOff size={15} /> : <Eye size={15} />}
              </button>
            </div>
          </div>

          {message && (
            <div style={{ display: 'flex', gap: 8, padding: '11px 14px', borderRadius: 9, background: message.type === 'success' ? 'var(--green-bg)' : 'var(--red-bg)', border: `1px solid ${message.type === 'success' ? 'var(--green-bd)' : 'var(--red-bd)'}`, fontSize: 13, color: message.type === 'success' ? 'var(--green)' : 'var(--red)' }}>
              {message.type === 'success' ? <CheckCircle size={14} style={{ flexShrink: 0, marginTop: 1 }} /> : <AlertCircle size={14} style={{ flexShrink: 0, marginTop: 1 }} />}
              {message.text}
            </div>
          )}

          <button type="submit" disabled={loading} style={{
            width: '100%', height: 48, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
            background: 'var(--brand)', color: '#fff', border: 'none', borderRadius: 10,
            fontSize: 14, fontWeight: 700, cursor: loading ? 'not-allowed' : 'pointer',
            opacity: loading ? 0.6 : 1, fontFamily: 'var(--font-sans)', marginTop: 4,
          }}>
            {loading
              ? <><Loader2 size={15} style={{ animation: 'spin 1s linear infinite' }} /> {mode === 'signup' ? 'Creating...' : 'Signing in...'}</>
              : <>{mode === 'signup' ? 'Create Account' : 'Sign In'} <ArrowRight size={15} /></>
            }
          </button>
        </form>

        <p style={{ marginTop: 20, fontSize: 11, color: 'var(--text-3)', textAlign: 'center', fontFamily: 'var(--font-mono)' }}>
          Email used for authentication only.
        </p>
      </div>
    </div>
  )
}
