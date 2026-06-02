'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useEffect, useState } from 'react'
import { Home, Compass, PlusCircle, BookOpen, Users, FolderOpen, ShieldCheck, ChevronLeft, ChevronRight, UserCircle } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import type { Session } from '@supabase/supabase-js'

const NAV = [
  { href: '/',          label: 'Home',      icon: Home,       disabled: false },
  { href: '/explore',   label: 'Explore',   icon: Compass,    disabled: false },
  { href: '/submit',    label: 'Submit',    icon: PlusCircle, disabled: false },
  { href: '/resources', label: 'Resources', icon: BookOpen,   disabled: false },
]

const NAV_COMING = [
  { label: 'Builder Profile', icon: UserCircle },
]

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

  useEffect(() => {
    setMounted(true)
    async function loadStats() {
      const [p, a] = await Promise.all([
        supabase.from('projects').select('*', { count: 'exact', head: true }).eq('status', 'active'),
        supabase.from('ai_scores').select('*', { count: 'exact', head: true }),
      ])
      const { data: userRows } = await supabase
        .from('interactions')
        .select('user_id')
      const distinctUsers = new Set((userRows ?? []).map((r: any) => r.user_id)).size
      setStats({
        users:       distinctUsers,
        projects:    p.count ?? 0,
        evaluations: a.count ?? 0,
      })
    }
    loadStats()
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
          {NAV_COMING.map(({ label, icon: Icon }) => (
            <div key={label} style={{
              display: 'flex', alignItems: 'center',
              gap: 10, padding: collapsed ? '12px 0' : '11px 18px',
              justifyContent: collapsed ? 'center' : 'flex-start',
              fontSize: 14, fontWeight: 500,
              color: 'var(--text-3)',
              background: 'transparent',
              borderLeft: '3px solid transparent',
              whiteSpace: 'nowrap', overflow: 'hidden',
              cursor: 'not-allowed', opacity: 0.5,
              userSelect: 'none',
            }}>
              <Icon size={16} style={{ flexShrink: 0 }} />
              {!collapsed && (
                <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                  {label}
                  <span style={{ fontSize: 9, padding: '1px 5px', borderRadius: 4, background: 'var(--bg-tertiary)', color: 'var(--text-3)', fontFamily: 'var(--font-mono)', letterSpacing: '0.04em' }}>
                    SOON
                  </span>
                </span>
              )}
            </div>
          ))}
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
