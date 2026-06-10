import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { agent, action, action_type, context } = body

    if (!agent || !action) {
      return NextResponse.json(
        { error: 'agent and action are required' },
        { status: 400 }
      )
    }

    const { data, error } = await supabase
      .from('approval_requests')
      .insert({
        agent_name: agent,
        action_type: action_type || 'action',
        action_description: action,
        context: context || {},
        status: 'pending',
      })
      .select('id')
      .single()

    if (error) throw error

    return NextResponse.json({ id: data.id }, { status: 201 })
  } catch (err) {
    console.error('POST /api/request error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
