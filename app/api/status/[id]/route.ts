import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const { data, error } = await supabase
      .from('approval_requests')
      .select('id, status, decision_at, decision_note, modified_value')
      .eq('id', id)
      .single()

    if (error || !data) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }

    return NextResponse.json({
      id: data.id,
      decision: data.status,
      decision_at: data.decision_at,
      decision_note: data.decision_note,
      modified_value: data.modified_value,
    })
  } catch (err) {
    console.error('GET /api/status error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
