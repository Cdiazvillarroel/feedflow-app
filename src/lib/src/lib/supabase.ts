import { createClient } from '@supabase/supabase-js'

// ─── PUBLIC CLIENT (browser + server components) ──────────────────────────────
// Uses the anon key — subject to Row Level Security
export const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

// ─── ADMIN CLIENT (server only — API routes, Server Actions) ──────────────────
// Uses the service role key — bypasses RLS
// NEVER import this in client components
export const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)
