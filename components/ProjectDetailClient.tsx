'use client'

import { useState, useEffect } from 'react'
import { Eye, Bookmark } from 'lucide-react'
import { supabase } from '@/lib/supabase'

interface Props { projectId: string; initialViews: number; initialSaves: number }

export function ProjectDetailClient({ projectId, initialViews, initialSaves }: Props) {
  const [views, setViews] = useState(initialViews)
  const [saves, setSaves] = useState(initialSaves)

  useEffect(() => {
    // Record a view only once per browser session to avoid inflation
    async function recordView() {
      const key = `viewed_${projectId}`
      if (sessionStorage.getItem(key)) return
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) return
      const res = await fetch('/api/interact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({ project_id: projectId, type: 'view' }),
      })
      if (res.ok) {
        sessionStorage.setItem(key, '1')
        setViews(v => v + 1)
      }
    }
    recordView()
  }, [projectId])

  return (
    <div style={{ display: 'flex', gap: 20, marginTop: 14 }}>
      <span style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 12, color: 'var(--text-3)', fontFamily: 'var(--font-mono)' }}>
        <Eye size={11} /> {views} views
      </span>
      <span style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 12, color: 'var(--text-3)', fontFamily: 'var(--font-mono)' }}>
        <Bookmark size={11} /> {saves} saves
      </span>
    </div>
  )
}
