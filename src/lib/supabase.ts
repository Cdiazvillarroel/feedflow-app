import { createClient, SupabaseClient } from '@supabase/supabase-js'

const url  = process.env.NEXT_PUBLIC_SUPABASE_URL  || 'https://placeholder.supabase.co'
const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'placeholder-key'
const svc  = process.env.SUPABASE_SERVICE_ROLE_KEY || anon

const globalForSupabase = globalThis as unknown as {
  supabase:      SupabaseClient | undefined
  supabaseAdmin: SupabaseClient | undefined
}

export const supabase: SupabaseClient =
  globalForSupabase.supabase ?? createClient(url, anon)

export const supabaseAdmin: SupabaseClient =
  globalForSupabase.supabaseAdmin ?? createClient(url, svc)

if (process.env.NODE_ENV !== 'production') {
  globalForSupabase.supabase      = supabase
  globalForSupabase.supabaseAdmin = supabaseAdmin
}

export const isConfigured = Boolean(
  process.env.NEXT_PUBLIC_SUPABASE_URL &&
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
)
