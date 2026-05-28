'use client'

import { useState } from 'react'
import { BuilderProfile } from '@/components/BuilderProfile'

interface Props {
  projectDetailsPanel: React.ReactNode
  builderId: string
}

export function ProjectTabs({ projectDetailsPanel, builderId }: Props) {
  const [tab, setTab] = useState<'details' | 'builder'>('details')

  return (
    <div>
      {/* Tab bar */}
      <div style={{ display: 'flex', borderBottom: '1px solid var(--border)', marginBottom: 28 }}>
        {[
          { key: 'details' as const, label: 'Project Details' },
          { key: 'builder' as const, label: 'Builder Profile' },
        ].map(({ key, label }) => (
          <button key={key} onClick={() => setTab(key)} style={{
            padding: '10px 22px', border: 'none', cursor: 'pointer',
            background: 'transparent', fontSize: 13, fontWeight: tab === key ? 700 : 500,
            color: tab === key ? 'var(--text-1)' : 'var(--text-3)',
            borderBottom: tab === key ? '2px solid var(--brand)' : '2px solid transparent',
            marginBottom: -1, transition: 'all 0.12s', fontFamily: 'var(--font-sans)',
          }}>
            {label}
          </button>
        ))}
      </div>

      {/* Content */}
      {tab === 'details' ? (
        <div>{projectDetailsPanel}</div>
      ) : (
        <BuilderProfile builderId={builderId} />
      )}
    </div>
  )
}
