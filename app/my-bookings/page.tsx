'use client'

import { useState, useEffect, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { onAuthStateChanged, signOut } from 'firebase/auth'
import { getUserBookings, updateBookingStatus, Booking, formatSlotTime, getMechanicName } from '@/lib/bookings'

function MyBookingsContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const isNewBooking = searchParams.get('new') === '1'
  const [user, setUser] = useState<any>(null)
  const [bookings, setBookings] = useState<Booking[]>([])
  const [loading, setLoading] = useState(true)
  const [showBanner, setShowBanner] = useState(isNewBooking)
  const [cancellingId, setCancellingId] = useState<string | null>(null)
  const [confirmCancelId, setConfirmCancelId] = useState<string | null>(null)
  const [refreshing, setRefreshing] = useState(false)

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
            const userBookings = await getUserBookings(currentUser.uid)
            setBookings(userBookings)
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

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-petrol-green border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-petrol-gray">Loading your bookings...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-petrol-black text-white p-4">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <button
            onClick={() => router.push('/book')}
            className="flex items-center space-x-2"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <h1 className="text-2xl font-bold">
            <span className="text-petrol-green">MY</span> BOOKINGS
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
      <div className="max-w-4xl mx-auto p-4 py-6">
        {/* Success Message for New Bookings */}
        {showBanner && (
          <div className="bg-green-50 border border-green-200 rounded-xl p-5 mb-6">
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

        {/* Quick Stats */}
        {bookings.length > 0 && (
          <div className="grid grid-cols-3 gap-3 mb-6">
            <div className="bg-white rounded-lg shadow p-4 text-center">
              <p className="text-3xl font-bold text-green-600">
                {bookings.filter(b => ['confirmed', 'approved', 'pending'].includes(b.status)).length}
              </p>
              <p className="text-sm text-petrol-gray mt-0.5">Upcoming</p>
            </div>
            <div className="bg-white rounded-lg shadow p-4 text-center">
              <p className="text-3xl font-bold text-blue-600">
                {bookings.filter(b => b.status === 'completed').length}
              </p>
              <p className="text-sm text-petrol-gray mt-0.5">Completed</p>
            </div>
            <div className="bg-white rounded-lg shadow p-4 text-center">
              <p className="text-3xl font-bold text-petrol-black">
                {bookings.length}
              </p>
              <p className="text-sm text-petrol-gray mt-0.5">Total</p>
            </div>
          </div>
        )}

        {bookings.length === 0 ? (
          <div className="bg-white rounded-lg shadow-lg p-8 text-center">
            <svg className="w-16 h-16 mx-auto text-gray-300 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
            <h2 className="text-2xl font-bold text-petrol-black mb-2">No bookings yet</h2>
            <p className="text-lg text-petrol-gray mb-6">Book your first service appointment!</p>
            <button
              onClick={() => router.push('/book')}
              className="bg-petrol-green text-petrol-black font-bold py-3 px-6 rounded-lg hover:brightness-110 transition-all"
            >
              Book a Service
            </button>
          </div>
        ) : (
          <div className="space-y-5">
            <h2 className="text-xl font-semibold text-petrol-black mb-4">Your Service History</h2>

            {bookings.map((booking) => (
              <div key={booking.id} className={`bg-white rounded-lg shadow-lg p-7 ${booking.status === 'cancelled' ? 'opacity-60' : ''}`}>
                {/* Booking Tag */}
                {(booking as any).bookingTag && (
                  <div className="mb-3">
                    <span className={`font-mono text-sm px-3 py-1 rounded-lg ${
                      isActiveBooking(booking)
                        ? 'bg-petrol-yellow/20 text-yellow-800'
                        : 'bg-gray-100 text-gray-600'
                    }`}>
                      {(booking as any).bookingTag}
                    </span>
                  </div>
                )}

                <div className="flex justify-between items-start mb-4">
                  <div>
                    <h3 className="font-bold text-petrol-black text-xl">
                      {booking.service || 'Service Appointment'}
                    </h3>
                    {booking.otherService && (
                      <p className="text-petrol-gray text-base">{booking.otherService}</p>
                    )}
                  </div>
                  <span className={`px-3 py-1 rounded-full text-sm font-semibold ${getStatusColor(booking.status)}`}>
                    {getStatusText(booking.status)}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-5">
                  <div>
                    <p className="text-sm text-petrol-gray">Date</p>
                    <p className="text-base font-medium text-petrol-black">{formatDate(booking.preferredDate)}</p>
                  </div>
                  <div>
                    <p className="text-sm text-petrol-gray">Time</p>
                    <p className="text-base font-medium text-petrol-black">{booking.preferredTime.includes(':') && booking.preferredTime.length <= 5 ? formatSlotTime(booking.preferredTime) : booking.preferredTime}</p>
                  </div>
                  {booking.vinNumber && (
                    <div>
                      <p className="text-sm text-petrol-gray">Vehicle</p>
                      <p className="text-base font-medium text-petrol-black">{booking.vinNumber}</p>
                    </div>
                  )}
                  <div>
                    <p className="text-sm text-petrol-gray">Submitted</p>
                    <p className="text-base font-medium text-petrol-black">
                      {booking.submittedAt?.toDate?.()
                        ? booking.submittedAt.toDate().toLocaleDateString('en-KE')
                        : 'Just now'}
                    </p>
                  </div>
                  {/* Mechanic Assignment */}
                  {(booking as any).mechanicPreference && (
                    <div>
                      <p className="text-sm text-petrol-gray">Mechanic</p>
                      <p className="text-base font-medium text-petrol-black flex items-center">
                        {(booking as any).mechanicPreference === 'garage-assigns' ? (
                          <span className="text-gray-400">Garage will assign</span>
                        ) : (
                          <>
                            <svg className="w-4 h-4 mr-1.5 text-petrol-green flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
                  <div className="mt-4 pt-4 border-t border-gray-100">
                    <p className="text-base text-petrol-gray">Description</p>
                    <p className="text-base text-petrol-black mt-1">{booking.description}</p>
                  </div>
                )}

                {/* Service Notes (what the mechanic did) */}
                {(booking as any).serviceNotes && (
                  <div className="mt-4 pt-4 border-t border-gray-100">
                    <p className="text-base text-petrol-gray">What was done</p>
                    <p className="text-base text-petrol-black mt-1 bg-blue-50 rounded-lg p-3">{(booking as any).serviceNotes}</p>
                  </div>
                )}

                {/* Photos */}
                {booking.photos && booking.photos.length > 0 && (
                  <div className="mt-4 pt-4 border-t border-gray-100">
                    <p className="text-base text-petrol-gray mb-2">Photos ({booking.photos.length})</p>
                    <div className="flex space-x-2 overflow-x-auto">
                      {booking.photos.map((photoUrl, idx) => (
                        <a
                          key={idx}
                          href={photoUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex-shrink-0 w-20 h-20 rounded-lg overflow-hidden border-2 border-gray-200"
                        >
                          <img src={photoUrl} alt={`Photo ${idx + 1}`} className="w-full h-full object-cover" />
                        </a>
                      ))}
                    </div>
                  </div>
                )}

                {/* Cancel button */}
                {canCancel(booking) && booking.id && (
                  <div className="mt-4 pt-4 border-t border-gray-100">
                    {confirmCancelId === booking.id ? (
                      <div className="flex items-center justify-between bg-red-50 rounded-lg p-3">
                        <p className="text-base text-red-700">Cancel this appointment?</p>
                        <div className="flex space-x-2">
                          <button
                            onClick={() => handleCancelBooking(booking.id!)}
                            disabled={cancellingId === booking.id}
                            className="px-3 py-1.5 bg-red-600 text-white rounded-lg text-base font-medium hover:bg-red-700 disabled:opacity-50"
                          >
                            {cancellingId === booking.id ? 'Cancelling...' : 'Yes, cancel'}
                          </button>
                          <button
                            onClick={() => setConfirmCancelId(null)}
                            className="px-3 py-1.5 bg-white text-gray-600 rounded-lg text-base font-medium hover:bg-gray-100 border border-gray-200"
                          >
                            Keep it
                          </button>
                        </div>
                      </div>
                    ) : (
                      <button
                        onClick={() => setConfirmCancelId(booking.id!)}
                        className="text-base text-gray-400 hover:text-red-500 transition-colors"
                      >
                        Cancel appointment
                      </button>
                    )}
                  </div>
                )}
              </div>
            ))}

            <div className="pt-4 pb-20">
              <button
                onClick={() => router.push('/book')}
                className="w-full bg-petrol-green text-petrol-black text-lg font-bold py-5 rounded-lg hover:brightness-110 transition-all"
              >
                Book Another Service
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Bottom Navigation */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 safe-area-bottom z-40">
        <div className="max-w-4xl mx-auto flex">
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
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
            </svg>
            <span className="text-xs font-semibold mt-0.5">My Bookings</span>
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
          <p className="text-petrol-gray">Loading your bookings...</p>
        </div>
      </div>
    }>
      <MyBookingsContent />
    </Suspense>
  )
}
