'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { onAuthStateChanged, signOut, User } from 'firebase/auth'
// NO static import of auth — dynamic import used inside useEffect and handlers
import { getAllBookings, updateBookingStatus, addServiceNotes, rescheduleBooking, Booking, formatSlotTime, generateTimeSlots, getMechanicName } from '@/lib/bookings'
import { sendBookingEmail, getBookingConfirmationEmailHtml, getBookingRejectionEmailHtml, getServiceCompletedEmailHtml, getBookingRescheduledEmailHtml } from '@/lib/email'
import { isAdmin } from '@/lib/admin'
import { getAllGarages, updateGarageProfile, GarageProfile } from '@/lib/garages'

type DashboardView = 'bookings' | 'garages'
type FilterTab = 'upcoming' | 'completed' | 'cancelled' | 'all'
type SortOption = 'date-desc' | 'date-asc' | 'name-asc' | 'name-desc'

const MECHANICS = [
  { id: 'mike-d', name: 'Mike D' },
  { id: 'kimanthi', name: 'Kimanthi' },
  { id: 'thomas', name: 'Thomas' },
  { id: 'viny', name: 'Viny' },
]

export default function DashboardPage() {
  const router = useRouter()
  const [user, setUser] = useState<User | null>(null)
  const [pageReady, setPageReady] = useState(false)
  const [bookings, setBookings] = useState<Booking[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [actionLoading, setActionLoading] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<FilterTab>('upcoming')
  const [notAuthorized, setNotAuthorized] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  // Service notes state
  const [notesBookingId, setNotesBookingId] = useState<string | null>(null)
  const [serviceNotes, setServiceNotes] = useState('')
  const [savingNotes, setSavingNotes] = useState(false)
  // Reschedule state
  const [rescheduleBookingId, setRescheduleBookingId] = useState<string | null>(null)
  const [rescheduleDate, setRescheduleDate] = useState('')
  const [rescheduleTime, setRescheduleTime] = useState('')
  const [savingReschedule, setSavingReschedule] = useState(false)
  // Mechanic assignment state
  const [assigningMechanicId, setAssigningMechanicId] = useState<string | null>(null)
  // Sort state
  const [sortBy, setSortBy] = useState<SortOption>('date-desc')
  // Dashboard view (bookings vs garages)
  const [dashView, setDashView] = useState<DashboardView>('bookings')
  // Garage applications
  const [garages, setGarages] = useState<GarageProfile[]>([])
  const [garageActionLoading, setGarageActionLoading] = useState<string | null>(null)

  // Auth check with timeout — dynamic import of auth
  useEffect(() => {
    let unsubscribe: (() => void) | undefined

    const timeout = setTimeout(() => {
      if (!pageReady) router.replace('/')
    }, 5000)

    const init = async () => {
      try {
        const { auth } = await import('@/lib/firebase')
        unsubscribe = onAuthStateChanged(auth, (currentUser) => {
          clearTimeout(timeout)
          if (currentUser) {
            if (!isAdmin(currentUser.email)) {
              setNotAuthorized(true)
              setPageReady(true)
              return
            }
            setUser(currentUser)
            setPageReady(true)
          } else {
            router.replace('/')
          }
        })
      } catch (err) {
        console.error('Firebase auth init error:', err)
        clearTimeout(timeout)
        router.replace('/')
      }
    }

    init()

    return () => {
      clearTimeout(timeout)
      if (unsubscribe) unsubscribe()
    }
  }, [router, pageReady])

  // Load bookings
  const [refreshing, setRefreshing] = useState(false)

  const loadBookings = async () => {
    if (!user) return
    setLoading(true)
    try {
      const [bookingData, garageData] = await Promise.all([
        getAllBookings(),
        getAllGarages(),
      ])
      setBookings(bookingData)
      setGarages(garageData)
    } catch (err: any) {
      console.error('Error loading data:', err)
      setError('Failed to load data')
    }
    setLoading(false)
  }

  const handleRefresh = async () => {
    setRefreshing(true)
    await loadBookings()
    setRefreshing(false)
  }

  useEffect(() => {
    if (pageReady && user) {
      loadBookings()
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, pageReady])

  const handleStatusChange = async (booking: Booking, newStatus: 'approved' | 'completed' | 'rejected' | 'cancelled') => {
    if (!booking.id) return
    setActionLoading(booking.id)

    try {
      const result = await updateBookingStatus(booking.id, newStatus, user?.uid)

      if (result.success) {
        // Send email for approve/reject (not for completed/cancelled — those are in-person actions)
        if (newStatus === 'approved') {
          const emailHtml = getBookingConfirmationEmailHtml(booking)
          await sendBookingEmail(booking.customerEmail, 'Booking Confirmed - Petrol Goons Garage', emailHtml)
        } else if (newStatus === 'rejected') {
          const emailHtml = getBookingRejectionEmailHtml(booking)
          await sendBookingEmail(booking.customerEmail, 'Booking Update - Petrol Goons Garage', emailHtml)
        }

        // Update local state
        setBookings(bookings.map(b =>
          b.id === booking.id ? { ...b, status: newStatus } : b
        ))
      } else {
        setError(result.error || `Failed to update booking`)
      }
    } catch (err: any) {
      setError(err.message || 'An error occurred')
    }
    setActionLoading(null)
  }

  // Mark as completed with service notes
  const handleCompleteWithNotes = async (booking: Booking) => {
    if (!booking.id) return
    setSavingNotes(true)

    try {
      // Save notes first
      if (serviceNotes.trim()) {
        await addServiceNotes(booking.id, serviceNotes.trim(), user?.displayName || 'Admin')
      }
      // Then mark as completed
      const result = await updateBookingStatus(booking.id, 'completed', user?.uid)
      if (result.success) {
        // Send service completed email to customer
        try {
          if (booking.customerEmail) {
            const emailHtml = getServiceCompletedEmailHtml(booking, serviceNotes.trim() || undefined)
            await sendBookingEmail(booking.customerEmail, 'Service Complete — Petrol Goons Garage', emailHtml)
          }
        } catch (emailErr) {
          console.error('Completion email failed (service still marked complete):', emailErr)
        }

        setBookings(bookings.map(b =>
          b.id === booking.id ? { ...b, status: 'completed' as const, serviceNotes: serviceNotes.trim() } : b
        ))
        setNotesBookingId(null)
        setServiceNotes('')
      } else {
        setError(result.error || 'Failed to complete booking')
      }
    } catch (err: any) {
      setError(err.message || 'An error occurred')
    }
    setSavingNotes(false)
  }

  // Reschedule a booking
  const handleReschedule = async (booking: Booking) => {
    if (!booking.id || !rescheduleDate || !rescheduleTime) return
    setSavingReschedule(true)

    try {
      const result = await rescheduleBooking(booking.id, rescheduleDate, rescheduleTime, user?.uid)
      if (result.success) {
        // Send reschedule email to customer
        try {
          if (booking.customerEmail) {
            const emailHtml = getBookingRescheduledEmailHtml(booking, rescheduleDate, rescheduleTime)
            await sendBookingEmail(booking.customerEmail, 'Booking Rescheduled — Petrol Goons Garage', emailHtml)
          }
        } catch (emailErr) {
          console.error('Reschedule email failed:', emailErr)
        }

        setBookings(bookings.map(b =>
          b.id === booking.id ? { ...b, status: 'approved' as const, preferredDate: rescheduleDate, preferredTime: rescheduleTime } : b
        ))
        setRescheduleBookingId(null)
        setRescheduleDate('')
        setRescheduleTime('')
      } else {
        setError(result.error || 'Failed to reschedule booking')
      }
    } catch (err: any) {
      setError(err.message || 'An error occurred')
    }
    setSavingReschedule(false)
  }

  // Assign mechanic to booking
  const handleAssignMechanic = async (bookingId: string, mechanic: string) => {
    try {
      const { db } = await import('@/lib/firebase')
      const { doc, updateDoc, serverTimestamp } = await import('firebase/firestore')
      await updateDoc(doc(db, 'bookings', bookingId), {
        mechanicPreference: mechanic,
        updatedAt: serverTimestamp(),
      })
      setBookings(prev => prev.map(b =>
        b.id === bookingId ? { ...b, mechanicPreference: mechanic } : b
      ))
      setAssigningMechanicId(null)
    } catch (err) {
      console.error('Error assigning mechanic:', err)
    }
  }

  // Garage approve/reject
  const handleGarageStatus = async (garage: GarageProfile, newStatus: 'approved' | 'suspended') => {
    if (!garage.id) return
    setGarageActionLoading(garage.id)
    try {
      const result = await updateGarageProfile(garage.id, { status: newStatus })
      if (result.success) {
        setGarages(garages.map(g =>
          g.id === garage.id ? { ...g, status: newStatus } : g
        ))
        // Send notification email to garage owner
        if (newStatus === 'approved' && garage.ownerEmail) {
          try {
            await sendBookingEmail(
              garage.ownerEmail,
              `Welcome to Petrol Goons — ${(garage as any).garageName || garage.name} is Approved!`,
              `<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;">
                <div style="background:#0A0A0A;padding:30px;text-align:center;">
                  <span style="color:#FDB913;font-size:24px;font-weight:bold;">PETROL GOONS</span>
                </div>
                <div style="padding:30px;background:white;border:1px solid #e5e7eb;">
                  <h2 style="color:#059669;">✓ Your Garage is Approved!</h2>
                  <p>Hi ${garage.ownerName},</p>
                  <p>Great news — <strong>${(garage as any).garageName || garage.name}</strong> has been approved and is now part of the Petrol Goons network!</p>
                  <p>What happens next:</p>
                  <ul>
                    <li>Your booking page is being set up</li>
                    <li>We'll reach out to finalize your dashboard access</li>
                    <li>Start sharing your booking link with customers</li>
                  </ul>
                  <p>Welcome aboard! 🏁<br><strong>The Petrol Goons Team</strong></p>
                </div>
              </div>`
            )
          } catch { /* email failed */ }
        }
      }
    } catch (err) {
      console.error('Error updating garage status:', err)
      setError('Failed to update garage status')
    }
    setGarageActionLoading(null)
  }

  const handleSignOut = async () => {
    try {
      const { auth: firebaseAuth } = await import('@/lib/firebase')
      await signOut(firebaseAuth)
    } catch (err) {
      console.error('Sign out error:', err)
    }
    window.location.href = '/'
  }

  const getStatusStyle = (status: string) => {
    switch(status) {
      case 'pending': return 'bg-yellow-100 text-yellow-800'
      case 'confirmed': return 'bg-green-100 text-green-800'
      case 'approved': return 'bg-green-100 text-green-800'
      case 'rejected': return 'bg-red-100 text-red-800'
      case 'completed': return 'bg-blue-100 text-blue-800'
      case 'cancelled': return 'bg-gray-100 text-gray-500'
      default: return 'bg-gray-100 text-gray-800'
    }
  }

  const getStatusLabel = (status: string) => {
    switch(status) {
      case 'confirmed': return 'CONFIRMED'
      case 'approved': return 'CONFIRMED'
      case 'pending': return 'PENDING'
      case 'completed': return 'COMPLETED'
      case 'rejected': return 'DECLINED'
      case 'cancelled': return 'CANCELLED'
      default: return status.toUpperCase()
    }
  }

  const formatTime = (time: string) => {
    if (time.includes(':') && time.length <= 5) return formatSlotTime(time)
    return time
  }

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr + 'T00:00:00')
    return date.toLocaleDateString('en-KE', { weekday: 'short', day: 'numeric', month: 'short' })
  }

  // Filter bookings by tab + search
  const searchLower = searchQuery.toLowerCase().trim()
  const filteredBookings = bookings.filter(b => {
    // Tab filter
    let tabMatch = true
    switch (activeTab) {
      case 'upcoming': tabMatch = ['confirmed', 'approved', 'pending'].includes(b.status); break
      case 'completed': tabMatch = b.status === 'completed'; break
      case 'cancelled': tabMatch = ['cancelled', 'rejected'].includes(b.status); break
      case 'all': tabMatch = true; break
    }
    if (!tabMatch) return false

    // Search filter
    if (!searchLower) return true
    return (
      b.customerName?.toLowerCase().includes(searchLower) ||
      b.customerEmail?.toLowerCase().includes(searchLower) ||
      b.vinNumber?.toLowerCase().includes(searchLower) ||
      b.service?.toLowerCase().includes(searchLower) ||
      b.description?.toLowerCase().includes(searchLower) ||
      b.preferredDate?.includes(searchLower) ||
      b.bookingTag?.toLowerCase().includes(searchLower)
    )
  }).sort((a, b) => {
    switch (sortBy) {
      case 'date-asc':
        return (a.preferredDate + a.preferredTime).localeCompare(b.preferredDate + b.preferredTime)
      case 'date-desc':
        return (b.preferredDate + b.preferredTime).localeCompare(a.preferredDate + a.preferredTime)
      case 'name-asc':
        return (a.customerName || '').localeCompare(b.customerName || '')
      case 'name-desc':
        return (b.customerName || '').localeCompare(a.customerName || '')
      default:
        return 0
    }
  })

  // CSV Export
  const handleExportCSV = () => {
    const headers = ['Tag', 'Date', 'Time', 'Customer', 'Email', 'Phone', 'Service', 'VIN', 'Mechanic', 'Status', 'Notes']
    const rows = filteredBookings.map(b => [
      b.bookingTag || '',
      b.preferredDate,
      formatTime(b.preferredTime),
      b.customerName || '',
      b.customerEmail || '',
      b.customerPhone || '',
      b.service ? (b.service + (b.otherService ? ': ' + b.otherService : '')) : '',
      b.vinNumber || '',
      b.mechanicPreference && b.mechanicPreference !== 'garage-assigns' ? getMechanicName(b.mechanicPreference) : '',
      b.status,
      (b as any).serviceNotes || '',
    ])

    const csvContent = [headers, ...rows]
      .map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(','))
      .join('\n')

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `petrol-goons-bookings-${new Date().toISOString().split('T')[0]}.csv`
    link.click()
    URL.revokeObjectURL(url)
  }

  // Counts
  const upcomingCount = bookings.filter(b => ['confirmed', 'approved', 'pending'].includes(b.status)).length
  const completedCount = bookings.filter(b => b.status === 'completed').length
  const cancelledCount = bookings.filter(b => ['cancelled', 'rejected'].includes(b.status)).length

  // Loading state
  if (!pageReady) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-yellow-400 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-white text-lg">Loading dashboard...</p>
        </div>
      </div>
    )
  }

  // Not authorized screen
  if (notAuthorized) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center p-4">
        <div className="text-center max-w-md">
          <div className="w-16 h-16 mx-auto mb-6 bg-red-500 bg-opacity-20 rounded-full flex items-center justify-center">
            <svg className="w-8 h-8 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
          </div>
          <h1 className="text-3xl font-bold text-white mb-2">Admin Only</h1>
          <p className="text-gray-400 text-lg mb-6">This dashboard is for Petrol Goons team members only. If you&apos;re a customer, head to the booking page.</p>
          <div className="space-y-3">
            <button
              onClick={() => router.push('/book')}
              className="w-full bg-petrol-yellow text-black font-bold py-3 rounded-xl"
            >
              Book a Service
            </button>
            <button
              onClick={handleSignOut}
              className="w-full bg-white bg-opacity-10 text-white font-medium py-3 rounded-xl"
            >
              Sign Out
            </button>
          </div>
        </div>
      </div>
    )
  }

  if (!user) return null

  return (
    <div className="min-h-screen bg-gray-100">
      {/* Header */}
      <div className="bg-petrol-black text-white p-4">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <span className="brand-text text-lg">
              <span className="text-petrol-green">PETROL</span>
              <span className="inline-block bg-petrol-yellow text-petrol-black px-1.5 py-0 ml-0.5 -skew-x-6 text-base">GOONS</span>
            </span>
            <span className="text-gray-500 text-sm font-semibold tracking-wider ml-1">ADMIN</span>
          </div>
          <div className="flex items-center space-x-2">
            <button
              onClick={handleRefresh}
              disabled={refreshing}
              className="bg-white bg-opacity-10 text-white px-3 py-2 rounded-lg font-medium text-sm hover:bg-opacity-20 disabled:opacity-50"
              title="Refresh bookings"
            >
              <svg className={`w-5 h-5 ${refreshing ? 'animate-spin' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
            </button>
            <button
              onClick={handleSignOut}
              className="bg-petrol-yellow text-black px-4 py-2 rounded-lg font-medium text-sm"
            >
              Sign Out
            </button>
          </div>
        </div>
      </div>
      <div className="racing-stripe"></div>

      <div className="max-w-6xl mx-auto p-4 py-6">
        {/* Dashboard view toggle */}
        <div className="flex bg-white rounded-xl p-1 shadow-sm mb-5">
          <button
            onClick={() => setDashView('bookings')}
            className={`flex-1 py-2.5 rounded-lg text-sm font-semibold transition-all ${
              dashView === 'bookings'
                ? 'bg-petrol-black text-white shadow-sm'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            📋 Bookings ({bookings.length})
          </button>
          <button
            onClick={() => setDashView('garages')}
            className={`flex-1 py-2.5 rounded-lg text-sm font-semibold transition-all relative ${
              dashView === 'garages'
                ? 'bg-petrol-black text-white shadow-sm'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            🏪 Garage Applications ({garages.length})
            {garages.filter(g => g.status === 'pending').length > 0 && (
              <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white text-xs font-bold rounded-full flex items-center justify-center">
                {garages.filter(g => g.status === 'pending').length}
              </span>
            )}
          </button>
        </div>

        {/* Error */}
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-4">
            <p className="text-base">{error}</p>
            <button onClick={() => setError(null)} className="text-red-500 underline text-base">Dismiss</button>
          </div>
        )}

        {/* ===== GARAGE APPLICATIONS VIEW ===== */}
        {dashView === 'garages' && (
          <div>
            {/* Garage stats */}
            <div className="grid grid-cols-3 gap-4 mb-5">
              <div className="bg-white rounded-lg shadow p-5 text-center">
                <p className="text-2xl font-bold text-yellow-600">{garages.filter(g => g.status === 'pending').length}</p>
                <p className="text-sm text-gray-500">Pending</p>
              </div>
              <div className="bg-white rounded-lg shadow p-5 text-center">
                <p className="text-2xl font-bold text-green-600">{garages.filter(g => g.status === 'approved' || g.status === 'active').length}</p>
                <p className="text-sm text-gray-500">Approved</p>
              </div>
              <div className="bg-white rounded-lg shadow p-5 text-center">
                <p className="text-2xl font-bold text-gray-800">{garages.length}</p>
                <p className="text-sm text-gray-500">Total</p>
              </div>
            </div>

            {loading ? (
              <div className="bg-white rounded-lg shadow p-8 text-center">
                <div className="w-8 h-8 border-4 border-yellow-400 border-t-transparent rounded-full animate-spin mx-auto"></div>
                <p className="text-gray-500 mt-2">Loading applications...</p>
              </div>
            ) : garages.length === 0 ? (
              <div className="bg-white rounded-lg shadow p-8 text-center text-gray-500">
                <p className="text-lg">No garage applications yet</p>
                <p className="text-sm mt-1">When garage owners sign up, their applications will appear here.</p>
              </div>
            ) : (
              <div className="space-y-4">
                {garages.map(garage => (
                  <div key={garage.id} className={`bg-white rounded-lg shadow p-5 ${garage.status === 'suspended' ? 'opacity-60' : ''}`}>
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        {/* Header */}
                        <div className="flex items-center space-x-2 mb-3 flex-wrap gap-y-1">
                          <h3 className="text-lg font-bold">{(garage as any).garageName || garage.name}</h3>
                          <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                            garage.status === 'pending' ? 'bg-yellow-100 text-yellow-800' :
                            garage.status === 'approved' || garage.status === 'active' ? 'bg-green-100 text-green-800' :
                            'bg-red-100 text-red-800'
                          }`}>
                            {garage.status === 'pending' ? '⏳ PENDING' :
                             garage.status === 'approved' || garage.status === 'active' ? '✓ APPROVED' :
                             'SUSPENDED'}
                          </span>
                        </div>

                        {/* Details */}
                        <div className="grid grid-cols-2 md:grid-cols-3 gap-3 text-sm">
                          <div>
                            <p className="text-gray-500 text-xs">Owner</p>
                            <p className="font-medium">{garage.ownerName}</p>
                          </div>
                          <div>
                            <p className="text-gray-500 text-xs">Phone</p>
                            <p className="font-medium">{garage.ownerPhone}</p>
                          </div>
                          <div>
                            <p className="text-gray-500 text-xs">Email</p>
                            <p className="font-medium truncate">{garage.ownerEmail || '—'}</p>
                          </div>
                          <div>
                            <p className="text-gray-500 text-xs">Location</p>
                            <p className="font-medium">{garage.location}</p>
                          </div>
                          <div>
                            <p className="text-gray-500 text-xs">Team Size</p>
                            <p className="font-medium">{garage.mechanicCount} mechanics</p>
                          </div>
                          <div>
                            <p className="text-gray-500 text-xs">Current System</p>
                            <p className="font-medium">{garage.currentSystem}</p>
                          </div>
                        </div>

                        {/* Services */}
                        <div className="mt-3">
                          <p className="text-gray-500 text-xs mb-1.5">Services ({garage.servicesOffered?.length || 0})</p>
                          <div className="flex flex-wrap gap-1.5">
                            {garage.servicesOffered?.map(s => (
                              <span key={s} className="bg-yellow-50 text-yellow-800 text-xs font-medium px-2 py-0.5 rounded">
                                {s}
                              </span>
                            ))}
                          </div>
                        </div>

                        {/* Applied date */}
                        <p className="text-gray-400 text-xs mt-3">
                          Applied: {garage.createdAt?.toDate?.()
                            ? garage.createdAt.toDate().toLocaleDateString('en-KE', { day: 'numeric', month: 'short', year: 'numeric' })
                            : 'Just now'}
                        </p>
                      </div>

                      {/* Action buttons */}
                      <div className="flex flex-col space-y-2 ml-4 shrink-0">
                        {garage.status === 'pending' && (
                          <>
                            <button
                              onClick={() => handleGarageStatus(garage, 'approved')}
                              disabled={garageActionLoading === garage.id}
                              className="px-4 py-2.5 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700 disabled:opacity-50 whitespace-nowrap"
                            >
                              {garageActionLoading === garage.id ? '...' : '✓ Approve'}
                            </button>
                            <button
                              onClick={() => handleGarageStatus(garage, 'suspended')}
                              disabled={garageActionLoading === garage.id}
                              className="px-4 py-2.5 bg-red-100 text-red-700 rounded-lg text-sm font-medium hover:bg-red-200 disabled:opacity-50 whitespace-nowrap"
                            >
                              {garageActionLoading === garage.id ? '...' : 'Decline'}
                            </button>
                          </>
                        )}
                        {(garage.status === 'approved' || garage.status === 'active') && (
                          <button
                            onClick={() => handleGarageStatus(garage, 'suspended')}
                            disabled={garageActionLoading === garage.id}
                            className="px-4 py-2.5 bg-gray-200 text-gray-600 rounded-lg text-sm font-medium hover:bg-gray-300 disabled:opacity-50 whitespace-nowrap"
                          >
                            Suspend
                          </button>
                        )}
                        {garage.status === 'suspended' && (
                          <button
                            onClick={() => handleGarageStatus(garage, 'approved')}
                            disabled={garageActionLoading === garage.id}
                            className="px-4 py-2.5 bg-green-100 text-green-700 rounded-lg text-sm font-medium hover:bg-green-200 disabled:opacity-50 whitespace-nowrap"
                          >
                            Reactivate
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ===== BOOKINGS VIEW ===== */}
        {dashView === 'bookings' && <>
        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-5 mb-6">
          <div className="bg-white rounded-lg shadow p-5">
            <p className="text-gray-500 text-base">Upcoming</p>
            <p className="text-3xl font-bold text-green-600">{upcomingCount}</p>
          </div>
          <div className="bg-white rounded-lg shadow p-5">
            <p className="text-gray-500 text-base">Completed</p>
            <p className="text-3xl font-bold text-blue-600">{completedCount}</p>
          </div>
          <div className="bg-white rounded-lg shadow p-5">
            <p className="text-gray-500 text-base">Cancelled</p>
            <p className="text-3xl font-bold text-gray-400">{cancelledCount}</p>
          </div>
          <div className="bg-white rounded-lg shadow p-5">
            <p className="text-gray-500 text-base">Total</p>
            <p className="text-3xl font-bold text-gray-800">{bookings.length}</p>
          </div>
        </div>

        {/* Search Bar */}
        <div className="mb-4">
          <div className="relative">
            <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by name, email, VIN, service, tag..."
              className="w-full pl-10 pr-10 py-3 bg-white border border-gray-200 rounded-lg shadow text-base focus:ring-2 focus:ring-yellow-400 focus:border-yellow-400 outline-none"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            )}
          </div>
        </div>

        {/* Sort & Export Bar */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center space-x-2">
            <label className="text-sm text-gray-500 font-medium">Sort:</label>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as SortOption)}
              className="text-sm bg-white border border-gray-200 rounded-lg px-3 py-2 focus:ring-2 focus:ring-yellow-400 focus:border-yellow-400 outline-none shadow-sm"
            >
              <option value="date-desc">Newest first</option>
              <option value="date-asc">Oldest first</option>
              <option value="name-asc">Name A-Z</option>
              <option value="name-desc">Name Z-A</option>
            </select>
          </div>
          <button
            onClick={handleExportCSV}
            disabled={filteredBookings.length === 0}
            className="flex items-center space-x-1.5 text-sm font-medium bg-white border border-gray-200 rounded-lg px-3 py-2 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed shadow-sm transition-colors"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            <span>Export CSV</span>
          </button>
        </div>

        {/* Filter Tabs */}
        <div className="bg-white rounded-lg shadow mb-4">
          <div className="flex border-b border-gray-200">
            {([
              { key: 'upcoming' as FilterTab, label: 'Upcoming', count: upcomingCount },
              { key: 'completed' as FilterTab, label: 'Completed', count: completedCount },
              { key: 'cancelled' as FilterTab, label: 'Cancelled', count: cancelledCount },
              { key: 'all' as FilterTab, label: 'All', count: bookings.length },
            ]).map(tab => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`flex-1 py-3 text-base font-medium transition-colors relative ${
                  activeTab === tab.key
                    ? 'text-yellow-600'
                    : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                {tab.label} ({tab.count})
                {activeTab === tab.key && (
                  <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-yellow-400"></div>
                )}
              </button>
            ))}
          </div>
        </div>

        {/* Service Notes Modal */}
        {notesBookingId && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-7">
              <h3 className="font-bold text-xl mb-2">Complete Service</h3>
              <p className="text-gray-500 text-base mb-4">What work was done? This goes into the customer&apos;s service history.</p>
              <textarea
                value={serviceNotes}
                onChange={(e) => setServiceNotes(e.target.value)}
                rows={4}
                className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-yellow-400 focus:border-yellow-400 outline-none resize-none text-base"
                placeholder="e.g. Changed oil (5W-30), replaced air filter, brake pads at 40%..."
                autoFocus
              />
              <div className="flex space-x-3 mt-4">
                <button
                  onClick={() => {
                    const booking = bookings.find(b => b.id === notesBookingId)
                    if (booking) handleCompleteWithNotes(booking)
                  }}
                  disabled={savingNotes}
                  className="flex-1 bg-blue-600 text-white font-medium py-3 rounded-xl hover:bg-blue-700 disabled:opacity-50 text-base"
                >
                  {savingNotes ? 'Saving...' : serviceNotes.trim() ? 'Save & Complete' : 'Complete Without Notes'}
                </button>
                <button
                  onClick={() => { setNotesBookingId(null); setServiceNotes('') }}
                  className="px-4 py-3 bg-gray-100 text-gray-600 rounded-xl hover:bg-gray-200 text-base"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Reschedule Modal */}
        {rescheduleBookingId && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-7">
              <h3 className="font-bold text-xl mb-2">Reschedule Booking</h3>
              <p className="text-gray-500 text-base mb-4">Pick a new date and time. The customer will be notified.</p>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">New Date</label>
                  <input
                    type="date"
                    value={rescheduleDate}
                    onChange={(e) => setRescheduleDate(e.target.value)}
                    min={new Date().toISOString().split('T')[0]}
                    className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-yellow-400 focus:border-yellow-400 outline-none text-base"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">New Time</label>
                  <select
                    value={rescheduleTime}
                    onChange={(e) => setRescheduleTime(e.target.value)}
                    className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-yellow-400 focus:border-yellow-400 outline-none bg-white text-base"
                  >
                    <option value="">Select a time</option>
                    {generateTimeSlots().map(slot => (
                      <option key={slot} value={slot}>{formatSlotTime(slot)}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="flex space-x-3 mt-5">
                <button
                  onClick={() => {
                    const booking = bookings.find(b => b.id === rescheduleBookingId)
                    if (booking) handleReschedule(booking)
                  }}
                  disabled={savingReschedule || !rescheduleDate || !rescheduleTime}
                  className="flex-1 bg-yellow-400 text-black font-medium py-3 rounded-xl hover:bg-yellow-500 disabled:opacity-50 text-base"
                >
                  {savingReschedule ? 'Saving...' : 'Reschedule & Notify Customer'}
                </button>
                <button
                  onClick={() => { setRescheduleBookingId(null); setRescheduleDate(''); setRescheduleTime('') }}
                  className="px-4 py-3 bg-gray-100 text-gray-600 rounded-xl hover:bg-gray-200 text-base"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Bookings List */}
        <div className="bg-white rounded-lg shadow">
          {loading ? (
            <div className="p-8 text-center">
              <div className="w-8 h-8 border-4 border-yellow-400 border-t-transparent rounded-full animate-spin mx-auto"></div>
              <p className="text-gray-500 mt-2">Loading bookings...</p>
            </div>
          ) : filteredBookings.length === 0 ? (
            <div className="p-8 text-center text-gray-500">
              <p>{searchQuery ? `No results for "${searchQuery}"` : `No ${activeTab === 'all' ? '' : activeTab} bookings`}</p>
              {searchQuery && (
                <button onClick={() => setSearchQuery('')} className="mt-2 text-yellow-600 text-base font-medium hover:underline">
                  Clear search
                </button>
              )}
            </div>
          ) : (
            <div className="divide-y divide-gray-200">
              {filteredBookings.map((booking) => (
                <div key={booking.id} className="p-5">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      {/* Name + Tag + Status Row */}
                      <div className="flex items-center space-x-2 mb-2 flex-wrap gap-y-1">
                        <h3 className="text-lg font-bold">{booking.customerName}</h3>
                        {booking.bookingTag && (
                          <span className="font-mono text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded">
                            {booking.bookingTag}
                          </span>
                        )}
                        <span className={`px-2 py-0.5 rounded-full text-sm font-medium ${getStatusStyle(booking.status)}`}>
                          {getStatusLabel(booking.status)}
                        </span>
                      </div>

                      {/* Details Grid */}
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                        <div>
                          <p className="text-sm text-gray-500">Date & Time</p>
                          <p className="text-base font-medium">{formatDate(booking.preferredDate)} @ {formatTime(booking.preferredTime)}</p>
                        </div>
                        <div>
                          <p className="text-sm text-gray-500">Email</p>
                          <p className="text-base font-medium truncate">{booking.customerEmail || '—'}</p>
                        </div>
                        {booking.service && (
                          <div>
                            <p className="text-sm text-gray-500">Service</p>
                            <p className="text-base font-medium">{booking.service}{booking.otherService ? `: ${booking.otherService}` : ''}</p>
                          </div>
                        )}
                        {booking.vinNumber && (
                          <div>
                            <p className="text-sm text-gray-500">VIN</p>
                            <p className="text-base font-medium">{booking.vinNumber}</p>
                          </div>
                        )}
                        {/* Mechanic field */}
                        <div>
                          <p className="text-sm text-gray-500">Mechanic</p>
                          {booking.mechanicPreference && booking.mechanicPreference !== 'garage-assigns' ? (
                            <p className="text-base font-medium">{getMechanicName(booking.mechanicPreference)}</p>
                          ) : (
                            <p className="text-base font-medium text-gray-400">Not assigned yet</p>
                          )}
                        </div>
                      </div>

                      {booking.description && (
                        <div className="mt-2">
                          <p className="text-sm text-gray-500">Issue Description</p>
                          <p className="text-base">{booking.description}</p>
                        </div>
                      )}

                      {/* Customer Photos */}
                      {booking.photos && booking.photos.length > 0 && (
                        <div className="mt-3">
                          <p className="text-gray-500 text-base mb-2">Customer Photos ({booking.photos.length})</p>
                          <div className="flex space-x-2 overflow-x-auto">
                            {booking.photos.map((photoUrl, idx) => (
                              <a
                                key={idx}
                                href={photoUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="flex-shrink-0 w-20 h-20 rounded-lg overflow-hidden border-2 border-gray-200 hover:border-yellow-400 transition-colors"
                              >
                                <img src={photoUrl} alt={`Issue photo ${idx + 1}`} className="w-full h-full object-cover" />
                              </a>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Service Notes (shown on completed bookings) */}
                      {(booking as any).serviceNotes && (
                        <div className="mt-3 bg-blue-50 rounded-lg p-3">
                          <p className="text-blue-700 text-xs font-semibold mb-1">Service Notes</p>
                          <p className="text-blue-800 text-base">{(booking as any).serviceNotes}</p>
                        </div>
                      )}

                      {!booking.service && !booking.vinNumber && !booking.description && (!booking.photos || booking.photos.length === 0) && (
                        <div className="mt-2">
                          <p className="text-gray-400 italic text-base">No extra details provided — follow up with customer</p>
                        </div>
                      )}
                    </div>

                    {/* Action Buttons */}
                    <div className="flex flex-col space-y-2.5 ml-4 shrink-0 relative">
                      {/* Confirmed bookings: Complete or Cancel */}
                      {(booking.status === 'confirmed' || booking.status === 'approved') && (
                        <>
                          <button
                            onClick={() => {
                              setNotesBookingId(booking.id!)
                              setServiceNotes('')
                            }}
                            disabled={actionLoading === booking.id}
                            className="px-4 py-2.5 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50 whitespace-nowrap"
                          >
                            {actionLoading === booking.id ? '...' : '✓ Completed'}
                          </button>
                          <button
                            onClick={() => handleStatusChange(booking, 'cancelled')}
                            disabled={actionLoading === booking.id}
                            className="px-4 py-2.5 bg-gray-200 text-gray-600 rounded-lg text-sm font-medium hover:bg-gray-300 disabled:opacity-50 whitespace-nowrap"
                          >
                            {actionLoading === booking.id ? '...' : 'Cancel'}
                          </button>
                          {/* Assign Mechanic Button */}
                          <button
                            onClick={() => setAssigningMechanicId(assigningMechanicId === booking.id ? null : booking.id!)}
                            className="px-4 py-2.5 bg-purple-100 text-purple-700 rounded-lg text-sm font-medium hover:bg-purple-200 whitespace-nowrap"
                          >
                            Assign Mechanic
                          </button>
                        </>
                      )}

                      {/* Pending bookings: Approve, Reschedule, Reject, or Assign */}
                      {booking.status === 'pending' && (
                        <>
                          <button
                            onClick={() => handleStatusChange(booking, 'approved')}
                            disabled={actionLoading === booking.id}
                            className="px-4 py-2.5 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700 disabled:opacity-50 whitespace-nowrap"
                          >
                            {actionLoading === booking.id ? '...' : 'Approve'}
                          </button>
                          <button
                            onClick={() => {
                              setRescheduleBookingId(booking.id!)
                              setRescheduleDate(booking.preferredDate)
                              setRescheduleTime(booking.preferredTime)
                            }}
                            disabled={actionLoading === booking.id}
                            className="px-4 py-2.5 bg-yellow-100 text-yellow-800 rounded-lg text-sm font-medium hover:bg-yellow-200 disabled:opacity-50 whitespace-nowrap"
                          >
                            Reschedule
                          </button>
                          <button
                            onClick={() => handleStatusChange(booking, 'rejected')}
                            disabled={actionLoading === booking.id}
                            className="px-4 py-2.5 bg-red-600 text-white rounded-lg text-sm font-medium hover:bg-red-700 disabled:opacity-50 whitespace-nowrap"
                          >
                            {actionLoading === booking.id ? '...' : 'Reject'}
                          </button>
                          {/* Assign Mechanic Button */}
                          <button
                            onClick={() => setAssigningMechanicId(assigningMechanicId === booking.id ? null : booking.id!)}
                            className="px-4 py-2.5 bg-purple-100 text-purple-700 rounded-lg text-sm font-medium hover:bg-purple-200 whitespace-nowrap"
                          >
                            Assign Mechanic
                          </button>
                        </>
                      )}

                      {/* Mechanic assignment dropdown */}
                      {assigningMechanicId === booking.id && (
                        <div className="absolute top-full right-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg z-40 w-48">
                          <div className="p-2">
                            <p className="text-xs text-gray-500 font-semibold px-2 py-1 uppercase tracking-wide">Select Mechanic</p>
                            {MECHANICS.map((mech) => (
                              <button
                                key={mech.id}
                                onClick={() => handleAssignMechanic(booking.id!, mech.id)}
                                className={`w-full text-left px-3 py-2 text-sm rounded-md hover:bg-purple-50 hover:text-purple-700 transition-colors ${
                                  booking.mechanicPreference === mech.id ? 'bg-purple-100 text-purple-700 font-medium' : 'text-gray-700'
                                }`}
                              >
                                {mech.name}
                                {booking.mechanicPreference === mech.id && (
                                  <span className="ml-2 text-purple-500">&#10003;</span>
                                )}
                              </button>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Click-away overlay to close mechanic dropdown */}
        {assigningMechanicId && (
          <div
            className="fixed inset-0 z-30"
            onClick={() => setAssigningMechanicId(null)}
          />
        )}
        </>}
      </div>
    </div>
  )
}
