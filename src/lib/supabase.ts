import { createClient, SupabaseClient } from '@supabase/supabase-js'

const url  = process.env.NEXT_PUBLIC_SUPABASE_URL  || 'https://placeholder.supabase.co'
const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'placeholder-key'
const svc  = process.env.SUPABASE_SERVICE_ROLE_KEY || anon

export const supabase: SupabaseClient = createClient(url, anon)
export const supabaseAdmin: SupabaseClient = createClient(url, svc)
export const isConfigured = Boolean(
  process.env.NEXT_PUBLIC_SUPABASE_URL &&
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
)
