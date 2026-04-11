import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(req: NextRequest) {
  const body = await req.json()

  if (body.action === 'toggle') {
    const { client_id, module, is_enabled } = body
    if (!client_id || !module) return NextResponse.json({ error: 'client_id and module required' }, { status: 400 })

    // Check if record exists
    const { data: existing } = await supabaseAdmin
      .from('client_modules')
      .select('id')
      .eq('client_id', client_id)
      .eq('module', module)
      .maybeSingle()

    if (existing) {
      await supabaseAdmin.from('client_modules')
        .update({ is_enabled })
        .eq('id', existing.id)
    } else {
      await supabaseAdmin.from('client_modules')
        .insert({ client_id, module, is_enabled, source: 'OVERRIDE' })
    }

    return NextResponse.json({ ok: true })
  }

  if (body.action === 'reset_to_plan') {
    const { client_id } = body
    if (!client_id) return NextResponse.json({ error: 'client_id required' }, { status: 400 })

    // Get client's plan and profile
    const { data: client } = await supabaseAdmin
      .from('clients')
      .select('plan_id, profile')
      .eq('id', client_id)
      .single()

    if (!client?.plan_id || !client?.profile) return NextResponse.json({ error: 'Client has no plan or profile' }, { status: 400 })

    const { data: plan } = await supabaseAdmin
      .from('plans')
      .select('slug')
      .eq('id', client.plan_id)
      .single()

    if (!plan) return NextResponse.json({ error: 'Plan not found' }, { status: 400 })

    // Delete all existing modules for this client
    await supabaseAdmin.from('client_modules').delete().eq('client_id', client_id)

    // Get modules from plan_profile_modules matrix
    const { data: ppmData } = await supabaseAdmin
      .from('plan_profile_modules')
      .select('module_key, feature_level')
      .eq('plan_slug', plan.slug)
      .eq('profile', client.profile)

    if (ppmData && ppmData.length > 0) {
      await supabaseAdmin.from('client_modules').insert(
        ppmData.map((m: any) => ({
          client_id,
          module: m.module_key,
          is_enabled: true,
          feature_level: m.feature_level,
          source: 'PLAN',
        }))
      )
    }

    return NextResponse.json({ ok: true })
  }

  if (body.action === 'disable_all') {
    const { client_id, modules } = body
    if (!client_id || !modules) return NextResponse.json({ error: 'client_id and modules required' }, { status: 400 })

    // Delete existing
    await supabaseAdmin.from('client_modules').delete().eq('client_id', client_id)

    // Insert all as disabled
    await supabaseAdmin.from('client_modules').insert(
      modules.map((mod: string) => ({
        client_id,
        module: mod,
        is_enabled: false,
        source: 'OVERRIDE',
      }))
    )

    return NextResponse.json({ ok: true })
  }

  return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
}
