'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { onAuthStateChanged } from 'firebase/auth'
import { auth } from '@/lib/firebase'
import { getAllBookings, updateBookingStatus, Booking } from '@/lib/bookings'
import { sendBookingEmail, getBookingConfirmationEmailHtml, getBookingRejectionEmailHtml } from '@/lib/email'

export default function DashboardPage() {
  const router = useRouter()
  const [user, setUser] = useState<any>(null)
  const [bookings, setBookings] = useState<Booking[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Check authentication
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      if (!currentUser) {
        router.push('/')
      } else {
        setUser(currentUser)
      }
    })
    return () => unsubscribe()
  }, [router])

  // Load bookings
  useEffect(() => {
    async function loadBookings() {
      setLoading(true)
      const data = await getAllBookings()
      setBookings(data)
      setLoading(false)
    }

    if (user) {
      loadBookings()
    }
  }, [user])

  const handleApprove = async (booking: Booking) => {
    if (!booking.id) return

    try {
      const result = await updateBookingStatus(booking.id, 'approved', user?.uid)

      if (result.success) {
        // Send email notification
        const emailHtml = getBookingConfirmationEmailHtml(booking)
        await sendBookingEmail(
          booking.customerEmail,
          'Booking Confirmed - Petrol Goons Garage',
          emailHtml
        )

        // Update local state
        setBookings(bookings.map(b =>
          b.id === booking.id ? { ...b, status: 'approved' } : b
        ))

        alert('Booking approved! Confirmation email sent to customer.')
      } else {
        setError(result.error || 'Failed to approve booking')
      }
    } catch (err: any) {
      setError(err.message || 'An error occurred')
    }
  }

  const handleReject = async (booking: Booking) => {
    if (!booking.id) return

    try {
      const result = await updateBookingStatus(booking.id, 'rejected', user?.uid)

      if (result.success) {
        // Send email notification
        const emailHtml = getBookingRejectionEmailHtml(booking)
        await sendBookingEmail(
          booking.customerEmail,
          'Booking Update - Petrol Goons Garage',
          emailHtml
        )

        // Update local state
        setBookings(bookings.map(b =>
          b.id === booking.id ? { ...b, status: 'rejected' } : b
        ))

        alert('Booking rejected. Customer has been notified.')
      } else {
        setError(result.error || 'Failed to reject booking')
      }
    } catch (err: any) {
      setError(err.message || 'An error occurred')
    }
  }

  const getStatusColor = (status: string) => {
    switch(status) {
      case 'pending': return 'bg-yellow-100 text-yellow-800'
      case 'approved': return 'bg-green-100 text-green-800'
      case 'rejected': return 'bg-red-100 text-red-800'
      default: return 'bg-gray-100 text-gray-800'
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-petrol-yellow border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-petrol-gray">Loading bookings...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-petrol-black text-white p-4 shadow-lg">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <h1 className="text-xl font-bold">
            <span className="text-petrol-yellow">PETROL GOONS</span> GARAGE
          </h1>
          <div className="flex items-center space-x-4">
            <button
              onClick={() => router.push('/book')}
              className="px-4 py-2 bg-petrol-yellow text-petrol-black rounded-lg font-medium hover:bg-yellow-500 transition-colors"
            >
              New Booking
            </button>
            <button className="flex items-center space-x-2">
              <div className="w-8 h-8 bg-petrol-yellow rounded-full flex items-center justify-center">
                <span className="text-petrol-black font-bold">A</span>
              </div>
            </button>
          </div>
        </div>
      </div>

      {/* Dashboard Content */}
      <div className="max-w-7xl mx-auto p-4 py-8">
        {/* Error Message */}
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-800 px-4 py-3 rounded-lg mb-6">
            <p className="text-sm">{error}</p>
          </div>
        )}

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-petrol-gray text-sm">Pending Bookings</p>
                <p className="text-3xl font-bold text-petrol-black mt-1">
                  {bookings.filter(b => b.status === 'pending').length}
                </p>
              </div>
              <div className="w-12 h-12 bg-yellow-100 rounded-full flex items-center justify-center">
                <svg className="w-6 h-6 text-petrol-yellow" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-petrol-gray text-sm">Approved Today</p>
                <p className="text-3xl font-bold text-petrol-black mt-1">
                  {bookings.filter(b => b.status === 'approved').length}
                </p>
              </div>
              <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center">
                <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-petrol-gray text-sm">Total Bookings</p>
                <p className="text-3xl font-bold text-petrol-black mt-1">{bookings.length}</p>
              </div>
              <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center">
                <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                </svg>
              </div>
            </div>
          </div>
        </div>

        {/* Bookings List */}
        <div className="bg-white rounded-lg shadow">
          <div className="p-6 border-b border-gray-200">
            <h2 className="text-xl font-bold text-petrol-black">Booking Requests</h2>
          </div>

          <div className="divide-y divide-gray-200">
            {bookings.length === 0 ? (
              <div className="p-8 text-center text-petrol-gray">
                <p>No bookings yet</p>
              </div>
            ) : (
              bookings.map((booking) => (
                <div key={booking.id} className="p-6 hover:bg-gray-50 transition-colors">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center space-x-3 mb-2">
                        <h3 className="text-lg font-semibold text-petrol-black">{booking.customerName}</h3>
                        <span className={`px-3 py-1 rounded-full text-xs font-medium ${getStatusColor(booking.status)}`}>
                          {booking.status.toUpperCase()}
                        </span>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
                        <div>
                          <p className="text-sm text-petrol-gray">Email</p>
                          <p className="text-sm font-medium text-petrol-black">{booking.customerEmail}</p>
                        </div>
                        <div>
                          <p className="text-sm text-petrol-gray">VIN Number</p>
                          <p className="text-sm font-medium text-petrol-black">{booking.vinNumber}</p>
                        </div>
                        <div>
                          <p className="text-sm text-petrol-gray">Service</p>
                          <p className="text-sm font-medium text-petrol-black">{booking.service}</p>
                        </div>
                        <div>
                          <p className="text-sm text-petrol-gray">Preferred Date & Time</p>
                          <p className="text-sm font-medium text-petrol-black">
                            {booking.preferredDate} at {booking.preferredTime}
                          </p>
                        </div>
                      </div>

                      {booking.description && (
                        <div className="mt-4">
                          <p className="text-sm text-petrol-gray">Description</p>
                          <p className="text-sm text-petrol-black mt-1">{booking.description}</p>
                        </div>
                      )}
                    </div>

                    {booking.status === 'pending' && (
                      <div className="flex flex-col space-y-2 ml-4">
                        <button
                          onClick={() => handleApprove(booking)}
                          className="px-4 py-2 bg-green-600 text-white rounded-lg font-medium hover:bg-green-700 transition-colors"
                        >
                          Approve
                        </button>
                        <button
                          onClick={() => handleReject(booking)}
                          className="px-4 py-2 bg-red-600 text-white rounded-lg font-medium hover:bg-red-700 transition-colors"
                        >
                          Reject
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
