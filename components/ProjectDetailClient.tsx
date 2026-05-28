'use client'

import { useState, useEffect } from 'react'
import { Eye, Bookmark } from 'lucide-react'
import { supabase } from '@/lib/supabase'

interface Props { projectId: string; initialViews: number; initialSaves: number }

export function ProjectDetailClient({ projectId, initialViews, initialSaves }: Props) {
  const [views, setViews] = useState(initialViews)
  const [saves, setSaves] = useState(initialSaves)

  useEffect(() => {
    async function recordAndFetchView() {
      // Record a view once per browser session (for any visitor, signed-in or not)
      const key = `viewed_${projectId}`
      if (!sessionStorage.getItem(key)) {
        try {
          const { data: { session } } = await supabase.auth.getSession()
          if (session) {
            // Authenticated: record through API
            const res = await fetch('/api/interact', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
              body: JSON.stringify({ project_id: projectId, type: 'view' }),
            })
            if (res.ok) sessionStorage.setItem(key, '1')
          } else {
            // Anonymous: still mark as viewed in session so we don't refetch
            sessionStorage.setItem(key, '1')
          }
        } catch {}
      }

      // Always fetch the real count from DB so the displayed number is accurate
      try {
        const { count } = await supabase
          .from('interactions')
          .select('*', { count: 'exact', head: true })
          .eq('project_id', projectId)
          .eq('type', 'view')
        if (count !== null) setViews(count)
      } catch {}

      // Fetch real save count too
      try {
        const { count } = await supabase
          .from('interactions')
          .select('*', { count: 'exact', head: true })
          .eq('project_id', projectId)
          .eq('type', 'save')
        if (count !== null) setSaves(count)
      } catch {}
    }

    recordAndFetchView()
  }, [projectId])

  return (
    <div style={{ display: 'flex', gap: 20, marginTop: 14 }}>
      <span style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 12, color: 'var(--text-3)', fontFamily: 'var(--font-mono)' }}>
        <Eye size={11} /> {views} view{views !== 1 ? 's' : ''}
      </span>
      <span style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 12, color: 'var(--text-3)', fontFamily: 'var(--font-mono)' }}>
        <Bookmark size={11} /> {saves} save{saves !== 1 ? 's' : ''}
      </span>
    </div>
  )
}
