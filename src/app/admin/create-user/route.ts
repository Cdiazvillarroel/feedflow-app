import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(req: NextRequest) {
  try {
    const { email, password, farm_ids, role } = await req.json()

    if (!email || !password || !farm_ids?.length) {
      return NextResponse.json({ error: 'Email, password and at least one farm are required' }, { status: 400 })
    }

    // Create user in Supabase Auth
    const { data: userData, error: userError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    })

    if (userError) {
      return NextResponse.json({ error: userError.message }, { status: 400 })
    }

    const userId = userData.user.id

    // Assign farms with role
    const userFarmsPayload = farm_ids.map((farm_id: string) => ({
      user_id: userId,
      farm_id,
      role: role || 'viewer',
    }))

    const { error: farmsError } = await supabaseAdmin
      .from('user_farms')
      .insert(userFarmsPayload)

    if (farmsError) {
      return NextResponse.json({ error: farmsError.message }, { status: 400 })
    }

    return NextResponse.json({ success: true, user_id: userId })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
