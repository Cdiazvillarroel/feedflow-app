import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(req: NextRequest) {
  const body = await req.json()

  if (body.action === 'create') {
    const { data, error } = await supabaseAdmin.auth.admin.createUser({
      email:         body.email,
      password:      body.password,
      email_confirm: true,
    })
    if (error) return NextResponse.json({ error: error.message }, { status: 400 })
    await supabaseAdmin.from('roles').insert({ user_id: data.user.id, role: body.role || 'client' })
    if (body.client_id) {
      await supabaseAdmin.from('client_users').insert({ user_id: data.user.id, client_id: body.client_id, role: 'owner' })
    }
    return NextResponse.json({ ok: true, user_id: data.user.id })
  }

  if (body.action === 'delete') {
    const { error } = await supabaseAdmin.auth.admin.deleteUser(body.user_id)
    if (error) return NextResponse.json({ error: error.message }, { status: 400 })
    await supabaseAdmin.from('roles').delete().eq('user_id', body.user_id)
    await supabaseAdmin.from('client_users').delete().eq('user_id', body.user_id)
    return NextResponse.json({ ok: true })
  }

  return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
}
