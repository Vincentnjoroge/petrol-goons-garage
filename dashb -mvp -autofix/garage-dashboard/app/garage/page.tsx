'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { onAuthStateChanged, signOut, User } from 'firebase/auth'
import {
  collection, query, where, orderBy, onSnapshot,
  doc, getDoc, getDocs, updateDoc, addDoc,
  serverTimestamp, Timestamp,
} from 'firebase/firestore'
import { auth, db } from '@/lib/firebase'
import {
  Job, JobStatus, StaffMember, GarageCustomer, ActivityLog,
  JOB_STATUS_LABELS, JOB_STATUS_COLORS, JOB_STATUS_ORDER, JOB_TRANSITIONS,
  UserProfile, Garage,
} from '@/lib/types'
import {
  updateJobStatus, assignMechanic, addJobServiceNotes,
  rescheduleJob, getGarageReviews, respondToReview,
  generateTimeSlots, formatSlotTime,
} from '@/lib/jobs'
import {
  getGarageStaff, getGarageCustomers, getUserProfile, getGarageById,
} from '@/lib/garages'
import { canManageJobs, canUpdateJobStatus, canManageStaff, canViewAnalytics, canViewAssignedJobsOnly, getRoleLabel } from '@/lib/roles'

// ─── Types ────────────────────────────────────────────────────────────────────
type Tab = 'overview' | 'jobs' | 'customers' | 'staff' | 'analytics' | 'settings'
type JobFilter = 'active' | 'today' | 'completed' | 'all'

// ─── Skeleton ─────────────────────────────────────────────────────────────────
function Skeleton({ className = '' }: { className?: string }) {
  return <div className={`animate-pulse bg-white/10 rounded-lg ${className}`} />
}

