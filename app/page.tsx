'use client'

import { useState, useEffect } from 'react'
import {
  onAuthStateChanged,
  getRedirectResult,
} from 'firebase/auth'

// Service data with details for interactive chips
const SERVICES = [
  { name: 'Oil Change', icon: '🛢️', from: 'KES 3,500', time: '~45 min', includes: 'Oil drain, new filter, top-up, inspection' },
  { name: 'Brake Pads', icon: '🔧', from: 'KES 5,000', time: '~1.5 hrs', includes: 'Pad replacement, rotor check, brake fluid top-up' },
  { name: 'Suspension', icon: '⚙️', from: 'KES 8,000', time: '~2 hrs', includes: 'Shock absorbers, bushings, alignment check' },
  { name: 'Diagnostics', icon: '💻', from: 'KES 2,500', time: '~30 min', includes: 'OBD scan, error codes, system health report' },
  { name: 'Tyres', icon: '🔘', from: 'KES 4,000', time: '~1 hr', includes: 'Tyre fitting, balancing, pressure check, rotation' },
  { name: 'Detailing', icon: '✨', from: 'KES 3,000', time: '~2 hrs', includes: 'Full wash, interior clean, polish, wax' },
  { name: 'Body Kits', icon: '🏎️', from: 'KES 15,000', time: 'Varies', includes: 'Fitment, paint matching, installation' },
  { name: 'Air Filter', icon: '💨', from: 'KES 1,500', time: '~20 min', includes: 'Air filter replacement, housing clean' },
]

