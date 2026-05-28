import { Shield } from 'lucide-react'
import type { RiskLevel } from '@/types'

export function RiskBadge({ risk, size = 'md' }: { risk: RiskLevel; size?: 'sm'|'md'|'lg' }) {
  const c = {
    Low:    { color: 'var(--green)',  bg: 'var(--green-bg)',  border: 'var(--green-bd)'  },
    Medium: { color: 'var(--yellow)', bg: 'var(--yellow-bg)', border: 'var(--yellow-bd)' },
    High:   { color: 'var(--red)',    bg: 'var(--red-bg)',    border: 'var(--red-bd)'    },
  }[risk]
  const fs  = { sm: 11, md: 12, lg: 13 }[size]
  const ics = { sm: 10, md: 11, lg: 13 }[size]
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 5,
      padding: size === 'lg' ? '5px 12px' : '3px 10px',
      borderRadius: 999, fontSize: fs, fontWeight: 500,
      color: c.color, background: c.bg, border: `1px solid ${c.border}`,
    }}>
      <Shield size={ics}/> {risk} Risk
    </span>
  )
}
