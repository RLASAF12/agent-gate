'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { supabase, type ApprovalRequest } from '@/lib/supabase'
import { CheckCircle, XCircle, ArrowLeft, Clock, Pencil } from 'lucide-react'

function JsonViewer({ data }: { data: Record<string, unknown> }) {
  if (!data || Object.keys(data).length === 0) return (
    <span className="text-gray-600 text-xs">No context provided</span>
  )
  return (
    <pre className="text-xs text-gray-300 font-mono whitespace-pre-wrap bg-gray-950 rounded-lg p-3 overflow-auto max-h-48">
      {JSON.stringify(data, null, 2)}
    </pre>
  )
}

export default function RequestDetailPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const [req, setReq] = useState<ApprovalRequest | null>(null)
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [note, setNote] = useState('')
  const [modifiedValue, setModifiedValue] = useState('')
  const [showModify, setShowModify] = useState(false)
  const [modifyError, setModifyError] = useState('')

  useEffect(() => {
    async function load() {
      const { data } = await supabase
        .from('approval_requests')
        .select('*')
        .eq('id', id)
        .single()
      setReq(data)
      setLoading(false)
    }
    load()
  }, [id])

  async function decide(decision: 'approved' | 'rejected' | 'modified') {
    if (decision === 'modified' && !modifiedValue.trim()) {
      setModifyError('Provide a modified value in JSON format')
      return
    }

    let parsedModified: unknown = null
    if (decision === 'modified') {
      try {
        parsedModified = JSON.parse(modifiedValue)
      } catch {
        setModifyError('Invalid JSON')
        return
      }
    }

    setSubmitting(true)
    const res = await fetch(`/api/decision/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        decision,
        note: note.trim() || null,
        modified_value: parsedModified,
      }),
    })
    if (res.ok) {
      router.push('/')
    } else {
      setSubmitting(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center">
        <div className="text-gray-600 text-sm">Loading…</div>
      </div>
    )
  }

  if (!req) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center">
        <div className="text-center">
          <p className="text-gray-400">Request not found</p>
          <button onClick={() => router.push('/')} className="mt-3 text-indigo-400 text-sm hover:underline">← Back</button>
        </div>
      </div>
    )
  }

  const isDone = req.status !== 'pending'

  return (
    <div className="min-h-screen bg-gray-950">
      <div className="max-w-2xl mx-auto px-4 py-8">
        {/* Back */}
        <button
          onClick={() => router.push('/')}
          className="flex items-center gap-1.5 text-gray-500 hover:text-gray-300 text-sm mb-6 transition-colors"
        >
          <ArrowLeft size={14} /> Back to inbox
        </button>

        {/* Header */}
        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6 mb-4">
          <div className="flex items-start justify-between gap-4 mb-4">
            <div>
              <div className="flex items-center gap-2 mb-2">
                <span className="text-xs font-mono text-indigo-400 bg-indigo-500/10 px-2 py-0.5 rounded">
                  {req.agent_name}
                </span>
                <span className="text-xs text-gray-500 uppercase tracking-wide">{req.action_type}</span>
              </div>
              <h2 className="text-lg font-semibold text-gray-100 leading-snug">{req.action_description}</h2>
            </div>
            {isDone && (
              <div className={`shrink-0 flex items-center gap-1.5 text-sm font-medium px-3 py-1.5 rounded-lg
                ${req.status === 'approved' ? 'bg-emerald-500/15 text-emerald-400' : ''}
                ${req.status === 'rejected' ? 'bg-red-500/15 text-red-400' : ''}
                ${req.status === 'modified' ? 'bg-blue-500/15 text-blue-400' : ''}
              `}>
                {req.status === 'approved' && <CheckCircle size={14} />}
                {req.status === 'rejected' && <XCircle size={14} />}
                {req.status === 'modified' && <Pencil size={14} />}
                {req.status}
              </div>
            )}
          </div>

          {/* Meta */}
          <div className="flex items-center gap-3 text-xs text-gray-500">
            <Clock size={12} />
            <span>{new Date(req.created_at).toLocaleString()}</span>
            <span className="font-mono text-gray-700 truncate">{req.id}</span>
          </div>
        </div>

        {/* Context */}
        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6 mb-4">
          <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Context</h3>
          <JsonViewer data={req.context} />
        </div>

        {/* Decision result (if done) */}
        {isDone && req.decision_note && (
          <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6 mb-4">
            <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Note</h3>
            <p className="text-sm text-gray-300">{req.decision_note}</p>
          </div>
        )}
        {isDone && req.modified_value && (
          <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6 mb-4">
            <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Modified Value</h3>
            <JsonViewer data={req.modified_value} />
          </div>
        )}

        {/* Action panel (only if pending) */}
        {!isDone && (
          <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6">
            <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-4">Your Decision</h3>

            {/* Optional note */}
            <div className="mb-4">
              <input
                type="text"
                placeholder="Add a note (optional)"
                value={note}
                onChange={e => setNote(e.target.value)}
                className="w-full bg-gray-950 border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-200 placeholder-gray-600 focus:outline-none focus:border-gray-500 transition-colors"
              />
            </div>

            {/* Modify section */}
            {showModify && (
              <div className="mb-4">
                <label className="text-xs text-gray-500 mb-1.5 block">Modified value (JSON)</label>
                <textarea
                  rows={3}
                  value={modifiedValue}
                  onChange={e => { setModifiedValue(e.target.value); setModifyError('') }}
                  placeholder='{"key": "new_value"}'
                  className="w-full bg-gray-950 border border-gray-700 rounded-lg px-3 py-2 text-sm font-mono text-gray-200 placeholder-gray-600 focus:outline-none focus:border-gray-500 resize-none"
                />
                {modifyError && <p className="text-xs text-red-400 mt-1">{modifyError}</p>}
              </div>
            )}

            {/* Buttons */}
            <div className="flex gap-3">
              <button
                disabled={submitting}
                onClick={() => decide('approved')}
                className="flex-1 flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-sm font-semibold py-2.5 px-4 rounded-xl transition-colors"
              >
                <CheckCircle size={16} /> Approve
              </button>
              <button
                disabled={submitting}
                onClick={() => decide('rejected')}
                className="flex-1 flex items-center justify-center gap-2 bg-red-700 hover:bg-red-600 disabled:opacity-50 text-white text-sm font-semibold py-2.5 px-4 rounded-xl transition-colors"
              >
                <XCircle size={16} /> Reject
              </button>
              <button
                disabled={submitting}
                onClick={() => {
                  if (!showModify) { setShowModify(true); return }
                  decide('modified')
                }}
                className="flex items-center justify-center gap-2 bg-gray-700 hover:bg-gray-600 disabled:opacity-50 text-white text-sm font-semibold py-2.5 px-4 rounded-xl transition-colors"
              >
                <Pencil size={16} /> {showModify ? 'Submit' : 'Modify'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
