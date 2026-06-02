'use client'

import { useState, useEffect } from 'react'

export function Footer() {
  const [avatar, setAvatar] = useState<string | null>(null)

  useEffect(() => {
    // Fetch heywole's builder profile for the avatar
    fetch('/api/builder-profile?user_id=59265f3b-db3e-45ae-a340-7267bcc70a4e')
      .then(r => r.json())
      .then(d => setAvatar(d.profile?.avatar_url || null))
      .catch(() => {})
  }, [])

  return (
    <footer style={{
      borderTop: '1px solid var(--border)',
      padding: '16px 32px',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 24,
      flexWrap: 'wrap',
    }}>
      <p style={{ fontSize: 13, color: 'var(--text-3)' }}>
        © {new Date().getFullYear()} GenRadar. All rights reserved.
      </p>

      {/* GitHub */}
      <a
        href="https://github.com/heywole/genradar"
        target="_blank"
        rel="noopener noreferrer"
        style={{ display: 'flex', alignItems: 'center', color: 'var(--text-3)', textDecoration: 'none' }}
        title="View on GitHub"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
          <path d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z"/>
        </svg>
      </a>

      {/* Built by @heywole */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        {/* Avatar */}
        <div style={{
          width: 26, height: 26, borderRadius: '50%',
          overflow: 'hidden', flexShrink: 0,
          background: 'var(--bg-secondary)',
          border: '1px solid var(--border)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          {avatar
            ? <img src={avatar} alt="heywole" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            : <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor" style={{ color: 'var(--text-3)' }}>
                <path d="M12 12c2.7 0 4.8-2.1 4.8-4.8S14.7 2.4 12 2.4 7.2 4.5 7.2 7.2 9.3 12 12 12zm0 2.4c-3.2 0-9.6 1.6-9.6 4.8v2.4h19.2v-2.4c0-3.2-6.4-4.8-9.6-4.8z"/>
              </svg>
          }
        </div>

        <span style={{ fontSize: 13, color: 'var(--text-3)' }}>
          Built by <strong style={{ color: 'var(--text-2)' }}>@heywole</strong>
        </span>

        {/* FOLLOW button */}
        <a
          href="https://x.com/heywole"
          target="_blank"
          rel="noopener noreferrer"
          style={{
            display: 'inline-flex', alignItems: 'center', gap: 5,
            padding: '4px 12px', borderRadius: 999,
            background: 'var(--text-1)', color: 'var(--bg)',
            fontSize: 12, fontWeight: 700, textDecoration: 'none',
            transition: 'opacity 0.15s',
          }}
          onMouseEnter={e => (e.currentTarget as HTMLAnchorElement).style.opacity = '0.8'}
          onMouseLeave={e => (e.currentTarget as HTMLAnchorElement).style.opacity = '1'}
        >
          FOLLOW
        </a>
      </div>
    </footer>
  )
}
