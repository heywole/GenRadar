'use client'

import { useState, useEffect } from 'react'
import { Bookmark } from 'lucide-react'
import { supabase } from '@/lib/supabase'

interface Props { projectId: string; onCountChange?: (delta: number) => void }

export function SaveButton({ projectId, onCountChange }: Props) {
  const [saved,   setSaved]   = useState(false)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    async function checkSaved() {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) return
      const { data } = await supabase
        .from('interactions').select('id')
        .eq('project_id', projectId).eq('user_id', session.user.id).eq('type', 'save')
        .maybeSingle()
      setSaved(!!data)
    }
    checkSaved()
  }, [projectId])

  async function handleSave() {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) { window.location.href = '/auth'; return }
    setLoading(true)
    const res  = await fetch('/api/interact', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
      body: JSON.stringify({ project_id: projectId, type: 'save' }),
    })
    const data = await res.json()
    const added = data.action === 'added'
    setSaved(added)
    onCountChange?.(added ? 1 : -1)
    setLoading(false)
  }

  return (
    <button onClick={handleSave} disabled={loading} style={{
      display: 'inline-flex', alignItems: 'center', gap: 7,
      padding: '10px 18px', borderRadius: 9, cursor: loading ? 'wait' : 'pointer',
      background: saved ? 'var(--green-bg)' : 'transparent',
      color: saved ? 'var(--green)' : 'var(--text-2)',
      border: `1px solid ${saved ? 'var(--green-bd)' : 'var(--border-hi)'}`,
      fontSize: 13, fontFamily: 'var(--font-sans)', transition: 'all 0.15s',
    }}>
      <Bookmark size={13} fill={saved ? 'currentColor' : 'none'} />
      {saved ? 'Saved' : 'Save'}
    </button>
  )
}
