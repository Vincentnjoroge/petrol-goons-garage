'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import {
  onAuthStateChanged,
  signInWithPopup,
  signInWithRedirect,
  getRedirectResult,
  GoogleAuthProvider,
  FacebookAuthProvider,
  OAuthProvider,
  RecaptchaVerifier,
  signInWithPhoneNumber,
  ConfirmationResult,
} from 'firebase/auth'

export default function LandingPage() {
  const router = useRouter()
  const [checkingAuth, setCheckingAuth] = useState(true)
  const [isSigningIn, setIsSigningIn] = useState(false)
  const [signingInWith, setSigningInWith] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [showPhoneForm, setShowPhoneForm] = useState(false)
  const [phoneNumber, setPhoneNumber] = useState('')
  const [otpCode, setOtpCode] = useState('')
  const [confirmationResult, setConfirmationResult] = useState<ConfirmationResult | null>(null)
  const [otpSent, setOtpSent] = useState(false)
  const recaptchaRef = useRef<HTMLDivElement>(null)

  // Navigate to booking page — uses hard navigation to avoid RSC fetch errors in dev
  const goToBooking = () => {
    window.location.href = '/book'
  }

  // Check if user is already logged in — redirect them to booking page
  useEffect(() => {
    let cancelled = false
    let unsubscribe: (() => void) | undefined

    // SAFETY NET: No matter what happens, stop showing the loading screen after 2s
    const forceReady = setTimeout(() => {
      if (!cancelled) setCheckingAuth(false)
    }, 2000)

    const init = async () => {
      try {
        const { auth } = await import('@/lib/firebase')
        if (!auth) { setCheckingAuth(false); return }

        unsubscribe = onAuthStateChanged(auth, (user) => {
          if (cancelled) return
          if (user) {
            goToBooking()
          } else {
            setCheckingAuth(false)
          }
        })

        // Also check redirect result (user coming back from Google/Facebook sign-in redirect)
        try {
          const result = await Promise.race([
            getRedirectResult(auth),
            new Promise<null>((r) => setTimeout(() => r(null), 3000)),
          ])
          if (result?.user && !cancelled) goToBooking()
        } catch {
          // Redirect check failed — that's fine, ignore it
        }
      } catch {
        if (!cancelled) setCheckingAuth(false)
      }
    }

    init()

    return () => {
      cancelled = true
      clearTimeout(forceReady)
      if (unsubscribe) unsubscribe()
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

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
    setSigningInWith(providerType)
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
          goToBooking()
          return
        }
      } catch (popupErr: any) {
        // These errors mean popup was blocked/closed — try redirect instead
        if (popupErr.code === 'auth/popup-blocked' ||
            popupErr.code === 'auth/popup-closed-by-user' ||
            popupErr.code === 'auth/cancelled-popup-request') {
          try {
            await signInWithRedirect(auth, provider)
          } catch {
            // Redirect also failed — let user try again
          }
          return
        }
        // "auth/internal-error" or COOP issues — the login may have actually succeeded
        // Wait a moment and check if the user got signed in
        if (popupErr.code === 'auth/internal-error' || popupErr.message?.includes('COOP')) {
          await new Promise(r => setTimeout(r, 1500))
          if (auth.currentUser) {
            goToBooking()
            return
          }
        }
        throw popupErr
      }
    } catch (err: any) {
      const message = getFriendlyError(err.code)
      if (message) setError(message)
      setIsSigningIn(false)
      setSigningInWith(null)
    }
  }

  const handlePhoneSendOtp = async () => {
    if (!phoneNumber.trim()) { setError('Enter your phone number'); return }
    setIsSigningIn(true)
    setSigningInWith('phone')
    setError(null)
    try {
      const { auth } = await import('@/lib/firebase')
      // Format number — add +254 if user typed local format
      let formatted = phoneNumber.trim()
      if (formatted.startsWith('07') || formatted.startsWith('01')) {
        formatted = '+254' + formatted.substring(1)
      } else if (!formatted.startsWith('+')) {
        formatted = '+' + formatted
      }

      const recaptcha = new RecaptchaVerifier(auth, recaptchaRef.current!, { size: 'invisible' })
      const result = await signInWithPhoneNumber(auth, formatted, recaptcha)
      setConfirmationResult(result)
      setOtpSent(true)
    } catch (err: any) {
      const message = getFriendlyError(err.code)
      if (message) setError(message)
    }
    setIsSigningIn(false)
    setSigningInWith(null)
  }

  const handlePhoneVerifyOtp = async () => {
    if (!otpCode.trim() || !confirmationResult) return
    setIsSigningIn(true)
    setSigningInWith('phone')
    setError(null)
    try {
      await confirmationResult.confirm(otpCode.trim())
      goToBooking()
    } catch {
      setError('That code didn\'t work. Double-check and try again.')
      setIsSigningIn(false)
      setSigningInWith(null)
    }
  }

  // Loading splash — shown briefly while checking if user is already signed in
  if (checkingAuth) {
    return (
      <div className="min-h-screen bg-petrol-black flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-5xl brand-text mb-1">
            <span className="text-petrol-green">PETROL</span>
            <span className="inline-block bg-petrol-yellow text-petrol-black px-3 py-0.5 ml-1 -skew-x-6">GOONS</span>
          </h1>
          <p className="text-petrol-yellow text-sm tracking-[0.3em] font-semibold mt-3">TUNERSHOP</p>
          <div className="w-56 mx-auto mt-4 racing-stripe rounded-full overflow-hidden"></div>
          <div className="w-8 h-8 border-4 border-petrol-green border-t-transparent rounded-full animate-spin mx-auto mt-6"></div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-petrol-black">
      {/* Racing stripe top accent */}
      <div className="racing-stripe"></div>

      {/* Hero Section */}
      <div className="relative overflow-hidden">
        {/* Subtle green glow behind logo */}
        <div className="absolute top-10 left-1/2 -translate-x-1/2 w-80 h-80 bg-petrol-green opacity-[0.03] rounded-full blur-3xl"></div>

        <div className="relative max-w-lg mx-auto px-6 pt-12 pb-10">
          {/* Logo — matching the design team's logo exactly */}
          <div className="text-center mb-10">
            <h1 className="text-5xl sm:text-6xl brand-text mb-1">
              <span className="text-petrol-green">PETROL</span>
              <span className="inline-block bg-petrol-yellow text-petrol-black px-3 py-0.5 ml-1 -skew-x-6">GOONS</span>
            </h1>
            <p className="text-petrol-yellow text-sm tracking-[0.3em] font-semibold mt-2">TUNERSHOP</p>
            <div className="w-56 mx-auto mt-3 racing-stripe-diagonal rounded-sm overflow-hidden"></div>
          </div>

          {/* Headline */}
          <div className="text-center mb-10">
            <h2 className="text-3xl sm:text-4xl font-bold text-white leading-tight mb-3">
              Book your car service<br />
              <span className="text-petrol-green">in 30 seconds</span>
            </h2>
            <p className="text-gray-400 text-lg">
              No more showing up and waiting. Book ahead, we prep everything, you drive in and out.
            </p>
          </div>

          {/* Value Props — with racing stripe left borders */}
          <div className="grid grid-cols-1 gap-4 mb-10">
            <div className="flex items-center space-x-3 bg-white bg-opacity-5 rounded-xl p-5 border-l-4 border-petrol-green">
              <div className="w-12 h-12 bg-petrol-green bg-opacity-10 rounded-lg flex items-center justify-center flex-shrink-0">
                <svg className="w-6 h-6 text-petrol-green" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <div>
                <p className="text-white font-semibold text-base">Book Ahead, Skip the Wait</p>
                <p className="text-gray-400 text-sm">Pick your date and time — we&apos;ll be ready</p>
              </div>
            </div>

            <div className="flex items-center space-x-3 bg-white bg-opacity-5 rounded-xl p-5 border-l-4 border-petrol-yellow">
              <div className="w-12 h-12 bg-petrol-yellow bg-opacity-10 rounded-lg flex items-center justify-center flex-shrink-0">
                <svg className="w-6 h-6 text-petrol-yellow" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              </div>
              <div>
                <p className="text-white font-semibold text-base">Full Service History</p>
                <p className="text-gray-400 text-sm">Every service logged — never lose your car&apos;s records</p>
              </div>
            </div>

            <div className="flex items-center space-x-3 bg-white bg-opacity-5 rounded-xl p-5 border-l-4 border-stripe-cyan">
              <div className="w-12 h-12 bg-stripe-cyan bg-opacity-10 rounded-lg flex items-center justify-center flex-shrink-0">
                <svg className="w-6 h-6 text-stripe-cyan" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
              </div>
              <div>
                <p className="text-white font-semibold text-base">Show Us the Problem</p>
                <p className="text-gray-400 text-sm">Upload photos so mechanics can prep before you arrive</p>
              </div>
            </div>

            <div className="flex items-center space-x-3 bg-white bg-opacity-5 rounded-xl p-5 border-l-4 border-stripe-red">
              <div className="w-12 h-12 bg-stripe-red bg-opacity-10 rounded-lg flex items-center justify-center flex-shrink-0">
                <svg className="w-6 h-6 text-stripe-red" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <div>
                <p className="text-white font-semibold text-base">Pay After Service</p>
                <p className="text-gray-400 text-sm">No upfront payment — pay only when satisfied</p>
              </div>
            </div>
          </div>

          {/* Services Preview */}
          <div className="mb-10">
            <p className="text-gray-500 text-sm uppercase tracking-wider font-semibold mb-3 text-center">What we do</p>
            <div className="flex flex-wrap justify-center gap-2">
              {['Oil Change', 'Brake Pads', 'Suspension', 'Diagnostics', 'Tyres', 'Detailing', 'Body Kits', 'Air Filter'].map(service => (
                <span key={service} className="px-4 py-2 bg-white bg-opacity-5 rounded-full text-sm text-gray-300 border border-white border-opacity-10">
                  {service}
                </span>
              ))}
            </div>
          </div>

          {/* CTA Section */}
          <div className="space-y-3">
            {error && (
              <div className="bg-red-900 bg-opacity-50 border border-red-500 text-red-200 px-4 py-3 rounded-xl">
                <p className="text-base">{error}</p>
              </div>
            )}

            {/* Phone Auth Form */}
            {showPhoneForm ? (
              <div className="bg-white bg-opacity-5 rounded-xl p-4 border border-white border-opacity-10 space-y-3">
                {!otpSent ? (
                  <>
                    <label className="text-gray-400 text-sm">Enter your phone number</label>
                    <input
                      type="tel"
                      value={phoneNumber}
                      onChange={(e) => setPhoneNumber(e.target.value)}
                      placeholder="0712 345 678"
                      className="w-full px-4 py-3.5 bg-white bg-opacity-10 border border-white border-opacity-20 rounded-xl text-white text-lg placeholder-gray-500 outline-none focus:border-petrol-yellow"
                    />
                    <button
                      onClick={handlePhoneSendOtp}
                      disabled={isSigningIn}
                      className="w-full bg-petrol-green text-petrol-black font-bold py-3.5 rounded-xl disabled:opacity-50"
                    >
                      {signingInWith === 'phone' ? 'Sending code...' : 'Send verification code'}
                    </button>
                    <button onClick={() => { setShowPhoneForm(false); setError(null) }} className="w-full text-gray-500 text-sm py-2">
                      Back to other options
                    </button>
                  </>
                ) : (
                  <>
                    <label className="text-gray-400 text-sm">Enter the 6-digit code sent to {phoneNumber}</label>
                    <input
                      type="text"
                      value={otpCode}
                      onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                      placeholder="123456"
                      maxLength={6}
                      className="w-full px-4 py-3.5 bg-white bg-opacity-10 border border-white border-opacity-20 rounded-xl text-white text-center text-3xl tracking-widest placeholder-gray-500 outline-none focus:border-petrol-yellow"
                    />
                    <button
                      onClick={handlePhoneVerifyOtp}
                      disabled={isSigningIn || otpCode.length < 6}
                      className="w-full bg-petrol-green text-petrol-black font-bold py-3.5 rounded-xl disabled:opacity-50"
                    >
                      {signingInWith === 'phone' ? 'Verifying...' : 'Verify & Book'}
                    </button>
                    <button onClick={() => { setOtpSent(false); setOtpCode(''); setError(null) }} className="w-full text-gray-500 text-sm py-2">
                      Resend code
                    </button>
                  </>
                )}
              </div>
            ) : (
              <>
                {/* Google */}
                <button
                  onClick={() => handleSocialLogin('google')}
                  disabled={isSigningIn}
                  className="w-full bg-white rounded-xl py-4 flex items-center justify-center space-x-3 hover:bg-gray-100 transition-all disabled:opacity-50 active:scale-[0.98]"
                >
                  {signingInWith === 'google' ? (
                    <span className="w-5 h-5 border-2 border-gray-400 border-t-transparent rounded-full animate-spin"></span>
                  ) : (
                    <>
                      <svg className="w-5 h-5" viewBox="0 0 24 24">
                        <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                        <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                        <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                        <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                      </svg>
                      <span className="font-semibold text-base text-gray-800">Continue with Google</span>
                    </>
                  )}
                </button>

                {/* Facebook */}
                <button
                  onClick={() => handleSocialLogin('facebook')}
                  disabled={isSigningIn}
                  className="w-full bg-[#1877F2] rounded-xl py-4 flex items-center justify-center space-x-3 hover:bg-[#166FE5] transition-all disabled:opacity-50 active:scale-[0.98]"
                >
                  {signingInWith === 'facebook' ? (
                    <span className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
                  ) : (
                    <>
                      <svg className="w-5 h-5 text-white" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
                      </svg>
                      <span className="font-semibold text-base text-white">Continue with Facebook</span>
                    </>
                  )}
                </button>

                {/* Apple */}
                <button
                  onClick={() => handleSocialLogin('apple')}
                  disabled={isSigningIn}
                  className="w-full bg-white bg-opacity-10 border border-white border-opacity-20 rounded-xl py-4 flex items-center justify-center space-x-3 hover:bg-opacity-15 transition-all disabled:opacity-50 active:scale-[0.98]"
                >
                  {signingInWith === 'apple' ? (
                    <span className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
                  ) : (
                    <>
                      <svg className="w-5 h-5 text-white" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M17.05 20.28c-.98.95-2.05.88-3.08.4-1.09-.5-2.08-.48-3.24 0-1.44.62-2.2.44-3.06-.4C2.79 15.25 3.51 7.59 9.05 7.31c1.35.07 2.29.74 3.08.8 1.18-.24 2.31-.93 3.57-.84 1.51.12 2.65.72 3.4 1.8-3.12 1.87-2.38 5.98.48 7.13-.57 1.5-1.31 2.99-2.54 4.09zM12.03 7.25c-.15-2.23 1.66-4.07 3.74-4.25.29 2.58-2.34 4.5-3.74 4.25z"/>
                      </svg>
                      <span className="font-semibold text-base text-white">Continue with Apple</span>
                    </>
                  )}
                </button>

                {/* Phone */}
                <button
                  onClick={() => setShowPhoneForm(true)}
                  disabled={isSigningIn}
                  className="w-full bg-white bg-opacity-10 border border-white border-opacity-20 rounded-xl py-4 flex items-center justify-center space-x-3 hover:bg-opacity-15 transition-all disabled:opacity-50 active:scale-[0.98]"
                >
                  <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                  </svg>
                  <span className="font-semibold text-base text-white">Continue with Phone</span>
                </button>
              </>
            )}

            {/* reCAPTCHA container (invisible) */}
            <div ref={recaptchaRef}></div>

            <p className="text-center text-sm text-gray-600 pt-1">
              Sign in to book your appointment. It takes 30 seconds.
            </p>
          </div>

          {/* Hours & Location */}
          <div className="mt-10 pt-6 border-t border-white border-opacity-5">
            <div className="grid grid-cols-2 gap-6 text-center">
              <div>
                <p className="text-gray-500 text-sm uppercase tracking-wider font-semibold mb-2">Hours</p>
                <p className="text-white text-base font-medium">Mon — Sat</p>
                <p className="text-gray-400 text-base">8:00 AM — 6:00 PM</p>
                <p className="text-gray-600 text-sm mt-1">Closed Sundays</p>
              </div>
              <div>
                <p className="text-gray-500 text-sm uppercase tracking-wider font-semibold mb-2">Follow Us</p>
                <a
                  href="https://instagram.com/petrol_goons"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center space-x-1 text-petrol-green hover:text-green-300 transition-colors text-base font-medium"
                >
                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z"/>
                  </svg>
                  <span>@petrol_goons</span>
                </a>
                <p className="text-gray-600 text-sm mt-2">DM us anytime</p>
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="text-center mt-8 pb-6">
            <div className="w-full racing-stripe mb-6 rounded-full overflow-hidden"></div>
            <p className="text-gray-700 text-sm">
              &copy; 2026 Petrol Goons Tunershop. Built for Kenya&apos;s car community.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
