import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(req: NextRequest) {
  const { email, password } = await req.json()

  // Authenticate with Supabase
  const { data, error } = await supabaseAdmin.auth.signInWithPassword({ email, password })
  if (error || !data.user) return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 })

  // Check admin role
  const { data: roleData } = await supabaseAdmin
    .from('roles').select('role').eq('user_id', data.user.id).single()

  if (roleData?.role !== 'admin') return NextResponse.json({ error: 'Not authorized' }, { status: 403 })

  const response = NextResponse.json({
    ok: true,
    session: {
      access_token:  data.session?.access_token,
      refresh_token: data.session?.refresh_token,
    },
  })

  response.cookies.set('admin_token', process.env.ADMIN_SECRET_TOKEN!, {
    httpOnly: true, secure: true, sameSite: 'strict', maxAge: 60 * 60 * 8, path: '/'
  })

  return response
}
