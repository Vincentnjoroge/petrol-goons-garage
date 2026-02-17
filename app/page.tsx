'use client'

import { useState, useEffect } from 'react'
import {
  onAuthStateChanged,
  getRedirectResult,
} from 'firebase/auth'

// Pricing plans
const PLANS = [
  {
    name: 'Starter',
    price: 'KES 4,999',
    period: '/month',
    badge: null,
    description: 'Perfect for small garages getting started',
    features: [
      'Digital booking system',
      'Basic dashboard',
      'Service logging',
      'Customer records',
      'Up to 2 staff accounts',
    ],
    cta: 'See Live Demo',
    highlight: false,
  },
  {
    name: 'Growth',
    price: 'KES 9,999',
    period: '/month',
    badge: 'Most Popular',
    description: 'For busy urban garages ready to scale',
    features: [
      'Everything in Starter',
      'Full analytics & reports',
      'Multi-mechanic tracking',
      'Customer notifications',
      'Branded booking page',
      'Photo diagnostics uploads',
    ],
    cta: 'See Live Demo',
    highlight: true,
  },
  {
    name: 'Performance',
    price: 'Custom',
    period: '',
    badge: null,
    description: 'For chains & premium workshops',
    features: [
      'Everything in Growth',
      'Multi-branch support',
      'Advanced analytics',
      'API integrations',
      'Priority support',
      'Custom branding',
    ],
    cta: 'Contact Us',
    highlight: false,
  },
]

