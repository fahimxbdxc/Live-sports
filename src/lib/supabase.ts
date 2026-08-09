import { createClient } from '@supabase/supabase-js'
import type { Database } from './database.types'

const url = import.meta.env.VITE_SUPABASE_URL?.trim()
const publishableKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY?.trim()

export const isSupabaseConfigured = Boolean(url && publishableKey)

export const supabase = createClient<Database>(
  url || 'https://placeholder.supabase.co',
  publishableKey || 'sb_publishable_placeholder',
  {
    auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
    global: { headers: { 'X-Client-Info': 'live-sports-tv/1.0' } },
  },
)

export const workerApiUrl = import.meta.env.VITE_WORKER_API_URL?.replace(/\/$/, '') || ''
