'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Search, Moon, Sun, Plus } from 'lucide-react'
import { useTheme } from 'next-themes'
import Link from 'next/link'
import type { Session } from '@supabase/supabase-js'

interface Props { session: Session | null }

export function Topbar({ session }: Props) {
  const router = useRouter()
  const { resolvedTheme, setTheme } = useTheme()
  const [mounted, setMounted] = useState(false)
  const [search,  setSearch]  = useState('')

  useEffect(() => setMounted(true), [])

  function handleSearch(e: React.FormEvent) {
    e.preventDefault()
    if (search.trim()) router.push(`/explore?search=${encodeURIComponent(search.trim())}`)
  }

  const isDark = resolvedTheme === 'dark'

  return (
    <header style={{
      height: 64,
      borderBottom: '1px solid var(--border-hi)',
      display: 'flex',
      alignItems: 'center',
      padding: '0 24px',
      gap: 12,
      background: 'var(--bg)',
      position: 'sticky',
      top: 0,
      zIndex: 30,
      justifyContent: 'flex-end',
    }}>

      {/* Search — right side */}
      <form onSubmit={handleSearch} style={{
        display: 'flex', alignItems: 'center', gap: 8,
        padding: '0 12px', height: 36,
        border: '1px solid var(--border-hi)',
        background: 'var(--bg-secondary)',
        width: 260,
      }}>
        <Search size={13} color="var(--text-3)" style={{ flexShrink: 0 }} />
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search projects..."
          style={{
            flex: 1, border: 'none', background: 'transparent',
            outline: 'none', fontSize: 13.5, color: 'var(--text-1)',
            fontFamily: 'var(--font-sans)',
          }}
        />
      </form>

      {/* Submit CTA */}
      <Link href="/submit" style={{
        display: 'flex', alignItems: 'center', gap: 6,
        padding: '0 16px', height: 36,
        background: 'var(--text-1)', color: 'var(--bg)',
        fontFamily: 'var(--font-sans)', fontWeight: 600, fontSize: 13,
        textDecoration: 'none', whiteSpace: 'nowrap',
      }}>
        <Plus size={13} /> Submit Project
      </Link>

      {/* Theme toggle */}
      {mounted && (
        <button
          onClick={() => setTheme(isDark ? 'light' : 'dark')}
          style={{
            width: 36, height: 36,
            border: '1px solid var(--border-hi)',
            background: 'transparent',
            color: 'var(--text-2)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            cursor: 'pointer',
          }}
          aria-label="Toggle theme"
        >
          {isDark ? <Sun size={14} /> : <Moon size={14} />}
        </button>
      )}
    </header>
  )
}
