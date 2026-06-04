'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useEffect, useState } from 'react'
import { Home, Compass, PlusCircle, BookOpen, Users, FolderOpen, ShieldCheck, ChevronLeft, ChevronRight, UserCircle, ChevronDown, Trophy } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import type { Session } from '@supabase/supabase-js'

const ADMIN_EMAILS = ['wolegold247@gmail.com']

const NAV = [
  { href: '/',          label: 'Home',      icon: Home,       disabled: false },
  { href: '/explore',   label: 'Explore',   icon: Compass,    disabled: false },
  { href: '/submit',    label: 'Submit',    icon: PlusCircle, disabled: false },
  { href: '/resources', label: 'Resources', icon: BookOpen,   disabled: false },
]

const IS_PROD = process.env.NODE_ENV === 'production'

function XIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.744l7.737-8.835L1.254 2.25H8.08l4.253 5.622 5.91-5.622zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
    </svg>
  )
}

interface Props { session: Session | null }



export function Sidebar({ session: initialSession }: Props) {
  const pathname = usePathname()
  const [mounted,   setMounted]   = useState(false)
  const [stats,     setStats]     = useState({ users: 0, projects: 0, evaluations: 0 })
  const [collapsed, setCollapsed] = useState(false)
  const [buildersOpen, setBuildersOpen] = useState(false)

  useEffect(() => {
    setMounted(true)
    async function loadStats() {
      try {
        const res = await fetch('/api/stats')
        const d = await res.json()
        setStats({ users: d.users ?? 0, projects: d.projects ?? 0, evaluations: d.evaluations ?? 0 })
      } catch {}
    }
    loadStats()
    const id = setInterval(loadStats, 30000)
    return () => clearInterval(id)
  }, [])

  const width = collapsed ? 64 : 200

  return (
    <>
      <aside className="sidebar-desktop" style={{
        width, minWidth: width,
        position: 'fixed', top: 64, left: 0,
        height: 'calc(100vh - 64px)',
        borderRight: '1px solid var(--border)',
        background: 'var(--bg)',
        display: 'flex', flexDirection: 'column',
        zIndex: 40,
        transition: 'width 0.22s ease',
        overflow: 'hidden',
      }}>
        {/* Collapse toggle */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: collapsed ? 'center' : 'space-between', padding: '10px 12px', borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
          {!collapsed && (
            <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-3)', letterSpacing: '0.08em', textTransform: 'uppercase', fontFamily: 'var(--font-mono)' }}>
              Navigation
            </span>
          )}
          <button onClick={() => setCollapsed(!collapsed)} style={{
            width: 24, height: 24, borderRadius: '50%',
            border: '1px solid var(--border-hi)', background: 'var(--bg-secondary)',
            color: 'var(--text-3)', display: 'flex', alignItems: 'center',
            justifyContent: 'center', cursor: 'pointer',
          }}>
            {collapsed ? <ChevronRight size={12} /> : <ChevronLeft size={12} />}
          </button>
        </div>

        {/* Nav */}
        <nav style={{ flex: 1, paddingTop: 6, overflowY: 'auto' }}>
          {NAV.map(({ href, label, icon: Icon }) => {
            const active = pathname === href || (href !== '/' && pathname.startsWith(href))
            return (
              <Link key={href} href={href} style={{
                display: 'flex', alignItems: 'center',
                gap: 10, padding: collapsed ? '12px 0' : '11px 18px',
                justifyContent: collapsed ? 'center' : 'flex-start',
                fontSize: 14, fontWeight: active ? 700 : 500,
                color: active ? 'var(--brand)' : 'var(--text-2)',
                background: active ? 'var(--brand-bg)' : 'transparent',
                textDecoration: 'none',
                borderLeft: active && !collapsed ? '3px solid var(--brand)' : '3px solid transparent',
                transition: 'all 0.12s', whiteSpace: 'nowrap', overflow: 'hidden',
              }}>
                <Icon size={16} style={{ flexShrink: 0, color: active ? 'var(--brand)' : 'inherit' }} />
                {!collapsed && label}
              </Link>
            )
          })}
          {/* Admin link — only for admin user */}
          {initialSession?.user?.email && ADMIN_EMAILS.includes(initialSession.user.email) && (
            <Link href="/admin" style={{
              display: 'flex', alignItems: 'center',
              gap: 10, padding: collapsed ? '12px 0' : '11px 18px',
              justifyContent: collapsed ? 'center' : 'flex-start',
              fontSize: 14, fontWeight: pathname === '/admin' ? 700 : 500,
              color: pathname === '/admin' ? 'var(--brand)' : 'var(--text-2)',
              background: pathname === '/admin' ? 'var(--brand-bg)' : 'transparent',
              borderLeft: pathname === '/admin' && !collapsed ? '3px solid var(--brand)' : '3px solid transparent',
              textDecoration: 'none', whiteSpace: 'nowrap', overflow: 'hidden',
            }}>
              <ShieldCheck size={16} style={{ flexShrink: 0, color: pathname === '/admin' ? 'var(--brand)' : 'inherit' }} />
              {!collapsed && 'Admin'}
            </Link>
          )}

          {/* Builders dropdown */}
          <div>
            <div
              onClick={() => !collapsed && setBuildersOpen(o => !o)}
              style={{
                display: 'flex', alignItems: 'center',
                gap: 10, padding: collapsed ? '12px 0' : '11px 18px',
                justifyContent: collapsed ? 'center' : 'flex-start',
                fontSize: 14, fontWeight: pathname.startsWith('/builders') ? 700 : 500,
                color: pathname.startsWith('/builders') ? 'var(--brand)' : 'var(--text-2)',
                background: pathname.startsWith('/builders') ? 'var(--brand-bg)' : 'transparent',
                borderLeft: pathname.startsWith('/builders') && !collapsed ? '3px solid var(--brand)' : '3px solid transparent',
                cursor: 'pointer', whiteSpace: 'nowrap', overflow: 'hidden',
                userSelect: 'none',
              }}
            >
              <Users size={16} style={{ flexShrink: 0, color: pathname.startsWith('/builders') ? 'var(--brand)' : 'inherit' }} />
              {!collapsed && (
                <>
                  <span style={{ flex: 1 }}>Builders</span>
                  <ChevronDown size={12} style={{ transform: buildersOpen ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.2s', marginRight: 4 }} />
                </>
              )}
            </div>
            {!collapsed && buildersOpen && (
              <div style={{ paddingLeft: 32 }}>
                <Link href="/builders" style={{
                  display: 'flex', alignItems: 'center', gap: 8,
                  padding: '8px 18px 8px 0', fontSize: 13,
                  color: pathname === '/builders' ? 'var(--brand)' : 'var(--text-3)',
                  fontWeight: pathname === '/builders' ? 600 : 400,
                  textDecoration: 'none',
                }}>All Builders</Link>
                <Link href="/builders/leaderboard" style={{
                  display: 'flex', alignItems: 'center', gap: 8,
                  padding: '8px 18px 8px 0', fontSize: 13,
                  color: pathname === '/builders/leaderboard' ? 'var(--brand)' : 'var(--text-3)',
                  fontWeight: pathname === '/builders/leaderboard' ? 600 : 400,
                  textDecoration: 'none',
                }}>
                  <Trophy size={11} /> Leaderboard
                </Link>
              </div>
            )}
          </div>
        </nav>

        {/* Stats */}
        {!collapsed && mounted && (
          <div style={{ borderTop: '1px solid var(--border)', padding: '16px 18px', flexShrink: 0 }}>
            {[
              { icon: Users,       label: 'Users',       value: stats.users       },
              { icon: FolderOpen,  label: 'Projects',    value: stats.projects    },
              { icon: ShieldCheck, label: 'Evaluations', value: stats.evaluations },
            ].map(({ icon: Icon, label, value }) => (
              <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
                <div style={{ width: 36, height: 36, borderRadius: 10, background: 'var(--brand-bg)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <Icon size={16} color="var(--brand)" />
                </div>
                <div>
                  <div style={{ fontWeight: 800, fontSize: 18, color: 'var(--text-1)', lineHeight: 1, letterSpacing: '-0.02em' }}>
                    {value > 0 ? value.toLocaleString() : '—'}
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 1 }}>{label}</div>
                </div>
              </div>
            ))}


          </div>
        )}

        {/* Collapsed: show X icon only */}

      </aside>
      <div style={{ width, minWidth: width, flexShrink: 0, transition: 'width 0.22s ease' }} />
    </>
  )
}
