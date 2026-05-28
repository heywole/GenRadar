import { createClient } from '@supabase/supabase-js'

const url  = process.env.NEXT_PUBLIC_SUPABASE_URL!
const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

// Single global instance - prevents multiple GoTrueClient warning
let _supabase: ReturnType<typeof createClient> | null = null

export const supabase = (() => {
  if (!_supabase) {
    _supabase = createClient(url, anon, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
        storageKey: 'genlayer-auth',
      },
    })
  }
  return _supabase
})()

export const supabaseServer = supabase
