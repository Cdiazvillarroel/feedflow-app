import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl) throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL')
if (!supabaseAnonKey) throw new Error('Missing NEXT_PUBLIC_SUPABASE_ANON_KEY')

// ─── PUBLIC CLIENT (browser + server components) ─────────────────────────────
// Uses the anon/publishable key — subject to Row Level Security
export const supabase = createClient(supabaseUrl, supabaseAnonKey)

// ─── ADMIN CLIENT (server only) ──────────────────────────────────────────────
// Uses the service_role/secret key — bypasses RLS
// NEVER import this in client components ('use client')
export const supabaseAdmin = supabaseServiceKey
  ? createClient(supabaseUrl, supabaseServiceKey)
  : supabase