export default function LandingPage() {
  const [checkingAuth, setCheckingAuth] = useState(true)
  const goToDemo = () => {
    window.location.href = '/book'
  }

  // Check auth state
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

  // Loading splash
  if (checkingAuth) {
    return (
      <div className="min-h-screen bg-petrol-black flex items-center justify-center px-10">
        <div className="text-center w-full max-w-xs">
          <h1 className="text-4xl sm:text-5xl brand-text mb-1 whitespace-nowrap">
            <span className="text-petrol-green">PETROL</span>{' '}
            <span className="inline-block bg-petrol-yellow text-petrol-black px-3 py-0.5 -skew-x-6">GOONS</span>
          </h1>
          <div className="w-40 mx-auto mt-5 racing-stripe-diagonal rounded-sm overflow-hidden"></div>
          <div className="w-8 h-8 border-4 border-petrol-green border-t-transparent rounded-full animate-spin mx-auto mt-6"></div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-petrol-black">
      <div className="relative overflow-hidden">
        {/* Subtle green glow */}
        <div className="absolute top-10 left-1/2 -translate-x-1/2 w-80 h-80 bg-petrol-green opacity-[0.03] rounded-full blur-3xl"></div>

        <div className="relative max-w-lg mx-auto px-6 pt-10 pb-10">

          {/* ===== LOGO ===== */}
          <div className="text-center mb-10">
            <h1 className="text-4xl sm:text-5xl brand-text mb-2 whitespace-nowrap">
              <span className="text-petrol-green">PETROL</span>{' '}
              <span className="inline-block bg-petrol-yellow text-petrol-black px-3 py-0.5 -skew-x-6">GOONS</span>
            </h1>
            <p className="text-gray-500 text-sm tracking-[0.2em] font-medium uppercase mt-1">OS</p>
            <div className="w-40 mx-auto mt-3 racing-stripe-diagonal rounded-sm overflow-hidden"></div>
          </div>

          {/* ===== HERO SECTION ===== */}
          <div className="text-center mb-10">
            <h2 className="text-3xl sm:text-4xl font-bold text-white leading-tight mb-4">
              Run Your Garage Like a<br />
              <span className="text-petrol-green">Performance Machine</span>
            </h2>
            <p className="text-gray-400 text-lg leading-relaxed mb-2">
              Manage bookings, track jobs, store records, and increase revenue — all in one platform.
            </p>
            <p className="text-gray-600 text-sm">
              Built for Kenya&apos;s next generation of garages.
            </p>
          </div>

          {/* ===== PRIMARY CTA ===== */}
          <div className="mb-12 space-y-3">
            <button
              onClick={goToDemo}
              className="w-full bg-petrol-green text-petrol-black font-bold py-5 rounded-xl hover:brightness-110 transition-all text-xl shadow-[0_0_20px_rgba(57,255,20,0.15)] hover:shadow-[0_0_30px_rgba(57,255,20,0.25)] active:scale-[0.96]"
            >
              See Live Demo
            </button>
            <button
              onClick={() => {
                document.getElementById('the-problem')?.scrollIntoView({ behavior: 'smooth' })
              }}
              className="w-full bg-transparent border border-white border-opacity-10 text-gray-400 font-medium py-3.5 rounded-xl hover:bg-white hover:bg-opacity-5 transition-all text-sm active:scale-[0.98]"
            >
              See How It Works
            </button>
          </div>

          {/* Speed line divider */}
          <div className="speed-line mb-14"></div>

          {/* ===== THE PROBLEM ===== */}
          <div id="the-problem" className="mb-14">
            <p className="text-gray-500 text-sm uppercase tracking-wider font-semibold mb-3 text-center">The Problem</p>
            <h3 className="text-2xl font-bold text-white text-center mb-8">
              Most garages in Kenya are still running on chaos
            </h3>

            <div className="space-y-3">
              {[
                { icon: '📋', text: 'Paper records that get lost or destroyed' },
                { icon: '🔄', text: 'No structured booking — customers just walk in' },
                { icon: '📉', text: 'Customer history lost between visits' },
                { icon: '💸', text: 'Payment disputes with no documentation' },
                { icon: '👋', text: 'Repeat business lost — customers forget you exist' },
              ].map((item, i) => (
                <div key={i} className="flex items-center space-x-3 bg-white bg-opacity-5 rounded-xl p-4 border border-white border-opacity-5">
                  <span className="text-xl flex-shrink-0">{item.icon}</span>
                  <p className="text-gray-300 text-base">{item.text}</p>
                </div>
              ))}
            </div>

            <p className="text-center text-petrol-yellow font-semibold text-lg mt-8">
              That chaos costs you money every single day.
            </p>
          </div>

          {/* Speed line divider */}
          <div className="speed-line mb-14"></div>

          {/* ===== THE SOLUTION ===== */}
          <div className="mb-14">
            <p className="text-gray-500 text-sm uppercase tracking-wider font-semibold mb-3 text-center">The Solution</p>
            <h3 className="text-2xl font-bold text-white text-center mb-8">
              Petrol Goons OS gives you
            </h3>

            <div className="space-y-4">
              {/* Solution 1 */}
              <div className="bg-white bg-opacity-5 rounded-2xl p-6 border border-white border-opacity-5">
                <div className="flex items-center space-x-3 mb-3">
                  <div className="w-10 h-10 bg-petrol-green rounded-lg flex items-center justify-center flex-shrink-0">
                    <span className="text-petrol-black font-black text-lg">1</span>
                  </div>
                  <h4 className="text-white font-bold text-lg">Digital Booking System</h4>
                </div>
                <p className="text-gray-400 text-base pl-[52px]">
                  Customers book before arrival. You prepare before they arrive. No more walk-in chaos.
                </p>
              </div>

              {/* Solution 2 */}
              <div className="bg-white bg-opacity-5 rounded-2xl p-6 border border-white border-opacity-5">
                <div className="flex items-center space-x-3 mb-3">
                  <div className="w-10 h-10 bg-petrol-yellow rounded-lg flex items-center justify-center flex-shrink-0">
                    <span className="text-petrol-black font-black text-lg">2</span>
                  </div>
                  <h4 className="text-white font-bold text-lg">Job Tracking Dashboard</h4>
                </div>
                <p className="text-gray-400 text-base pl-[52px]">
                  See active cars, completed jobs, pending approvals, and revenue — all in one view.
                </p>
              </div>

              {/* Solution 3 */}
              <div className="bg-white bg-opacity-5 rounded-2xl p-6 border border-white border-opacity-5">
                <div className="flex items-center space-x-3 mb-3">
                  <div className="w-10 h-10 bg-stripe-cyan rounded-lg flex items-center justify-center flex-shrink-0">
                    <span className="text-petrol-black font-black text-lg">3</span>
                  </div>
                  <h4 className="text-white font-bold text-lg">Customer History &amp; Records</h4>
                </div>
                <p className="text-gray-400 text-base pl-[52px]">
                  Every service logged. Every part recorded. Every visit tracked. Nothing gets lost.
                </p>
              </div>

              {/* Solution 4 */}
              <div className="bg-white bg-opacity-5 rounded-2xl p-6 border border-white border-opacity-5">
                <div className="flex items-center space-x-3 mb-3">
                  <div className="w-10 h-10 bg-petrol-green rounded-lg flex items-center justify-center flex-shrink-0">
                    <span className="text-petrol-black font-black text-lg">4</span>
                  </div>
                  <h4 className="text-white font-bold text-lg">Pay-After-Service Model</h4>
                </div>
                <p className="text-gray-400 text-base pl-[52px]">
                  Build trust with customers. Increase conversions. Reduce payment friction.
                </p>
              </div>
            </div>
          </div>

          {/* Speed line divider */}
          <div className="speed-line mb-14"></div>

          {/* ===== BENEFITS ===== */}
          <div className="mb-14">
            <p className="text-gray-500 text-sm uppercase tracking-wider font-semibold mb-3 text-center">Why Garage Owners Choose Us</p>
            <h3 className="text-2xl font-bold text-white text-center mb-8">
              This is not software.<br />
              <span className="text-petrol-green">This is competitive advantage.</span>
            </h3>

            <div className="grid grid-cols-2 gap-3">
              {[
                { icon: '📈', label: 'More structured bookings' },
                { icon: '⚡', label: 'Faster diagnostics' },
                { icon: '🔁', label: 'More repeat customers' },
                { icon: '✨', label: 'Premium brand perception' },
                { icon: '💰', label: 'Transparent pricing' },
                { icon: '🏆', label: 'Digital reputation' },
              ].map((item, i) => (
                <div key={i} className="flex items-center space-x-2.5 bg-white bg-opacity-5 rounded-xl p-4 border border-white border-opacity-5 service-card">
                  <span className="text-lg flex-shrink-0">{item.icon}</span>
                  <p className="text-white text-sm font-medium">{item.label}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Speed line divider */}
          <div className="speed-line mb-14"></div>

          {/* ===== POWERED BY ===== */}
          <div className="mb-14 bg-gradient-to-br from-petrol-green/20 to-petrol-green/5 border-2 border-petrol-green/30 rounded-2xl p-7 text-center">
            <p className="text-gray-400 text-sm uppercase tracking-wider font-semibold mb-3">Your Garage Becomes</p>
            <h3 className="text-white text-2xl font-bold mb-2">
              XYZ Garage
            </h3>
            <p className="text-petrol-green text-sm font-semibold tracking-wider uppercase">
              Powered by Petrol Goons
            </p>
            <p className="text-gray-400 text-base mt-4">
              Look like a premium, tech-driven garage without building anything yourself.
            </p>
          </div>

          {/* Speed line divider */}
          <div className="speed-line mb-14"></div>

          {/* ===== PRICING ===== */}
          <div className="mb-14">
            <p className="text-gray-500 text-sm uppercase tracking-wider font-semibold mb-3 text-center">Pricing</p>
            <h3 className="text-2xl font-bold text-white text-center mb-8">
              Start small. Scale when ready.
            </h3>

            <div className="space-y-4">
              {PLANS.map((plan, i) => (
                <div
                  key={i}
                  className={`rounded-2xl p-6 border-2 transition-all ${
                    plan.highlight
                      ? 'border-petrol-green bg-petrol-green/5'
                      : 'border-white border-opacity-10 bg-white bg-opacity-[0.03]'
                  }`}
                >
                  {plan.badge && (
                    <span className="inline-block bg-petrol-green text-petrol-black text-xs font-bold px-3 py-1 rounded-full mb-3 uppercase tracking-wider">
                      {plan.badge}
                    </span>
                  )}
                  <div className="flex items-baseline space-x-1 mb-1">
                    <span className="text-white text-3xl font-bold">{plan.price}</span>
                    {plan.period && <span className="text-gray-500 text-base">{plan.period}</span>}
                  </div>
                  <p className="text-petrol-yellow font-semibold text-lg mb-1">{plan.name}</p>
                  <p className="text-gray-400 text-sm mb-4">{plan.description}</p>

                  <ul className="space-y-2 mb-5">
                    {plan.features.map((feature, j) => (
                      <li key={j} className="flex items-center space-x-2">
                        <svg className="w-4 h-4 text-petrol-green flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                        </svg>
                        <span className="text-gray-300 text-sm">{feature}</span>
                      </li>
                    ))}
                  </ul>

                  <button
                    onClick={plan.name === 'Performance' ? () => window.open('https://instagram.com/petrol_goons', '_blank') : goToDemo}
                    className={`w-full font-bold py-3.5 rounded-xl transition-all active:scale-[0.97] text-base ${
                      plan.highlight
                        ? 'bg-petrol-green text-petrol-black hover:brightness-110 shadow-[0_0_15px_rgba(57,255,20,0.15)]'
                        : 'bg-white bg-opacity-10 text-white hover:bg-opacity-15'
                    }`}
                  >
                    {plan.cta}
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* Speed line divider */}
          <div className="speed-line mb-14"></div>

          {/* ===== DEMO CTA ===== */}
          <div className="mb-14 text-center">
            <h3 className="text-2xl font-bold text-white mb-3">
              See it in action
            </h3>
            <p className="text-gray-400 text-base mb-6">
              Try the live booking system your customers would use. No signup needed.
            </p>
            <button
              onClick={goToDemo}
              className="w-full bg-petrol-green text-petrol-black font-bold py-5 rounded-xl hover:brightness-110 transition-all text-xl shadow-[0_0_20px_rgba(57,255,20,0.15)] hover:shadow-[0_0_30px_rgba(57,255,20,0.25)] active:scale-[0.96]"
            >
              Try Live Demo
            </button>
          </div>

          {/* ===== HOURS & CONTACT ===== */}
          <div className="pt-8 border-t border-white border-opacity-5">
            <div className="text-center">
              <p className="text-gray-500 text-sm uppercase tracking-wider font-semibold mb-3">Get In Touch</p>
              <a
                href="https://instagram.com/petrol_goons"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center space-x-2 text-petrol-green hover:text-green-300 transition-colors text-lg font-medium"
              >
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z"/>
                </svg>
                <span>@petrol_goons</span>
              </a>
              <p className="text-gray-600 text-sm mt-2">DM us to get started or ask questions</p>
            </div>
          </div>

          {/* ===== FOOTER ===== */}
          <div className="text-center mt-10 pb-8">
            <div className="w-full racing-stripe-diagonal mb-6 rounded-sm overflow-hidden"></div>
            <p className="text-gray-700 text-sm">
              &copy; 2026 Petrol Goons OS. Powering Kenya&apos;s modern garages.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