export default function LandingPage() {
  const [checkingAuth, setCheckingAuth] = useState(true)
  const [expandedService, setExpandedService] = useState<string | null>(null)

  const goToBooking = () => {
    window.location.href = '/book'
  }

  // Check auth state — if already logged in, redirect to booking
  useEffect(() => {
    let cancelled = false
    let unsubscribe: (() => void) | undefined

    const forceReady = setTimeout(() => {
      if (!cancelled) setCheckingAuth(false)
    }, 2000)

    const init = async () => {
      try {
        const { auth } = await import('@/lib/firebase')
        if (!auth) { setCheckingAuth(false); return }

        unsubscribe = onAuthStateChanged(auth, () => {
          if (cancelled) return
          setCheckingAuth(false)
        })

        try {
          await Promise.race([
            getRedirectResult(auth),
            new Promise<null>((r) => setTimeout(() => r(null), 3000)),
          ])
          if (!cancelled) setCheckingAuth(false)
        } catch {
          // Redirect check failed — fine
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

  // Always go straight to booking form — login happens there after form is filled
  const handleBookNow = () => {
    goToBooking()
  }

  // Loading splash
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

      <div className="relative overflow-hidden">
        {/* Subtle green glow */}
        <div className="absolute top-10 left-1/2 -translate-x-1/2 w-80 h-80 bg-petrol-green opacity-[0.03] rounded-full blur-3xl"></div>

        <div className="relative max-w-lg mx-auto px-6 pt-12 pb-10">

          {/* ===== LOGO ===== */}
          <div className="text-center mb-8">
            <h1 className="text-5xl sm:text-6xl brand-text mb-1">
              <span className="text-petrol-green">PETROL</span>
              <span className="inline-block bg-petrol-yellow text-petrol-black px-3 py-0.5 ml-1 -skew-x-6">GOONS</span>
            </h1>
            <p className="text-petrol-yellow text-sm tracking-[0.3em] font-semibold mt-2">TUNERSHOP</p>
            <div className="w-56 mx-auto mt-3 racing-stripe-diagonal rounded-sm overflow-hidden"></div>
          </div>

          {/* ===== HERO SECTION ===== */}
          <div className="text-center mb-8">
            <h2 className="text-3xl sm:text-4xl font-bold text-white leading-tight mb-3">
              Kenya&apos;s Smart<br />
              <span className="text-petrol-green">Garage Experience</span>
            </h2>
            <p className="text-gray-400 text-lg leading-relaxed mb-2">
              Book. Track. Approve. Drive.
            </p>
            <p className="text-gray-500 text-base">
              No waiting. No surprises. No upfront payment.<br />
              Just transparent, tech-powered car care.
            </p>
          </div>

          {/* ===== PRIMARY CTA ===== */}
          <div className="mb-10 space-y-3">
            <button
              onClick={handleBookNow}
              className="w-full bg-petrol-green text-petrol-black font-bold py-5 rounded-xl hover:brightness-110 transition-all text-xl shadow-lg hover:shadow-xl active:scale-[0.98]"
            >
              Book Your Service
            </button>
            <button
              onClick={() => {
                document.getElementById('how-it-works')?.scrollIntoView({ behavior: 'smooth' })
              }}
              className="w-full bg-white bg-opacity-5 border border-white border-opacity-15 text-white font-medium py-4 rounded-xl hover:bg-opacity-10 transition-all text-base active:scale-[0.98]"
            >
              See How It Works
            </button>
          </div>

          {/* ===== TRUST STRIP ===== */}
          <div className="bg-white bg-opacity-[0.04] rounded-2xl p-5 mb-12 border border-white border-opacity-5">
            <div className="grid grid-cols-2 gap-4 text-center">
              <div className="flex flex-col items-center">
                <div className="text-petrol-yellow text-lg mb-0.5">★★★★★</div>
                <p className="text-white text-sm font-semibold">Top Rated</p>
                <p className="text-gray-500 text-xs">Nairobi Drivers</p>
              </div>
              <div className="flex flex-col items-center">
                <div className="text-petrol-green text-lg font-bold mb-0.5">✓</div>
                <p className="text-white text-sm font-semibold">Certified Technicians</p>
                <p className="text-gray-500 text-xs">Trained Mechanics</p>
              </div>
              <div className="flex flex-col items-center">
                <div className="text-petrol-yellow text-lg font-bold mb-0.5">🔒</div>
                <p className="text-white text-sm font-semibold">Pay After Service</p>
                <p className="text-gray-500 text-xs">Zero Risk</p>
              </div>
              <div className="flex flex-col items-center">
                <div className="text-stripe-cyan text-lg font-bold mb-0.5">📱</div>
                <p className="text-white text-sm font-semibold">Digital Records</p>
                <p className="text-gray-500 text-xs">Full History</p>
              </div>
            </div>
          </div>

          {/* ===== HOW IT WORKS ===== */}
          <div id="how-it-works" className="mb-12">
            <p className="text-gray-500 text-sm uppercase tracking-wider font-semibold mb-6 text-center">How It Works</p>

            <div className="space-y-4">
              {/* Step 1 */}
              <div className="flex items-start space-x-4">
                <div className="w-12 h-12 bg-petrol-green rounded-xl flex items-center justify-center flex-shrink-0 shadow-lg">
                  <span className="text-petrol-black font-black text-xl">1</span>
                </div>
                <div className="pt-1">
                  <p className="text-white font-bold text-lg">Book in 30 Seconds</p>
                  <p className="text-gray-400 text-sm">Pick your service, date, and preferred mechanic</p>
                </div>
              </div>

              {/* Connector line */}
              <div className="ml-6 w-[1px] h-4 bg-gradient-to-b from-petrol-green to-petrol-yellow"></div>

              {/* Step 2 */}
              <div className="flex items-start space-x-4">
                <div className="w-12 h-12 bg-petrol-yellow rounded-xl flex items-center justify-center flex-shrink-0 shadow-lg">
                  <span className="text-petrol-black font-black text-xl">2</span>
                </div>
                <div className="pt-1">
                  <p className="text-white font-bold text-lg">We Prepare Before You Arrive</p>
                  <p className="text-gray-400 text-sm">Parts sourced, tools ready, mechanic briefed on your car</p>
                </div>
              </div>

              {/* Connector line */}
              <div className="ml-6 w-[1px] h-4 bg-gradient-to-b from-petrol-yellow to-stripe-cyan"></div>

              {/* Step 3 */}
              <div className="flex items-start space-x-4">
                <div className="w-12 h-12 bg-stripe-cyan rounded-xl flex items-center justify-center flex-shrink-0 shadow-lg">
                  <span className="text-petrol-black font-black text-xl">3</span>
                </div>
                <div className="pt-1">
                  <p className="text-white font-bold text-lg">Drive In & Out — Pay After</p>
                  <p className="text-gray-400 text-sm">No surprises. Service logged digitally. Pay only when satisfied.</p>
                </div>
              </div>
            </div>
          </div>

          {/* ===== WHY DRIVERS CHOOSE US (Outcome-focused) ===== */}
          <div className="mb-12">
            <p className="text-gray-500 text-sm uppercase tracking-wider font-semibold mb-6 text-center">Why Drivers Choose Petrol Goons</p>

            <div className="grid grid-cols-1 gap-3">
              <div className="flex items-center space-x-3 bg-white bg-opacity-5 rounded-xl p-5 border-l-4 border-petrol-green">
                <div className="w-12 h-12 bg-petrol-green bg-opacity-10 rounded-lg flex items-center justify-center flex-shrink-0">
                  <svg className="w-6 h-6 text-petrol-green" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <div>
                  <p className="text-white font-semibold text-base">Skip the Wait, Save Your Time</p>
                  <p className="text-gray-400 text-sm">Book your slot — no more sitting in a queue all morning</p>
                </div>
              </div>

              <div className="flex items-center space-x-3 bg-white bg-opacity-5 rounded-xl p-5 border-l-4 border-petrol-yellow">
                <div className="w-12 h-12 bg-petrol-yellow bg-opacity-10 rounded-lg flex items-center justify-center flex-shrink-0">
                  <svg className="w-6 h-6 text-petrol-yellow" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                </div>
                <div>
                  <p className="text-white font-semibold text-base">Never Lose Your Car&apos;s Records</p>
                  <p className="text-gray-400 text-sm">Every service logged digitally — access your history anytime</p>
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
                  <p className="text-white font-semibold text-base">Get Faster Diagnostics</p>
                  <p className="text-gray-400 text-sm">Upload photos of issues — mechanics prep before you arrive</p>
                </div>
              </div>

              <div className="flex items-center space-x-3 bg-white bg-opacity-5 rounded-xl p-5 border-l-4 border-petrol-green">
                <div className="w-12 h-12 bg-petrol-green bg-opacity-10 rounded-lg flex items-center justify-center flex-shrink-0">
                  <svg className="w-6 h-6 text-petrol-green" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                  </svg>
                </div>
                <div>
                  <p className="text-white font-semibold text-base">Zero Risk — Pay After Service</p>
                  <p className="text-gray-400 text-sm">No deposits, no surprises. Pay only when you&apos;re satisfied</p>
                </div>
              </div>
            </div>
          </div>

          {/* ===== PAY AFTER SERVICE HERO BADGE ===== */}
          <div className="mb-12 bg-gradient-to-br from-petrol-green/20 to-petrol-green/5 border-2 border-petrol-green/30 rounded-2xl p-6 text-center">
            <div className="w-16 h-16 bg-petrol-green rounded-full flex items-center justify-center mx-auto mb-3">
              <svg className="w-8 h-8 text-petrol-black" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
              </svg>
            </div>
            <h3 className="text-white text-xl font-bold mb-1">Pay Only When Satisfied</h3>
            <p className="text-gray-400 text-base">
              We never ask for deposits or upfront payment.<br />
              You pay after the work is done and you&apos;re happy with it.
            </p>
          </div>

          {/* ===== INTERACTIVE SERVICES ===== */}
          <div className="mb-12">
            <p className="text-gray-500 text-sm uppercase tracking-wider font-semibold mb-2 text-center">Our Services</p>
            <p className="text-gray-600 text-sm text-center mb-6">Tap any service for details and pricing</p>

            <div className="grid grid-cols-2 gap-2.5">
              {SERVICES.map(service => (
                <button
                  key={service.name}
                  onClick={() => setExpandedService(expandedService === service.name ? null : service.name)}
                  className={`text-left rounded-xl p-4 transition-all border ${
                    expandedService === service.name
                      ? 'bg-petrol-yellow/10 border-petrol-yellow/40 col-span-2'
                      : 'bg-white bg-opacity-5 border-white border-opacity-10 hover:border-opacity-25'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      <span className="text-xl">{service.icon}</span>
                      <span className="text-white font-medium text-sm">{service.name}</span>
                    </div>
                    {expandedService !== service.name && (
                      <span className="text-petrol-yellow text-xs font-medium">From {service.from}</span>
                    )}
                  </div>

                  {/* Expanded details */}
                  {expandedService === service.name && (
                    <div className="mt-3 pt-3 border-t border-white border-opacity-10 space-y-2">
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-400">Starting from</span>
                        <span className="text-petrol-yellow font-bold">{service.from}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-400">Estimated time</span>
                        <span className="text-white">{service.time}</span>
                      </div>
                      <div className="text-sm">
                        <span className="text-gray-400">Includes: </span>
                        <span className="text-gray-300">{service.includes}</span>
                      </div>
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          handleBookNow()
                        }}
                        className="w-full mt-2 bg-petrol-green text-petrol-black font-bold py-3 rounded-lg text-sm hover:brightness-110 transition-all active:scale-[0.98]"
                      >
                        Book {service.name}
                      </button>
                    </div>
                  )}
                </button>
              ))}
            </div>
          </div>

          {/* ===== SECOND CTA ===== */}
          <div className="mb-12">
            <button
              onClick={handleBookNow}
              className="w-full bg-petrol-green text-petrol-black font-bold py-5 rounded-xl hover:brightness-110 transition-all text-xl shadow-lg hover:shadow-xl active:scale-[0.98]"
            >
              Book Your Service Now
            </button>
          </div>

          {/* ===== HOURS & LOCATION ===== */}
          <div className="pt-6 border-t border-white border-opacity-5">
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

          {/* ===== FOOTER ===== */}
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
