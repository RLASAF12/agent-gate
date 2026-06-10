import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

export type ApprovalRequest = {
  id: string
  created_at: string
  agent_name: string
  action_type: string
  action_description: string
  context: Record<string, unknown>
  status: 'pending' | 'approved' | 'rejected' | 'modified'
  decision_at: string | null
  decision_note: string | null
  modified_value: Record<string, unknown> | null
}
