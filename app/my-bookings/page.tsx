'use client'

import { useState, useEffect, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { onAuthStateChanged, signOut } from 'firebase/auth'
import { getUserBookings, updateBookingStatus, Booking, formatSlotTime, getMechanicName, getUserCars } from '@/lib/bookings'

function MyBookingsContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const isNewBooking = searchParams.get('new') === '1'
  const [user, setUser] = useState<any>(null)
  const [bookings, setBookings] = useState<Booking[]>([])
  const [savedCars, setSavedCars] = useState<string[]>([])
  const [loading, setLoading] = useState(true)
  const [showBanner, setShowBanner] = useState(isNewBooking)
  const [cancellingId, setCancellingId] = useState<string | null>(null)
  const [confirmCancelId, setConfirmCancelId] = useState<string | null>(null)
  const [refreshing, setRefreshing] = useState(false)
  const [activeTab, setActiveTab] = useState<'dashboard' | 'history'>('dashboard')

  const refreshBookings = async (userId: string) => {
    const userBookings = await getUserBookings(userId)
    setBookings(userBookings)
  }

  const handleRefresh = async () => {
    if (!user) return
    setRefreshing(true)
    await refreshBookings(user.uid)
    setRefreshing(false)
  }

  useEffect(() => {
    let unsubscribe: (() => void) | undefined

    const initAuth = async () => {
      try {
        const { auth } = await import('@/lib/firebase')
        unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
          if (!currentUser) {
            router.push('/')
          } else {
            setUser(currentUser)
            const [userBookings, cars] = await Promise.all([
              getUserBookings(currentUser.uid),
              getUserCars(currentUser.uid),
            ])
            setBookings(userBookings)
            setSavedCars(cars)
            setLoading(false)
          }
        })
      } catch (err) {
        console.error('Firebase auth init failed:', err)
        setLoading(false)
      }
    }

    initAuth()

    return () => {
      if (unsubscribe) unsubscribe()
    }
  }, [router])

  // Auto-dismiss the banner after 8 seconds
  useEffect(() => {
    if (showBanner) {
      const timer = setTimeout(() => setShowBanner(false), 8000)
      return () => clearTimeout(timer)
    }
  }, [showBanner])

  const handleSignOut = async () => {
    try {
      const { auth: firebaseAuth } = await import('@/lib/firebase')
      await signOut(firebaseAuth)
    } catch (err) {
      console.error('Sign out error:', err)
    }
    window.location.href = '/'
  }

  const handleCancelBooking = async (bookingId: string) => {
    setCancellingId(bookingId)
    try {
      const result = await updateBookingStatus(bookingId, 'cancelled')
      if (result.success) {
        setBookings(bookings.map(b =>
          b.id === bookingId ? { ...b, status: 'cancelled' as const } : b
        ))
      }
    } catch (err) {
      console.error('Cancel error:', err)
    }
    setCancellingId(null)
    setConfirmCancelId(null)
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending': return 'bg-yellow-100 text-yellow-800'
      case 'confirmed': return 'bg-green-100 text-green-800'
      case 'approved': return 'bg-green-100 text-green-800'
      case 'rejected': return 'bg-red-100 text-red-800'
      case 'completed': return 'bg-blue-100 text-blue-800'
      case 'cancelled': return 'bg-gray-100 text-gray-500'
      default: return 'bg-gray-100 text-gray-800'
    }
  }

  const getStatusText = (status: string) => {
    switch (status) {
      case 'pending': return 'Awaiting Review'
      case 'confirmed': return 'Confirmed'
      case 'approved': return 'Confirmed'
      case 'rejected': return 'Declined'
      case 'completed': return 'Completed'
      case 'cancelled': return 'Cancelled'
      default: return status
    }
  }

  const canCancel = (booking: Booking) => {
    return ['confirmed', 'approved', 'pending'].includes(booking.status)
  }

  const isActiveBooking = (booking: Booking) => {
    return ['pending', 'confirmed', 'approved'].includes(booking.status)
  }

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr + 'T00:00:00')
    return date.toLocaleDateString('en-KE', {
      weekday: 'short',
      day: 'numeric',
      month: 'short',
      year: 'numeric'
    })
  }

  // Derived data for dashboard
  const upcomingBookings = bookings.filter(b => isActiveBooking(b))
  const completedBookings = bookings.filter(b => b.status === 'completed')
  const lastCompletedBooking = completedBookings[0]

  // Calculate next service due (90 days from last completed)
  const getNextServiceDue = () => {
    if (!lastCompletedBooking?.completedAt) return null
    const completedDate = lastCompletedBooking.completedAt.toDate?.()
    if (!completedDate) return null
    const nextDue = new Date(completedDate)
    nextDue.setDate(nextDue.getDate() + 90)
    const now = new Date()
    const daysUntil = Math.ceil((nextDue.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
    return { date: nextDue, daysUntil, overdue: daysUntil < 0 }
  }

  const nextService = getNextServiceDue()

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-petrol-green border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-petrol-gray">Loading your dashboard...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      {/* Header */}
      <div className="bg-petrol-black text-white p-4">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <button onClick={() => router.push('/')} className="flex items-center space-x-2">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <h1 className="text-xl font-bold">
            <span className="text-petrol-green">PETROL</span>{' '}
            <span className="text-petrol-yellow">GOONS</span>
          </h1>
          <button
            onClick={handleRefresh}
            disabled={refreshing}
            className="text-white disabled:opacity-50"
            title="Refresh"
          >
            <svg className={`w-6 h-6 ${refreshing ? 'animate-spin' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
          </button>
        </div>
      </div>
      <div className="racing-stripe"></div>

      {/* Content */}
      <div className="max-w-4xl mx-auto p-4 py-5">
        {/* Success Banner for New Bookings */}
        {showBanner && (
          <div className="bg-green-50 border border-green-200 rounded-xl p-5 mb-5">
            <div className="flex items-start space-x-3">
              <div className="confirm-check flex-shrink-0">
                <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <div className="flex-1">
                <h3 className="text-lg font-bold text-green-800">Pit Stop Confirmed</h3>
                <p className="text-base text-green-700">Your slot is secured. Our team will confirm within a few hours. Pay after service.</p>
              </div>
              <button onClick={() => setShowBanner(false)} className="text-green-400 hover:text-green-600">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          </div>
        )}

        {/* Welcome section */}
        <div className="mb-5">
          <h2 className="text-xl font-bold text-petrol-black">
            Hey{user?.displayName ? `, ${user.displayName.split(' ')[0]}` : ''} 👋
          </h2>
          <p className="text-petrol-gray text-sm mt-0.5">Here&apos;s your garage dashboard</p>
        </div>

        {/* Tab switcher */}
        <div className="flex bg-white rounded-xl p-1 shadow-sm mb-5">
          <button
            onClick={() => setActiveTab('dashboard')}
            className={`flex-1 py-2.5 rounded-lg text-sm font-semibold transition-all ${
              activeTab === 'dashboard'
                ? 'bg-petrol-black text-white shadow-sm'
                : 'text-petrol-gray hover:text-petrol-black'
            }`}
          >
            Dashboard
          </button>
          <button
            onClick={() => setActiveTab('history')}
            className={`flex-1 py-2.5 rounded-lg text-sm font-semibold transition-all ${
              activeTab === 'history'
                ? 'bg-petrol-black text-white shadow-sm'
                : 'text-petrol-gray hover:text-petrol-black'
            }`}
          >
            Service History ({bookings.length})
          </button>
        </div>

        {/* ========== DASHBOARD TAB ========== */}
        {activeTab === 'dashboard' && (
          <div className="space-y-4">
            {/* Quick Stats */}
            <div className="grid grid-cols-3 gap-3">
              <div className="bg-white rounded-xl shadow-sm p-4 text-center">
                <p className="text-2xl font-bold text-green-600">{upcomingBookings.length}</p>
                <p className="text-xs text-petrol-gray mt-0.5">Upcoming</p>
              </div>
              <div className="bg-white rounded-xl shadow-sm p-4 text-center">
                <p className="text-2xl font-bold text-blue-600">{completedBookings.length}</p>
                <p className="text-xs text-petrol-gray mt-0.5">Completed</p>
              </div>
              <div className="bg-white rounded-xl shadow-sm p-4 text-center">
                <p className="text-2xl font-bold text-petrol-black">{savedCars.length}</p>
                <p className="text-xs text-petrol-gray mt-0.5">Vehicles</p>
              </div>
            </div>

            {/* Next Service Due */}
            {nextService && (
              <div className={`rounded-xl p-5 shadow-sm ${
                nextService.overdue
                  ? 'bg-red-50 border border-red-200'
                  : nextService.daysUntil <= 14
                    ? 'bg-yellow-50 border border-yellow-200'
                    : 'bg-green-50 border border-green-200'
              }`}>
                <div className="flex items-center justify-between">
                  <div>
                    <p className={`text-xs font-semibold uppercase tracking-wider ${
                      nextService.overdue ? 'text-red-500' : nextService.daysUntil <= 14 ? 'text-yellow-600' : 'text-green-600'
                    }`}>
                      {nextService.overdue ? '⚠️ Service Overdue' : '🔧 Next Service Due'}
                    </p>
                    <p className="text-petrol-black font-bold text-lg mt-1">
                      {nextService.overdue
                        ? `${Math.abs(nextService.daysUntil)} days overdue`
                        : nextService.daysUntil <= 0
                          ? 'Due today!'
                          : `In ${nextService.daysUntil} days`
                      }
                    </p>
                    <p className="text-petrol-gray text-sm">
                      {nextService.date.toLocaleDateString('en-KE', { day: 'numeric', month: 'long', year: 'numeric' })}
                    </p>
                  </div>
                  <button
                    onClick={() => router.push('/book')}
                    className="bg-petrol-green text-petrol-black font-bold px-5 py-2.5 rounded-lg text-sm hover:brightness-110 transition-all active:scale-[0.97]"
                  >
                    Book Now
                  </button>
                </div>
              </div>
            )}

            {/* Saved Vehicles */}
            {savedCars.length > 0 && (
              <div className="bg-white rounded-xl shadow-sm p-5">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="font-semibold text-petrol-black text-sm">Your Vehicles</h3>
                  <span className="text-xs text-petrol-gray">{savedCars.length} saved</span>
                </div>
                <div className="space-y-2">
                  {savedCars.map((vin, i) => {
                    const carBookings = bookings.filter(b => b.vinNumber?.toLowerCase() === vin.toLowerCase())
                    const lastService = carBookings.find(b => b.status === 'completed')
                    return (
                      <div key={i} className="flex items-center justify-between bg-gray-50 rounded-lg p-3">
                        <div className="flex items-center space-x-3">
                          <div className="w-9 h-9 bg-petrol-black rounded-lg flex items-center justify-center">
                            <svg className="w-5 h-5 text-petrol-yellow" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 17h1M15 17h1M3 11l1.5-5.5A2 2 0 016.4 4h11.2a2 2 0 011.9 1.5L21 11M3 11v6a1 1 0 001 1h1m16-7v6a1 1 0 01-1 1h-1M3 11h18" />
                            </svg>
                          </div>
                          <div>
                            <p className="text-petrol-black font-medium text-sm">{vin}</p>
                            <p className="text-petrol-gray text-xs">
                              {lastService
                                ? `Last: ${lastService.service || 'Service'} · ${formatDate(lastService.preferredDate)}`
                                : `${carBookings.length} booking${carBookings.length !== 1 ? 's' : ''}`
                              }
                            </p>
                          </div>
                        </div>
                        <button
                          onClick={() => router.push('/book')}
                          className="text-petrol-green text-xs font-semibold hover:text-green-600"
                        >
                          Rebook
                        </button>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}

            {/* Upcoming Bookings */}
            {upcomingBookings.length > 0 ? (
              <div>
                <h3 className="font-semibold text-petrol-black text-sm mb-3">Upcoming Appointments</h3>
                <div className="space-y-3">
                  {upcomingBookings.map(booking => (
                    <div key={booking.id} className="bg-white rounded-xl shadow-sm p-5">
                      {(booking as any).bookingTag && (
                        <span className="font-mono text-xs px-2 py-0.5 rounded bg-petrol-yellow/20 text-yellow-800 mb-2 inline-block">
                          {(booking as any).bookingTag}
                        </span>
                      )}
                      <div className="flex justify-between items-start">
                        <div>
                          <h4 className="font-bold text-petrol-black text-base">
                            {booking.service || 'Service Appointment'}
                          </h4>
                          {booking.otherService && (
                            <p className="text-petrol-gray text-sm">{booking.otherService}</p>
                          )}
                        </div>
                        <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold ${getStatusColor(booking.status)}`}>
                          {getStatusText(booking.status)}
                        </span>
                      </div>
                      <div className="flex items-center space-x-4 mt-3 text-sm">
                        <span className="flex items-center text-petrol-gray">
                          <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                          </svg>
                          {formatDate(booking.preferredDate)}
                        </span>
                        <span className="flex items-center text-petrol-gray">
                          <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                          {booking.preferredTime.includes(':') && booking.preferredTime.length <= 5 ? formatSlotTime(booking.preferredTime) : booking.preferredTime}
                        </span>
                      </div>
                      {(booking as any).mechanicPreference && (booking as any).mechanicPreference !== 'garage-assigns' && (
                        <p className="text-petrol-gray text-xs mt-2">
                          Mechanic: <span className="text-petrol-black font-medium">{getMechanicName((booking as any).mechanicPreference)}</span>
                        </p>
                      )}

                      {/* Cancel option */}
                      {canCancel(booking) && booking.id && (
                        <div className="mt-3 pt-3 border-t border-gray-100">
                          {confirmCancelId === booking.id ? (
                            <div className="flex items-center justify-between bg-red-50 rounded-lg p-2.5">
                              <p className="text-sm text-red-700">Cancel this?</p>
                              <div className="flex space-x-2">
                                <button
                                  onClick={() => handleCancelBooking(booking.id!)}
                                  disabled={cancellingId === booking.id}
                                  className="px-3 py-1 bg-red-600 text-white rounded-lg text-sm font-medium hover:bg-red-700 disabled:opacity-50"
                                >
                                  {cancellingId === booking.id ? '...' : 'Yes'}
                                </button>
                                <button
                                  onClick={() => setConfirmCancelId(null)}
                                  className="px-3 py-1 bg-white text-gray-600 rounded-lg text-sm font-medium border border-gray-200"
                                >
                                  No
                                </button>
                              </div>
                            </div>
                          ) : (
                            <button
                              onClick={() => setConfirmCancelId(booking.id!)}
                              className="text-sm text-gray-400 hover:text-red-500 transition-colors"
                            >
                              Cancel appointment
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="bg-white rounded-xl shadow-sm p-6 text-center">
                <div className="w-14 h-14 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-3">
                  <svg className="w-7 h-7 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                </div>
                <p className="text-petrol-gray text-sm mb-3">No upcoming appointments</p>
                <button
                  onClick={() => router.push('/book')}
                  className="bg-petrol-green text-petrol-black font-bold py-3 px-6 rounded-lg text-sm hover:brightness-110 transition-all"
                >
                  Book a Service
                </button>
              </div>
            )}

            {/* Quick re-book section */}
            {completedBookings.length > 0 && (
              <div className="bg-white rounded-xl shadow-sm p-5">
                <h3 className="font-semibold text-petrol-black text-sm mb-3">Quick Re-book</h3>
                <p className="text-petrol-gray text-xs mb-3">Book the same service again with one tap</p>
                <div className="space-y-2">
                  {completedBookings.slice(0, 3).map(booking => (
                    <button
                      key={booking.id}
                      onClick={() => router.push('/book')}
                      className="w-full flex items-center justify-between bg-gray-50 rounded-lg p-3 hover:bg-gray-100 transition-all active:scale-[0.99]"
                    >
                      <div className="text-left">
                        <p className="text-petrol-black font-medium text-sm">{booking.service || 'Service'}</p>
                        <p className="text-petrol-gray text-xs">{formatDate(booking.preferredDate)}</p>
                      </div>
                      <div className="flex items-center space-x-2">
                        <span className="text-petrol-green text-xs font-semibold">Rebook</span>
                        <svg className="w-4 h-4 text-petrol-green" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                        </svg>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ========== HISTORY TAB ========== */}
        {activeTab === 'history' && (
          <div>
            {bookings.length === 0 ? (
              <div className="bg-white rounded-xl shadow-sm p-8 text-center">
                <svg className="w-16 h-16 mx-auto text-gray-300 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
                <h2 className="text-xl font-bold text-petrol-black mb-2">No bookings yet</h2>
                <p className="text-petrol-gray mb-6">Book your first service appointment!</p>
                <button
                  onClick={() => router.push('/book')}
                  className="bg-petrol-green text-petrol-black font-bold py-3 px-6 rounded-lg hover:brightness-110 transition-all"
                >
                  Book a Service
                </button>
              </div>
            ) : (
              <div className="space-y-4">
                {bookings.map((booking) => (
                  <div key={booking.id} className={`bg-white rounded-xl shadow-sm p-5 ${booking.status === 'cancelled' ? 'opacity-60' : ''}`}>
                    {/* Booking Tag */}
                    {(booking as any).bookingTag && (
                      <div className="mb-2">
                        <span className={`font-mono text-xs px-2 py-0.5 rounded ${
                          isActiveBooking(booking)
                            ? 'bg-petrol-yellow/20 text-yellow-800'
                            : 'bg-gray-100 text-gray-600'
                        }`}>
                          {(booking as any).bookingTag}
                        </span>
                      </div>
                    )}

                    <div className="flex justify-between items-start mb-3">
                      <div>
                        <h3 className="font-bold text-petrol-black text-lg">
                          {booking.service || 'Service Appointment'}
                        </h3>
                        {booking.otherService && (
                          <p className="text-petrol-gray text-sm">{booking.otherService}</p>
                        )}
                      </div>
                      <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold ${getStatusColor(booking.status)}`}>
                        {getStatusText(booking.status)}
                      </span>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <p className="text-xs text-petrol-gray">Date</p>
                        <p className="text-sm font-medium text-petrol-black">{formatDate(booking.preferredDate)}</p>
                      </div>
                      <div>
                        <p className="text-xs text-petrol-gray">Time</p>
                        <p className="text-sm font-medium text-petrol-black">{booking.preferredTime.includes(':') && booking.preferredTime.length <= 5 ? formatSlotTime(booking.preferredTime) : booking.preferredTime}</p>
                      </div>
                      {booking.vinNumber && (
                        <div>
                          <p className="text-xs text-petrol-gray">Vehicle</p>
                          <p className="text-sm font-medium text-petrol-black">{booking.vinNumber}</p>
                        </div>
                      )}
                      <div>
                        <p className="text-xs text-petrol-gray">Submitted</p>
                        <p className="text-sm font-medium text-petrol-black">
                          {booking.submittedAt?.toDate?.()
                            ? booking.submittedAt.toDate().toLocaleDateString('en-KE')
                            : 'Just now'}
                        </p>
                      </div>
                      {(booking as any).mechanicPreference && (
                        <div>
                          <p className="text-xs text-petrol-gray">Mechanic</p>
                          <p className="text-sm font-medium text-petrol-black flex items-center">
                            {(booking as any).mechanicPreference === 'garage-assigns' ? (
                              <span className="text-gray-400">Garage assigned</span>
                            ) : (
                              <>
                                <svg className="w-3.5 h-3.5 mr-1 text-petrol-green flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                                </svg>
                                {getMechanicName((booking as any).mechanicPreference)}
                              </>
                            )}
                          </p>
                        </div>
                      )}
                    </div>

                    {booking.description && (
                      <div className="mt-3 pt-3 border-t border-gray-100">
                        <p className="text-xs text-petrol-gray">Description</p>
                        <p className="text-sm text-petrol-black mt-0.5">{booking.description}</p>
                      </div>
                    )}

                    {/* Service Notes */}
                    {(booking as any).serviceNotes && (
                      <div className="mt-3 pt-3 border-t border-gray-100">
                        <p className="text-xs text-petrol-gray">What was done</p>
                        <p className="text-sm text-petrol-black mt-0.5 bg-blue-50 rounded-lg p-2.5">{(booking as any).serviceNotes}</p>
                      </div>
                    )}

                    {/* Photos */}
                    {booking.photos && booking.photos.length > 0 && (
                      <div className="mt-3 pt-3 border-t border-gray-100">
                        <p className="text-xs text-petrol-gray mb-1.5">Photos ({booking.photos.length})</p>
                        <div className="flex space-x-2 overflow-x-auto">
                          {booking.photos.map((photoUrl, idx) => (
                            <a
                              key={idx}
                              href={photoUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="flex-shrink-0 w-16 h-16 rounded-lg overflow-hidden border-2 border-gray-200"
                            >
                              <img src={photoUrl} alt={`Photo ${idx + 1}`} className="w-full h-full object-cover" />
                            </a>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Cancel */}
                    {canCancel(booking) && booking.id && (
                      <div className="mt-3 pt-3 border-t border-gray-100">
                        {confirmCancelId === booking.id ? (
                          <div className="flex items-center justify-between bg-red-50 rounded-lg p-2.5">
                            <p className="text-sm text-red-700">Cancel this?</p>
                            <div className="flex space-x-2">
                              <button
                                onClick={() => handleCancelBooking(booking.id!)}
                                disabled={cancellingId === booking.id}
                                className="px-3 py-1 bg-red-600 text-white rounded-lg text-sm font-medium hover:bg-red-700 disabled:opacity-50"
                              >
                                {cancellingId === booking.id ? '...' : 'Yes'}
                              </button>
                              <button
                                onClick={() => setConfirmCancelId(null)}
                                className="px-3 py-1 bg-white text-gray-600 rounded-lg text-sm font-medium border border-gray-200"
                              >
                                No
                              </button>
                            </div>
                          </div>
                        ) : (
                          <button
                            onClick={() => setConfirmCancelId(booking.id!)}
                            className="text-sm text-gray-400 hover:text-red-500 transition-colors"
                          >
                            Cancel appointment
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                ))}

                <div className="pt-2 pb-4">
                  <button
                    onClick={() => router.push('/book')}
                    className="w-full bg-petrol-green text-petrol-black text-base font-bold py-4 rounded-lg hover:brightness-110 transition-all"
                  >
                    Book Another Service
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Bottom Navigation */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 safe-area-bottom z-40">
        <div className="max-w-4xl mx-auto flex">
          <button
            onClick={() => router.push('/')}
            className="flex-1 flex flex-col items-center py-3 text-gray-400"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
            </svg>
            <span className="text-xs font-medium mt-0.5">Home</span>
          </button>
          <button
            onClick={() => router.push('/book')}
            className="flex-1 flex flex-col items-center py-3 text-gray-400"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
            </svg>
            <span className="text-xs font-medium mt-0.5">Book</span>
          </button>
          <button
            className="flex-1 flex flex-col items-center py-3 text-petrol-green"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zm10 0a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zm10 0a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
            </svg>
            <span className="text-xs font-semibold mt-0.5">Dashboard</span>
          </button>
          <button
            onClick={handleSignOut}
            className="flex-1 flex flex-col items-center py-3 text-gray-400"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
            </svg>
            <span className="text-xs font-medium mt-0.5">Sign Out</span>
          </button>
        </div>
      </div>
    </div>
  )
}

export default function MyBookingsPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-petrol-green border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-petrol-gray">Loading your dashboard...</p>
        </div>
      </div>
    }>
      <MyBookingsContent />
    </Suspense>
  )
}
