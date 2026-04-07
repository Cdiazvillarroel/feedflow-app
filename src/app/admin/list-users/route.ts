import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function GET() {
  try {
    const { data, error } = await supabaseAdmin.auth.admin.listUsers()
    if (error) return NextResponse.json({ error: error.message }, { status: 400 })
    return NextResponse.json({ users: data.users })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
