'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import {
  onAuthStateChanged,
  signOut,
  signInWithPopup,
  signInWithRedirect,
  getRedirectResult,
  GoogleAuthProvider,
  FacebookAuthProvider,
  OAuthProvider,
  RecaptchaVerifier,
  signInWithPhoneNumber,
  ConfirmationResult,
  User,
} from 'firebase/auth'
import { getApprovedGarages, getGarageById, getGarageMechanics } from '@/lib/garages'
import { createJob, generateTimeSlots, formatSlotTime, getBookedSlots, isSunday } from '@/lib/jobs'
import { getOrCreateGarageCustomer } from '@/lib/garages'
import { sendBookingEmail, getBookingReceivedEmailHtml, getNewBookingAdminEmailHtml } from '@/lib/email'
import { Garage, StaffMember } from '@/lib/types'

const SERVICES = [
  'Oil change',
  'Air filter exchange',
  'Tyres',
  'Brake pads',
  'Suspension changes/fixes',
  'Computer diagnostics',
  'Body kits',
  'Detailing services',
  'Other'
]

const ALL_SLOTS = generateTimeSlots()

type BookingStep = 'select-garage' | 'booking-form'

function BookingPageContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const garageParam = searchParams.get('garage')
  const [user, setUser] = useState<User | null>(null)
  const [showLoginModal, setShowLoginModal] = useState(false)

  // Garage selection
  const [step, setStep] = useState<BookingStep>('select-garage')
  const [garages, setGarages] = useState<Garage[]>([])
  const [loadingGarages, setLoadingGarages] = useState(true)
  const [selectedGarage, setSelectedGarage] = useState<Garage | null>(null)
  const [garageMechanics, setGarageMechanics] = useState<StaffMember[]>([])
  const [garageSearchQuery, setGarageSearchQuery] = useState('')

  // Form state
  const [showMoreDetails, setShowMoreDetails] = useState(false)
  const [formData, setFormData] = useState({
    vinNumber: '',
    service: '',
    otherService: '',
    description: '',
    preferredDate: '',
    preferredTime: '',
    contactEmail: '',
  })
  const [mechanicPreference, setMechanicPreference] = useState<string>('garage-assigns')
  const [photos, setPhotos] = useState<File[]>([])
  const [photoPreviews, setPhotoPreviews] = useState<string[]>([])
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Slot availability
  const [bookedSlots, setBookedSlots] = useState<string[]>([])
  const [loadingSlots, setLoadingSlots] = useState(false)
  const [selectedDateIsSunday, setSelectedDateIsSunday] = useState(false)

  // Auth
  useEffect(() => {
    let unsubscribe: (() => void) | undefined
    const initAuth = async () => {
      try {
        const { auth } = await import('@/lib/firebase')
        unsubscribe = onAuthStateChanged(auth, (currentUser) => {
          setUser(currentUser || null)
        })
      } catch (err) {
        console.error('Auth init error:', err)
        setUser(null)
      }
    }
    initAuth()
    return () => { if (unsubscribe) unsubscribe() }
  }, [])

  // Load garages
  useEffect(() => {
    const loadGarages = async () => {
      setLoadingGarages(true)
      try {
        // If a garage ID is in the URL, go straight to it
        if (garageParam) {
          const g = await getGarageById(garageParam)
          if (g && (g.status === 'approved' || g.status === 'active')) {
            setSelectedGarage(g)
            setStep('booking-form')
            // Load mechanics for this garage
            const mechs = await getGarageMechanics(garageParam)
            setGarageMechanics(mechs)
            setLoadingGarages(false)
            return
          }
        }

        // Otherwise load all approved garages
        const approved = await getApprovedGarages()
        setGarages(approved)

        // If only 1 garage, auto-select it
        if (approved.length === 1) {
          setSelectedGarage(approved[0])
          setStep('booking-form')
          const mechs = await getGarageMechanics(approved[0].id!)
          setGarageMechanics(mechs)
        }
      } catch (err) {
        console.error('Error loading garages:', err)
      }
      setLoadingGarages(false)
    }
    loadGarages()
  }, [garageParam])

  // Select a garage
  const handleSelectGarage = async (garage: Garage) => {
    setSelectedGarage(garage)
    setStep('booking-form')
    setError(null)
    // Load mechanics
    try {
      const mechs = await getGarageMechanics(garage.id!)
      setGarageMechanics(mechs)
    } catch {}
  }

  // When date changes, fetch booked slots for that date + garage
  const handleDateChange = useCallback(async (dateStr: string) => {
    setFormData(prev => ({ ...prev, preferredDate: dateStr, preferredTime: '' }))
    setError(null)
    if (!dateStr || !selectedGarage?.id) {
      setBookedSlots([])
      setSelectedDateIsSunday(false)
      return
    }
    if (isSunday(dateStr)) {
      setSelectedDateIsSunday(true)
      setBookedSlots([])
      return
    }
    setSelectedDateIsSunday(false)
    setLoadingSlots(true)
    try {
      const slots = await getBookedSlots(selectedGarage.id, dateStr)
      setBookedSlots(slots)
    } catch (err) {
      console.error('Error fetching slots:', err)
      setBookedSlots([])
    }
    setLoadingSlots(false)
  }, [selectedGarage])

  const isSlotPast = (slot: string): boolean => {
    const today = new Date().toISOString().split('T')[0]
    if (formData.preferredDate !== today) return false
    const now = new Date()
    const [hours, minutes] = slot.split(':').map(Number)
    const slotTime = new Date()
    slotTime.setHours(hours, minutes, 0, 0)
    return slotTime <= now
  }

  const handlePhotoAdd = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (!files) return
    const newFiles = Array.from(files)
    const maxFiles = 5
    const maxSize = 5 * 1024 * 1024
    const validFiles = newFiles.filter(file => file.type.startsWith('image/') && file.size <= maxSize)
    if (photos.length + validFiles.length > maxFiles) {
      setError(`You can upload up to ${maxFiles} photos`)
      return
    }
    setPhotos(prev => [...prev, ...validFiles])
    validFiles.forEach(file => {
      const reader = new FileReader()
      reader.onload = (ev) => {
        setPhotoPreviews(prev => [...prev, ev.target?.result as string])
      }
      reader.readAsDataURL(file)
    })
    e.target.value = ''
  }

  const handlePhotoRemove = (index: number) => {
    setPhotos(prev => prev.filter((_, i) => i !== index))
    setPhotoPreviews(prev => prev.filter((_, i) => i !== index))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!formData.preferredDate || !formData.preferredTime) {
      setError('Please pick a date and time slot for your visit')
      return
    }
    if (!user) {
      setShowLoginModal(true)
      return
    }
    if (!selectedGarage?.id) {
      setError('Please select a garage first')
      return
    }

    setIsSubmitting(true)
    setError(null)

    try {
      const customerEmail = user.email || formData.contactEmail.trim() || ''
      const customerName = user.displayName || user.phoneNumber || user.email || 'Customer'
      const customerPhone = user.phoneNumber || ''

      // Create/update customer record in this garage
      await getOrCreateGarageCustomer(selectedGarage.id, {
        userId: user.uid,
        name: customerName,
        email: customerEmail,
        phone: customerPhone,
      })

      // Build services array
      const services: string[] = []
      if (formData.service) services.push(formData.service)
      if (formData.service === 'Other' && formData.otherService.trim()) {
        services.push(formData.otherService.trim())
      }
      if (services.length === 0) services.push('General inspection')

      // Find mechanic name if specific one selected
      let assignedMechanicId = ''
      let assignedMechanicName = ''
      if (mechanicPreference !== 'garage-assigns') {
        const mech = garageMechanics.find(m => m.id === mechanicPreference)
        if (mech) {
          assignedMechanicId = mech.userId || mech.id || ''
          assignedMechanicName = mech.name
        }
      }

      const result = await createJob(selectedGarage.id, {
        customerId: user.uid,
        customerName,
        customerEmail,
        customerPhone,
        vinNumber: formData.vinNumber.trim() || undefined,
        services,
        otherService: formData.otherService.trim() || undefined,
        description: formData.description.trim() || undefined,
        preferredDate: formData.preferredDate,
        preferredTime: formData.preferredTime,
        assignedMechanicId: assignedMechanicId || undefined,
        assignedMechanicName: assignedMechanicName || undefined,
        createdBy: user.uid,
        photos: photos.length > 0 ? photos : undefined,
      })

      if (result.success) {
        // Send confirmation email (don't block redirect)
        try {
          if (customerEmail) {
            const emailHtml = getBookingReceivedEmailHtml({
              customerName,
              customerEmail,
              preferredDate: formData.preferredDate,
              preferredTime: formData.preferredTime,
              service: formData.service,
              bookingTag: result.bookingTag || '',
              photos: [],
              status: 'pending',
            } as any)
            await sendBookingEmail(
              customerEmail,
              `Booking Request Received — ${selectedGarage.name || 'Petrol Goons Garage'}`,
              emailHtml
            )
          }
          // Notify garage owner
          if (selectedGarage.ownerEmail) {
            const adminEmailHtml = getNewBookingAdminEmailHtml({
              customerName,
              customerEmail,
              preferredDate: formData.preferredDate,
              preferredTime: formData.preferredTime,
              service: formData.service,
              bookingTag: result.bookingTag || '',
              photos: [],
              status: 'pending',
            } as any)
            sendBookingEmail(
              selectedGarage.ownerEmail,
              `New Booking: ${customerName} — ${formData.preferredDate}`,
              adminEmailHtml
            ).catch(() => {})
          }
        } catch (emailErr) {
          console.error('Email sending failed (booking still saved):', emailErr)
        }

        router.push(`/my-bookings?new=1&tag=${result.bookingTag}`)
      } else {
        setError(result.error || 'Something went wrong. Please try again.')
        if (formData.preferredDate && selectedGarage.id) {
          const slots = await getBookedSlots(selectedGarage.id, formData.preferredDate)
          setBookedSlots(slots)
          setFormData(prev => ({ ...prev, preferredTime: '' }))
        }
      }
    } catch (err: any) {
      console.error('Booking error:', err)
      setError('Something went wrong. Please try again.')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleSignOut = async () => {
    try {
      const { auth } = await import('@/lib/firebase')
      await signOut(auth)
    } catch (err) {
      console.error('Sign out error:', err)
    }
    window.location.href = '/'
  }

  const today = new Date().toISOString().split('T')[0]
  const availableCount = formData.preferredDate && !selectedDateIsSunday
    ? ALL_SLOTS.filter(s => !bookedSlots.includes(s) && !isSlotPast(s)).length
    : 0

  // Filter garages by search
  const filteredGarages = garages.filter(g => {
    if (!garageSearchQuery.trim()) return true
    const q = garageSearchQuery.toLowerCase()
    return (
      (g.name || '').toLowerCase().includes(q) ||
      (g.location || '').toLowerCase().includes(q) ||
      (g.servicesOffered || []).some(s => s.toLowerCase().includes(q))
    )
  })

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-petrol-black text-white p-4">
        <div className="max-w-2xl mx-auto flex items-center justify-between">
          <button
            onClick={() => router.push('/')}
            className="flex items-center space-x-2 hover:opacity-80"
          >
            <span className="brand-text text-lg">
              <span className="text-petrol-green">PETROL</span>
              <span className="inline-block bg-petrol-yellow text-petrol-black px-1.5 py-0 ml-0.5 -skew-x-6 text-base">GOONS</span>
            </span>
          </button>
          <div className="flex items-center space-x-3">
            {user && (
              <>
                <button
                  onClick={() => router.push('/my-bookings')}
                  className="text-petrol-yellow text-sm font-medium hover:underline"
                >
                  My Bookings
                </button>
                <button
                  onClick={handleSignOut}
                  className="bg-petrol-yellow text-black px-4 py-2 rounded-lg font-medium text-sm"
                >
                  Sign Out
                </button>
              </>
            )}
          </div>
        </div>
      </div>
      <div className="racing-stripe"></div>

      {/* Welcome */}
      <div className="bg-petrol-black text-white px-4 pb-8">
        <div className="max-w-2xl mx-auto">
          {user ? (
            <>
              <p className="text-gray-400 text-base">Welcome back,</p>
              <p className="text-xl font-bold">{user.displayName || user.phoneNumber || user.email}</p>
            </>
          ) : (
            <>
              <p className="text-gray-400 text-base">Ready to book?</p>
              <p className="text-xl font-bold">Pick a garage and book your service</p>
            </>
          )}
        </div>
      </div>

      {/* Booking Form — always shown */}
      <div className="max-w-2xl mx-auto p-4 -mt-4">
        <div className="bg-white rounded-2xl shadow-lg p-7">
          <h2 className="text-2xl font-bold text-petrol-black mb-1">Book a Service</h2>
          <p className="text-petrol-gray text-base mb-6">Pick a garage, date and time — the team will confirm your slot</p>

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl mb-4">
              <p className="text-sm">{error}</p>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Email for phone-auth users */}
            {user && !user.email && (
              <div className="bg-blue-50 rounded-xl p-4 border border-blue-100">
                <label className="block text-base font-semibold text-petrol-black mb-1.5">
                  Your email address
                </label>
                <input
                  type="email"
                  value={formData.contactEmail}
                  onChange={(e) => setFormData({...formData, contactEmail: e.target.value})}
                  className="w-full px-4 py-4 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-petrol-yellow focus:border-petrol-yellow outline-none transition-colors text-petrol-black placeholder-gray-400 bg-white"
                  placeholder="you@example.com"
                />
                <p className="text-sm text-blue-600 mt-1">So we can send you booking updates and confirmations</p>
              </div>
            )}

            {/* Step 1: Select Garage (dropdown) */}
            <div>
              <label className="block text-base font-semibold text-petrol-black mb-1.5">
                1. Select a garage <span className="text-red-500">*</span>
              </label>
              {loadingGarages ? (
                <div className="flex items-center space-x-2 py-4">
                  <div className="w-5 h-5 border-2 border-petrol-yellow border-t-transparent rounded-full animate-spin"></div>
                  <span className="text-petrol-gray text-sm">Loading garages...</span>
                </div>
              ) : garages.length === 0 && !selectedGarage ? (
                <div className="bg-gray-50 rounded-xl p-5 text-center">
                  <p className="text-petrol-gray text-sm mb-3">No garages are available for booking right now.</p>
                  <button
                    type="button"
                    onClick={() => router.push('/')}
                    className="bg-petrol-yellow text-petrol-black font-semibold px-5 py-2.5 rounded-lg text-sm hover:brightness-110 transition-all"
                  >
                    Go Home
                  </button>
                </div>
              ) : (
                <>
                  <select
                    value={selectedGarage?.id || ''}
                    onChange={(e) => {
                      const garage = garages.find(g => g.id === e.target.value)
                      if (garage) {
                        handleSelectGarage(garage)
                      } else {
                        setSelectedGarage(null)
                        setGarageMechanics([])
                        setStep('select-garage')
                      }
                    }}
                    className="w-full px-4 py-4 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-petrol-yellow focus:border-petrol-yellow outline-none bg-white transition-colors text-petrol-black"
                    required
                  >
                    <option value="">Choose a garage...</option>
                    {garages.map(garage => (
                      <option key={garage.id} value={garage.id || ''}>
                        {(garage as any).garageName || garage.name} — {garage.location}
                      </option>
                    ))}
                  </select>
                  {/* Show selected garage details */}
                  {selectedGarage && (
                    <div className="mt-2 bg-petrol-black rounded-xl p-3 flex items-center space-x-3">
                      <div className="w-9 h-9 bg-petrol-yellow rounded-full flex items-center justify-center flex-shrink-0">
                        <svg className="w-5 h-5 text-petrol-black" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                        </svg>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-white font-semibold text-sm truncate">{(selectedGarage as any).garageName || selectedGarage.name}</p>
                        <p className="text-gray-400 text-xs truncate">{selectedGarage.location}</p>
                      </div>
                      {selectedGarage.servicesOffered && selectedGarage.servicesOffered.length > 0 && (
                        <span className="text-xs text-petrol-yellow font-medium flex-shrink-0">
                          {selectedGarage.servicesOffered.length} services
                        </span>
                      )}
                    </div>
                  )}
                </>
              )}
            </div>

            {/* Step 2: Date Picker */}
            <div>
              <label className="block text-base font-semibold text-petrol-black mb-1.5">
                2. Pick a date <span className="text-red-500">*</span>
              </label>
                <input
                  type="date"
                  required
                  value={formData.preferredDate}
                  onChange={(e) => handleDateChange(e.target.value)}
                  min={today}
                  className="w-full px-4 py-4 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-petrol-yellow focus:border-petrol-yellow outline-none transition-colors text-petrol-black"
                />
              </div>

              {/* Sunday message */}
              {selectedDateIsSunday && (
                <div className="bg-orange-50 border border-orange-200 rounded-xl p-4">
                  <div className="flex items-center space-x-2">
                    <svg className="w-5 h-5 text-orange-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
                    </svg>
                    <p className="text-sm font-medium text-orange-800">We're closed on Sundays</p>
                  </div>
                  <p className="text-sm text-orange-600 mt-1">We're open Monday to Saturday, 8 AM — 6 PM. Pick another day!</p>
                </div>
              )}

              {/* Step 2: Time Slot Grid */}
              {formData.preferredDate && !selectedDateIsSunday && (
                <div>
                  <label className="block text-base font-semibold text-petrol-black mb-1.5">
                    3. Pick a time slot <span className="text-red-500">*</span>
                  </label>
                  <p className="text-sm text-petrol-gray mb-3">
                    {loadingSlots
                      ? 'Checking availability...'
                      : `${availableCount} of ${ALL_SLOTS.length} slots available`
                    }
                  </p>
                  {loadingSlots ? (
                    <div className="flex items-center justify-center py-8">
                      <div className="w-8 h-8 border-3 border-petrol-yellow border-t-transparent rounded-full animate-spin"></div>
                    </div>
                  ) : (
                    <div className="grid grid-cols-4 gap-2.5">
                      {ALL_SLOTS.map((slot) => {
                        const isBooked = bookedSlots.includes(slot)
                        const isPast = isSlotPast(slot)
                        const isSelected = formData.preferredTime === slot
                        const isDisabled = isBooked || isPast
                        return (
                          <button
                            key={slot}
                            type="button"
                            disabled={isDisabled}
                            onClick={() => {
                              setFormData(prev => ({ ...prev, preferredTime: slot }))
                              setError(null)
                            }}
                            className={`
                              py-2.5 px-1 rounded-lg text-base font-medium transition-all
                              ${isSelected
                                ? 'bg-petrol-yellow text-petrol-black ring-2 ring-petrol-yellow ring-offset-1 shadow-md'
                                : isDisabled
                                  ? 'bg-gray-100 text-gray-300 cursor-not-allowed line-through'
                                  : 'bg-white border-2 border-gray-200 text-petrol-black hover:border-petrol-yellow hover:bg-yellow-50 active:scale-95'
                              }
                            `}
                          >
                            {formatSlotTime(slot)}
                          </button>
                        )
                      })}
                    </div>
                  )}
                  <div className="flex items-center space-x-4 mt-3 text-sm text-petrol-gray">
                    <div className="flex items-center space-x-1">
                      <div className="w-3 h-3 rounded border-2 border-gray-200 bg-white"></div>
                      <span>Available</span>
                    </div>
                    <div className="flex items-center space-x-1">
                      <div className="w-3 h-3 rounded bg-petrol-yellow"></div>
                      <span>Selected</span>
                    </div>
                    <div className="flex items-center space-x-1">
                      <div className="w-3 h-3 rounded bg-gray-100"></div>
                      <span>Taken</span>
                    </div>
                  </div>
                </div>
              )}

              {/* Step 3: Mechanic Preference */}
              <div>
                <label className="block text-base font-semibold text-petrol-black mb-1.5">
                  4. Mechanic preference
                </label>
                <p className="text-sm text-petrol-gray mb-3">Choose a specific mechanic or let the garage assign one</p>
                <div className="grid grid-cols-2 gap-2.5">
                  {/* Garage Assigns */}
                  <button
                    type="button"
                    onClick={() => setMechanicPreference('garage-assigns')}
                    className={`col-span-2 rounded-xl p-4 border-2 text-left flex items-center space-x-3 transition-all ${
                      mechanicPreference === 'garage-assigns'
                        ? 'border-petrol-yellow bg-yellow-50'
                        : 'border-gray-200 bg-white hover:border-gray-300'
                    }`}
                  >
                    <div className={`flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center ${mechanicPreference === 'garage-assigns' ? 'bg-petrol-yellow' : 'bg-gray-100'}`}>
                      <svg className={`w-5 h-5 ${mechanicPreference === 'garage-assigns' ? 'text-petrol-black' : 'text-gray-500'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                      </svg>
                    </div>
                    <div className="flex-1">
                      <p className="text-base font-semibold text-petrol-black">Let the garage assign</p>
                      <p className="text-sm text-petrol-gray">We'll pick the best available mechanic</p>
                    </div>
                    {mechanicPreference === 'garage-assigns' && (
                      <svg className="w-6 h-6 text-petrol-yellow flex-shrink-0" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z" />
                      </svg>
                    )}
                  </button>

                  {/* Dynamic mechanics from garage */}
                  {garageMechanics.map((mechanic) => (
                    <button
                      key={mechanic.id}
                      type="button"
                      onClick={() => setMechanicPreference(mechanic.id || '')}
                      className={`rounded-xl p-4 border-2 text-left flex items-center space-x-3 transition-all ${
                        mechanicPreference === mechanic.id
                          ? 'border-petrol-yellow bg-yellow-50'
                          : 'border-gray-200 bg-white hover:border-gray-300'
                      }`}
                    >
                      <div className={`flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center ${mechanicPreference === mechanic.id ? 'bg-petrol-yellow' : 'bg-gray-100'}`}>
                        <svg className={`w-5 h-5 ${mechanicPreference === mechanic.id ? 'text-petrol-black' : 'text-gray-500'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                        </svg>
                      </div>
                      <p className="text-base font-semibold text-petrol-black flex-1 truncate">{mechanic.name}</p>
                      {mechanicPreference === mechanic.id && (
                        <svg className="w-6 h-6 text-petrol-yellow flex-shrink-0" fill="currentColor" viewBox="0 0 24 24">
                          <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z" />
                        </svg>
                      )}
                    </button>
                  ))}

                  {/* If no mechanics registered yet */}
                  {garageMechanics.length === 0 && (
                    <p className="col-span-2 text-sm text-petrol-gray bg-gray-50 rounded-lg px-3 py-2">
                      The garage will assign a mechanic when they confirm your booking
                    </p>
                  )}
                </div>
              </div>

              {/* Description */}
              <div>
                <label className="block text-base font-semibold text-petrol-black mb-1.5">
                  What do you need help with?
                </label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData({...formData, description: e.target.value})}
                  rows={3}
                  className="w-full px-4 py-4 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-petrol-yellow focus:border-petrol-yellow outline-none resize-none transition-colors text-base text-petrol-black placeholder-gray-400"
                  placeholder="e.g. My car is making a weird noise when braking..."
                />
                <p className="text-sm text-petrol-gray mt-1">Optional — you can also explain when you visit</p>
              </div>

              {/* Expandable: More Details */}
              <div className="border-2 border-gray-100 rounded-xl overflow-hidden">
                <button
                  type="button"
                  onClick={() => setShowMoreDetails(!showMoreDetails)}
                  className="w-full px-4 py-4 flex items-center justify-between text-base font-medium text-petrol-gray hover:bg-gray-50 transition-colors"
                >
                  <div className="flex items-center space-x-2">
                    <svg className={`w-4 h-4 transition-transform duration-200 ${showMoreDetails ? 'rotate-45' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                    </svg>
                    <span>Add more details</span>
                    <span className="text-sm text-petrol-gray font-normal">(VIN, service type, photos)</span>
                  </div>
                  <svg className={`w-5 h-5 transition-transform duration-200 ${showMoreDetails ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </button>
                {showMoreDetails && (
                  <div className="px-4 pb-4 space-y-4 border-t border-gray-100 pt-4">
                    {/* VIN */}
                    <div>
                      <label className="block text-base font-semibold text-petrol-black mb-1.5">VIN / Chassis Number</label>
                      <input
                        type="text"
                        value={formData.vinNumber}
                        onChange={(e) => setFormData({...formData, vinNumber: e.target.value})}
                        className="w-full px-4 py-4 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-petrol-yellow focus:border-petrol-yellow outline-none transition-colors text-petrol-black placeholder-gray-400"
                        placeholder="Found on your logbook or windshield"
                      />
                      <p className="text-sm text-petrol-gray mt-1">Helps us pull up your car's service history</p>
                    </div>

                    {/* Service */}
                    <div>
                      <label className="block text-base font-semibold text-petrol-black mb-1.5">Service Type</label>
                      <select
                        value={formData.service}
                        onChange={(e) => setFormData({...formData, service: e.target.value})}
                        className="w-full px-4 py-4 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-petrol-yellow focus:border-petrol-yellow outline-none bg-white transition-colors text-petrol-black"
                      >
                        <option value="">Not sure yet</option>
                        {SERVICES.map(service => (
                          <option key={service} value={service}>{service}</option>
                        ))}
                      </select>
                    </div>

                    {/* Other Service */}
                    {formData.service === 'Other' && (
                      <div>
                        <label className="block text-base font-semibold text-petrol-black mb-1.5">Tell us more</label>
                        <input
                          type="text"
                          value={formData.otherService}
                          onChange={(e) => setFormData({...formData, otherService: e.target.value})}
                          className="w-full px-4 py-4 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-petrol-yellow focus:border-petrol-yellow outline-none transition-colors text-petrol-black placeholder-gray-400"
                          placeholder="What service do you need?"
                        />
                      </div>
                    )}

                    {/* Photo Upload */}
                    <div>
                      <label className="block text-base font-semibold text-petrol-black mb-1.5">Photos of the issue</label>
                      <p className="text-sm text-petrol-gray mb-3">Up to 5 photos, max 5MB each</p>
                      {photoPreviews.length > 0 && (
                        <div className="grid grid-cols-3 gap-2 mb-3">
                          {photoPreviews.map((preview, index) => (
                            <div key={index} className="relative aspect-square rounded-lg overflow-hidden border-2 border-gray-200">
                              <img src={preview} alt={`Photo ${index + 1}`} className="w-full h-full object-cover" />
                              <button
                                type="button"
                                onClick={() => handlePhotoRemove(index)}
                                className="absolute top-1 right-1 w-6 h-6 bg-black bg-opacity-60 rounded-full flex items-center justify-center text-white hover:bg-opacity-80"
                              >
                                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                </svg>
                              </button>
                            </div>
                          ))}
                        </div>
                      )}
                      {photos.length < 5 && (
                        <label className="flex items-center justify-center w-full py-4 border-2 border-dashed border-gray-300 rounded-xl cursor-pointer hover:border-petrol-yellow hover:bg-yellow-50 transition-colors">
                          <div className="flex items-center space-x-2 text-petrol-gray">
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                            </svg>
                            <span className="text-sm font-medium">
                              {photos.length === 0 ? 'Add photos' : `Add more (${photos.length}/5)`}
                            </span>
                          </div>
                          <input type="file" accept="image/*" multiple onChange={handlePhotoAdd} className="hidden" />
                        </label>
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* Submit */}
              <button
                type="submit"
                disabled={isSubmitting || !selectedGarage || !formData.preferredDate || !formData.preferredTime || selectedDateIsSunday}
                className="w-full bg-petrol-green text-petrol-black font-bold py-5 rounded-xl hover:brightness-110 transition-all disabled:opacity-50 disabled:cursor-not-allowed text-xl shadow-md hover:shadow-lg active:scale-[0.98]"
              >
                {isSubmitting ? (
                  <span className="flex items-center justify-center space-x-2">
                    <span className="w-5 h-5 border-2 border-petrol-black border-t-transparent rounded-full animate-spin"></span>
                    <span>{photos.length > 0 ? 'Uploading photos & booking...' : 'Booking...'}</span>
                  </span>
                ) : formData.preferredTime ? (
                  `Book for ${formatSlotTime(formData.preferredTime)}`
                ) : (
                  'Pick a time slot above'
                )}
              </button>
          </form>
        </div>

        <p className="text-center text-sm text-petrol-gray mt-4 px-4 pb-24">
          The garage reviews every booking and confirms within a few hours. No payment until after service.
        </p>
      </div>

      {/* Bottom Navigation */}
      {user && (
        <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 safe-area-bottom z-40">
          <div className="max-w-2xl mx-auto flex">
            <button className="flex-1 flex flex-col items-center py-3 text-petrol-green">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
              </svg>
              <span className="text-xs font-semibold mt-0.5">Book</span>
            </button>
            <button onClick={() => router.push('/my-bookings')} className="flex-1 flex flex-col items-center py-3 text-gray-400">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
              </svg>
              <span className="text-xs font-medium mt-0.5">My Bookings</span>
            </button>
            <button onClick={handleSignOut} className="flex-1 flex flex-col items-center py-3 text-gray-400">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
              </svg>
              <span className="text-xs font-medium mt-0.5">Sign Out</span>
            </button>
          </div>
        </div>
      )}

      {/* Login Modal */}
      {showLoginModal && (
        <LoginModal
          isOpen={showLoginModal}
          onClose={() => setShowLoginModal(false)}
          onLoginSuccess={() => setShowLoginModal(false)}
          setError={setError}
        />
      )}
    </div>
  )
}

// Suspense wrapper for searchParams
import { Suspense } from 'react'

export default function BookingPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="w-10 h-10 border-3 border-petrol-yellow border-t-transparent rounded-full animate-spin"></div>
      </div>
    }>
      <BookingPageContent />
    </Suspense>
  )
}

