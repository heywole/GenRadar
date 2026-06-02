'use client'

import Link from 'next/link'
import { useTheme } from 'next-themes'
import { useEffect, useRef, useState } from 'react'
import { Moon, Sun, Plus, User, LogIn, LogOut, Settings, ChevronDown } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import type { Session } from '@supabase/supabase-js'

interface Props { session: Session | null }

export function Navbar({ session: initialSession }: Props) {
  const { resolvedTheme, setTheme } = useTheme()
  const [mounted,     setMounted]     = useState(false)
  const [session,     setSession]     = useState<Session | null>(initialSession)
  const [dropOpen,    setDropOpen]    = useState(false)
  const [avatarError, setAvatarError] = useState(false)
  const dropRef = useRef<HTMLDivElement>(null)
  const router  = useRouter()
  const isDark  = resolvedTheme === 'dark'

  useEffect(() => {
    setMounted(true)
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, s) => {
      setSession(s)
      setAvatarError(false)
    })
    function handleClick(e: MouseEvent) {
      if (dropRef.current && !dropRef.current.contains(e.target as Node)) setDropOpen(false)
    }
    document.addEventListener('mousedown', handleClick)
    return () => { subscription.unsubscribe(); document.removeEventListener('mousedown', handleClick) }
  }, [])

  async function handleSignOut() {
    setDropOpen(false)
    await supabase.auth.signOut()
    router.push('/')
    router.refresh()
  }

  const avatarUrl = session?.user?.user_metadata?.avatar_url
  const userName  = session?.user?.user_metadata?.full_name || session?.user?.email?.split('@')[0] || 'Profile'

  return (
    <header style={{
      height: 64, borderBottom: '1px solid var(--border)',
      background: 'var(--bg-card)', position: 'fixed',
      top: 0, left: 0, right: 0, zIndex: 100,
      display: 'flex', alignItems: 'center', padding: '0 20px', gap: 12,
    }}>
      <Link href="/" style={{ display: 'flex', alignItems: 'center', gap: 8, textDecoration: 'none', flexShrink: 0 }}>
        {mounted ? (
          // Use SVG logos — switch between dark and light version
          <img
            src={isDark ? '/logo-dark.svg' : '/logo-light.svg'}
            alt="GenRadar"
            style={{ height: 44, width: 'auto', objectFit: 'contain', display: 'block' }}
            onError={e => {
              // fallback: try png, then hide
              const img = e.target as HTMLImageElement
              if (img.src.endsWith('.svg')) {
                img.src = isDark ? '/logo-dark.png' : '/logo-light.png'
              } else {
                img.style.display = 'none'
              }
            }}
          />
        ) : (
          // SSR placeholder keeps layout stable before hydration
          <div style={{ height: 44, width: 44 }} />
        )}
        <span style={{ fontWeight: 900, fontSize: 21, letterSpacing: '-0.04em', color: 'var(--text-1)' }}>
          GenRadar
        </span>
      </Link>

      <div style={{ flex: 1 }} />

      <Link href="/submit" style={{
        display: 'inline-flex', alignItems: 'center', gap: 6,
        padding: '0 16px', height: 38, borderRadius: 20,
        background: 'var(--brand)', color: '#fff',
        fontWeight: 700, fontSize: 13, textDecoration: 'none', whiteSpace: 'nowrap',
      }}>
        <Plus size={14} /> Submit Project
      </Link>

      {mounted && (
        <button onClick={() => setTheme(isDark ? 'light' : 'dark')} style={{
          width: 38, height: 38, borderRadius: '50%', border: '1px solid var(--border-hi)',
          background: 'var(--bg-secondary)', color: 'var(--text-2)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer',
        }}>
          {isDark ? <Sun size={15} /> : <Moon size={15} />}
        </button>
      )}

      {mounted && (
        session ? (
          <div ref={dropRef} style={{ position: 'relative' }}>
            <button onClick={() => setDropOpen(!dropOpen)} style={{
              display: 'inline-flex', alignItems: 'center', gap: 8,
              height: 38, padding: '0 12px', borderRadius: 20,
              border: '1px solid var(--border-hi)', background: 'var(--bg-secondary)',
              color: 'var(--text-1)', cursor: 'pointer', fontSize: 13, fontWeight: 500,
            }}>
              <div style={{ width: 26, height: 26, borderRadius: '50%', overflow: 'hidden', background: 'var(--brand-bg)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                {avatarUrl && !avatarError
                  ? <img src={avatarUrl} alt="avatar"
                      style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                      onError={() => setAvatarError(true)} />
                  : <User size={13} color="var(--brand)" />
                }
              </div>
              <span style={{ maxWidth: 80, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{userName}</span>
              <ChevronDown size={12} style={{ transform: dropOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.15s' }} />
            </button>

            {dropOpen && (
              <div style={{
                position: 'absolute', top: 'calc(100% + 8px)', right: 0,
                minWidth: 180, background: 'var(--bg-card)',
                border: '1px solid var(--border-hi)', borderRadius: 12,
                padding: '6px', zIndex: 200,
                boxShadow: '0 8px 24px rgba(0,0,0,0.12)',
              }}>
                <Link href="/profile" onClick={() => setDropOpen(false)} style={{
                  display: 'flex', alignItems: 'center', gap: 8, padding: '9px 12px',
                  borderRadius: 8, fontSize: 13, color: 'var(--text-1)', textDecoration: 'none',
                  fontWeight: 500,
                }}>
                  <Settings size={14} color="var(--text-3)" /> My Profile
                </Link>
                <div style={{ height: 1, background: 'var(--border)', margin: '4px 0' }} />
                <button onClick={handleSignOut} style={{
                  width: '100%', display: 'flex', alignItems: 'center', gap: 8,
                  padding: '9px 12px', borderRadius: 8, fontSize: 13,
                  color: 'var(--red)', border: 'none', background: 'transparent',
                  cursor: 'pointer', fontWeight: 500, textAlign: 'left',
                }}>
                  <LogOut size={14} /> Sign Out
                </button>
              </div>
            )}
          </div>
        ) : (
          <Link href="/auth" style={{
            display: 'inline-flex', alignItems: 'center', gap: 6,
            height: 38, padding: '0 14px', borderRadius: 20,
            border: '1px solid var(--border-hi)', background: 'var(--bg-secondary)',
            color: 'var(--text-1)', textDecoration: 'none', fontSize: 13, fontWeight: 600,
          }}>
            <LogIn size={14} /> Sign In
          </Link>
        )
      )}
    </header>
  )
}