// ─── Status pill ──────────────────────────────────────────────────────────────
function StatusPill({ status }: { status: JobStatus }) {
  const c = JOB_STATUS_COLORS[status]
  return (
    <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-bold ${c.bg} ${c.text}`}>
      {JOB_STATUS_LABELS[status]}
    </span>
  )
}

// ─── Getting started checklist (for new garages) ─────────────────────────────
function GettingStarted({ garage, jobCount, staffCount, onDismiss }: {
  garage: Garage; jobCount: number; staffCount: number; onDismiss: () => void
}) {
  const tasks = [
    { label: 'Garage registered & live', done: true },
    { label: 'First booking received', done: jobCount > 0 },
    { label: 'Team member added', done: staffCount > 1 },
    { label: 'Share your booking link', done: false },
  ]
  const done = tasks.filter(t => t.done).length
  const pct = Math.round((done / tasks.length) * 100)

  return (
    <div className="bg-gradient-to-br from-petrol-yellow/20 to-petrol-yellow/5 border border-petrol-yellow/30 rounded-2xl p-5 mb-5">
      <div className="flex items-start justify-between mb-3">
        <div>
          <h3 className="text-white font-bold text-base">Getting Started</h3>
          <p className="text-gray-400 text-xs mt-0.5">{done}/{tasks.length} done</p>
        </div>
        <button onClick={onDismiss} className="text-gray-600 hover:text-gray-400 text-xs mt-0.5">Dismiss</button>
      </div>
      <div className="h-1.5 bg-white/10 rounded-full mb-3">
        <div className="h-1.5 bg-petrol-yellow rounded-full transition-all duration-500" style={{ width: `${pct}%` }} />
      </div>
      <div className="space-y-2">
        {tasks.map((t, i) => (
          <div key={i} className="flex items-center gap-2.5">
            <div className={`w-5 h-5 rounded-full flex items-center justify-center shrink-0 ${t.done ? 'bg-petrol-yellow' : 'bg-white/10'}`}>
              {t.done && <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#0A0A0A" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>}
            </div>
            <span className={`text-sm ${t.done ? 'text-gray-400 line-through' : 'text-white'}`}>{t.label}</span>
          </div>
        ))}
      </div>
      {tasks.find(t => t.label === 'Share your booking link' && !t.done) && (
        <button
          onClick={() => {
            const link = `${window.location.origin}/book?garage=${garage.id}`
            navigator.clipboard.writeText(link).catch(() => {})
            // Could show a toast here
          }}
          className="mt-3 w-full bg-petrol-yellow text-petrol-black font-bold py-2.5 rounded-xl text-sm"
        >
          📋 Copy Booking Link
        </button>
      )}
    </div>
  )
}

// ─── Stat card ────────────────────────────────────────────────────────────────
function StatCard({ label, value, sub, color = 'text-white', highlight = false }: {
  label: string; value: string | number; sub?: string; color?: string; highlight?: boolean
}) {
  return (
    <div className={`rounded-2xl p-4 ${highlight ? 'bg-petrol-yellow/15 border border-petrol-yellow/30' : 'bg-white/[0.06] border border-white/10'}`}>
      <p className={`text-2xl font-extrabold ${color}`}>{value}</p>
      <p className="text-white text-xs font-semibold mt-0.5">{label}</p>
      {sub && <p className="text-gray-500 text-[10px] mt-0.5">{sub}</p>}
    </div>
  )
}

// ─── Job card ─────────────────────────────────────────────────────────────────
function JobCard({
  job, staff, canUpdate, canManage, onStatusChange, onAssign, onNotes, onReschedule, actionLoading,
}: {
  job: Job
  staff: StaffMember[]
  canUpdate: boolean
  canManage: boolean
  onStatusChange: (job: Job, status: JobStatus) => void
  onAssign: (job: Job) => void
  onNotes: (job: Job) => void
  onReschedule: (job: Job) => void
  actionLoading: string | null
}) {
  const [expanded, setExpanded] = useState(false)
  const allowed = JOB_TRANSITIONS[job.status] || []
  const progressPct = (JOB_STATUS_ORDER.indexOf(job.status) / (JOB_STATUS_ORDER.length - 1)) * 100
  const isActive = !['completed', 'cancelled'].includes(job.status)

  return (
    <div className={`rounded-2xl overflow-hidden border transition-all ${isActive ? 'bg-white/[0.07] border-white/10' : 'bg-white/[0.03] border-white/5'}`}>
      {/* Progress strip */}
      {isActive && (
        <div className="h-0.5 bg-white/5">
          <div className="h-0.5 bg-petrol-yellow transition-all duration-500" style={{ width: `${progressPct}%` }} />
        </div>
      )}

      <div className="p-4">
        {/* Header */}
        <div className="flex items-start justify-between gap-2 mb-2">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-white font-bold text-[15px]">{job.customerName}</span>
              <span className="font-mono text-xs text-gray-500 bg-white/5 px-1.5 py-0.5 rounded">{job.bookingTag}</span>
            </div>
            <p className="text-gray-400 text-xs mt-0.5">
              {formatDate(job.preferredDate)} · {formatSlotTime(job.preferredTime)}
              {job.assignedMechanicName && <span className="ml-1.5 text-petrol-yellow">· 🔧 {job.assignedMechanicName}</span>}
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <StatusPill status={job.status} />
            <button onClick={() => setExpanded(!expanded)} className="text-gray-600 p-1">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <polyline points={expanded ? '18 15 12 9 6 15' : '6 9 12 15 18 9'} />
              </svg>
            </button>
          </div>
        </div>

        {/* Services */}
        <div className="flex flex-wrap gap-1 mb-3">
          {job.services?.map(s => (
            <span key={s} className="text-[10px] font-medium bg-white/5 text-gray-300 px-2 py-0.5 rounded-full">{s}</span>
          ))}
        </div>

        {/* Expand details */}
        {expanded && (
          <div className="mb-3 space-y-2 border-t border-white/5 pt-3">
            <div className="grid grid-cols-2 gap-2 text-xs">
              {job.customerPhone && <div><span className="text-gray-500">Phone </span><span className="text-white">{job.customerPhone}</span></div>}
              {job.customerEmail && <div><span className="text-gray-500">Email </span><span className="text-white truncate block">{job.customerEmail}</span></div>}
              {job.vinNumber && <div><span className="text-gray-500">VIN </span><span className="text-white font-mono">{job.vinNumber}</span></div>}
              {job.plateNumber && <div><span className="text-gray-500">Plate </span><span className="text-white">{job.plateNumber}</span></div>}
            </div>
            {job.description && (
              <p className="text-xs text-gray-400 bg-white/[0.03] rounded-lg p-2">{job.description}</p>
            )}
            {job.serviceNotes && (
              <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-2">
                <p className="text-[10px] text-blue-400 font-semibold mb-0.5">Service Notes</p>
                <p className="text-xs text-blue-200">{job.serviceNotes}</p>
              </div>
            )}
            {job.photos?.length > 0 && (
              <div className="flex gap-2">
                {job.photos.slice(0, 4).map((url, i) => (
                  <a key={i} href={url} target="_blank" rel="noopener noreferrer"
                    className="w-12 h-12 rounded-lg overflow-hidden border border-white/10 shrink-0">
                    <img src={url} alt="" className="w-full h-full object-cover" />
                  </a>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Quick actions */}
        {canUpdate && isActive && (
          <div className="flex flex-wrap gap-1.5 pt-3 border-t border-white/5">
            {allowed.map(ns => (
              <button key={ns} onClick={() => onStatusChange(job, ns)}
                disabled={actionLoading === job.id}
                className={`px-3 py-1.5 rounded-xl text-[11px] font-bold transition-all active:scale-95 disabled:opacity-40 ${ns === 'cancelled' ? 'bg-red-500/15 text-red-400 border border-red-500/20' : ns === 'completed' ? 'bg-petrol-green/15 text-petrol-green border border-petrol-green/20' : 'bg-petrol-yellow/15 text-petrol-yellow border border-petrol-yellow/20'}`}>
                {actionLoading === job.id ? '…' : `→ ${JOB_STATUS_LABELS[ns]}`}
              </button>
            ))}
            {canManage && (
              <>
                <button onClick={() => onNotes(job)} className="px-3 py-1.5 rounded-xl text-[11px] font-bold bg-white/5 text-gray-300 border border-white/10">
                  📝 Notes
                </button>
                {staff.filter(s => s.role === 'mechanic').length > 0 && (
                  <button onClick={() => onAssign(job)} className="px-3 py-1.5 rounded-xl text-[11px] font-bold bg-purple-500/10 text-purple-400 border border-purple-500/20">
                    🔧 Assign
                  </button>
                )}
                <button onClick={() => onReschedule(job)} className="px-3 py-1.5 rounded-xl text-[11px] font-bold bg-white/5 text-gray-300 border border-white/10">
                  📅
                </button>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Bottom nav ───────────────────────────────────────────────────────────────
function BottomNav({ tab, onChange, unread }: { tab: Tab; onChange: (t: Tab) => void; unread: number }) {
  const items: { id: Tab; label: string; icon: (a: boolean) => React.ReactNode }[] = [
    { id: 'overview', label: 'Home', icon: (a) => (
      <svg width="22" height="22" viewBox="0 0 24 24" fill={a ? '#FDB913' : 'none'} stroke={a ? '#FDB913' : '#6B7280'} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" /><polyline points="9 22 9 12 15 12 15 22" />
      </svg>
    )},
    { id: 'jobs', label: 'Jobs', icon: (a) => (
      <svg width="22" height="22" viewBox="0 0 24 24" fill={a ? '#FDB913' : 'none'} stroke={a ? '#FDB913' : '#6B7280'} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" /><line x1="16" y1="13" x2="8" y2="13" /><line x1="16" y1="17" x2="8" y2="17" /><polyline points="10 9 9 9 8 9" />
      </svg>
    )},
    { id: 'customers', label: 'Customers', icon: (a) => (
      <svg width="22" height="22" viewBox="0 0 24 24" fill={a ? '#FDB913' : 'none'} stroke={a ? '#FDB913' : '#6B7280'} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M23 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" />
      </svg>
    )},
    { id: 'analytics', label: 'Analytics', icon: (a) => (
      <svg width="22" height="22" viewBox="0 0 24 24" fill={a ? '#FDB913' : 'none'} stroke={a ? '#FDB913' : '#6B7280'} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <line x1="18" y1="20" x2="18" y2="10" /><line x1="12" y1="20" x2="12" y2="4" /><line x1="6" y1="20" x2="6" y2="14" />
      </svg>
    )},
    { id: 'settings', label: 'Settings', icon: (a) => (
      <svg width="22" height="22" viewBox="0 0 24 24" fill={a ? '#FDB913' : 'none'} stroke={a ? '#FDB913' : '#6B7280'} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
      </svg>
    )},
  ]

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-petrol-black border-t border-white/10 z-50 safe-area-bottom">
      <div className="max-w-[430px] mx-auto flex justify-around items-center py-2 px-1">
        {items.map(item => {
          const active = tab === item.id
          return (
            <button key={item.id} onClick={() => onChange(item.id)}
              className="relative flex flex-col items-center gap-0.5 px-3 py-1">
              {item.id === 'jobs' && unread > 0 && (
                <span className="absolute -top-0.5 right-1 min-w-[16px] h-4 bg-petrol-yellow rounded-full flex items-center justify-center px-0.5">
                  <span className="text-[9px] font-black text-petrol-black">{unread > 9 ? '9+' : unread}</span>
                </span>
              )}
              {item.icon(active)}
              <span className="text-[10px] font-semibold" style={{ color: active ? '#FDB913' : '#6B7280' }}>{item.label}</span>
            </button>
          )
        })}
      </div>
    </nav>
  )
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
function formatDate(s: string): string {
  const d = new Date(s + 'T00:00:00')
  const today = new Date(); today.setHours(0, 0, 0, 0)
  const tomorrow = new Date(today); tomorrow.setDate(today.getDate() + 1)
  const yesterday = new Date(today); yesterday.setDate(today.getDate() - 1)
  if (d.getTime() === today.getTime()) return 'Today'
  if (d.getTime() === tomorrow.getTime()) return 'Tomorrow'
  if (d.getTime() === yesterday.getTime()) return 'Yesterday'
  return d.toLocaleDateString('en-KE', { weekday: 'short', day: 'numeric', month: 'short' })
}

function timeAgo(ts: any): string {
  if (!ts?.toDate) return ''
  const diff = Date.now() - (ts.toDate() as Date).getTime()
  const m = Math.floor(diff / 60000)
  if (m < 1) return 'just now'
  if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h ago`
  return `${Math.floor(h / 24)}d ago`
}

// ─── Main component ────────────────────────────────────────────────────────────
export default function GarageDashboard() {
  const [user, setUser] = useState<User | null>(null)
  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [garage, setGarage] = useState<Garage | null>(null)
  const [pageReady, setPageReady] = useState(false)
  const [loadError, setLoadError] = useState<string | null>(null)

  // Real-time data
  const [jobs, setJobs] = useState<Job[]>([])
  const [staff, setStaff] = useState<StaffMember[]>([])
  const [customers, setCustomers] = useState<GarageCustomer[]>([])
  const [activity, setActivity] = useState<ActivityLog[]>([])
  const [reviews, setReviews] = useState<any[]>([])
  const [dataLoading, setDataLoading] = useState(true)

  // UI state
  const [tab, setTab] = useState<Tab>('overview')
  const [jobFilter, setJobFilter] = useState<JobFilter>('active')
  const [jobSearch, setJobSearch] = useState('')
  const [actionLoading, setActionLoading] = useState<string | null>(null)
  const [showGettingStarted, setShowGettingStarted] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Modals
  const [notesModal, setNotesModal] = useState<Job | null>(null)
  const [notesText, setNotesText] = useState('')
  const [assignModal, setAssignModal] = useState<Job | null>(null)
  const [rescheduleModal, setRescheduleModal] = useState<Job | null>(null)
  const [rescheduleDate, setRescheduleDate] = useState('')
  const [rescheduleTime, setRescheduleTime] = useState('')
  const [replyModal, setReplyModal] = useState<any>(null)
  const [replyText, setReplyText] = useState('')
  const [savingModal, setSavingModal] = useState(false)

  const unsubscribers = useRef<(() => void)[]>([])

  // ── Auth ────────────────────────────────────────────────────────────────────
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (u) => {
      if (!u) { window.location.href = '/'; return }
      setUser(u)
      try {
        const p = await getUserProfile(u.uid)
        if (!p || !p.garageId) { setLoadError('no_garage'); setPageReady(true); return }
        const allowed = ['garage_owner', 'garage_manager', 'mechanic', 'reception']
        if (!allowed.includes(p.role)) { setLoadError('no_access'); setPageReady(true); return }
        setProfile(p)
        const g = await getGarageById(p.garageId)
        if (!g) { setLoadError('no_garage'); setPageReady(true); return }
        setGarage(g)
        setPageReady(true)
      } catch {
        setLoadError('error')
        setPageReady(true)
      }
    })
    return () => unsub()
  }, [])

  // ── Real-time subscriptions ──────────────────────────────────────────────────
  useEffect(() => {
    if (!profile?.garageId) return
    const gid = profile.garageId

    // Cleanup previous subscriptions
    unsubscribers.current.forEach(fn => fn())
    unsubscribers.current = []

    // Jobs — real-time
    const jobsQ = canViewAssignedJobsOnly(profile.role)
      ? query(collection(db, 'garages', gid, 'jobs'), where('assignedMechanicId', '==', profile.uid), orderBy('submittedAt', 'desc'))
      : query(collection(db, 'garages', gid, 'jobs'), orderBy('submittedAt', 'desc'))

    const jobsUnsub = onSnapshot(jobsQ, (snap) => {
      setJobs(snap.docs.map(d => ({ id: d.id, ...d.data() } as Job)))
      setDataLoading(false)
    }, () => setDataLoading(false))
    unsubscribers.current.push(jobsUnsub)

    // Activity — real-time (last 30)
    const actQ = query(collection(db, 'garages', gid, 'activity'), orderBy('timestamp', 'desc'))
    const actUnsub = onSnapshot(actQ, (snap) => {
      setActivity(snap.docs.slice(0, 30).map(d => ({ id: d.id, ...d.data() } as ActivityLog)))
    })
    unsubscribers.current.push(actUnsub)

    // Staff + customers (one-time, these rarely change)
    getGarageStaff(gid).then(setStaff)
    if (canManageJobs(profile.role)) {
      getGarageCustomers(gid).then(setCustomers)
      getGarageReviews(gid).then(setReviews)
    }

    return () => { unsubscribers.current.forEach(fn => fn()) }
  }, [profile?.garageId, profile?.role, profile?.uid])

  // ── Job actions ──────────────────────────────────────────────────────────────
  const handleStatusChange = async (job: Job, newStatus: JobStatus) => {
    if (!job.id || !profile) return
    setActionLoading(job.id)
    const res = await updateJobStatus(garage!.id!, job.id, newStatus, profile.uid, profile.displayName, '')
    if (!res.success) setError(res.error || 'Failed to update status')
    setActionLoading(null)
  }

  const handleSaveNotes = async () => {
    if (!notesModal?.id || !profile) return
    setSavingModal(true)
    await addJobServiceNotes(garage!.id!, notesModal.id, notesText, profile.uid, profile.displayName)
    setNotesModal(null); setNotesText(''); setSavingModal(false)
  }

  const handleAssign = async (mechanic: StaffMember) => {
    if (!assignModal?.id || !profile) return
    setSavingModal(true)
    await assignMechanic(garage!.id!, assignModal.id, mechanic.userId, mechanic.name, profile.uid, profile.displayName)
    setAssignModal(null); setSavingModal(false)
  }

  const handleReschedule = async () => {
    if (!rescheduleModal?.id || !rescheduleDate || !rescheduleTime || !profile) return
    setSavingModal(true)
    await rescheduleJob(garage!.id!, rescheduleModal.id, rescheduleDate, rescheduleTime, profile.uid, profile.displayName)
    setRescheduleModal(null); setRescheduleDate(''); setRescheduleTime(''); setSavingModal(false)
  }

  const handleReplyReview = async () => {
    if (!replyModal?.id || !replyText.trim()) return
    setSavingModal(true)
    await respondToReview(garage!.id!, replyModal.id, replyText.trim())
    setReviews(prev => prev.map(r => r.id === replyModal.id ? { ...r, garageResponse: replyText } : r))
    setReplyModal(null); setReplyText(''); setSavingModal(false)
  }

  const handleSignOut = async () => {
    await signOut(auth)
    window.location.href = '/'
  }

  // ── Derived data ─────────────────────────────────────────────────────────────
  const today = new Date().toISOString().split('T')[0]
  const activeJobs = jobs.filter(j => !['completed', 'cancelled'].includes(j.status))
  const todayJobs = jobs.filter(j => j.preferredDate === today)
  const newBookings = jobs.filter(j => j.status === 'booking_created')
  const completedJobs = jobs.filter(j => j.status === 'completed')
  const mechanics = staff.filter(s => s.role === 'mechanic')
  const avgRating = reviews.length > 0 ? (reviews.reduce((a, r) => a + (r.rating || 0), 0) / reviews.length).toFixed(1) : '—'

  const filteredJobs = jobs.filter(j => {
    const matchFilter = jobFilter === 'active' ? !['completed', 'cancelled'].includes(j.status)
      : jobFilter === 'today' ? j.preferredDate === today
      : jobFilter === 'completed' ? j.status === 'completed'
      : true
    if (!matchFilter) return false
    if (!jobSearch.trim()) return true
    const q = jobSearch.toLowerCase()
    return j.customerName?.toLowerCase().includes(q) || j.bookingTag?.toLowerCase().includes(q) || j.vinNumber?.toLowerCase().includes(q)
  })

  // ── Error states ─────────────────────────────────────────────────────────────
  if (!pageReady) {
    return (
      <div className="min-h-screen bg-petrol-black flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-petrol-yellow border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-gray-400 text-sm">Loading your garage…</p>
        </div>
      </div>
    )
  }

  if (loadError === 'no_garage') {
    return (
      <div className="min-h-screen bg-petrol-black flex items-center justify-center p-6">
        <div className="text-center max-w-xs">
          <div className="text-5xl mb-4">🏪</div>
          <h1 className="text-white text-xl font-bold mb-2">No Garage Found</h1>
          <p className="text-gray-400 text-sm mb-6">Register your garage to access the dashboard.</p>
          <button onClick={() => window.location.href = '/garage-signup'} className="w-full bg-petrol-yellow text-petrol-black font-bold py-3 rounded-xl">
            Register Your Garage
          </button>
          <button onClick={handleSignOut} className="w-full mt-3 bg-white/5 text-gray-400 py-3 rounded-xl text-sm">Sign Out</button>
        </div>
      </div>
    )
  }

  if (loadError === 'no_access') {
    return (
      <div className="min-h-screen bg-petrol-black flex items-center justify-center p-6">
        <div className="text-center max-w-xs">
          <div className="text-5xl mb-4">🔒</div>
          <h1 className="text-white text-xl font-bold mb-2">Access Denied</h1>
          <p className="text-gray-400 text-sm mb-6">Your account doesn't have access to the garage dashboard.</p>
          <button onClick={handleSignOut} className="w-full bg-petrol-yellow text-petrol-black font-bold py-3 rounded-xl">Sign Out</button>
        </div>
      </div>
    )
  }

  if (!user || !profile || !garage) return null

  const canUpdate = canUpdateJobStatus(profile.role)
  const canManage = canManageJobs(profile.role)
  const isOwner = profile.role === 'garage_owner'

  // ── Render ────────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-petrol-black pb-24 max-w-[430px] mx-auto">
      {/* Header */}
      <div className="sticky top-0 z-40 bg-petrol-black/95 backdrop-blur-sm border-b border-white/5">
        <div className="flex items-center justify-between px-4 py-3">
          <div>
            <h1 className="brand-text text-base">
              <span className="text-petrol-green">PETROL</span>
              <span className="inline-block bg-petrol-yellow text-petrol-black px-2 py-0.5 ml-0.5 -skew-x-6 text-sm">GOONS</span>
            </h1>
            <p className="text-gray-500 text-xs">{garage.name}</p>
          </div>
          <div className="flex items-center gap-2">
            {/* Live indicator */}
            <div className="flex items-center gap-1.5 bg-petrol-green/10 border border-petrol-green/20 rounded-full px-2.5 py-1">
              <div className="w-1.5 h-1.5 bg-petrol-green rounded-full animate-pulse" />
              <span className="text-petrol-green text-[10px] font-bold">LIVE</span>
            </div>
            <button onClick={() => window.location.href = '/book?garage=' + garage.id}
              className="bg-white/5 border border-white/10 rounded-xl px-3 py-1.5 text-xs text-gray-300 font-medium">
              + Booking
            </button>
          </div>
        </div>
      </div>

      {error && (
        <div className="mx-4 mt-3 bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3 flex items-center justify-between">
          <p className="text-red-400 text-sm">{error}</p>
          <button onClick={() => setError(null)} className="text-red-500 text-xs ml-3">✕</button>
        </div>
      )}

      <div className="px-4 pt-4">

        {/* ── OVERVIEW TAB ── */}
        {tab === 'overview' && (
          <>
            {/* Getting started */}
            {isOwner && showGettingStarted && jobs.length < 3 && (
              <GettingStarted
                garage={garage}
                jobCount={jobs.length}
                staffCount={staff.length}
                onDismiss={() => setShowGettingStarted(false)}
              />
            )}

            {/* Stats */}
            {dataLoading ? (
              <div className="grid grid-cols-2 gap-3 mb-5">
                {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-20" />)}
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-3 mb-5">
                <StatCard label="New Bookings" value={newBookings.length} color="text-petrol-yellow" highlight={newBookings.length > 0} sub="awaiting confirmation" />
                <StatCard label="Active Jobs" value={activeJobs.length} color="text-white" sub="in progress" />
                <StatCard label="Today's Jobs" value={todayJobs.length} color="text-petrol-green" sub={today} />
                <StatCard label="Avg Rating" value={avgRating} color="text-amber-400" sub={`${reviews.length} reviews`} />
              </div>
            )}

            {/* New bookings — most important, first */}
            {newBookings.length > 0 && (
              <div className="mb-5">
                <h2 className="text-white font-bold text-sm mb-3 flex items-center gap-2">
                  <span className="w-2 h-2 bg-petrol-yellow rounded-full animate-pulse" />
                  New Bookings ({newBookings.length})
                </h2>
                <div className="space-y-3">
                  {newBookings.map(job => (
                    <JobCard key={job.id} job={job} staff={staff} canUpdate={canUpdate} canManage={canManage}
                      onStatusChange={handleStatusChange} onAssign={setAssignModal} onNotes={(j) => { setNotesModal(j); setNotesText(j.serviceNotes || '') }}
                      onReschedule={(j) => { setRescheduleModal(j); setRescheduleDate(j.preferredDate); setRescheduleTime(j.preferredTime) }}
                      actionLoading={actionLoading} />
                  ))}
                </div>
              </div>
            )}

            {/* Today's schedule */}
            {todayJobs.filter(j => j.status !== 'booking_created').length > 0 && (
              <div className="mb-5">
                <h2 className="text-white font-bold text-sm mb-3">Today's Schedule</h2>
                <div className="space-y-3">
                  {todayJobs.filter(j => j.status !== 'booking_created').sort((a, b) => a.preferredTime.localeCompare(b.preferredTime)).map(job => (
                    <JobCard key={job.id} job={job} staff={staff} canUpdate={canUpdate} canManage={canManage}
                      onStatusChange={handleStatusChange} onAssign={setAssignModal} onNotes={(j) => { setNotesModal(j); setNotesText(j.serviceNotes || '') }}
                      onReschedule={(j) => { setRescheduleModal(j); setRescheduleDate(j.preferredDate); setRescheduleTime(j.preferredTime) }}
                      actionLoading={actionLoading} />
                  ))}
                </div>
              </div>
            )}

            {/* Recent activity */}
            {activity.length > 0 && (
              <div className="mb-5">
                <h2 className="text-white font-bold text-sm mb-3">Recent Activity</h2>
                <div className="bg-white/[0.04] border border-white/10 rounded-2xl divide-y divide-white/5">
                  {activity.slice(0, 8).map((log, i) => (
                    <div key={log.id || i} className="px-4 py-3 flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <p className="text-white text-xs font-medium truncate">{log.details || log.action}</p>
                        <p className="text-gray-500 text-[10px] mt-0.5">{log.changedByName} · {log.bookingTag}</p>
                      </div>
                      <p className="text-gray-600 text-[10px] shrink-0">{timeAgo(log.timestamp)}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {!dataLoading && jobs.length === 0 && (
              <div className="text-center py-16">
                <div className="text-5xl mb-4">📋</div>
                <h3 className="text-white font-bold text-lg mb-1">No bookings yet</h3>
                <p className="text-gray-500 text-sm mb-4">Share your booking link to start receiving jobs.</p>
                <button onClick={() => { const l = `${window.location.origin}/book?garage=${garage.id}`; navigator.clipboard.writeText(l).catch(() => {}) }}
                  className="bg-petrol-yellow text-petrol-black font-bold px-6 py-3 rounded-xl text-sm">
                  📋 Copy Booking Link
                </button>
              </div>
            )}
          </>
        )}

        {/* ── JOBS TAB ── */}
        {tab === 'jobs' && (
          <>
            <div className="flex gap-2 mb-4 overflow-x-auto no-scrollbar">
              {([
                { id: 'active',    label: 'Active',    count: activeJobs.length },
                { id: 'today',     label: 'Today',     count: todayJobs.length },
                { id: 'completed', label: 'Done',      count: completedJobs.length },
                { id: 'all',       label: 'All',       count: jobs.length },
              ] as { id: JobFilter; label: string; count: number }[]).map(f => (
                <button key={f.id} onClick={() => setJobFilter(f.id)}
                  className={`shrink-0 px-4 py-2 rounded-xl text-sm font-semibold transition-all ${jobFilter === f.id ? 'bg-petrol-yellow text-petrol-black' : 'bg-white/5 text-gray-400 border border-white/10'}`}>
                  {f.label} {f.count > 0 && <span className="ml-1 opacity-70">({f.count})</span>}
                </button>
              ))}
            </div>

            <div className="mb-4">
              <input value={jobSearch} onChange={e => setJobSearch(e.target.value)}
                placeholder="Search name, tag, VIN…"
                className="w-full bg-white/[0.06] border border-white/10 rounded-xl px-4 py-3 text-white placeholder-gray-600 text-sm focus:border-petrol-yellow/50 focus:outline-none" />
            </div>

            {dataLoading ? (
              <div className="space-y-3">{[...Array(3)].map((_, i) => <Skeleton key={i} className="h-32" />)}</div>
            ) : filteredJobs.length === 0 ? (
              <div className="text-center py-16 text-gray-500 text-sm">
                {jobSearch ? `No results for "${jobSearch}"` : 'No jobs in this filter'}
              </div>
            ) : (
              <div className="space-y-3">
                {filteredJobs.map(job => (
                  <JobCard key={job.id} job={job} staff={staff} canUpdate={canUpdate} canManage={canManage}
                    onStatusChange={handleStatusChange} onAssign={setAssignModal} onNotes={(j) => { setNotesModal(j); setNotesText(j.serviceNotes || '') }}
                    onReschedule={(j) => { setRescheduleModal(j); setRescheduleDate(j.preferredDate); setRescheduleTime(j.preferredTime) }}
                    actionLoading={actionLoading} />
                ))}
              </div>
            )}
          </>
        )}

        {/* ── CUSTOMERS TAB ── */}
        {tab === 'customers' && (
          <>
            <h2 className="text-white font-bold text-lg mb-4">Customers ({customers.length})</h2>
            {customers.length === 0 ? (
              <div className="text-center py-16">
                <div className="text-5xl mb-3">👤</div>
                <p className="text-gray-400 text-sm">Customers appear here after they book a service.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {customers.map(c => {
                  const custJobs = jobs.filter(j => j.customerId === c.userId)
                  const active = custJobs.filter(j => !['completed', 'cancelled'].includes(j.status)).length
                  return (
                    <div key={c.id} className="bg-white/[0.06] border border-white/10 rounded-2xl p-4">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <p className="text-white font-semibold text-sm">{c.name}</p>
                            {active > 0 && <span className="text-[10px] bg-petrol-yellow/20 text-petrol-yellow font-bold px-1.5 py-0.5 rounded">{active} active</span>}
                          </div>
                          <p className="text-gray-500 text-xs mt-0.5">{c.email}</p>
                          {c.phone && <p className="text-gray-500 text-xs">{c.phone}</p>}
                        </div>
                        <div className="text-right shrink-0">
                          <p className="text-white font-bold text-sm">{custJobs.length}</p>
                          <p className="text-gray-600 text-[10px]">visits</p>
                        </div>
                      </div>
                      {custJobs.length > 0 && (
                        <div className="mt-3 pt-3 border-t border-white/5">
                          <p className="text-gray-500 text-[10px] font-semibold uppercase tracking-wider mb-2">Recent Jobs</p>
                          <div className="space-y-1.5">
                            {custJobs.slice(0, 3).map(j => (
                              <div key={j.id} className="flex items-center justify-between bg-white/[0.03] rounded-lg px-3 py-2">
                                <div>
                                  <span className="text-[10px] font-mono text-gray-500 mr-2">{j.bookingTag}</span>
                                  <span className="text-[11px] text-gray-300">{j.services?.slice(0, 2).join(', ')}</span>
                                </div>
                                <StatusPill status={j.status} />
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </>
        )}

        {/* ── ANALYTICS TAB ── */}
        {tab === 'analytics' && (
          <>
            <h2 className="text-white font-bold text-lg mb-4">Analytics</h2>

            <div className="grid grid-cols-2 gap-3 mb-5">
              <div className="bg-white/[0.06] border border-white/10 rounded-2xl p-4 col-span-2">
                <p className="text-gray-400 text-xs font-semibold uppercase tracking-wider mb-3">Completion Rate</p>
                <div className="flex items-end gap-3">
                  <p className="text-4xl font-extrabold text-white">
                    {jobs.length > 0 ? Math.round((completedJobs.length / jobs.length) * 100) : 0}%
                  </p>
                  <p className="text-gray-500 text-sm mb-1">{completedJobs.length} of {jobs.length} jobs completed</p>
                </div>
                <div className="mt-3 h-2 bg-white/10 rounded-full">
                  <div className="h-2 bg-petrol-green rounded-full"
                    style={{ width: `${jobs.length > 0 ? (completedJobs.length / jobs.length) * 100 : 0}%` }} />
                </div>
              </div>

              <div className="bg-white/[0.06] border border-white/10 rounded-2xl p-4">
                <p className="text-gray-400 text-xs mb-1">Avg Rating</p>
                <p className="text-3xl font-bold text-amber-400">{avgRating}</p>
                <p className="text-gray-600 text-[10px]">{reviews.length} reviews</p>
              </div>

              <div className="bg-white/[0.06] border border-white/10 rounded-2xl p-4">
                <p className="text-gray-400 text-xs mb-1">Customers</p>
                <p className="text-3xl font-bold text-white">{new Set(jobs.map(j => j.customerId)).size}</p>
                <p className="text-gray-600 text-[10px]">unique</p>
              </div>
            </div>

            {/* Top services */}
            <div className="bg-white/[0.06] border border-white/10 rounded-2xl p-4 mb-4">
              <p className="text-white font-semibold text-sm mb-3">Top Services</p>
              {(() => {
                const counts: Record<string, number> = {}
                jobs.forEach(j => j.services?.forEach(s => { counts[s] = (counts[s] || 0) + 1 }))
                const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, 5)
                const max = sorted[0]?.[1] || 1
                return sorted.length === 0 ? (
                  <p className="text-gray-600 text-sm">No data yet</p>
                ) : (
                  <div className="space-y-2.5">
                    {sorted.map(([service, count]) => (
                      <div key={service}>
                        <div className="flex justify-between text-xs mb-1">
                          <span className="text-gray-300">{service}</span>
                          <span className="text-white font-semibold">{count}</span>
                        </div>
                        <div className="h-1.5 bg-white/10 rounded-full">
                          <div className="h-1.5 bg-petrol-yellow rounded-full" style={{ width: `${(count / max) * 100}%` }} />
                        </div>
                      </div>
                    ))}
                  </div>
                )
              })()}
            </div>

            {/* Reviews */}
            {reviews.length > 0 && (
              <div className="bg-white/[0.06] border border-white/10 rounded-2xl p-4 mb-4">
                <p className="text-white font-semibold text-sm mb-3">Reviews</p>
                <div className="space-y-3">
                  {reviews.slice(0, 5).map((r: any) => (
                    <div key={r.id} className="border-b border-white/5 pb-3 last:border-0 last:pb-0">
                      <div className="flex items-center justify-between mb-1">
                        <p className="text-white text-sm font-medium">{r.customerName}</p>
                        <div className="flex">
                          {[1,2,3,4,5].map(s => (
                            <span key={s} className={`text-sm ${s <= r.rating ? 'text-amber-400' : 'text-white/10'}`}>★</span>
                          ))}
                        </div>
                      </div>
                      <p className="text-gray-400 text-xs">{r.comment}</p>
                      {!r.garageResponse && isOwner && (
                        <button onClick={() => { setReplyModal(r); setReplyText('') }}
                          className="mt-2 text-xs text-petrol-yellow underline">Reply</button>
                      )}
                      {r.garageResponse && (
                        <p className="mt-2 text-xs text-petrol-green bg-petrol-green/5 rounded-lg p-2">{r.garageResponse}</p>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        )}

        {/* ── SETTINGS TAB ── */}
        {tab === 'settings' && (
          <>
            <h2 className="text-white font-bold text-lg mb-4">Settings</h2>

            {/* Garage info */}
            <div className="bg-white/[0.06] border border-white/10 rounded-2xl p-4 mb-4">
              <p className="text-gray-400 text-xs font-semibold uppercase tracking-wider mb-3">Garage</p>
              <div className="space-y-2">
                <div className="flex justify-between"><p className="text-gray-500 text-sm">Name</p><p className="text-white text-sm font-medium">{garage.name}</p></div>
                <div className="flex justify-between"><p className="text-gray-500 text-sm">Location</p><p className="text-white text-sm font-medium">{garage.location}</p></div>
                <div className="flex justify-between"><p className="text-gray-500 text-sm">Status</p>
                  <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${garage.status === 'active' ? 'bg-petrol-green/20 text-petrol-green' : 'bg-petrol-yellow/20 text-petrol-yellow'}`}>
                    {garage.status}
                  </span>
                </div>
                <div className="flex justify-between"><p className="text-gray-500 text-sm">Plan</p><p className="text-petrol-yellow text-sm font-bold capitalize">{garage.subscriptionPlan}</p></div>
              </div>
            </div>

            {/* Staff */}
            <div className="bg-white/[0.06] border border-white/10 rounded-2xl p-4 mb-4">
              <div className="flex items-center justify-between mb-3">
                <p className="text-gray-400 text-xs font-semibold uppercase tracking-wider">Staff ({staff.length})</p>
              </div>
              {staff.map(s => (
                <div key={s.id} className="flex items-center justify-between py-2 border-b border-white/5 last:border-0">
                  <div>
                    <p className="text-white text-sm font-medium">{s.name}</p>
                    <p className="text-gray-500 text-xs">{s.email}</p>
                  </div>
                  <span className="text-[10px] font-bold bg-white/5 text-gray-400 px-2 py-0.5 rounded">{getRoleLabel(s.role as any)}</span>
                </div>
              ))}
            </div>

            {/* Booking link */}
            <div className="bg-white/[0.06] border border-white/10 rounded-2xl p-4 mb-4">
              <p className="text-gray-400 text-xs font-semibold uppercase tracking-wider mb-2">Booking Link</p>
              <p className="text-petrol-yellow text-xs font-mono break-all mb-3">{typeof window !== 'undefined' ? `${window.location.origin}/book?garage=${garage.id}` : ''}</p>
              <button
                onClick={() => { const l = `${window.location.origin}/book?garage=${garage.id}`; navigator.clipboard.writeText(l).catch(() => {}) }}
                className="w-full bg-petrol-yellow/10 border border-petrol-yellow/30 text-petrol-yellow font-semibold py-2.5 rounded-xl text-sm">
                📋 Copy Link
              </button>
            </div>

            {/* Danger */}
            <div className="bg-white/[0.06] border border-white/10 rounded-2xl p-4 mb-4">
              <p className="text-gray-400 text-xs font-semibold uppercase tracking-wider mb-3">Account</p>
              <div className="flex items-center justify-between mb-3">
                <div>
                  <p className="text-white text-sm font-medium">{profile.displayName}</p>
                  <p className="text-gray-500 text-xs">{getRoleLabel(profile.role)}</p>
                </div>
              </div>
              <button onClick={handleSignOut} className="w-full bg-red-500/10 border border-red-500/20 text-red-400 font-semibold py-3 rounded-xl text-sm">
                Sign Out
              </button>
            </div>
          </>
        )}
      </div>

      <BottomNav tab={tab} onChange={setTab} unread={newBookings.length} />

      {/* ── MODALS ── */}

      {/* Notes modal */}
      {notesModal && (
        <div className="fixed inset-0 bg-black/70 z-50 flex items-end">
          <div className="bg-[#1a1a1a] w-full max-w-[430px] mx-auto rounded-t-2xl p-6">
            <h3 className="text-white font-bold text-base mb-1">Service Notes</h3>
            <p className="text-gray-500 text-xs mb-3">{notesModal.bookingTag} · {notesModal.customerName}</p>
            <textarea value={notesText} onChange={e => setNotesText(e.target.value)} rows={4}
              autoFocus placeholder="What work was done? Parts replaced? Notes for the customer…"
              className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-gray-600 text-sm focus:border-petrol-yellow/50 focus:outline-none resize-none mb-4" />
            <div className="flex gap-3">
              <button onClick={() => { setNotesModal(null); setNotesText('') }} className="flex-1 bg-white/5 text-gray-400 py-3 rounded-xl">Cancel</button>
              <button onClick={handleSaveNotes} disabled={savingModal} className="flex-[2] bg-petrol-yellow text-petrol-black font-bold py-3 rounded-xl disabled:opacity-50">
                {savingModal ? 'Saving…' : 'Save Notes'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Assign modal */}
      {assignModal && (
        <div className="fixed inset-0 bg-black/70 z-50 flex items-end">
          <div className="bg-[#1a1a1a] w-full max-w-[430px] mx-auto rounded-t-2xl p-6">
            <h3 className="text-white font-bold text-base mb-1">Assign Mechanic</h3>
            <p className="text-gray-500 text-xs mb-4">{assignModal.bookingTag}</p>
            <div className="space-y-2 mb-4">
              {mechanics.map(m => (
                <button key={m.id} onClick={() => handleAssign(m)} disabled={savingModal}
                  className={`w-full text-left px-4 py-3 rounded-xl border-2 transition-all ${assignModal.assignedMechanicId === m.userId ? 'border-petrol-yellow bg-petrol-yellow/10' : 'border-white/10 bg-white/5'}`}>
                  <p className="text-white font-medium text-sm">{m.name}</p>
                  <p className="text-gray-500 text-xs">{m.email}</p>
                </button>
              ))}
            </div>
            <button onClick={() => setAssignModal(null)} className="w-full bg-white/5 text-gray-400 py-3 rounded-xl">Cancel</button>
          </div>
        </div>
      )}

      {/* Reschedule modal */}
      {rescheduleModal && (
        <div className="fixed inset-0 bg-black/70 z-50 flex items-end">
          <div className="bg-[#1a1a1a] w-full max-w-[430px] mx-auto rounded-t-2xl p-6">
            <h3 className="text-white font-bold text-base mb-4">Reschedule Job</h3>
            <div className="space-y-3 mb-4">
              <div>
                <label className="text-gray-400 text-xs font-medium block mb-1.5">New Date</label>
                <input type="date" value={rescheduleDate} onChange={e => setRescheduleDate(e.target.value)} min={today}
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white text-sm focus:border-petrol-yellow/50 focus:outline-none" />
              </div>
              <div>
                <label className="text-gray-400 text-xs font-medium block mb-1.5">New Time</label>
                <select value={rescheduleTime} onChange={e => setRescheduleTime(e.target.value)}
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white text-sm focus:border-petrol-yellow/50 focus:outline-none bg-[#1a1a1a]">
                  <option value="">Select time</option>
                  {generateTimeSlots().map(s => <option key={s} value={s}>{formatSlotTime(s)}</option>)}
                </select>
              </div>
            </div>
            <div className="flex gap-3">
              <button onClick={() => setRescheduleModal(null)} className="flex-1 bg-white/5 text-gray-400 py-3 rounded-xl">Cancel</button>
              <button onClick={handleReschedule} disabled={!rescheduleDate || !rescheduleTime || savingModal}
                className="flex-[2] bg-petrol-yellow text-petrol-black font-bold py-3 rounded-xl disabled:opacity-40">
                {savingModal ? 'Saving…' : 'Reschedule'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Review reply modal */}
      {replyModal && (
        <div className="fixed inset-0 bg-black/70 z-50 flex items-end">
          <div className="bg-[#1a1a1a] w-full max-w-[430px] mx-auto rounded-t-2xl p-6">
            <h3 className="text-white font-bold text-base mb-1">Reply to Review</h3>
            <p className="text-gray-400 text-xs mb-3">"{replyModal.comment}"</p>
            <textarea value={replyText} onChange={e => setReplyText(e.target.value)} rows={3} autoFocus
              placeholder="Thank the customer and acknowledge their feedback…"
              className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-gray-600 text-sm focus:border-petrol-yellow/50 focus:outline-none resize-none mb-4" />
            <div className="flex gap-3">
              <button onClick={() => setReplyModal(null)} className="flex-1 bg-white/5 text-gray-400 py-3 rounded-xl">Cancel</button>
              <button onClick={handleReplyReview} disabled={!replyText.trim() || savingModal}
                className="flex-[2] bg-petrol-yellow text-petrol-black font-bold py-3 rounded-xl disabled:opacity-40">
                {savingModal ? 'Saving…' : 'Send Reply'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
