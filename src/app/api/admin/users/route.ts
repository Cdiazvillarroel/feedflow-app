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

    const userId = data.user.id

    await supabaseAdmin.from('roles').insert({ user_id: userId, role: body.role || 'client' })

    if (body.client_id) {
      await supabaseAdmin.from('client_users').insert({ user_id: userId, client_id: body.client_id, role: 'owner' })
    }

    // Assign farms
    if (body.farm_ids && body.farm_ids.length > 0) {
      await supabaseAdmin.from('user_farms').insert(
        body.farm_ids.map((farmId: string) => ({
          user_id: userId,
          farm_id: farmId,
          role: body.role === 'admin' ? 'admin' : 'owner',
        }))
      )
    }

    return NextResponse.json({ ok: true, user_id: userId })
  }

  if (body.action === 'update') {
    const userId = body.user_id
    if (!userId) return NextResponse.json({ error: 'user_id required' }, { status: 400 })

    // Update role
    await supabaseAdmin.from('roles').upsert({ user_id: userId, role: body.role || 'client' })

    // Update client assignment
    if (body.client_id) {
      await supabaseAdmin.from('client_users').delete().eq('user_id', userId)
      await supabaseAdmin.from('client_users').insert({ user_id: userId, client_id: body.client_id, role: 'owner' })
    }

    // Update farm assignments
    if (body.farm_ids !== undefined) {
      await supabaseAdmin.from('user_farms').delete().eq('user_id', userId)
      if (body.farm_ids.length > 0) {
        await supabaseAdmin.from('user_farms').insert(
          body.farm_ids.map((farmId: string) => ({
            user_id: userId,
            farm_id: farmId,
            role: body.role === 'admin' ? 'admin' : 'owner',
          }))
        )
      }
    }

    return NextResponse.json({ ok: true })
  }

  if (body.action === 'get_user_farms') {
    const { data, error } = await supabaseAdmin
      .from('user_farms')
      .select('farm_id')
      .eq('user_id', body.user_id)
    if (error) return NextResponse.json({ error: error.message }, { status: 400 })
    return NextResponse.json({ farm_ids: (data || []).map((r: any) => r.farm_id) })
  }

  if (body.action === 'list_all_user_farms') {
    const { data, error } = await supabaseAdmin
      .from('user_farms')
      .select('user_id, farm_id')
    if (error) return NextResponse.json({ error: error.message }, { status: 400 })
    return NextResponse.json({ user_farms: data || [] })
  }

  if (body.action === 'delete') {
    await supabaseAdmin.from('user_farms').delete().eq('user_id', body.user_id)
    await supabaseAdmin.from('client_users').delete().eq('user_id', body.user_id)
    await supabaseAdmin.from('roles').delete().eq('user_id', body.user_id)
    const { error } = await supabaseAdmin.auth.admin.deleteUser(body.user_id)
    if (error) return NextResponse.json({ error: error.message }, { status: 400 })
    return NextResponse.json({ ok: true })
  }

  return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
}
