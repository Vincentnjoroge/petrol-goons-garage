'use client'

import { useState, useEffect } from 'react'
import { onAuthStateChanged, signOut, User } from 'firebase/auth'
import { getUserProfile, getGarageById, getGarageStaff, getGarageMechanics } from '@/lib/garages'
import { getGarageJobs, getMechanicJobs, updateJobStatus, assignMechanic, addJobServiceNotes, rescheduleJob, getGarageStats, getGarageActivity, generateTimeSlots, formatSlotTime } from '@/lib/jobs'
import { sendBookingEmail } from '@/lib/email'
import { canViewAllJobs, canViewAssignedJobsOnly, canManageJobs, canUpdateJobStatus, canManageStaff, canViewAnalytics, getRoleLabel } from '@/lib/roles'
import { Job, JobStatus, JOB_STATUS_LABELS, JOB_STATUS_COLORS, JOB_STATUS_ORDER, JOB_TRANSITIONS, StaffMember, UserProfile, Garage, ActivityLog } from '@/lib/types'

type DashTab = 'jobs' | 'staff' | 'analytics' | 'activity'
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
  const [activity, setActivity] = useState<ActivityLog[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // UI state
  const [activeTab, setActiveTab] = useState<DashTab>('jobs')
  const [jobFilter, setJobFilter] = useState<JobFilter>('active')
  const [searchQuery, setSearchQuery] = useState('')
  const [actionLoading, setActionLoading] = useState<string | null>(null)
  const [refreshing, setRefreshing] = useState(false)

  // Modals
  const [statusModalJob, setStatusModalJob] = useState<Job | null>(null)
  const [notesModalJob, setNotesModalJob] = useState<Job | null>(null)
  const [serviceNotes, setServiceNotes] = useState('')
  const [rescheduleModalJob, setRescheduleModalJob] = useState<Job | null>(null)
  const [rescheduleDate, setRescheduleDate] = useState('')
  const [rescheduleTime, setRescheduleTime] = useState('')
  const [savingAction, setSavingAction] = useState(false)

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
          // Load user profile to get role + garageId
          const userProfile = await getUserProfile(currentUser.uid)
          if (!userProfile || !userProfile.garageId) {
            // User doesn't belong to a garage
            setNoGarage(true)
            setPageReady(true)
            return
          }

          const allowedRoles = ['garage_owner', 'garage_manager', 'mechanic', 'reception']
          if (!allowedRoles.includes(userProfile.role)) {
            setNotAuthorized(true)
            setPageReady(true)
            return
          }

          setProfile(userProfile)

          // Load garage
          const garageData = await getGarageById(userProfile.garageId)
          if (!garageData) {
            setNoGarage(true)
            setPageReady(true)
            return
          }
          setGarage(garageData)
          setPageReady(true)
        })
      } catch {
        clearTimeout(timeout)
        window.location.href = '/'
      }
    }
    init()
    return () => { clearTimeout(timeout); unsubscribe?.() }
  }, [pageReady])

  // Load data when garage is ready
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
        // Mechanics only see their assigned jobs
        jobsData = await getMechanicJobs(garage.id, profile.uid)
      } else {
        jobsData = await getGarageJobs(garage.id)
      }

      const [staffData, activityData, statsData] = await Promise.all([
        canManageStaff(profile.role) ? getGarageStaff(garage.id) : Promise.resolve([]),
        canViewAnalytics(profile.role) ? getGarageActivity(garage.id, 30) : Promise.resolve([]),
        getGarageStats(garage.id),
      ])

      setJobs(jobsData)
      setStaff(staffData)
      setActivity(activityData)
      setStats(statsData)
    } catch (err: any) {
      console.error('Error loading data:', err)
      setError('Failed to load data')
    }
    setLoading(false)
  }

  const handleRefresh = async () => {
    setRefreshing(true)
    await loadData()
    setRefreshing(false)
  }

  // ========== STATUS CHANGE ==========
  const handleStatusChange = async (job: Job, newStatus: JobStatus, notes?: string) => {
    if (!job.id || !garage?.id || !user) return
    setActionLoading(job.id)
    try {
      const result = await updateJobStatus(
        garage.id, job.id, newStatus,
        user.uid, user.displayName || 'Staff',
        notes
      )
      if (result.success) {
        setJobs(prev => prev.map(j => j.id === job.id ? { ...j, status: newStatus } : j))
        setStatusModalJob(null)
        // Refresh stats
        const newStats = await getGarageStats(garage.id)
        setStats(newStats)
      } else {
        setError(result.error || 'Failed to update status')
      }
    } catch (err: any) {
      setError(err.message)
    }
    setActionLoading(null)
  }

  // ========== COMPLETE WITH NOTES ==========
  const handleCompleteWithNotes = async (job: Job) => {
    if (!job.id || !garage?.id || !user) return
    setSavingAction(true)
    try {
      if (serviceNotes.trim()) {
        await addJobServiceNotes(garage.id, job.id, serviceNotes.trim(), user.uid, user.displayName || 'Staff')
      }
      // Move to quality_check or completed based on current state
      const nextStatus: JobStatus = job.status === 'quality_check' ? 'ready_for_pickup' :
                                    job.status === 'ready_for_pickup' ? 'completed' : 'quality_check'
      await handleStatusChange(job, nextStatus, serviceNotes.trim())
      setNotesModalJob(null)
      setServiceNotes('')
    } catch (err: any) {
      setError(err.message)
    }
    setSavingAction(false)
  }

  // ========== RESCHEDULE ==========
  const handleReschedule = async (job: Job) => {
    if (!job.id || !garage?.id || !user || !rescheduleDate || !rescheduleTime) return
    setSavingAction(true)
    try {
      const result = await rescheduleJob(
        garage.id, job.id, rescheduleDate, rescheduleTime,
        user.uid, user.displayName || 'Staff'
      )
      if (result.success) {
        setJobs(prev => prev.map(j => j.id === job.id
          ? { ...j, preferredDate: rescheduleDate, preferredTime: rescheduleTime }
          : j
        ))
        setRescheduleModalJob(null)
        setRescheduleDate('')
        setRescheduleTime('')
      }
    } catch (err: any) {
      setError(err.message)
    }
    setSavingAction(false)
  }

  // ========== ASSIGN MECHANIC ==========
  const [assignModalJob, setAssignModalJob] = useState<Job | null>(null)
  const handleAssignMechanic = async (job: Job, mechanicStaff: StaffMember) => {
    if (!job.id || !garage?.id || !user) return
    setActionLoading(job.id)
    try {
      await assignMechanic(
        garage.id, job.id,
        mechanicStaff.userId, mechanicStaff.name,
        user.uid, user.displayName || 'Staff'
      )
      setJobs(prev => prev.map(j => j.id === job.id
        ? { ...j, assignedMechanicId: mechanicStaff.userId, assignedMechanicName: mechanicStaff.name }
        : j
      ))
      setAssignModalJob(null)
    } catch (err: any) {
      setError(err.message)
    }
    setActionLoading(null)
  }

  const handleSignOut = async () => {
    try {
      const { auth: firebaseAuth } = await import('@/lib/firebase')
      await signOut(firebaseAuth)
    } catch {}
    window.location.href = '/'
  }

  // ========== FILTERS ==========
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
    return (
      j.customerName?.toLowerCase().includes(searchLower) ||
      j.customerEmail?.toLowerCase().includes(searchLower) ||
      j.bookingTag?.toLowerCase().includes(searchLower) ||
      j.vinNumber?.toLowerCase().includes(searchLower) ||
      j.services?.some(s => s.toLowerCase().includes(searchLower)) ||
      j.assignedMechanicName?.toLowerCase().includes(searchLower) ||
      JOB_STATUS_LABELS[j.status]?.toLowerCase().includes(searchLower)
    )
  })

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr + 'T00:00:00')
    return date.toLocaleDateString('en-KE', { weekday: 'short', day: 'numeric', month: 'short' })
  }

  // ========== LOADING STATES ==========
  if (!pageReady) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-yellow-400 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-white text-lg">Loading your garage...</p>
        </div>
      </div>
    )
  }

  if (noGarage) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center p-4">
        <div className="text-center max-w-md">
          <div className="w-16 h-16 mx-auto mb-6 bg-yellow-400 bg-opacity-20 rounded-full flex items-center justify-center">
            <span className="text-3xl">🏪</span>
          </div>
          <h1 className="text-2xl font-bold text-white mb-2">No Garage Found</h1>
          <p className="text-gray-400 mb-6">Your account isn&apos;t connected to a garage yet. Register your garage or ask your garage owner to add you as staff.</p>
          <div className="space-y-3">
            <button onClick={() => window.location.href = '/garage-signup'} className="w-full bg-petrol-yellow text-black font-bold py-3 rounded-xl">
              Register Your Garage
            </button>
            <button onClick={handleSignOut} className="w-full bg-white bg-opacity-10 text-white font-medium py-3 rounded-xl">
              Sign Out
            </button>
          </div>
        </div>
      </div>
    )
  }

  if (notAuthorized) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center p-4">
        <div className="text-center max-w-md">
          <div className="w-16 h-16 mx-auto mb-6 bg-red-500 bg-opacity-20 rounded-full flex items-center justify-center">
            <span className="text-3xl">🔒</span>
          </div>
          <h1 className="text-2xl font-bold text-white mb-2">Access Denied</h1>
          <p className="text-gray-400 mb-6">Your role doesn&apos;t have access to the garage dashboard.</p>
          <button onClick={handleSignOut} className="w-full bg-petrol-yellow text-black font-bold py-3 rounded-xl">Sign Out</button>
        </div>
      </div>
    )
  }

  if (!user || !profile || !garage) return null

  const mechanics = staff.filter(s => s.role === 'mechanic')

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
            <button onClick={handleRefresh} disabled={refreshing}
              className="bg-white bg-opacity-10 text-white px-3 py-2 rounded-lg text-sm hover:bg-opacity-20 disabled:opacity-50">
              <svg className={`w-5 h-5 ${refreshing ? 'animate-spin' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
            </button>
            <button onClick={handleSignOut} className="bg-petrol-yellow text-black px-4 py-2 rounded-lg font-medium text-sm">
              Sign Out
            </button>
          </div>
        </div>
      </div>
      <div className="racing-stripe"></div>

      <div className="max-w-6xl mx-auto p-4 py-6">
        {/* Stats Bar */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-5">
          <div className="bg-white rounded-lg shadow p-4 text-center">
            <p className="text-2xl font-bold text-gray-800">{stats.todayJobs}</p>
            <p className="text-xs text-gray-500">Today</p>
          </div>
          <div className="bg-white rounded-lg shadow p-4 text-center">
            <p className="text-2xl font-bold text-blue-600">{stats.activeJobs}</p>
            <p className="text-xs text-gray-500">Active</p>
          </div>
          <div className="bg-white rounded-lg shadow p-4 text-center">
            <p className="text-2xl font-bold text-green-600">{stats.completedJobs}</p>
            <p className="text-xs text-gray-500">Completed</p>
          </div>
          <div className="bg-white rounded-lg shadow p-4 text-center">
            <p className="text-2xl font-bold text-gray-400">{stats.cancelledJobs}</p>
            <p className="text-xs text-gray-500">Cancelled</p>
          </div>
          <div className="bg-white rounded-lg shadow p-4 text-center">
            <p className="text-2xl font-bold text-petrol-yellow">{stats.totalJobs}</p>
            <p className="text-xs text-gray-500">Total</p>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="flex bg-white rounded-xl p-1 shadow-sm mb-5 overflow-x-auto">
          {([
            { key: 'jobs' as DashTab, label: '📋 Jobs', show: true },
            { key: 'staff' as DashTab, label: '👥 Staff', show: canManageStaff(profile.role) },
            { key: 'analytics' as DashTab, label: '📊 Analytics', show: canViewAnalytics(profile.role) },
            { key: 'activity' as DashTab, label: '📝 Activity', show: canViewAnalytics(profile.role) },
          ]).filter(t => t.show).map(tab => (
            <button key={tab.key} onClick={() => setActiveTab(tab.key)}
              className={`flex-1 py-2.5 rounded-lg text-sm font-semibold transition-all whitespace-nowrap px-3 ${
                activeTab === tab.key ? 'bg-petrol-black text-white shadow-sm' : 'text-gray-500 hover:text-gray-700'
              }`}>
              {tab.label}
            </button>
          ))}
        </div>

        {/* Error */}
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-4">
            <p>{error}</p>
            <button onClick={() => setError(null)} className="text-red-500 underline text-sm">Dismiss</button>
          </div>
        )}

        {/* ===== JOBS TAB ===== */}
        {activeTab === 'jobs' && (
          <div>
            {/* Search + Filter */}
            <div className="mb-4">
              <input type="text" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search by name, tag, VIN, service..."
                className="w-full px-4 py-3 bg-white border border-gray-200 rounded-lg shadow text-base focus:ring-2 focus:ring-yellow-400 outline-none" />
            </div>

            <div className="flex space-x-2 mb-4 overflow-x-auto">
              {([
                { key: 'active' as JobFilter, label: 'Active', count: stats.activeJobs },
                { key: 'completed' as JobFilter, label: 'Completed', count: stats.completedJobs },
                { key: 'cancelled' as JobFilter, label: 'Cancelled', count: stats.cancelledJobs },
                { key: 'all' as JobFilter, label: 'All', count: stats.totalJobs },
              ]).map(f => (
                <button key={f.key} onClick={() => setJobFilter(f.key)}
                  className={`px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-all ${
                    jobFilter === f.key ? 'bg-petrol-black text-white' : 'bg-white text-gray-600 hover:bg-gray-50'
                  }`}>
                  {f.label} ({f.count})
                </button>
              ))}
            </div>

            {/* Job Cards */}
            {loading ? (
              <div className="bg-white rounded-lg shadow p-8 text-center">
                <div className="w-8 h-8 border-4 border-yellow-400 border-t-transparent rounded-full animate-spin mx-auto"></div>
                <p className="text-gray-500 mt-2">Loading jobs...</p>
              </div>
            ) : filteredJobs.length === 0 ? (
              <div className="bg-white rounded-lg shadow p-8 text-center text-gray-500">
                <p className="text-lg">{searchQuery ? `No results for "${searchQuery}"` : 'No jobs found'}</p>
              </div>
            ) : (
              <div className="space-y-3">
                {filteredJobs.map(job => {
                  const statusColor = JOB_STATUS_COLORS[job.status]
                  const allowedNext = JOB_TRANSITIONS[job.status] || []
                  return (
                    <div key={job.id} className="bg-white rounded-lg shadow p-5">
                      {/* Header row */}
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex-1">
                          <div className="flex items-center space-x-2 flex-wrap gap-y-1">
                            <h3 className="text-lg font-bold">{job.customerName}</h3>
                            <span className="font-mono text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded">{job.bookingTag}</span>
                            <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold ${statusColor.bg} ${statusColor.text}`}>
                              {JOB_STATUS_LABELS[job.status]}
                            </span>
                          </div>
                          <p className="text-sm text-gray-500 mt-1">
                            {formatDate(job.preferredDate)} @ {formatSlotTime(job.preferredTime)}
                            {job.assignedMechanicName && <span className="ml-2">· 🔧 {job.assignedMechanicName}</span>}
                          </p>
                        </div>
                      </div>

                      {/* Details */}
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm mb-3">
                        <div>
                          <p className="text-gray-400 text-xs">Services</p>
                          <p className="font-medium">{job.services?.join(', ') || '—'}</p>
                        </div>
                        {job.vinNumber && (
                          <div>
                            <p className="text-gray-400 text-xs">VIN</p>
                            <p className="font-medium">{job.vinNumber}</p>
                          </div>
                        )}
                        <div>
                          <p className="text-gray-400 text-xs">Email</p>
                          <p className="font-medium truncate">{job.customerEmail || '—'}</p>
                        </div>
                        <div>
                          <p className="text-gray-400 text-xs">Phone</p>
                          <p className="font-medium">{job.customerPhone || '—'}</p>
                        </div>
                      </div>

                      {job.description && (
                        <div className="mb-3">
                          <p className="text-gray-400 text-xs">Issue</p>
                          <p className="text-sm">{job.description}</p>
                        </div>
                      )}

                      {/* Photos */}
                      {job.photos && job.photos.length > 0 && (
                        <div className="flex space-x-2 overflow-x-auto mb-3">
                          {job.photos.map((url, idx) => (
                            <a key={idx} href={url} target="_blank" rel="noopener noreferrer"
                              className="flex-shrink-0 w-16 h-16 rounded-lg overflow-hidden border-2 border-gray-200 hover:border-yellow-400">
                              <img src={url} alt={`Photo ${idx + 1}`} className="w-full h-full object-cover" />
                            </a>
                          ))}
                        </div>
                      )}

                      {/* Service notes */}
                      {job.serviceNotes && (
                        <div className="bg-blue-50 rounded-lg p-3 mb-3">
                          <p className="text-blue-700 text-xs font-semibold">Service Notes</p>
                          <p className="text-blue-800 text-sm">{job.serviceNotes}</p>
                        </div>
                      )}

                      {/* Status progress bar */}
                      {!['completed', 'cancelled'].includes(job.status) && (
                        <div className="mb-3">
                          <div className="flex items-center space-x-1">
                            {JOB_STATUS_ORDER.map((s, idx) => {
                              const currentIdx = JOB_STATUS_ORDER.indexOf(job.status)
                              const isPast = idx < currentIdx
                              const isCurrent = idx === currentIdx
                              return (
                                <div key={s} className="flex-1">
                                  <div className={`h-1.5 rounded-full ${
                                    isPast ? 'bg-green-400' : isCurrent ? 'bg-yellow-400' : 'bg-gray-200'
                                  }`} />
                                </div>
                              )
                            })}
                          </div>
                          <p className="text-[10px] text-gray-400 mt-1">
                            Step {JOB_STATUS_ORDER.indexOf(job.status) + 1} of {JOB_STATUS_ORDER.length}
                          </p>
                        </div>
                      )}

                      {/* Action buttons */}
                      {canUpdateJobStatus(profile.role) && allowedNext.length > 0 && (
                        <div className="flex flex-wrap gap-2 pt-2 border-t border-gray-100">
                          {allowedNext.map(nextStatus => {
                            const isCancel = nextStatus === 'cancelled'
                            const isComplete = nextStatus === 'completed'
                            return (
                              <button key={nextStatus}
                                onClick={() => {
                                  if (isComplete || nextStatus === 'quality_check') {
                                    setNotesModalJob(job)
                                    setServiceNotes(job.serviceNotes || '')
                                  } else {
                                    handleStatusChange(job, nextStatus)
                                  }
                                }}
                                disabled={actionLoading === job.id}
                                className={`px-3 py-2 rounded-lg text-xs font-semibold transition-all disabled:opacity-50 ${
                                  isCancel ? 'bg-red-100 text-red-700 hover:bg-red-200' :
                                  isComplete ? 'bg-green-600 text-white hover:bg-green-700' :
                                  'bg-blue-100 text-blue-700 hover:bg-blue-200'
                                }`}>
                                {actionLoading === job.id ? '...' : `→ ${JOB_STATUS_LABELS[nextStatus]}`}
                              </button>
                            )
                          })}

                          {/* Assign mechanic button */}
                          {canManageJobs(profile.role) && mechanics.length > 0 && (
                            <button onClick={() => setAssignModalJob(job)}
                              className="px-3 py-2 rounded-lg text-xs font-semibold bg-purple-100 text-purple-700 hover:bg-purple-200">
                              🔧 Assign
                            </button>
                          )}

                          {/* Reschedule */}
                          {canManageJobs(profile.role) && !['completed', 'cancelled'].includes(job.status) && (
                            <button onClick={() => {
                              setRescheduleModalJob(job)
                              setRescheduleDate(job.preferredDate)
                              setRescheduleTime(job.preferredTime)
                            }}
                              className="px-3 py-2 rounded-lg text-xs font-semibold bg-yellow-100 text-yellow-800 hover:bg-yellow-200">
                              📅 Reschedule
                            </button>
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

        {/* ===== STAFF TAB ===== */}
        {activeTab === 'staff' && canManageStaff(profile.role) && (
          <div>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold">Team ({staff.length})</h2>
              {/* Add staff button - future */}
              <span className="text-xs text-gray-400 bg-gray-100 px-3 py-1.5 rounded-lg">Invite staff coming soon</span>
            </div>

            {staff.length === 0 ? (
              <div className="bg-white rounded-lg shadow p-8 text-center text-gray-500">
                <p>No staff members yet. You&apos;re the first!</p>
              </div>
            ) : (
              <div className="space-y-3">
                {staff.map(member => (
                  <div key={member.id} className="bg-white rounded-lg shadow p-4 flex items-center justify-between">
                    <div>
                      <div className="flex items-center space-x-2">
                        <h3 className="font-bold">{member.name}</h3>
                        <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${
                          member.role === 'garage_owner' ? 'bg-yellow-100 text-yellow-800' :
                          member.role === 'garage_manager' ? 'bg-blue-100 text-blue-800' :
                          member.role === 'mechanic' ? 'bg-purple-100 text-purple-800' :
                          'bg-gray-100 text-gray-600'
                        }`}>
                          {getRoleLabel(member.role as any)}
                        </span>
                      </div>
                      <p className="text-sm text-gray-500 mt-0.5">{member.email}</p>
                      {member.skills && member.skills.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-2">
                          {member.skills.map(s => (
                            <span key={s} className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded">{s}</span>
                          ))}
                        </div>
                      )}
                    </div>
                    <div className={`w-3 h-3 rounded-full ${member.isActive ? 'bg-green-400' : 'bg-gray-300'}`}
                      title={member.isActive ? 'Active' : 'Inactive'} />
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
              {/* Top Services */}
              <div className="bg-white rounded-lg shadow p-5">
                <h3 className="font-semibold text-gray-700 mb-3">Top Services</h3>
                {(() => {
                  const serviceCounts: Record<string, number> = {}
                  jobs.forEach(j => j.services?.forEach(s => { serviceCounts[s] = (serviceCounts[s] || 0) + 1 }))
                  const sorted = Object.entries(serviceCounts).sort((a, b) => b[1] - a[1]).slice(0, 5)
                  if (sorted.length === 0) return <p className="text-gray-400 text-sm">No data yet</p>
                  const max = sorted[0][1]
                  return sorted.map(([service, count]) => (
                    <div key={service} className="mb-2">
                      <div className="flex justify-between text-sm mb-0.5">
                        <span>{service}</span>
                        <span className="font-semibold">{count}</span>
                      </div>
                      <div className="h-2 bg-gray-100 rounded-full">
                        <div className="h-2 bg-petrol-yellow rounded-full" style={{ width: `${(count / max) * 100}%` }} />
                      </div>
                    </div>
                  ))
                })()}
              </div>

              {/* Mechanic Performance */}
              <div className="bg-white rounded-lg shadow p-5">
                <h3 className="font-semibold text-gray-700 mb-3">Mechanic Performance</h3>
                {(() => {
                  const mechJobs: Record<string, number> = {}
                  jobs.filter(j => j.status === 'completed' && j.assignedMechanicName).forEach(j => {
                    mechJobs[j.assignedMechanicName!] = (mechJobs[j.assignedMechanicName!] || 0) + 1
                  })
                  const sorted = Object.entries(mechJobs).sort((a, b) => b[1] - a[1])
                  if (sorted.length === 0) return <p className="text-gray-400 text-sm">No completed jobs yet</p>
                  return sorted.map(([name, count]) => (
                    <div key={name} className="flex items-center justify-between py-2 border-b border-gray-50 last:border-0">
                      <span className="font-medium">{name}</span>
                      <span className="text-sm bg-green-100 text-green-800 px-2 py-0.5 rounded-full font-semibold">{count} jobs</span>
                    </div>
                  ))
                })()}
              </div>

              {/* Completion Rate */}
              <div className="bg-white rounded-lg shadow p-5">
                <h3 className="font-semibold text-gray-700 mb-3">Completion Rate</h3>
                {(() => {
                  const total = jobs.length
                  const completed = jobs.filter(j => j.status === 'completed').length
                  const rate = total > 0 ? Math.round((completed / total) * 100) : 0
                  return (
                    <div className="text-center">
                      <p className="text-5xl font-bold text-green-600">{rate}%</p>
                      <p className="text-sm text-gray-500 mt-1">{completed} of {total} jobs completed</p>
                    </div>
                  )
                })()}
              </div>

              {/* Average Job Duration */}
              <div className="bg-white rounded-lg shadow p-5">
                <h3 className="font-semibold text-gray-700 mb-3">Subscription</h3>
                <div className="text-center">
                  <p className="text-2xl font-bold text-petrol-yellow capitalize">{garage.subscriptionPlan || 'Basic'}</p>
                  <p className="text-sm text-gray-500 mt-1 capitalize">{garage.subscriptionStatus || 'Trial'}</p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ===== ACTIVITY TAB ===== */}
        {activeTab === 'activity' && canViewAnalytics(profile.role) && (
          <div>
            <h2 className="text-lg font-bold mb-4">Recent Activity</h2>
            {activity.length === 0 ? (
              <div className="bg-white rounded-lg shadow p-8 text-center text-gray-500">
                <p>No activity yet</p>
              </div>
            ) : (
              <div className="bg-white rounded-lg shadow divide-y divide-gray-100">
                {activity.map(log => (
                  <div key={log.id} className="p-4">
                    <div className="flex items-start justify-between">
                      <div>
                        <p className="text-sm font-medium">{log.details || log.action}</p>
                        <p className="text-xs text-gray-400 mt-0.5">
                          by {log.changedByName}
                          {log.bookingTag && <span> · {log.bookingTag}</span>}
                        </p>
                      </div>
                      <p className="text-xs text-gray-400 whitespace-nowrap ml-4">
                        {log.timestamp?.toDate?.()
                          ? log.timestamp.toDate().toLocaleString('en-KE', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
                          : 'Just now'}
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

      {/* Service Notes Modal */}
      {notesModalJob && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6">
            <h3 className="font-bold text-lg mb-2">Service Notes</h3>
            <p className="text-gray-500 text-sm mb-3">What work was done? This goes into the customer&apos;s service history.</p>
            <textarea value={serviceNotes} onChange={e => setServiceNotes(e.target.value)} rows={4}
              className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-yellow-400 outline-none resize-none"
              placeholder="e.g. Changed oil (5W-30), replaced air filter..." autoFocus />
            <div className="flex space-x-3 mt-4">
              <button onClick={() => handleCompleteWithNotes(notesModalJob)} disabled={savingAction}
                className="flex-1 bg-green-600 text-white font-medium py-3 rounded-xl hover:bg-green-700 disabled:opacity-50">
                {savingAction ? 'Saving...' : 'Save & Advance'}
              </button>
              <button onClick={() => { setNotesModalJob(null); setServiceNotes('') }}
                className="px-4 py-3 bg-gray-100 text-gray-600 rounded-xl hover:bg-gray-200">Cancel</button>
            </div>
          </div>
        </div>
      )}

      {/* Reschedule Modal */}
      {rescheduleModalJob && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6">
            <h3 className="font-bold text-lg mb-2">Reschedule</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">New Date</label>
                <input type="date" value={rescheduleDate} onChange={e => setRescheduleDate(e.target.value)}
                  min={new Date().toISOString().split('T')[0]}
                  className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-yellow-400 outline-none" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">New Time</label>
                <select value={rescheduleTime} onChange={e => setRescheduleTime(e.target.value)}
                  className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-yellow-400 outline-none bg-white">
                  <option value="">Select time</option>
                  {generateTimeSlots().map(s => (
                    <option key={s} value={s}>{formatSlotTime(s)}</option>
                  ))}
                </select>
              </div>
            </div>
            <div className="flex space-x-3 mt-5">
              <button onClick={() => handleReschedule(rescheduleModalJob)}
                disabled={savingAction || !rescheduleDate || !rescheduleTime}
                className="flex-1 bg-yellow-400 text-black font-medium py-3 rounded-xl hover:bg-yellow-500 disabled:opacity-50">
                {savingAction ? 'Saving...' : 'Reschedule'}
              </button>
              <button onClick={() => { setRescheduleModalJob(null); setRescheduleDate(''); setRescheduleTime('') }}
                className="px-4 py-3 bg-gray-100 text-gray-600 rounded-xl hover:bg-gray-200">Cancel</button>
            </div>
          </div>
        </div>
      )}

      {/* Assign Mechanic Modal */}
      {assignModalJob && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-sm w-full p-6">
            <h3 className="font-bold text-lg mb-3">Assign Mechanic</h3>
            <p className="text-gray-500 text-sm mb-4">Choose a mechanic for {assignModalJob.bookingTag}</p>
            <div className="space-y-2">
              {mechanics.map(mech => (
                <button key={mech.id} onClick={() => handleAssignMechanic(assignModalJob, mech)}
                  disabled={actionLoading === assignModalJob.id}
                  className={`w-full text-left px-4 py-3 rounded-xl border-2 transition-all ${
                    assignModalJob.assignedMechanicId === mech.userId
                      ? 'border-purple-400 bg-purple-50'
                      : 'border-gray-200 hover:border-purple-300 hover:bg-purple-50'
                  }`}>
                  <p className="font-medium">{mech.name}</p>
                  <p className="text-xs text-gray-500">{mech.email}</p>
                </button>
              ))}
            </div>
            <button onClick={() => setAssignModalJob(null)}
              className="w-full mt-4 px-4 py-3 bg-gray-100 text-gray-600 rounded-xl hover:bg-gray-200">Cancel</button>
          </div>
        </div>
      )}
    </div>
  )
}
