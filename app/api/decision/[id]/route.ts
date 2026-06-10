import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const body = await req.json()
    const { decision, note, modified_value } = body

    if (!['approved', 'rejected', 'modified'].includes(decision)) {
      return NextResponse.json(
        { error: 'decision must be approved, rejected, or modified' },
        { status: 400 }
      )
    }

    const { data, error } = await supabase
      .from('approval_requests')
      .update({
        status: decision,
        decision_at: new Date().toISOString(),
        decision_note: note || null,
        modified_value: modified_value || null,
      })
      .eq('id', id)
      .select('id, status')
      .single()

    if (error || !data) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }

    return NextResponse.json({ id: data.id, status: data.status })
  } catch (err) {
    console.error('PATCH /api/decision error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
