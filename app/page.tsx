'use client'

import { useEffect, useState } from 'react'
import { supabase, type ApprovalRequest } from '@/lib/supabase'
import { CheckCircle, XCircle, Clock, Zap, Bell } from 'lucide-react'
import Link from 'next/link'

type Filter = 'pending' | 'all'

function timeAgo(date: string) {
  const seconds = Math.floor((Date.now() - new Date(date).getTime()) / 1000)
  if (seconds < 60) return `${seconds}s ago`
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`
  return `${Math.floor(seconds / 86400)}d ago`
}

function StatusBadge({ status }: { status: ApprovalRequest['status'] }) {
  const map = {
    pending: { color: 'bg-amber-500/15 text-amber-400 border-amber-500/30', icon: <Clock size={12} />, label: 'Pending' },
    approved: { color: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30', icon: <CheckCircle size={12} />, label: 'Approved' },
    rejected: { color: 'bg-red-500/15 text-red-400 border-red-500/30', icon: <XCircle size={12} />, label: 'Rejected' },
    modified: { color: 'bg-blue-500/15 text-blue-400 border-blue-500/30', icon: <Zap size={12} />, label: 'Modified' },
  }
  const s = map[status]
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border ${s.color}`}>
      {s.icon} {s.label}
    </span>
  )
}

function RequestCard({ req, isNew }: { req: ApprovalRequest; isNew: boolean }) {
  return (
    <Link href={`/request/${req.id}`}>
      <div className={`group relative bg-gray-900 border rounded-xl p-5 cursor-pointer transition-all duration-200
        hover:border-gray-600 hover:bg-gray-800
        ${isNew ? 'border-amber-500/60 shadow-lg shadow-amber-500/10 animate-pulse-once' : 'border-gray-800'}
      `}>
        {isNew && (
          <span className="absolute -top-1.5 -right-1.5 w-3 h-3 bg-amber-400 rounded-full shadow-sm shadow-amber-400/50" />
        )}
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-xs font-mono text-indigo-400 bg-indigo-500/10 px-2 py-0.5 rounded">
                {req.agent_name}
              </span>
              <span className="text-xs text-gray-500">{req.action_type}</span>
            </div>
            <p className="text-sm text-gray-200 leading-relaxed line-clamp-2">{req.action_description}</p>
            {req.context && Object.keys(req.context).length > 0 && (
              <p className="text-xs text-gray-500 mt-1 truncate">
                {Object.entries(req.context).slice(0, 2).map(([k, v]) => `${k}: ${v}`).join(' · ')}
              </p>
            )}
          </div>
          <div className="flex flex-col items-end gap-2 shrink-0">
            <StatusBadge status={req.status} />
            <span className="text-xs text-gray-600">{timeAgo(req.created_at)}</span>
          </div>
        </div>
        {req.status === 'pending' && (
          <div className="mt-3 pt-3 border-t border-gray-800 flex gap-2">
            <span className="text-xs text-gray-500">Click to review →</span>
          </div>
        )}
      </div>
    </Link>
  )
}

export default function InboxPage() {
  const [requests, setRequests] = useState<ApprovalRequest[]>([])
  const [filter, setFilter] = useState<Filter>('pending')
  const [newIds, setNewIds] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState(true)
  const [live, setLive] = useState(false)

  // Initial fetch
  useEffect(() => {
    async function load() {
      const query = supabase
        .from('approval_requests')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(100)

      if (filter === 'pending') query.eq('status', 'pending')

      const { data } = await query
      setRequests(data ?? [])
      setLoading(false)
    }
    load()
  }, [filter])

  // Realtime subscription
  useEffect(() => {
    const channel = supabase
      .channel('agentgate-inbox')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'approval_requests' },
        (payload) => {
          if (payload.eventType === 'INSERT') {
            const newReq = payload.new as ApprovalRequest
            setRequests(prev => [newReq, ...prev])
            setNewIds(prev => new Set([...prev, newReq.id]))
            setTimeout(() => {
              setNewIds(prev => {
                const next = new Set(prev)
                next.delete(newReq.id)
                return next
              })
            }, 5000)
          } else if (payload.eventType === 'UPDATE') {
            const updated = payload.new as ApprovalRequest
            setRequests(prev => prev.map(r => r.id === updated.id ? updated : r))
          }
        }
      )
      .subscribe((status) => {
        setLive(status === 'SUBSCRIBED')
      })

    return () => { supabase.removeChannel(channel) }
  }, [])

  const filtered = filter === 'pending'
    ? requests.filter(r => r.status === 'pending')
    : requests

  const pendingCount = requests.filter(r => r.status === 'pending').length

  return (
    <div className="min-h-screen bg-gray-950">
      {/* Header */}
      <div className="border-b border-gray-800 bg-gray-900/50 sticky top-0 backdrop-blur-sm z-10">
        <div className="max-w-3xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center">
              <Bell size={16} className="text-white" />
            </div>
            <div>
              <h1 className="text-sm font-semibold text-gray-100">AgentGate</h1>
              <p className="text-xs text-gray-500">Human-in-the-loop approvals</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {pendingCount > 0 && (
              <span className="bg-amber-500 text-black text-xs font-bold px-2 py-0.5 rounded-full">
                {pendingCount} pending
              </span>
            )}
            <div className={`flex items-center gap-1.5 text-xs ${live ? 'text-emerald-400' : 'text-gray-500'}`}>
              <span className={`w-1.5 h-1.5 rounded-full ${live ? 'bg-emerald-400 shadow-sm shadow-emerald-400' : 'bg-gray-600'}`} />
              {live ? 'Live' : 'Connecting…'}
            </div>
          </div>
        </div>
      </div>

      {/* Filter tabs */}
      <div className="max-w-3xl mx-auto px-4 pt-6 pb-3">
        <div className="flex gap-1 bg-gray-900 rounded-lg p-1 w-fit">
          {(['pending', 'all'] as Filter[]).map(f => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-4 py-1.5 text-sm rounded-md transition-colors capitalize
                ${filter === f ? 'bg-gray-700 text-gray-100 font-medium' : 'text-gray-400 hover:text-gray-200'}`}
            >
              {f}
            </button>
          ))}
        </div>
      </div>

      {/* Request list */}
      <div className="max-w-3xl mx-auto px-4 pb-16 space-y-3">
        {loading ? (
          <div className="py-20 text-center text-gray-600 text-sm">Loading…</div>
        ) : filtered.length === 0 ? (
          <div className="py-20 text-center">
            <div className="text-4xl mb-3">🤖</div>
            <p className="text-gray-400 text-sm font-medium">
              {filter === 'pending' ? 'No pending approvals' : 'No requests yet'}
            </p>
            <p className="text-gray-600 text-xs mt-1">
              Agents will appear here when they need your approval
            </p>
          </div>
        ) : (
          filtered.map(req => (
            <RequestCard key={req.id} req={req} isNew={newIds.has(req.id)} />
          ))
        )}
      </div>

      {/* API Quick-start footer */}
      <div className="fixed bottom-0 left-0 right-0 bg-gray-900/80 backdrop-blur border-t border-gray-800 px-4 py-3">
        <div className="max-w-3xl mx-auto">
          <p className="text-xs text-gray-500 font-mono truncate">
            POST /api/request {"{ agent, action, context }"} → returns {"{id}"}  ·  GET /api/status/{"{id}"}  ·  PATCH /api/decision/{"{id}"}
          </p>
        </div>
      </div>
    </div>
  )
}
