'use client'

import { useState, useEffect } from 'react'
import { onAuthStateChanged, signInWithPopup, signInWithRedirect, getRedirectResult } from 'firebase/auth'
import {
  createGarageProfile,
  getGarageByOwner,
  GARAGE_SERVICES,
  CURRENT_SYSTEMS,
  MECHANIC_COUNTS,
} from '@/lib/garages'
import { sendBookingEmail, getNewGarageApplicationEmailHtml } from '@/lib/email'
import { ADMIN_EMAILS } from '@/lib/admin'

type Step = 'welcome' | 'details' | 'services' | 'review' | 'success'

export default function GarageSignupPage() {
  const [user, setUser] = useState<any>(null)
  const [checkingAuth, setCheckingAuth] = useState(true)
  const [existingGarage, setExistingGarage] = useState<any>(null)
  const [step, setStep] = useState<Step>('welcome')
  const [submitting, setSubmitting] = useState(false)
  const [authLoading, setAuthLoading] = useState(false)
  const [error, setError] = useState('')

  // Form data
  const [garageName, setGarageName] = useState('')
  const [ownerName, setOwnerName] = useState('')
  const [ownerPhone, setOwnerPhone] = useState('')
  const [ownerEmail, setOwnerEmail] = useState('')
  const [location, setLocation] = useState('')
  const [googleMapsLink, setGoogleMapsLink] = useState('')
  const [selectedServices, setSelectedServices] = useState<string[]>([])
  const [mechanicCount, setMechanicCount] = useState('')
  const [currentSystem, setCurrentSystem] = useState('')

  useEffect(() => {
    let unsubscribe: (() => void) | undefined

    const init = async () => {
      try {
        const { auth } = await import('@/lib/firebase')
        // Check for redirect result first
        try {
          await getRedirectResult(auth)
        } catch { /* redirect check failed */ }

        unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
          setUser(currentUser)
          if (currentUser) {
            // Pre-fill from auth profile
            setOwnerName(currentUser.displayName || '')
            setOwnerEmail(currentUser.email || '')
            setOwnerPhone(currentUser.phoneNumber || '')
            // Check if they already have a garage
            const garage = await getGarageByOwner(currentUser.uid)
            if (garage) {
              setExistingGarage(garage)
            }
          }
          setCheckingAuth(false)
        })
      } catch {
        setCheckingAuth(false)
      }
    }

    init()
    return () => { if (unsubscribe) unsubscribe() }
  }, [])

  const handleGoogleSignIn = async () => {
    setAuthLoading(true)
    setError('')
    try {
      const { auth, googleProvider } = await import('@/lib/firebase')
      try {
        await signInWithPopup(auth, googleProvider)
      } catch (popupErr: any) {
        if (popupErr.code === 'auth/popup-blocked') {
          await signInWithRedirect(auth, googleProvider)
        } else {
          throw popupErr
        }
      }
    } catch (err: any) {
      setError('Sign-in failed. Please try again.')
      console.error(err)
    }
    setAuthLoading(false)
  }

  const toggleService = (service: string) => {
    setSelectedServices(prev =>
      prev.includes(service)
        ? prev.filter(s => s !== service)
        : [...prev, service]
    )
  }

  const handleSubmit = async () => {
    if (!user) return
    setSubmitting(true)
    setError('')

    const result = await createGarageProfile({
      ownerId: user.uid,
      ownerName,
      ownerEmail,
      ownerPhone,
      garageName,
      location,
      googleMapsLink,
      servicesOffered: selectedServices,
      mechanicCount,
      currentSystem,
    })

    if (result.success) {
      // Send notification email to admin team
      try {
        const emailHtml = getNewGarageApplicationEmailHtml({
          garageName, ownerName, ownerPhone, ownerEmail, location,
          servicesOffered: selectedServices, mechanicCount, currentSystem,
        })
        for (const adminEmail of ADMIN_EMAILS) {
          sendBookingEmail(adminEmail, `New Garage Application — ${garageName}`, emailHtml).catch(() => {})
        }
      } catch { /* email failed silently */ }
      setStep('success')
    } else {
      setError('Something went wrong. Please try again.')
    }
    setSubmitting(false)
  }

  // Validation helpers
  const canProceedDetails = garageName.trim() && ownerName.trim() && ownerPhone.trim() && location.trim()
  const canProceedServices = selectedServices.length > 0 && mechanicCount && currentSystem

  // Loading state
  if (checkingAuth) {
    return (
      <div className="min-h-screen bg-petrol-black flex items-center justify-center px-6">
        <div className="text-center">
          <h1 className="text-3xl brand-text mb-2">
            <span className="text-petrol-green">PETROL</span>{' '}
            <span className="inline-block bg-petrol-yellow text-petrol-black px-3 py-0.5 -skew-x-6">GOONS</span>
          </h1>
          <div className="w-8 h-8 border-4 border-petrol-yellow border-t-transparent rounded-full animate-spin mx-auto mt-6"></div>
        </div>
      </div>
    )
  }

  // Already registered — show status
  if (existingGarage) {
    return (
      <div className="min-h-screen bg-petrol-black flex items-center justify-center px-6">
        <div className="max-w-md w-full text-center">
          <h1 className="text-3xl brand-text mb-4">
            <span className="text-petrol-green">PETROL</span>{' '}
            <span className="inline-block bg-petrol-yellow text-petrol-black px-3 py-0.5 -skew-x-6">GOONS</span>
          </h1>
          <div className="bg-white/[0.06] border border-white/10 rounded-2xl p-8 mt-6">
            <div className="w-16 h-16 bg-petrol-yellow/20 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-petrol-yellow" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
              </svg>
            </div>
            <h2 className="text-white text-2xl font-bold mb-2">{existingGarage.garageName || existingGarage.name}</h2>
            <p className="text-gray-400 mb-1">{existingGarage.location}</p>
            <span className={`inline-block px-3 py-1 rounded-full text-sm font-semibold mt-2 ${
              existingGarage.status === 'active' ? 'bg-petrol-green/20 text-petrol-green' :
              existingGarage.status === 'approved' ? 'bg-petrol-green/20 text-petrol-green' :
              'bg-petrol-yellow/20 text-petrol-yellow'
            }`}>
              {existingGarage.status === 'pending' ? '⏳ Under Review' :
               existingGarage.status === 'approved' || existingGarage.status === 'active' ? '✓ Active' :
               existingGarage.status}
            </span>
            <p className="text-gray-500 text-sm mt-4">
              {existingGarage.status === 'pending'
                ? 'Our team is reviewing your application. We\'ll reach out shortly!'
                : 'Your garage is live on Petrol Goons.'}
            </p>
            <div className="mt-6 space-y-3">
              <button
                onClick={() => window.location.href = '/dashboard'}
                className="w-full bg-petrol-yellow text-petrol-black font-bold py-3 rounded-xl hover:brightness-110 transition-all"
              >
                Go to Dashboard
              </button>
              <button
                onClick={() => window.location.href = '/'}
                className="w-full bg-white/5 text-gray-400 font-medium py-3 rounded-xl hover:bg-white/10 transition-all"
              >
                Back to Home
              </button>
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-petrol-black">
      <div className="max-w-lg mx-auto px-6 pt-8 pb-12">
        {/* Header */}
        <div className="text-center mb-8">
          <button onClick={() => window.location.href = '/'} className="text-gray-500 text-sm mb-4 inline-block hover:text-gray-400">
            ← Back to Home
          </button>
          <h1 className="text-3xl brand-text mb-2">
            <span className="text-petrol-green">PETROL</span>{' '}
            <span className="inline-block bg-petrol-yellow text-petrol-black px-3 py-0.5 -skew-x-6">GOONS</span>
          </h1>
          <p className="text-gray-500 text-sm tracking-[0.2em] font-medium uppercase mt-1">For Garages</p>
          <div className="w-40 mx-auto mt-3 racing-stripe-diagonal rounded-sm overflow-hidden"></div>
        </div>

        {/* Progress bar */}
        {step !== 'welcome' && step !== 'success' && (
          <div className="flex items-center space-x-2 mb-8">
            {['details', 'services', 'review'].map((s, i) => (
              <div key={s} className="flex items-center flex-1">
                <div className={`h-1.5 flex-1 rounded-full transition-all duration-300 ${
                  ['details', 'services', 'review'].indexOf(step) >= i
                    ? 'bg-petrol-yellow'
                    : 'bg-white/10'
                }`} />
              </div>
            ))}
          </div>
        )}

        {error && (
          <div className="bg-red-500/10 border border-red-500/30 text-red-400 rounded-xl p-4 mb-6 text-sm">
            {error}
          </div>
        )}

        {/* STEP: Welcome / Sign In */}
        {step === 'welcome' && (
          <div className="text-center">
            <div className="bg-white/[0.06] border border-white/10 rounded-2xl p-8 mb-6">
              <div className="w-20 h-20 bg-petrol-yellow/20 rounded-full flex items-center justify-center mx-auto mb-6">
                <svg className="w-10 h-10 text-petrol-yellow" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                </svg>
              </div>
              <h2 className="text-white text-2xl font-bold mb-3">Register Your Garage</h2>
              <p className="text-gray-400 text-base mb-2">
                Join the Petrol Goons network and start receiving digital bookings today.
              </p>
              <p className="text-gray-600 text-sm mb-6">Takes about 2 minutes.</p>

              <div className="space-y-4">
                {/* What you get */}
                <div className="text-left space-y-2.5">
                  {[
                    'Digital booking page for your garage',
                    'Dashboard to manage jobs & customers',
                    'Service history & records for every car',
                    'Your garage branded "Powered by Petrol Goons"',
                  ].map((item, i) => (
                    <div key={i} className="flex items-center space-x-2.5">
                      <svg className="w-4 h-4 text-petrol-yellow flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                      </svg>
                      <span className="text-gray-300 text-sm">{item}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {user ? (
              <div>
                <p className="text-gray-400 text-sm mb-3">Signed in as <span className="text-white font-medium">{user.email || user.phoneNumber}</span></p>
                <button
                  onClick={() => setStep('details')}
                  className="w-full bg-petrol-yellow text-petrol-black font-bold py-4 rounded-xl hover:brightness-110 transition-all text-lg"
                >
                  Continue Setup →
                </button>
              </div>
            ) : (
              <div>
                <p className="text-gray-500 text-sm mb-4">Sign in to get started</p>
                <button
                  onClick={handleGoogleSignIn}
                  disabled={authLoading}
                  className="w-full bg-white text-gray-800 font-semibold py-4 rounded-xl hover:bg-gray-50 transition-all flex items-center justify-center space-x-3 disabled:opacity-50"
                >
                  {authLoading ? (
                    <div className="w-5 h-5 border-2 border-gray-400 border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <>
                      <svg className="w-5 h-5" viewBox="0 0 24 24">
                        <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/>
                        <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                        <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                        <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                      </svg>
                      <span>Continue with Google</span>
                    </>
                  )}
                </button>
              </div>
            )}
          </div>
        )}

        {/* STEP: Garage Details */}
        {step === 'details' && (
          <div>
            <h2 className="text-white text-2xl font-bold mb-2">Your Garage Details</h2>
            <p className="text-gray-500 text-sm mb-6">Tell us about your garage so we can set it up properly.</p>

            <div className="space-y-5">
              <div>
                <label className="block text-gray-400 text-sm font-medium mb-1.5">Garage Name *</label>
                <input
                  type="text"
                  value={garageName}
                  onChange={e => setGarageName(e.target.value)}
                  placeholder="e.g. Speedfix Auto Garage"
                  className="w-full bg-white/[0.06] border border-white/10 rounded-xl px-4 py-3.5 text-white placeholder-gray-600 focus:border-petrol-yellow/50 focus:outline-none transition-all"
                />
              </div>

              <div>
                <label className="block text-gray-400 text-sm font-medium mb-1.5">Your Name *</label>
                <input
                  type="text"
                  value={ownerName}
                  onChange={e => setOwnerName(e.target.value)}
                  placeholder="Your full name"
                  className="w-full bg-white/[0.06] border border-white/10 rounded-xl px-4 py-3.5 text-white placeholder-gray-600 focus:border-petrol-yellow/50 focus:outline-none transition-all"
                />
              </div>

              <div>
                <label className="block text-gray-400 text-sm font-medium mb-1.5">Phone Number *</label>
                <input
                  type="tel"
                  value={ownerPhone}
                  onChange={e => setOwnerPhone(e.target.value)}
                  placeholder="0712 345 678"
                  className="w-full bg-white/[0.06] border border-white/10 rounded-xl px-4 py-3.5 text-white placeholder-gray-600 focus:border-petrol-yellow/50 focus:outline-none transition-all"
                />
              </div>

              <div>
                <label className="block text-gray-400 text-sm font-medium mb-1.5">Email</label>
                <input
                  type="email"
                  value={ownerEmail}
                  onChange={e => setOwnerEmail(e.target.value)}
                  placeholder="your@email.com"
                  className="w-full bg-white/[0.06] border border-white/10 rounded-xl px-4 py-3.5 text-white placeholder-gray-600 focus:border-petrol-yellow/50 focus:outline-none transition-all"
                />
              </div>

              <div>
                <label className="block text-gray-400 text-sm font-medium mb-1.5">Location / Area *</label>
                <input
                  type="text"
                  value={location}
                  onChange={e => setLocation(e.target.value)}
                  placeholder="e.g. Westlands, Nairobi"
                  className="w-full bg-white/[0.06] border border-white/10 rounded-xl px-4 py-3.5 text-white placeholder-gray-600 focus:border-petrol-yellow/50 focus:outline-none transition-all"
                />
              </div>

              <div>
                <label className="block text-gray-400 text-sm font-medium mb-1.5">Google Maps Link <span className="text-gray-600">(optional)</span></label>
                <input
                  type="url"
                  value={googleMapsLink}
                  onChange={e => setGoogleMapsLink(e.target.value)}
                  placeholder="Paste your Google Maps pin link"
                  className="w-full bg-white/[0.06] border border-white/10 rounded-xl px-4 py-3.5 text-white placeholder-gray-600 focus:border-petrol-yellow/50 focus:outline-none transition-all"
                />
              </div>
            </div>

            <div className="flex space-x-3 mt-8">
              <button
                onClick={() => setStep('welcome')}
                className="flex-1 bg-white/5 text-gray-400 font-medium py-3.5 rounded-xl hover:bg-white/10 transition-all"
              >
                Back
              </button>
              <button
                onClick={() => setStep('services')}
                disabled={!canProceedDetails}
                className="flex-[2] bg-petrol-yellow text-petrol-black font-bold py-3.5 rounded-xl hover:brightness-110 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
              >
                Next →
              </button>
            </div>
          </div>
        )}

        {/* STEP: Services & Operations */}
        {step === 'services' && (
          <div>
            <h2 className="text-white text-2xl font-bold mb-2">Services & Operations</h2>
            <p className="text-gray-500 text-sm mb-6">Help us understand what your garage offers.</p>

            <div className="space-y-6">
              {/* Services offered */}
              <div>
                <label className="block text-gray-400 text-sm font-medium mb-3">What services do you offer? *</label>
                <div className="grid grid-cols-2 gap-2">
                  {GARAGE_SERVICES.map(service => (
                    <button
                      key={service}
                      onClick={() => toggleService(service)}
                      className={`text-left px-3.5 py-3 rounded-xl text-sm font-medium transition-all border ${
                        selectedServices.includes(service)
                          ? 'bg-petrol-yellow/15 border-petrol-yellow/40 text-petrol-yellow'
                          : 'bg-white/[0.04] border-white/10 text-gray-400 hover:border-white/20'
                      }`}
                    >
                      <span className="flex items-center space-x-2">
                        {selectedServices.includes(service) && (
                          <svg className="w-3.5 h-3.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                          </svg>
                        )}
                        <span>{service}</span>
                      </span>
                    </button>
                  ))}
                </div>
                {selectedServices.length > 0 && (
                  <p className="text-petrol-yellow/60 text-xs mt-2">{selectedServices.length} selected</p>
                )}
              </div>

              {/* Mechanic count */}
              <div>
                <label className="block text-gray-400 text-sm font-medium mb-3">How many mechanics do you have? *</label>
                <div className="grid grid-cols-2 gap-2">
                  {MECHANIC_COUNTS.map(opt => (
                    <button
                      key={opt.value}
                      onClick={() => setMechanicCount(opt.value)}
                      className={`px-3.5 py-3 rounded-xl text-sm font-medium transition-all border ${
                        mechanicCount === opt.value
                          ? 'bg-petrol-yellow/15 border-petrol-yellow/40 text-petrol-yellow'
                          : 'bg-white/[0.04] border-white/10 text-gray-400 hover:border-white/20'
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Current system */}
              <div>
                <label className="block text-gray-400 text-sm font-medium mb-3">How do you manage bookings now? *</label>
                <div className="space-y-2">
                  {CURRENT_SYSTEMS.map(sys => (
                    <button
                      key={sys}
                      onClick={() => setCurrentSystem(sys)}
                      className={`w-full text-left px-4 py-3 rounded-xl text-sm font-medium transition-all border ${
                        currentSystem === sys
                          ? 'bg-petrol-yellow/15 border-petrol-yellow/40 text-petrol-yellow'
                          : 'bg-white/[0.04] border-white/10 text-gray-400 hover:border-white/20'
                      }`}
                    >
                      {sys}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="flex space-x-3 mt-8">
              <button
                onClick={() => setStep('details')}
                className="flex-1 bg-white/5 text-gray-400 font-medium py-3.5 rounded-xl hover:bg-white/10 transition-all"
              >
                Back
              </button>
              <button
                onClick={() => setStep('review')}
                disabled={!canProceedServices}
                className="flex-[2] bg-petrol-yellow text-petrol-black font-bold py-3.5 rounded-xl hover:brightness-110 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
              >
                Review →
              </button>
            </div>
          </div>
        )}

        {/* STEP: Review & Submit */}
        {step === 'review' && (
          <div>
            <h2 className="text-white text-2xl font-bold mb-2">Review Your Application</h2>
            <p className="text-gray-500 text-sm mb-6">Make sure everything looks right before submitting.</p>

            <div className="space-y-4">
              {/* Garage info card */}
              <div className="bg-white/[0.06] border border-white/10 rounded-2xl p-5">
                <p className="text-gray-500 text-xs uppercase tracking-wider font-semibold mb-3">Garage</p>
                <h3 className="text-white text-xl font-bold">{garageName}</h3>
                <p className="text-gray-400 text-sm mt-1">📍 {location}</p>
                {googleMapsLink && <p className="text-petrol-yellow/60 text-xs mt-1 truncate">🗺️ {googleMapsLink}</p>}
              </div>

              {/* Owner info card */}
              <div className="bg-white/[0.06] border border-white/10 rounded-2xl p-5">
                <p className="text-gray-500 text-xs uppercase tracking-wider font-semibold mb-3">Owner</p>
                <p className="text-white font-medium">{ownerName}</p>
                <p className="text-gray-400 text-sm">{ownerPhone}</p>
                {ownerEmail && <p className="text-gray-400 text-sm">{ownerEmail}</p>}
              </div>

              {/* Services card */}
              <div className="bg-white/[0.06] border border-white/10 rounded-2xl p-5">
                <p className="text-gray-500 text-xs uppercase tracking-wider font-semibold mb-3">Services ({selectedServices.length})</p>
                <div className="flex flex-wrap gap-2">
                  {selectedServices.map(s => (
                    <span key={s} className="bg-petrol-yellow/10 text-petrol-yellow text-xs font-medium px-2.5 py-1 rounded-lg">{s}</span>
                  ))}
                </div>
              </div>

              {/* Operations card */}
              <div className="bg-white/[0.06] border border-white/10 rounded-2xl p-5">
                <p className="text-gray-500 text-xs uppercase tracking-wider font-semibold mb-3">Operations</p>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-500">Team size</span>
                    <span className="text-white font-medium">{mechanicCount} mechanics</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">Current system</span>
                    <span className="text-white font-medium">{currentSystem}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* What happens next */}
            <div className="bg-petrol-yellow/5 border border-petrol-yellow/20 rounded-xl p-4 mt-6">
              <p className="text-petrol-yellow font-semibold text-sm mb-2">What happens next?</p>
              <ol className="text-gray-400 text-sm space-y-1.5 list-decimal list-inside">
                <li>Our team reviews your application</li>
                <li>We set up your custom booking page</li>
                <li>You get access to your garage dashboard</li>
                <li>Start receiving digital bookings!</li>
              </ol>
            </div>

            <div className="flex space-x-3 mt-8">
              <button
                onClick={() => setStep('services')}
                className="flex-1 bg-white/5 text-gray-400 font-medium py-3.5 rounded-xl hover:bg-white/10 transition-all"
              >
                Back
              </button>
              <button
                onClick={handleSubmit}
                disabled={submitting}
                className="flex-[2] bg-petrol-yellow text-petrol-black font-bold py-3.5 rounded-xl hover:brightness-110 transition-all disabled:opacity-60 flex items-center justify-center space-x-2"
              >
                {submitting ? (
                  <>
                    <div className="w-5 h-5 border-2 border-petrol-black/30 border-t-petrol-black rounded-full animate-spin" />
                    <span>Submitting...</span>
                  </>
                ) : (
                  <span>Submit Application</span>
                )}
              </button>
            </div>
          </div>
        )}

        {/* STEP: Success */}
        {step === 'success' && (
          <div className="text-center py-8">
            <div className="confirm-check">
              <div className="w-20 h-20 bg-petrol-yellow/20 rounded-full flex items-center justify-center mx-auto">
                <svg className="w-10 h-10 text-petrol-yellow" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                </svg>
              </div>
            </div>

            <h2 className="text-white text-3xl font-bold mt-6 mb-3">You&apos;re In!</h2>
            <p className="text-gray-400 text-lg mb-2">
              Welcome to the Petrol Goons network, <span className="text-petrol-yellow font-semibold">{garageName}</span>.
            </p>
            <p className="text-gray-500 text-base mb-8">
              Our team will review your application and reach out within 24 hours to get you set up.
            </p>

            <div className="space-y-3">
              <button
                onClick={() => window.location.href = '/book'}
                className="w-full bg-petrol-yellow text-petrol-black font-bold py-4 rounded-xl hover:brightness-110 transition-all text-lg"
              >
                Try the Live Demo
              </button>
              <button
                onClick={() => window.location.href = '/'}
                className="w-full bg-white/5 text-gray-400 font-medium py-3 rounded-xl hover:bg-white/10 transition-all"
              >
                Back to Home
              </button>
            </div>

            <div className="mt-8 pt-6 border-t border-white/5">
              <p className="text-gray-600 text-sm">
                Questions? DM us on Instagram{' '}
                <a href="https://instagram.com/petrol_goons" target="_blank" rel="noopener noreferrer" className="text-petrol-yellow hover:text-yellow-300">
                  @petrol_goons
                </a>
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