// Login Modal Component
function LoginModal({
  isOpen,
  onClose,
  onLoginSuccess,
  setError,
}: {
  isOpen: boolean
  onClose: () => void
  onLoginSuccess: () => void
  setError: (msg: string | null) => void
}) {
  const [isSigningIn, setIsSigningIn] = useState(false)
  const [showPhoneForm, setShowPhoneForm] = useState(false)
  const [phoneNumber, setPhoneNumber] = useState('')
  const [otpCode, setOtpCode] = useState('')
  const [confirmationResult, setConfirmationResult] = useState<ConfirmationResult | null>(null)
  const [otpSent, setOtpSent] = useState(false)

  const getFriendlyError = (code: string) => {
    switch (code) {
      case 'auth/popup-closed-by-user': return 'Sign-in was cancelled. Try again when ready.'
      case 'auth/popup-blocked': return 'Pop-up was blocked. Trying a different method...'
      case 'auth/network-request-failed': return 'Network issue. Check your internet and try again.'
      case 'auth/unauthorized-domain': return 'This domain is not authorized yet. Contact us on Instagram @petrol_goons.'
      case 'auth/cancelled-popup-request': return null
      default: return 'Something went wrong. Please try again.'
    }
  }

  const handleSocialLogin = async (providerType: 'google' | 'facebook' | 'apple') => {
    setIsSigningIn(true)
    setError(null)
    try {
      const { auth } = await import('@/lib/firebase')
      let provider
      if (providerType === 'google') provider = new GoogleAuthProvider()
      else if (providerType === 'facebook') provider = new FacebookAuthProvider()
      else provider = new OAuthProvider('apple.com')

      try {
        const result = await signInWithPopup(auth, provider)
        if (result?.user) {
          onLoginSuccess()
          return
        }
      } catch (popupErr: any) {
        if (popupErr.code === 'auth/popup-blocked' ||
            popupErr.code === 'auth/popup-closed-by-user' ||
            popupErr.code === 'auth/cancelled-popup-request') {
          try {
            await signInWithRedirect(auth, provider)
          } catch {}
          return
        }
        if (popupErr.code === 'auth/internal-error' || popupErr.message?.includes('COOP')) {
          await new Promise(r => setTimeout(r, 1500))
          if (auth.currentUser) {
            onLoginSuccess()
            return
          }
        }
        throw popupErr
      }
    } catch (err: any) {
      const message = getFriendlyError(err.code)
      if (message) setError(message)
    } finally {
      setIsSigningIn(false)
    }
  }

  const handlePhoneSubmit = async () => {
    if (!phoneNumber.trim()) {
      setError('Please enter your phone number')
      return
    }
    setIsSigningIn(true)
    setError(null)
    try {
      const { auth } = await import('@/lib/firebase')
      const appVerifier = new RecaptchaVerifier(auth, 'recaptcha-container', {
        size: 'invisible',
        callback: () => {},
      })
      const result = await signInWithPhoneNumber(auth, phoneNumber, appVerifier)
      setConfirmationResult(result)
      setOtpSent(true)
    } catch (err: any) {
      setError(err.message || 'Failed to send OTP. Check your number and try again.')
    } finally {
      setIsSigningIn(false)
    }
  }

  const handleOtpSubmit = async () => {
    if (!otpCode.trim() || !confirmationResult) {
      setError('Please enter the OTP')
      return
    }
    setIsSigningIn(true)
    setError(null)
    try {
      await confirmationResult.confirm(otpCode)
      onLoginSuccess()
    } catch (err: any) {
      setError(err.message || 'Invalid OTP. Try again.')
    } finally {
      setIsSigningIn(false)
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6 relative">
        <button onClick={onClose} className="absolute top-4 right-4 text-gray-400 hover:text-gray-600">
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>

        <h3 className="text-2xl font-bold text-petrol-black mb-2">Almost there!</h3>
        <p className="text-petrol-gray text-base mb-6">Sign in to save your booking. It takes 30 seconds.</p>

        {showPhoneForm ? (
          <>
            {!otpSent ? (
              <>
                <label className="block text-base font-semibold text-petrol-black mb-2">Phone Number</label>
                <input
                  type="tel"
                  value={phoneNumber}
                  onChange={(e) => setPhoneNumber(e.target.value)}
                  placeholder="+254712345678"
                  className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-petrol-yellow focus:border-petrol-yellow outline-none text-petrol-black mb-4"
                />
                <button
                  onClick={handlePhoneSubmit}
                  disabled={isSigningIn}
                  className="w-full bg-petrol-yellow text-petrol-black font-semibold py-3 rounded-xl hover:brightness-110 transition-all disabled:opacity-50 mb-3"
                >
                  {isSigningIn ? 'Sending OTP...' : 'Send OTP'}
                </button>
              </>
            ) : (
              <>
                <label className="block text-base font-semibold text-petrol-black mb-2">Enter OTP</label>
                <p className="text-sm text-petrol-gray mb-3">Check your SMS for the code</p>
                <input
                  type="text"
                  value={otpCode}
                  onChange={(e) => setOtpCode(e.target.value)}
                  placeholder="000000"
                  maxLength={6}
                  className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-petrol-yellow focus:border-petrol-yellow outline-none text-petrol-black text-center text-2xl tracking-widest mb-4"
                />
                <button
                  onClick={handleOtpSubmit}
                  disabled={isSigningIn}
                  className="w-full bg-petrol-yellow text-petrol-black font-semibold py-3 rounded-xl hover:brightness-110 transition-all disabled:opacity-50 mb-3"
                >
                  {isSigningIn ? 'Verifying...' : 'Verify OTP'}
                </button>
              </>
            )}
            <button
              onClick={() => {
                setShowPhoneForm(false)
                setPhoneNumber('')
                setOtpCode('')
                setOtpSent(false)
                setConfirmationResult(null)
              }}
              className="w-full text-petrol-gray py-2 font-medium hover:bg-gray-100 rounded-lg transition-colors"
            >
              Back to other methods
            </button>
            <div id="recaptcha-container"></div>
          </>
        ) : (
          <>
            <button
              onClick={() => handleSocialLogin('google')}
              disabled={isSigningIn}
              className="w-full flex items-center justify-center space-x-3 bg-white border-2 border-gray-200 text-petrol-black py-4 px-4 rounded-xl font-medium mb-3 hover:border-blue-400 hover:bg-blue-50 disabled:opacity-50 transition-colors"
            >
              <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none">
                <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
              </svg>
              <span>Google</span>
            </button>
            <button
              onClick={() => handleSocialLogin('facebook')}
              disabled={isSigningIn}
              className="w-full flex items-center justify-center space-x-3 bg-[#1877F2] text-white py-4 px-4 rounded-xl font-medium mb-3 hover:bg-[#166FE5] disabled:opacity-50 transition-colors"
            >
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
              </svg>
              <span>Facebook</span>
            </button>
            <button
              onClick={() => handleSocialLogin('apple')}
              disabled={isSigningIn}
              className="w-full flex items-center justify-center space-x-3 bg-black text-white py-4 px-4 rounded-xl font-medium mb-3 hover:bg-gray-800 disabled:opacity-50 transition-colors"
            >
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                <path d="M17.05 20.28c-.98.95-2.05.88-3.08.4-1.09-.5-2.08-.48-3.24 0-1.44.62-2.2.44-3.06-.4C2.79 15.25 3.51 7.59 9.05 7.31c1.35.07 2.29.74 3.08.8 1.18-.24 2.31-.93 3.57-.84 1.51.12 2.65.72 3.4 1.8-3.12 1.87-2.38 5.98.48 7.13-.57 1.5-1.31 2.99-2.54 4.09zM12.03 7.25c-.15-2.23 1.66-4.07 3.74-4.25.29 2.58-2.34 4.5-3.74 4.25z"/>
              </svg>
              <span>Apple</span>
            </button>
            <button
              onClick={() => setShowPhoneForm(true)}
              disabled={isSigningIn}
              className="w-full flex items-center justify-center space-x-3 bg-petrol-yellow text-petrol-black py-4 px-4 rounded-xl font-medium hover:brightness-110 disabled:opacity-50 transition-all"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
              </svg>
              <span>Phone</span>
            </button>
            <button onClick={onClose} className="w-full text-petrol-gray py-3 px-4 rounded-xl font-medium hover:bg-gray-100 transition-colors mt-3">
              I'll do this later
            </button>
          </>
        )}
      </div>
    </div>
  )
}
