'use client'

import { useState, useEffect } from 'react'
import { onAuthStateChanged, signOut, User } from 'firebase/auth'
import { getUserProfile, getGarageById, getGarageStaff, getGarageMechanics, getGarageCustomers } from '@/lib/garages'
import { getGarageJobs, getMechanicJobs, updateJobStatus, assignMechanic, addJobServiceNotes, rescheduleJob, getGarageStats, getGarageActivity, getGarageReviews, respondToReview, generateTimeSlots, formatSlotTime } from '@/lib/jobs'
import { sendBookingEmail } from '@/lib/email'
import { canViewAllJobs, canViewAssignedJobsOnly, canManageJobs, canUpdateJobStatus, canManageStaff, canViewAnalytics, getRoleLabel } from '@/lib/roles'
import { Job, JobStatus, JOB_STATUS_LABELS, JOB_STATUS_COLORS, JOB_STATUS_ORDER, JOB_TRANSITIONS, StaffMember, GarageCustomer, UserProfile, Garage, ActivityLog, CustomerReview } from '@/lib/types'

type DashTab = 'jobs' | 'customers' | 'mechanics' | 'analytics' | 'reviews' | 'activity'
type JobFilter = 'active' | 'completed' | 'cancelled' | 'all'

export default function GarageDashboardPage() {
  const [user, setUser] = useState<User | null>(null)
  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [garage, setGarage] = useState<Garage | null>(null)
  const [pageReady, setPageReady] = useState(false)
  const [notAuthorized, setNotAuthorized] = useState(false)
  const [noGarage, setNoGarage] = useState(false)

  // Data
  const [jobs, setJobs] = useState<Job[]>([])
  const [staff, setStaff] = useState<StaffMember[]>([])
  const [customers, setCustomers] = useState<GarageCustomer[]>([])
  const [reviews, setReviews] = useState<any[]>([])
  const [activity, setActivity] = useState<ActivityLog[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // UI state
  const [activeTab, setActiveTab] = useState<DashTab>('jobs')
  const [jobFilter, setJobFilter] = useState<JobFilter>('active')
  const [searchQuery, setSearchQuery] = useState('')
  const [customerSearch, setCustomerSearch] = useState('')
  const [actionLoading, setActionLoading] = useState<string | null>(null)
  const [refreshing, setRefreshing] = useState(false)

  // Modals
  const [notesModalJob, setNotesModalJob] = useState<Job | null>(null)
  const [serviceNotes, setServiceNotes] = useState('')
  const [rescheduleModalJob, setRescheduleModalJob] = useState<Job | null>(null)
  const [rescheduleDate, setRescheduleDate] = useState('')
  const [rescheduleTime, setRescheduleTime] = useState('')
  const [savingAction, setSavingAction] = useState(false)
  const [assignModalJob, setAssignModalJob] = useState<Job | null>(null)
  const [expandedCustomer, setExpandedCustomer] = useState<string | null>(null)
  const [expandedMechanic, setExpandedMechanic] = useState<string | null>(null)
  const [replyReviewId, setReplyReviewId] = useState<string | null>(null)
  const [replyText, setReplyText] = useState('')

  // Stats
  const [stats, setStats] = useState({ totalJobs: 0, activeJobs: 0, completedJobs: 0, cancelledJobs: 0, todayJobs: 0 })

  // Auth + load
  useEffect(() => {
    let unsubscribe: (() => void) | undefined
    const timeout = setTimeout(() => { if (!pageReady) window.location.href = '/' }, 6000)

    const init = async () => {
      try {
        const { auth } = await import('@/lib/firebase')
        unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
          clearTimeout(timeout)
          if (!currentUser) { window.location.href = '/'; return }
          setUser(currentUser)
          const userProfile = await getUserProfile(currentUser.uid)
          if (!userProfile || !userProfile.garageId) { setNoGarage(true); setPageReady(true); return }
          const allowedRoles = ['garage_owner', 'garage_manager', 'mechanic', 'reception']
          if (!allowedRoles.includes(userProfile.role)) { setNotAuthorized(true); setPageReady(true); return }
          setProfile(userProfile)
          const garageData = await getGarageById(userProfile.garageId)
          if (!garageData) { setNoGarage(true); setPageReady(true); return }
          setGarage(garageData)
          setPageReady(true)
        })
      } catch { clearTimeout(timeout); window.location.href = '/' }
    }
    init()
    return () => { clearTimeout(timeout); unsubscribe?.() }
  }, [pageReady])

  useEffect(() => {
    if (!pageReady || !garage?.id || !profile) return
    loadData()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pageReady, garage?.id, profile?.role])

  const loadData = async () => {
    if (!garage?.id || !profile) return
    setLoading(true)
    try {
      let jobsData: Job[]
      if (canViewAssignedJobsOnly(profile.role)) {
        jobsData = await getMechanicJobs(garage.id, profile.uid)
      } else {
        jobsData = await getGarageJobs(garage.id)
      }

      const [staffData, customersData, reviewsData, activityData, statsData] = await Promise.all([
        getGarageStaff(garage.id),
        canManageJobs(profile.role) ? getGarageCustomers(garage.id) : Promise.resolve([]),
        getGarageReviews(garage.id),
        canViewAnalytics(profile.role) ? getGarageActivity(garage.id, 50) : Promise.resolve([]),
        getGarageStats(garage.id),
      ])

      setJobs(jobsData)
      setStaff(staffData)
      setCustomers(customersData)
      setReviews(reviewsData)
      setActivity(activityData)
      setStats(statsData)
    } catch (err: any) {
      console.error('Error loading data:', err)
      setError('Failed to load data')
    }
    setLoading(false)
  }

  const handleRefresh = async () => { setRefreshing(true); await loadData(); setRefreshing(false) }

  // ========== STATUS CHANGE ==========
  const handleStatusChange = async (job: Job, newStatus: JobStatus, notes?: string) => {
    if (!job.id || !garage?.id || !user) return
    setActionLoading(job.id)
    try {
      const result = await updateJobStatus(garage.id, job.id, newStatus, user.uid, user.displayName || 'Staff', notes)
      if (result.success) {
        setJobs(prev => prev.map(j => j.id === job.id ? { ...j, status: newStatus } : j))
        const newStats = await getGarageStats(garage.id)
        setStats(newStats)
      } else { setError(result.error || 'Failed to update status') }
    } catch (err: any) { setError(err.message) }
    setActionLoading(null)
  }

  const handleCompleteWithNotes = async (job: Job) => {
    if (!job.id || !garage?.id || !user) return
    setSavingAction(true)
    try {
      if (serviceNotes.trim()) {
        await addJobServiceNotes(garage.id, job.id, serviceNotes.trim(), user.uid, user.displayName || 'Staff')
      }
      const nextStatus: JobStatus = job.status === 'quality_check' ? 'ready_for_pickup' :
                                    job.status === 'ready_for_pickup' ? 'completed' : 'quality_check'
      await handleStatusChange(job, nextStatus, serviceNotes.trim())
      setNotesModalJob(null); setServiceNotes('')
    } catch (err: any) { setError(err.message) }
    setSavingAction(false)
  }

  const handleReschedule = async (job: Job) => {
    if (!job.id || !garage?.id || !user || !rescheduleDate || !rescheduleTime) return
    setSavingAction(true)
    try {
      const result = await rescheduleJob(garage.id, job.id, rescheduleDate, rescheduleTime, user.uid, user.displayName || 'Staff')
      if (result.success) {
        setJobs(prev => prev.map(j => j.id === job.id ? { ...j, preferredDate: rescheduleDate, preferredTime: rescheduleTime } : j))
        setRescheduleModalJob(null); setRescheduleDate(''); setRescheduleTime('')
      }
    } catch (err: any) { setError(err.message) }
    setSavingAction(false)
  }

  const handleAssignMechanic = async (job: Job, mechanicStaff: StaffMember) => {
    if (!job.id || !garage?.id || !user) return
    setActionLoading(job.id)
    try {
      await assignMechanic(garage.id, job.id, mechanicStaff.userId, mechanicStaff.name, user.uid, user.displayName || 'Staff')
      setJobs(prev => prev.map(j => j.id === job.id ? { ...j, assignedMechanicId: mechanicStaff.userId, assignedMechanicName: mechanicStaff.name } : j))
      setAssignModalJob(null)
    } catch (err: any) { setError(err.message) }
    setActionLoading(null)
  }

  const handleReplyReview = async (reviewId: string) => {
    if (!garage?.id || !replyText.trim()) return
    setSavingAction(true)
    try {
      await respondToReview(garage.id, reviewId, replyText.trim())
      setReviews(prev => prev.map(r => r.id === reviewId ? { ...r, garageResponse: replyText.trim() } : r))
      setReplyReviewId(null); setReplyText('')
    } catch (err: any) { setError(err.message) }
    setSavingAction(false)
  }

  const handleSignOut = async () => {
    try { const { auth: firebaseAuth } = await import('@/lib/firebase'); await signOut(firebaseAuth) } catch {}
    window.location.href = '/'
  }

  // ========== DERIVED DATA ==========
  const searchLower = searchQuery.toLowerCase().trim()
  const filteredJobs = jobs.filter(j => {
    let filterMatch = true
    switch (jobFilter) {
      case 'active': filterMatch = !['completed', 'cancelled'].includes(j.status); break
      case 'completed': filterMatch = j.status === 'completed'; break
      case 'cancelled': filterMatch = j.status === 'cancelled'; break
      case 'all': filterMatch = true; break
    }
    if (!filterMatch) return false
    if (!searchLower) return true
    return (j.customerName?.toLowerCase().includes(searchLower) || j.bookingTag?.toLowerCase().includes(searchLower) || j.vinNumber?.toLowerCase().includes(searchLower) || j.services?.some(s => s.toLowerCase().includes(searchLower)) || j.assignedMechanicName?.toLowerCase().includes(searchLower))
  })

  const mechanics = staff.filter(s => s.role === 'mechanic')
  const managers = staff.filter(s => s.role === 'garage_manager')

  // Customer enrichment: attach their booking data
  const customerSearchLower = customerSearch.toLowerCase().trim()
  const enrichedCustomers = customers.map(c => {
    const custJobs = jobs.filter(j => j.customerId === c.userId)
    const completedCount = custJobs.filter(j => j.status === 'completed').length
    const activeCount = custJobs.filter(j => !['completed', 'cancelled'].includes(j.status)).length
    const lastJob = custJobs[0]
    return { ...c, jobCount: custJobs.length, completedCount, activeCount, lastJob, allJobs: custJobs }
  }).filter(c => {
    if (!customerSearchLower) return true
    return c.name?.toLowerCase().includes(customerSearchLower) || c.email?.toLowerCase().includes(customerSearchLower) || c.phone?.toLowerCase().includes(customerSearchLower)
  }).sort((a, b) => b.jobCount - a.jobCount)

  // Mechanic enrichment: attach their assignments
  const enrichedMechanics = mechanics.map(m => {
    const mechJobs = jobs.filter(j => j.assignedMechanicId === m.userId)
    const activeJobs = mechJobs.filter(j => !['completed', 'cancelled'].includes(j.status))
    const completedJobs = mechJobs.filter(j => j.status === 'completed')
    const mechReviews = reviews.filter(r => r.mechanicId === m.userId)
    const avgRating = mechReviews.length > 0 ? mechReviews.reduce((acc: number, r: any) => acc + (r.rating || 0), 0) / mechReviews.length : 0
    return { ...m, totalJobs: mechJobs.length, activeJobs, completedJobs, reviewCount: mechReviews.length, avgRating, allJobs: mechJobs }
  })

  // Analytics data
  const avgRating = reviews.length > 0 ? (reviews.reduce((acc, r) => acc + (r.rating || 0), 0) / reviews.length).toFixed(1) : '—'
  const uniqueCustomerIds = new Set(jobs.map(j => j.customerId))
  const thisWeekJobs = jobs.filter(j => {
    const d = new Date(j.preferredDate + 'T00:00:00')
    const now = new Date()
    const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
    return d >= weekAgo
  })

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr + 'T00:00:00')
    return date.toLocaleDateString('en-KE', { weekday: 'short', day: 'numeric', month: 'short' })
  }

  // ========== LOADING/AUTH STATES ==========
  if (!pageReady) return (
    <div className="min-h-screen bg-black flex items-center justify-center">
      <div className="text-center">
        <div className="w-12 h-12 border-4 border-yellow-400 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
        <p className="text-white text-lg">Loading your garage...</p>
      </div>
    </div>
  )

  if (noGarage) return (
    <div className="min-h-screen bg-black flex items-center justify-center p-4">
      <div className="text-center max-w-md">
        <span className="text-4xl mb-4 block">🏪</span>
        <h1 className="text-2xl font-bold text-white mb-2">No Garage Found</h1>
        <p className="text-gray-400 mb-6">Register your garage or ask your owner to add you as staff.</p>
        <div className="space-y-3">
          <button onClick={() => window.location.href = '/garage-signup'} className="w-full bg-petrol-yellow text-black font-bold py-3 rounded-xl">Register Your Garage</button>
          <button onClick={handleSignOut} className="w-full bg-white bg-opacity-10 text-white font-medium py-3 rounded-xl">Sign Out</button>
        </div>
      </div>
    </div>
  )

  if (notAuthorized) return (
    <div className="min-h-screen bg-black flex items-center justify-center p-4">
      <div className="text-center max-w-md">
        <span className="text-4xl mb-4 block">🔒</span>
        <h1 className="text-2xl font-bold text-white mb-2">Access Denied</h1>
        <p className="text-gray-400 mb-6">Your role doesn&apos;t have access to the garage dashboard.</p>
        <button onClick={handleSignOut} className="w-full bg-petrol-yellow text-black font-bold py-3 rounded-xl">Sign Out</button>
      </div>
    </div>
  )

  if (!user || !profile || !garage) return null

  return (
    <div className="min-h-screen bg-gray-100">
      {/* Header */}
      <div className="bg-petrol-black text-white p-4">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div>
            <div className="flex items-center space-x-2">
              <span className="brand-text text-lg">
                <span className="text-petrol-green">PETROL</span>
                <span className="inline-block bg-petrol-yellow text-petrol-black px-1.5 py-0 ml-0.5 -skew-x-6 text-base">GOONS</span>
              </span>
            </div>
            <p className="text-gray-400 text-xs mt-0.5">{garage.name} · {getRoleLabel(profile.role)}</p>
          </div>
          <div className="flex items-center space-x-2">
            <button onClick={handleRefresh} disabled={refreshing} className="bg-white bg-opacity-10 text-white px-3 py-2 rounded-lg text-sm hover:bg-opacity-20 disabled:opacity-50">
              <svg className={`w-5 h-5 ${refreshing ? 'animate-spin' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
            </button>
            <button onClick={handleSignOut} className="bg-petrol-yellow text-black px-4 py-2 rounded-lg font-medium text-sm">Sign Out</button>
          </div>
        </div>
      </div>
      <div className="racing-stripe"></div>

      <div className="max-w-6xl mx-auto p-4 py-6">
        {/* Stats Bar */}
        <div className="grid grid-cols-3 md:grid-cols-6 gap-3 mb-5">
          <div className="bg-white rounded-lg shadow p-3 text-center">
            <p className="text-xl font-bold text-gray-800">{stats.todayJobs}</p>
            <p className="text-[10px] text-gray-500">Today</p>
          </div>
          <div className="bg-white rounded-lg shadow p-3 text-center">
            <p className="text-xl font-bold text-blue-600">{stats.activeJobs}</p>
            <p className="text-[10px] text-gray-500">Active Jobs</p>
          </div>
          <div className="bg-white rounded-lg shadow p-3 text-center">
            <p className="text-xl font-bold text-green-600">{stats.completedJobs}</p>
            <p className="text-[10px] text-gray-500">Completed</p>
          </div>
          <div className="bg-white rounded-lg shadow p-3 text-center">
            <p className="text-xl font-bold text-purple-600">{uniqueCustomerIds.size}</p>
            <p className="text-[10px] text-gray-500">Customers</p>
          </div>
          <div className="bg-white rounded-lg shadow p-3 text-center">
            <p className="text-xl font-bold text-petrol-yellow">{avgRating}</p>
            <p className="text-[10px] text-gray-500">Avg Rating</p>
          </div>
          <div className="bg-white rounded-lg shadow p-3 text-center">
            <p className="text-xl font-bold text-orange-500">{thisWeekJobs.length}</p>
            <p className="text-[10px] text-gray-500">This Week</p>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="flex bg-white rounded-xl p-1 shadow-sm mb-5 overflow-x-auto">
          {([
            { key: 'jobs' as DashTab, label: '📋 Jobs', count: stats.activeJobs, show: true },
            { key: 'customers' as DashTab, label: '👤 Customers', count: customers.length, show: canManageJobs(profile.role) },
            { key: 'mechanics' as DashTab, label: '🔧 Mechanics', count: mechanics.length, show: true },
            { key: 'reviews' as DashTab, label: '⭐ Reviews', count: reviews.length, show: true },
            { key: 'analytics' as DashTab, label: '📊 Analytics', count: 0, show: canViewAnalytics(profile.role) },
            { key: 'activity' as DashTab, label: '📝 Log', count: 0, show: canViewAnalytics(profile.role) },
          ]).filter(t => t.show).map(tab => (
            <button key={tab.key} onClick={() => setActiveTab(tab.key)}
              className={`flex-1 py-2 rounded-lg text-xs font-semibold transition-all whitespace-nowrap px-2 ${
                activeTab === tab.key ? 'bg-petrol-black text-white shadow-sm' : 'text-gray-500 hover:text-gray-700'
              }`}>
              {tab.label}{tab.count > 0 ? ` (${tab.count})` : ''}
            </button>
          ))}
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-4">
            <p>{error}</p>
            <button onClick={() => setError(null)} className="text-red-500 underline text-sm">Dismiss</button>
          </div>
        )}

        {/* ===== JOBS TAB ===== */}
        {activeTab === 'jobs' && (
          <div>
            <div className="mb-4">
              <input type="text" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search by name, tag, VIN, service..."
                className="w-full px-4 py-3 bg-white border border-gray-200 rounded-lg shadow text-base focus:ring-2 focus:ring-yellow-400 outline-none" />
            </div>
            <div className="flex space-x-2 mb-4 overflow-x-auto">
              {([
                { key: 'active' as JobFilter, label: 'Active', count: stats.activeJobs },
                { key: 'completed' as JobFilter, label: 'Done', count: stats.completedJobs },
                { key: 'cancelled' as JobFilter, label: 'Cancelled', count: stats.cancelledJobs },
                { key: 'all' as JobFilter, label: 'All', count: stats.totalJobs },
              ]).map(f => (
                <button key={f.key} onClick={() => setJobFilter(f.key)}
                  className={`px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap ${jobFilter === f.key ? 'bg-petrol-black text-white' : 'bg-white text-gray-600 hover:bg-gray-50'}`}>
                  {f.label} ({f.count})
                </button>
              ))}
            </div>

            {loading ? (
              <div className="bg-white rounded-lg shadow p-8 text-center"><div className="w-8 h-8 border-4 border-yellow-400 border-t-transparent rounded-full animate-spin mx-auto"></div></div>
            ) : filteredJobs.length === 0 ? (
              <div className="bg-white rounded-lg shadow p-8 text-center text-gray-500"><p>{searchQuery ? `No results for "${searchQuery}"` : 'No jobs found'}</p></div>
            ) : (
              <div className="space-y-3">
                {filteredJobs.map(job => {
                  const statusColor = JOB_STATUS_COLORS[job.status]
                  const allowedNext = JOB_TRANSITIONS[job.status] || []
                  return (
                    <div key={job.id} className="bg-white rounded-lg shadow p-5">
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex-1">
                          <div className="flex items-center space-x-2 flex-wrap gap-y-1">
                            <h3 className="text-lg font-bold">{job.customerName}</h3>
                            <span className="font-mono text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded">{job.bookingTag}</span>
                            <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold ${statusColor.bg} ${statusColor.text}`}>{JOB_STATUS_LABELS[job.status]}</span>
                          </div>
                          <p className="text-sm text-gray-500 mt-1">
                            {formatDate(job.preferredDate)} @ {formatSlotTime(job.preferredTime)}
                            {job.assignedMechanicName && <span className="ml-2">· 🔧 {job.assignedMechanicName}</span>}
                          </p>
                        </div>
                      </div>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm mb-3">
                        <div><p className="text-gray-400 text-xs">Services</p><p className="font-medium">{job.services?.join(', ') || '—'}</p></div>
                        {job.vinNumber && <div><p className="text-gray-400 text-xs">VIN</p><p className="font-medium">{job.vinNumber}</p></div>}
                        <div><p className="text-gray-400 text-xs">Email</p><p className="font-medium truncate">{job.customerEmail || '—'}</p></div>
                        <div><p className="text-gray-400 text-xs">Phone</p><p className="font-medium">{job.customerPhone || '—'}</p></div>
                      </div>
                      {job.description && <div className="mb-3"><p className="text-gray-400 text-xs">Issue</p><p className="text-sm">{job.description}</p></div>}
                      {job.photos && job.photos.length > 0 && (
                        <div className="flex space-x-2 overflow-x-auto mb-3">
                          {job.photos.map((url, idx) => (
                            <a key={idx} href={url} target="_blank" rel="noopener noreferrer" className="flex-shrink-0 w-16 h-16 rounded-lg overflow-hidden border-2 border-gray-200 hover:border-yellow-400">
                              <img src={url} alt={`Photo ${idx + 1}`} className="w-full h-full object-cover" />
                            </a>
                          ))}
                        </div>
                      )}
                      {job.serviceNotes && <div className="bg-blue-50 rounded-lg p-3 mb-3"><p className="text-blue-700 text-xs font-semibold">Service Notes</p><p className="text-blue-800 text-sm">{job.serviceNotes}</p></div>}
                      {!['completed', 'cancelled'].includes(job.status) && (
                        <div className="mb-3">
                          <div className="flex items-center space-x-1">
                            {JOB_STATUS_ORDER.map((s, idx) => {
                              const currentIdx = JOB_STATUS_ORDER.indexOf(job.status)
                              return <div key={s} className="flex-1"><div className={`h-1.5 rounded-full ${idx < currentIdx ? 'bg-green-400' : idx === currentIdx ? 'bg-yellow-400' : 'bg-gray-200'}`} /></div>
                            })}
                          </div>
                          <p className="text-[10px] text-gray-400 mt-1">Step {JOB_STATUS_ORDER.indexOf(job.status) + 1} of {JOB_STATUS_ORDER.length}</p>
                        </div>
                      )}
                      {canUpdateJobStatus(profile.role) && allowedNext.length > 0 && (
                        <div className="flex flex-wrap gap-2 pt-2 border-t border-gray-100">
                          {allowedNext.map(ns => (
                            <button key={ns} onClick={() => ns === 'completed' || ns === 'quality_check' ? (setNotesModalJob(job), setServiceNotes(job.serviceNotes || '')) : handleStatusChange(job, ns)}
                              disabled={actionLoading === job.id}
                              className={`px-3 py-2 rounded-lg text-xs font-semibold disabled:opacity-50 ${ns === 'cancelled' ? 'bg-red-100 text-red-700' : ns === 'completed' ? 'bg-green-600 text-white' : 'bg-blue-100 text-blue-700'}`}>
                              {actionLoading === job.id ? '...' : `→ ${JOB_STATUS_LABELS[ns]}`}
                            </button>
                          ))}
                          {canManageJobs(profile.role) && mechanics.length > 0 && <button onClick={() => setAssignModalJob(job)} className="px-3 py-2 rounded-lg text-xs font-semibold bg-purple-100 text-purple-700">🔧 Assign</button>}
                          {canManageJobs(profile.role) && !['completed', 'cancelled'].includes(job.status) && (
                            <button onClick={() => { setRescheduleModalJob(job); setRescheduleDate(job.preferredDate); setRescheduleTime(job.preferredTime) }}
                              className="px-3 py-2 rounded-lg text-xs font-semibold bg-yellow-100 text-yellow-800">📅 Reschedule</button>
                          )}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )}

        {/* ===== CUSTOMERS TAB ===== */}
        {activeTab === 'customers' && (
          <div>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold">Customers ({enrichedCustomers.length})</h2>
            </div>
            <div className="mb-4">
              <input type="text" value={customerSearch} onChange={e => setCustomerSearch(e.target.value)}
                placeholder="Search customers by name, email, phone..."
                className="w-full px-4 py-3 bg-white border border-gray-200 rounded-lg shadow text-base focus:ring-2 focus:ring-yellow-400 outline-none" />
            </div>

            {loading ? (
              <div className="bg-white rounded-lg shadow p-8 text-center"><div className="w-8 h-8 border-4 border-yellow-400 border-t-transparent rounded-full animate-spin mx-auto"></div></div>
            ) : enrichedCustomers.length === 0 ? (
              <div className="bg-white rounded-lg shadow p-8 text-center text-gray-500"><p>No customers yet. They&apos;ll appear here once they book.</p></div>
            ) : (
              <div className="space-y-3">
                {enrichedCustomers.map(c => (
                  <div key={c.id} className="bg-white rounded-lg shadow">
                    <button onClick={() => setExpandedCustomer(expandedCustomer === c.id ? null : c.id!)}
                      className="w-full p-4 text-left flex items-center justify-between">
                      <div className="flex-1">
                        <div className="flex items-center space-x-2 flex-wrap gap-y-1">
                          <h3 className="font-bold">{c.name}</h3>
                          {c.activeCount > 0 && <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-blue-100 text-blue-800">{c.activeCount} active</span>}
                          <span className="text-xs text-gray-400">{c.jobCount} total visits</span>
                        </div>
                        <p className="text-sm text-gray-500 mt-0.5">{c.email} {c.phone && `· ${c.phone}`}</p>
                      </div>
                      <div className="flex items-center space-x-3">
                        <div className="text-right">
                          <p className="text-sm font-bold text-green-600">{c.completedCount} done</p>
                        </div>
                        <svg className={`w-5 h-5 text-gray-400 transition-transform ${expandedCustomer === c.id ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                        </svg>
                      </div>
                    </button>

                    {expandedCustomer === c.id && (
                      <div className="px-4 pb-4 border-t border-gray-100">
                        {/* Vehicles */}
                        {c.vehicles && c.vehicles.length > 0 && (
                          <div className="mt-3 mb-3">
                            <p className="text-xs text-gray-400 font-semibold mb-1">Vehicles</p>
                            <div className="flex flex-wrap gap-2">
                              {c.vehicles.map((v, i) => (
                                <span key={i} className="text-xs bg-gray-100 px-2 py-1 rounded font-medium">
                                  {v.make || ''} {v.model || ''} {v.year || ''} {v.vinNumber && `· ${v.vinNumber}`}
                                </span>
                              ))}
                            </div>
                          </div>
                        )}
                        {/* Booking History */}
                        <p className="text-xs text-gray-400 font-semibold mb-2 mt-3">Booking History</p>
                        {c.allJobs.length === 0 ? (
                          <p className="text-sm text-gray-400">No bookings yet</p>
                        ) : (
                          <div className="space-y-2">
                            {c.allJobs.slice(0, 5).map(j => {
                              const sc = JOB_STATUS_COLORS[j.status]
                              return (
                                <div key={j.id} className="flex items-center justify-between bg-gray-50 rounded-lg p-3">
                                  <div>
                                    <div className="flex items-center space-x-2">
                                      <span className="font-mono text-xs text-gray-500">{j.bookingTag}</span>
                                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${sc.bg} ${sc.text}`}>{JOB_STATUS_LABELS[j.status]}</span>
                                    </div>
                                    <p className="text-xs text-gray-600 mt-0.5">{j.services?.join(', ')}</p>
                                  </div>
                                  <div className="text-right">
                                    <p className="text-xs text-gray-500">{formatDate(j.preferredDate)}</p>
                                    {j.assignedMechanicName && <p className="text-[10px] text-gray-400">🔧 {j.assignedMechanicName}</p>}
                                  </div>
                                </div>
                              )
                            })}
                            {c.allJobs.length > 5 && <p className="text-xs text-gray-400 text-center">+{c.allJobs.length - 5} more bookings</p>}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ===== MECHANICS TAB ===== */}
        {activeTab === 'mechanics' && (
          <div>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold">Mechanics ({mechanics.length})</h2>
              {canManageStaff(profile.role) && <span className="text-xs text-gray-400 bg-gray-100 px-3 py-1.5 rounded-lg">Invite mechanic coming soon</span>}
            </div>

            {enrichedMechanics.length === 0 ? (
              <div className="bg-white rounded-lg shadow p-8 text-center text-gray-500"><p>No mechanics registered yet.</p></div>
            ) : (
              <div className="space-y-3">
                {enrichedMechanics.map(m => (
                  <div key={m.id} className="bg-white rounded-lg shadow">
                    <button onClick={() => setExpandedMechanic(expandedMechanic === m.id ? null : m.id!)}
                      className="w-full p-4 text-left flex items-center justify-between">
                      <div className="flex-1">
                        <div className="flex items-center space-x-2 flex-wrap gap-y-1">
                          <h3 className="font-bold">{m.name}</h3>
                          <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-purple-100 text-purple-800">Mechanic</span>
                          {m.activeJobs.length > 0 && <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-blue-100 text-blue-700">{m.activeJobs.length} active</span>}
                        </div>
                        <p className="text-sm text-gray-500 mt-0.5">{m.email}</p>
                      </div>
                      <div className="flex items-center space-x-4">
                        <div className="text-right">
                          <p className="text-sm font-bold text-green-600">{m.completedJobs.length} done</p>
                          {m.avgRating > 0 && <p className="text-xs text-yellow-600">⭐ {m.avgRating.toFixed(1)}</p>}
                        </div>
                        <svg className={`w-5 h-5 text-gray-400 transition-transform ${expandedMechanic === m.id ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                        </svg>
                      </div>
                    </button>

                    {expandedMechanic === m.id && (
                      <div className="px-4 pb-4 border-t border-gray-100">
                        {/* Stats row */}
                        <div className="grid grid-cols-4 gap-2 mt-3 mb-3">
                          <div className="bg-gray-50 rounded-lg p-2 text-center"><p className="text-lg font-bold">{m.totalJobs}</p><p className="text-[10px] text-gray-500">Total</p></div>
                          <div className="bg-blue-50 rounded-lg p-2 text-center"><p className="text-lg font-bold text-blue-600">{m.activeJobs.length}</p><p className="text-[10px] text-gray-500">Active</p></div>
                          <div className="bg-green-50 rounded-lg p-2 text-center"><p className="text-lg font-bold text-green-600">{m.completedJobs.length}</p><p className="text-[10px] text-gray-500">Done</p></div>
                          <div className="bg-yellow-50 rounded-lg p-2 text-center"><p className="text-lg font-bold text-yellow-600">{m.reviewCount}</p><p className="text-[10px] text-gray-500">Reviews</p></div>
                        </div>
                        {m.skills && m.skills.length > 0 && (
                          <div className="mb-3"><p className="text-xs text-gray-400 font-semibold mb-1">Skills</p><div className="flex flex-wrap gap-1">{m.skills.map(s => <span key={s} className="text-xs bg-purple-50 text-purple-700 px-2 py-0.5 rounded">{s}</span>)}</div></div>
                        )}
                        {/* Active assignments */}
                        {m.activeJobs.length > 0 && (
                          <>
                            <p className="text-xs text-gray-400 font-semibold mb-2">Current Assignments</p>
                            <div className="space-y-2">
                              {m.activeJobs.map(j => {
                                const sc = JOB_STATUS_COLORS[j.status]
                                return (
                                  <div key={j.id} className="flex items-center justify-between bg-blue-50 rounded-lg p-3">
                                    <div>
                                      <div className="flex items-center space-x-2">
                                        <span className="font-mono text-xs">{j.bookingTag}</span>
                                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${sc.bg} ${sc.text}`}>{JOB_STATUS_LABELS[j.status]}</span>
                                      </div>
                                      <p className="text-xs text-gray-600 mt-0.5">{j.customerName} · {j.services?.join(', ')}</p>
                                    </div>
                                    <p className="text-xs text-gray-500">{formatDate(j.preferredDate)}</p>
                                  </div>
                                )
                              })}
                            </div>
                          </>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}

            {/* Also show managers and other staff */}
            {canManageStaff(profile.role) && (managers.length > 0 || staff.filter(s => s.role === 'reception').length > 0) && (
              <div className="mt-6">
                <h3 className="text-sm font-bold text-gray-500 mb-3">Other Staff</h3>
                <div className="space-y-2">
                  {staff.filter(s => s.role !== 'mechanic' && s.role !== 'garage_owner').map(s => (
                    <div key={s.id} className="bg-white rounded-lg shadow p-3 flex items-center justify-between">
                      <div>
                        <p className="font-medium">{s.name}</p>
                        <p className="text-xs text-gray-500">{s.email}</p>
                      </div>
                      <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${s.role === 'garage_manager' ? 'bg-blue-100 text-blue-800' : 'bg-gray-100 text-gray-600'}`}>{getRoleLabel(s.role as any)}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ===== REVIEWS TAB ===== */}
        {activeTab === 'reviews' && (
          <div>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold">Customer Reviews ({reviews.length})</h2>
              {reviews.length > 0 && (
                <div className="flex items-center space-x-1 bg-yellow-50 px-3 py-1.5 rounded-lg">
                  <span className="text-yellow-500">⭐</span>
                  <span className="font-bold text-yellow-700">{avgRating}</span>
                  <span className="text-xs text-yellow-600">avg</span>
                </div>
              )}
            </div>

            {reviews.length === 0 ? (
              <div className="bg-white rounded-lg shadow p-8 text-center text-gray-500">
                <span className="text-4xl block mb-3">⭐</span>
                <p className="text-lg font-medium">No reviews yet</p>
                <p className="text-sm mt-1">Customer reviews will appear here after they complete a service.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {reviews.map((r: any) => (
                  <div key={r.id} className="bg-white rounded-lg shadow p-5">
                    <div className="flex items-start justify-between mb-2">
                      <div>
                        <div className="flex items-center space-x-2">
                          <h3 className="font-bold">{r.customerName}</h3>
                          <span className="font-mono text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded">{r.bookingTag}</span>
                        </div>
                        <div className="flex items-center mt-1">
                          {[1,2,3,4,5].map(star => (
                            <span key={star} className={`text-sm ${star <= r.rating ? 'text-yellow-400' : 'text-gray-200'}`}>★</span>
                          ))}
                          {r.mechanicName && <span className="text-xs text-gray-400 ml-2">🔧 {r.mechanicName}</span>}
                        </div>
                      </div>
                      <p className="text-xs text-gray-400">
                        {r.createdAt?.toDate?.() ? r.createdAt.toDate().toLocaleDateString('en-KE', { day: 'numeric', month: 'short' }) : ''}
                      </p>
                    </div>
                    <p className="text-sm text-gray-700 mb-2">{r.comment}</p>
                    {r.services && r.services.length > 0 && (
                      <div className="flex flex-wrap gap-1 mb-2">
                        {r.services.map((s: string) => <span key={s} className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded">{s}</span>)}
                      </div>
                    )}
                    {/* Garage response */}
                    {r.garageResponse ? (
                      <div className="bg-green-50 rounded-lg p-3 mt-2">
                        <p className="text-xs text-green-700 font-semibold mb-1">Garage Response</p>
                        <p className="text-sm text-green-800">{r.garageResponse}</p>
                      </div>
                    ) : canManageStaff(profile.role) && (
                      replyReviewId === r.id ? (
                        <div className="mt-2">
                          <textarea value={replyText} onChange={e => setReplyText(e.target.value)} rows={2}
                            className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-yellow-400 outline-none resize-none"
                            placeholder="Write your response..." autoFocus />
                          <div className="flex space-x-2 mt-2">
                            <button onClick={() => handleReplyReview(r.id)} disabled={savingAction || !replyText.trim()}
                              className="px-3 py-1.5 bg-green-600 text-white rounded-lg text-xs font-medium disabled:opacity-50">
                              {savingAction ? '...' : 'Reply'}
                            </button>
                            <button onClick={() => { setReplyReviewId(null); setReplyText('') }}
                              className="px-3 py-1.5 bg-gray-100 text-gray-600 rounded-lg text-xs">Cancel</button>
                          </div>
                        </div>
                      ) : (
                        <button onClick={() => setReplyReviewId(r.id)} className="text-xs text-green-600 font-medium hover:underline mt-1">
                          Reply to review
                        </button>
                      )
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ===== ANALYTICS TAB ===== */}
        {activeTab === 'analytics' && canViewAnalytics(profile.role) && (
          <div>
            <h2 className="text-lg font-bold mb-4">Analytics</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Active Users */}
              <div className="bg-white rounded-lg shadow p-5">
                <h3 className="font-semibold text-gray-700 mb-3">Active Users</h3>
                <div className="space-y-3">
                  <div className="flex justify-between items-center py-2 border-b border-gray-50">
                    <div><p className="font-medium">Total Customers</p><p className="text-xs text-gray-400">Who have booked at least once</p></div>
                    <span className="text-2xl font-bold text-purple-600">{uniqueCustomerIds.size}</span>
                  </div>
                  <div className="flex justify-between items-center py-2 border-b border-gray-50">
                    <div><p className="font-medium">Active This Week</p><p className="text-xs text-gray-400">Customers with bookings this week</p></div>
                    <span className="text-2xl font-bold text-blue-600">{new Set(thisWeekJobs.map(j => j.customerId)).size}</span>
                  </div>
                  <div className="flex justify-between items-center py-2 border-b border-gray-50">
                    <div><p className="font-medium">Repeat Customers</p><p className="text-xs text-gray-400">2+ bookings</p></div>
                    <span className="text-2xl font-bold text-green-600">{enrichedCustomers.filter(c => c.jobCount >= 2).length}</span>
                  </div>
                  <div className="flex justify-between items-center py-2">
                    <div><p className="font-medium">Staff Members</p><p className="text-xs text-gray-400">Active team</p></div>
                    <span className="text-2xl font-bold text-yellow-600">{staff.length}</span>
                  </div>
                </div>
              </div>

              {/* Customer Activity Heatmap */}
              <div className="bg-white rounded-lg shadow p-5">
                <h3 className="font-semibold text-gray-700 mb-3">Booking Activity (Last 7 Days)</h3>
                {(() => {
                  const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
                  const counts: number[] = [0,0,0,0,0,0,0]
                  thisWeekJobs.forEach(j => {
                    const d = new Date(j.preferredDate + 'T00:00:00')
                    counts[d.getDay()]++
                  })
                  const max = Math.max(...counts, 1)
                  return (
                    <div className="space-y-2">
                      {days.map((day, i) => (
                        <div key={day} className="flex items-center space-x-3">
                          <span className="text-xs text-gray-500 w-8">{day}</span>
                          <div className="flex-1 h-4 bg-gray-100 rounded-full overflow-hidden">
                            <div className="h-full bg-petrol-yellow rounded-full transition-all" style={{ width: `${(counts[i] / max) * 100}%` }} />
                          </div>
                          <span className="text-xs font-semibold w-4 text-right">{counts[i]}</span>
                        </div>
                      ))}
                    </div>
                  )
                })()}
              </div>

              {/* Top Services */}
              <div className="bg-white rounded-lg shadow p-5">
                <h3 className="font-semibold text-gray-700 mb-3">Top Services</h3>
                {(() => {
                  const serviceCounts: Record<string, number> = {}
                  jobs.forEach(j => j.services?.forEach(s => { serviceCounts[s] = (serviceCounts[s] || 0) + 1 }))
                  const sorted = Object.entries(serviceCounts).sort((a, b) => b[1] - a[1]).slice(0, 6)
                  if (sorted.length === 0) return <p className="text-gray-400 text-sm">No data yet</p>
                  const max = sorted[0][1]
                  return sorted.map(([service, count]) => (
                    <div key={service} className="mb-2">
                      <div className="flex justify-between text-sm mb-0.5"><span>{service}</span><span className="font-semibold">{count}</span></div>
                      <div className="h-2 bg-gray-100 rounded-full"><div className="h-2 bg-petrol-yellow rounded-full" style={{ width: `${(count / max) * 100}%` }} /></div>
                    </div>
                  ))
                })()}
              </div>

              {/* Mechanic Leaderboard */}
              <div className="bg-white rounded-lg shadow p-5">
                <h3 className="font-semibold text-gray-700 mb-3">Mechanic Leaderboard</h3>
                {enrichedMechanics.length === 0 ? <p className="text-gray-400 text-sm">No mechanics yet</p> : (
                  <div className="space-y-2">
                    {enrichedMechanics.sort((a, b) => b.completedJobs.length - a.completedJobs.length).map((m, i) => (
                      <div key={m.id} className="flex items-center justify-between py-2 border-b border-gray-50 last:border-0">
                        <div className="flex items-center space-x-2">
                          <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${i === 0 ? 'bg-yellow-100 text-yellow-700' : i === 1 ? 'bg-gray-100 text-gray-600' : 'bg-orange-50 text-orange-600'}`}>{i + 1}</span>
                          <span className="font-medium">{m.name}</span>
                        </div>
                        <div className="flex items-center space-x-3">
                          {m.avgRating > 0 && <span className="text-xs text-yellow-600">⭐ {m.avgRating.toFixed(1)}</span>}
                          <span className="text-sm bg-green-100 text-green-800 px-2 py-0.5 rounded-full font-semibold">{m.completedJobs.length} jobs</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Review Summary */}
              <div className="bg-white rounded-lg shadow p-5">
                <h3 className="font-semibold text-gray-700 mb-3">Review Summary</h3>
                {reviews.length === 0 ? <p className="text-gray-400 text-sm">No reviews yet</p> : (
                  <div>
                    <div className="text-center mb-4">
                      <p className="text-4xl font-bold text-yellow-500">{avgRating}</p>
                      <div className="flex justify-center mt-1">
                        {[1,2,3,4,5].map(s => <span key={s} className={`text-lg ${s <= Math.round(parseFloat(avgRating as string)) ? 'text-yellow-400' : 'text-gray-200'}`}>★</span>)}
                      </div>
                      <p className="text-xs text-gray-500 mt-1">{reviews.length} reviews</p>
                    </div>
                    {[5,4,3,2,1].map(star => {
                      const count = reviews.filter(r => r.rating === star).length
                      const pct = reviews.length > 0 ? (count / reviews.length) * 100 : 0
                      return (
                        <div key={star} className="flex items-center space-x-2 mb-1">
                          <span className="text-xs w-3 text-right">{star}</span>
                          <span className="text-xs text-yellow-400">★</span>
                          <div className="flex-1 h-2 bg-gray-100 rounded-full"><div className="h-2 bg-yellow-400 rounded-full" style={{ width: `${pct}%` }} /></div>
                          <span className="text-xs text-gray-500 w-6 text-right">{count}</span>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>

              {/* Subscription */}
              <div className="bg-white rounded-lg shadow p-5">
                <h3 className="font-semibold text-gray-700 mb-3">Subscription</h3>
                <div className="text-center">
                  <p className="text-2xl font-bold text-petrol-yellow capitalize">{garage.subscriptionPlan || 'Basic'}</p>
                  <p className="text-sm text-gray-500 mt-1 capitalize">{garage.subscriptionStatus || 'Trial'}</p>
                  <p className="text-xs text-gray-400 mt-2">Completion rate: {stats.totalJobs > 0 ? Math.round((stats.completedJobs / stats.totalJobs) * 100) : 0}%</p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ===== ACTIVITY TAB ===== */}
        {activeTab === 'activity' && canViewAnalytics(profile.role) && (
          <div>
            <h2 className="text-lg font-bold mb-4">Activity Log</h2>
            {activity.length === 0 ? (
              <div className="bg-white rounded-lg shadow p-8 text-center text-gray-500"><p>No activity yet</p></div>
            ) : (
              <div className="bg-white rounded-lg shadow divide-y divide-gray-100">
                {activity.map(log => (
                  <div key={log.id} className="p-4">
                    <div className="flex items-start justify-between">
                      <div>
                        <p className="text-sm font-medium">{log.details || log.action}</p>
                        <p className="text-xs text-gray-400 mt-0.5">by {log.changedByName}{log.bookingTag && ` · ${log.bookingTag}`}</p>
                      </div>
                      <p className="text-xs text-gray-400 whitespace-nowrap ml-4">
                        {log.timestamp?.toDate?.() ? log.timestamp.toDate().toLocaleString('en-KE', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : 'Just now'}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* ===== MODALS ===== */}
      {notesModalJob && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6">
            <h3 className="font-bold text-lg mb-2">Service Notes</h3>
            <p className="text-gray-500 text-sm mb-3">What work was done?</p>
            <textarea value={serviceNotes} onChange={e => setServiceNotes(e.target.value)} rows={4}
              className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-yellow-400 outline-none resize-none"
              placeholder="e.g. Changed oil (5W-30), replaced air filter..." autoFocus />
            <div className="flex space-x-3 mt-4">
              <button onClick={() => handleCompleteWithNotes(notesModalJob)} disabled={savingAction}
                className="flex-1 bg-green-600 text-white font-medium py-3 rounded-xl disabled:opacity-50">{savingAction ? 'Saving...' : 'Save & Advance'}</button>
              <button onClick={() => { setNotesModalJob(null); setServiceNotes('') }} className="px-4 py-3 bg-gray-100 text-gray-600 rounded-xl">Cancel</button>
            </div>
          </div>
        </div>
      )}

      {rescheduleModalJob && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6">
            <h3 className="font-bold text-lg mb-2">Reschedule</h3>
            <div className="space-y-4">
              <div><label className="block text-sm font-medium text-gray-700 mb-1">New Date</label>
                <input type="date" value={rescheduleDate} onChange={e => setRescheduleDate(e.target.value)} min={new Date().toISOString().split('T')[0]}
                  className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-yellow-400 outline-none" /></div>
              <div><label className="block text-sm font-medium text-gray-700 mb-1">New Time</label>
                <select value={rescheduleTime} onChange={e => setRescheduleTime(e.target.value)}
                  className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-yellow-400 outline-none bg-white">
                  <option value="">Select time</option>
                  {generateTimeSlots().map(s => <option key={s} value={s}>{formatSlotTime(s)}</option>)}
                </select></div>
            </div>
            <div className="flex space-x-3 mt-5">
              <button onClick={() => handleReschedule(rescheduleModalJob)} disabled={savingAction || !rescheduleDate || !rescheduleTime}
                className="flex-1 bg-yellow-400 text-black font-medium py-3 rounded-xl disabled:opacity-50">{savingAction ? 'Saving...' : 'Reschedule'}</button>
              <button onClick={() => { setRescheduleModalJob(null); setRescheduleDate(''); setRescheduleTime('') }} className="px-4 py-3 bg-gray-100 text-gray-600 rounded-xl">Cancel</button>
            </div>
          </div>
        </div>
      )}

      {assignModalJob && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-sm w-full p-6">
            <h3 className="font-bold text-lg mb-3">Assign Mechanic</h3>
            <p className="text-gray-500 text-sm mb-4">Choose a mechanic for {assignModalJob.bookingTag}</p>
            <div className="space-y-2">
              {mechanics.map(mech => (
                <button key={mech.id} onClick={() => handleAssignMechanic(assignModalJob, mech)} disabled={actionLoading === assignModalJob.id}
                  className={`w-full text-left px-4 py-3 rounded-xl border-2 transition-all ${assignModalJob.assignedMechanicId === mech.userId ? 'border-purple-400 bg-purple-50' : 'border-gray-200 hover:border-purple-300'}`}>
                  <p className="font-medium">{mech.name}</p><p className="text-xs text-gray-500">{mech.email}</p>
                </button>
              ))}
            </div>
            <button onClick={() => setAssignModalJob(null)} className="w-full mt-4 px-4 py-3 bg-gray-100 text-gray-600 rounded-xl">Cancel</button>
          </div>
        </div>
      )}
    </div>
  )
}
