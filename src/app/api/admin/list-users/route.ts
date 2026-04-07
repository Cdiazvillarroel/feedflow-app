import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function GET() {
  try {
    const { data: authData, error } = await supabaseAdmin.auth.admin.listUsers()
    if (error) return NextResponse.json({ error: error.message }, { status: 400 })

    const { data: userFarms } = await supabaseAdmin
      .from('user_farms')
      .select('user_id, farm_id, role, farms(id, name)')

    const users = authData.users.map(u => ({
      id:         u.id,
      email:      u.email,
      created_at: u.created_at,
      user_farms: (userFarms || [])
        .filter((r: any) => r.user_id === u.id)
        .map((r: any) => ({
          farm_id:   r.farm_id,
          role:      r.role,
          farm_name: Array.isArray(r.farms) ? r.farms[0]?.name || '—' : (r.farms as any)?.name || '—',
        })),
    }))

    return NextResponse.json(
      { users },
      { headers: { 'Cache-Control': 'no-store, no-cache, must-revalidate', 'Pragma': 'no-cache' } }
    )
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
