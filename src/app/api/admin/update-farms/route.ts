import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(req: NextRequest) {
  try {
    const { user_id, farms } = await req.json()
    if (!user_id || !farms) {
      return NextResponse.json({ error: 'user_id and farms required' }, { status: 400 })
    }

    // Delete all existing farm assignments for this user
    await supabaseAdmin.from('user_farms').delete().eq('user_id', user_id)

    // Re-insert only the assigned ones
    const assigned = farms.filter((f: any) => f.assigned)
    if (assigned.length > 0) {
      await supabaseAdmin.from('user_farms').insert(
        assigned.map((f: any) => ({ user_id, farm_id: f.farm_id, role: f.role }))
      )
    }

    return NextResponse.json({ success: true })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
