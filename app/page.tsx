'use client'

import { useState, useEffect, useRef } from 'react'
import {
  onAuthStateChanged,
  getRedirectResult,
} from 'firebase/auth'

// Service data for customer view
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

// Pricing plans for garage owner view
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

// 3D Fuel pump toggle component
function FuelPumpToggle({ isGarage, onToggle }: { isGarage: boolean; onToggle: () => void }) {
  const [justToggled, setJustToggled] = useState(false)
  const [dripActive, setDripActive] = useState(false)

  const handleToggle = () => {
    setJustToggled(true)
    setDripActive(true)
    onToggle()
    // Reset bounce
    setTimeout(() => setJustToggled(false), 400)
    // Reset drip
    setTimeout(() => setDripActive(false), 800)
  }

  return (
    <div className="flex flex-col items-center justify-center mb-10">
      {/* Toggle container with 3D perspective */}
      <div
        className="toggle-3d-container bg-white/[0.06] rounded-2xl p-3 border border-white/10 flex items-center space-x-3"
        style={{ perspective: '600px' }}
      >
        {/* Customer label */}
        <button
          onClick={() => isGarage && handleToggle()}
          className={`text-sm font-semibold px-3 py-1.5 rounded-lg transition-all duration-300 ${
            !isGarage
              ? 'text-petrol-green bg-petrol-green/10'
              : 'text-gray-500 hover:text-gray-400'
          }`}
        >
          <span className="flex items-center space-x-1.5">
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>
            <span>I need a service</span>
          </span>
        </button>

        {/* 3D Toggle track */}
        <button
          onClick={handleToggle}
          className={`toggle-track relative w-[76px] h-10 rounded-full focus:outline-none transition-all duration-500 ${
            justToggled ? 'toggle-bounce' : ''
          }`}
          style={{
            background: 'linear-gradient(180deg, #0A0A0A 0%, #1a1a1a 100%)',
            boxShadow: isGarage
              ? '0 0 20px rgba(253,185,19,0.2), inset 0 2px 4px rgba(0,0,0,0.6), inset 0 -1px 2px rgba(255,255,255,0.05)'
              : '0 0 20px rgba(57,255,20,0.2), inset 0 2px 4px rgba(0,0,0,0.6), inset 0 -1px 2px rgba(255,255,255,0.05)',
            border: `2px solid ${isGarage ? 'rgba(253,185,19,0.5)' : 'rgba(57,255,20,0.5)'}`,
          }}
          aria-label="Toggle between customer and garage owner view"
        >
          {/* Track inner glow */}
          <div
            className="absolute inset-1 rounded-full transition-all duration-500"
            style={{
              background: isGarage
                ? 'linear-gradient(90deg, transparent 20%, rgba(253,185,19,0.08) 100%)'
                : 'linear-gradient(90deg, rgba(57,255,20,0.08) 0%, transparent 80%)',
            }}
          />

          {/* Track markers */}
          <div className="absolute inset-0 flex items-center justify-between px-3 pointer-events-none">
            <div className={`w-1.5 h-1.5 rounded-full transition-all duration-300 ${!isGarage ? 'bg-petrol-green/50 scale-0' : 'bg-white/10 scale-100'}`} />
            <div className={`w-1.5 h-1.5 rounded-full transition-all duration-300 ${isGarage ? 'bg-petrol-yellow/50 scale-0' : 'bg-white/10 scale-100'}`} />
          </div>

          {/* 3D Fuel pump knob */}
          <div
            className={`absolute top-[3px] w-8 h-8 rounded-full flex items-center justify-center transition-all duration-400 ease-[cubic-bezier(0.34,1.56,0.64,1)] ${
              isGarage ? 'left-[calc(100%-35px)]' : 'left-[3px]'
            }`}
            style={{
              background: isGarage
                ? 'linear-gradient(145deg, #FDB913, #e5a711)'
                : 'linear-gradient(145deg, #39FF14, #2ecc0f)',
              boxShadow: isGarage
                ? '0 2px 8px rgba(253,185,19,0.5), 0 0 16px rgba(253,185,19,0.2), inset 0 1px 1px rgba(255,255,255,0.3), inset 0 -1px 1px rgba(0,0,0,0.2)'
                : '0 2px 8px rgba(57,255,20,0.5), 0 0 16px rgba(57,255,20,0.2), inset 0 1px 1px rgba(255,255,255,0.3), inset 0 -1px 1px rgba(0,0,0,0.2)',
              transform: justToggled ? 'scale(1.15)' : 'scale(1)',
            }}
          >
            {/* Fuel pump SVG with rotation */}
            <svg
              className="w-4 h-4 transition-transform duration-500"
              style={{ transform: isGarage ? 'rotate(0deg)' : 'rotate(-15deg)' }}
              viewBox="0 0 24 24"
              fill="currentColor"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path d="M19.77 7.23l.01-.01-3.72-3.72L15 4.56l2.11 2.11c-.94.36-1.61 1.26-1.61 2.33 0 1.38 1.12 2.5 2.5 2.5.36 0 .69-.08 1-.21v7.21c0 .55-.45 1-1 1s-1-.45-1-1V14c0-1.1-.9-2-2-2h-1V5c0-1.1-.9-2-2-2H6c-1.1 0-2 .9-2 2v16h10v-7.5h1.5v5c0 1.38 1.12 2.5 2.5 2.5s2.5-1.12 2.5-2.5V9c0-.69-.28-1.32-.73-1.77zM12 13.5V19H6v-7h6v1.5zm0-3.5H6V5h6v5z" fill="#0A0A0A"/>
            </svg>

            {/* Pulse ring */}
            <div
              className={`absolute inset-0 rounded-full transition-opacity duration-300 ${justToggled ? 'toggle-pulse' : 'opacity-0'}`}
              style={{
                border: `2px solid ${isGarage ? '#FDB913' : '#39FF14'}`,
              }}
            />
          </div>

          {/* Fuel drip animation */}
          {dripActive && (
            <div
              className="fuel-drip absolute"
              style={{
                left: isGarage ? 'calc(100% - 22px)' : '14px',
                bottom: '-4px',
                width: '4px',
                height: '4px',
                borderRadius: '50% 50% 50% 0',
                transform: 'rotate(45deg)',
                background: isGarage ? '#FDB913' : '#39FF14',
              }}
            />
          )}
        </button>

        {/* Garage label */}
        <button
          onClick={() => !isGarage && handleToggle()}
          className={`text-sm font-semibold px-3 py-1.5 rounded-lg transition-all duration-300 ${
            isGarage
              ? 'text-petrol-yellow bg-petrol-yellow/10'
              : 'text-gray-500 hover:text-gray-400'
          }`}
        >
          <span className="flex items-center space-x-1.5">
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" /></svg>
            <span>I run a garage</span>
          </span>
        </button>
      </div>

      {/* Toggle hint text */}
      <p className={`text-xs mt-3 transition-all duration-300 ${isGarage ? 'text-petrol-yellow/40' : 'text-petrol-green/40'}`}>
        Tap to switch view
      </p>
    </div>
  )
}

// ===== CUSTOMER VIEW =====
function CustomerView({ goToBooking, expandedService, setExpandedService }: {
  goToBooking: () => void
  expandedService: string | null
  setExpandedService: (s: string | null) => void
}) {
  return (
    <div className="transition-opacity duration-300">
      {/* Hero */}
      <div className="text-center mb-10">
        <h2 className="text-3xl sm:text-4xl font-bold text-white leading-tight mb-4">
          Kenya&apos;s Smart<br />
          <span className="text-petrol-green">Garage Experience</span>
        </h2>
        <p className="text-gray-400 text-lg leading-relaxed">
          No queues. No surprises. Fully digital.
        </p>
      </div>

      {/* CTA */}
      <div className="mb-12 space-y-3">
        <button
          onClick={goToBooking}
          className="w-full bg-petrol-green text-petrol-black font-bold py-5 rounded-xl hover:brightness-110 transition-all text-xl shadow-[0_0_20px_rgba(57,255,20,0.15)] hover:shadow-[0_0_30px_rgba(57,255,20,0.25)] active:scale-[0.96]"
        >
          Book in 30 Seconds
        </button>
        <p className="text-center text-petrol-yellow text-sm font-medium">Limited daily slots available</p>
      </div>

      <div className="speed-line mb-14"></div>

      {/* Trust Strip */}
      <div className="bg-white bg-opacity-[0.04] rounded-2xl p-6 mb-14 border border-white border-opacity-5">
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

      <div className="speed-line mb-14"></div>

      {/* How It Works */}
      <div id="how-it-works" className="mb-14">
        <p className="text-gray-500 text-sm uppercase tracking-wider font-semibold mb-6 text-center">How It Works</p>
        <div className="space-y-4">
          <div className="flex items-start space-x-4">
            <div className="w-12 h-12 bg-petrol-green rounded-xl flex items-center justify-center flex-shrink-0 shadow-lg">
              <span className="text-petrol-black font-black text-xl">1</span>
            </div>
            <div className="pt-1">
              <p className="text-white font-bold text-lg">Book in 30 Seconds</p>
              <p className="text-gray-400 text-sm">Pick your service, date, and preferred mechanic</p>
            </div>
          </div>
          <div className="ml-6 w-[1px] h-4 bg-gradient-to-b from-petrol-green to-petrol-yellow"></div>
          <div className="flex items-start space-x-4">
            <div className="w-12 h-12 bg-petrol-yellow rounded-xl flex items-center justify-center flex-shrink-0 shadow-lg">
              <span className="text-petrol-black font-black text-xl">2</span>
            </div>
            <div className="pt-1">
              <p className="text-white font-bold text-lg">We Prepare Before You Arrive</p>
              <p className="text-gray-400 text-sm">Parts sourced, tools ready, mechanic briefed on your car</p>
            </div>
          </div>
          <div className="ml-6 w-[1px] h-4 bg-gradient-to-b from-petrol-yellow to-stripe-cyan"></div>
          <div className="flex items-start space-x-4">
            <div className="w-12 h-12 bg-stripe-cyan rounded-xl flex items-center justify-center flex-shrink-0 shadow-lg">
              <span className="text-petrol-black font-black text-xl">3</span>
            </div>
            <div className="pt-1">
              <p className="text-white font-bold text-lg">Drive In &amp; Out — Pay After</p>
              <p className="text-gray-400 text-sm">No surprises. Service logged digitally. Pay only when satisfied.</p>
            </div>
          </div>
        </div>
      </div>

      <div className="speed-line mb-14"></div>

      {/* Why Drivers Choose Us */}
      <div className="mb-14">
        <p className="text-gray-500 text-sm uppercase tracking-wider font-semibold mb-6 text-center">Why Drivers Choose Petrol Goons</p>
        <div className="grid grid-cols-1 gap-3">
          <div className="flex items-center space-x-3 bg-white bg-opacity-5 rounded-xl p-5 border-l-4 border-petrol-green">
            <div className="w-12 h-12 bg-petrol-green bg-opacity-10 rounded-lg flex items-center justify-center flex-shrink-0">
              <svg className="w-6 h-6 text-petrol-green" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
            </div>
            <div>
              <p className="text-white font-semibold text-base">Skip the Wait, Save Your Time</p>
              <p className="text-gray-400 text-sm">Book your slot — no more sitting in a queue all morning</p>
            </div>
          </div>
          <div className="flex items-center space-x-3 bg-white bg-opacity-5 rounded-xl p-5 border-l-4 border-petrol-yellow">
            <div className="w-12 h-12 bg-petrol-yellow bg-opacity-10 rounded-lg flex items-center justify-center flex-shrink-0">
              <svg className="w-6 h-6 text-petrol-yellow" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
            </div>
            <div>
              <p className="text-white font-semibold text-base">Never Lose Your Car&apos;s Records</p>
              <p className="text-gray-400 text-sm">Every service logged digitally — access your history anytime</p>
            </div>
          </div>
          <div className="flex items-center space-x-3 bg-white bg-opacity-5 rounded-xl p-5 border-l-4 border-stripe-cyan">
            <div className="w-12 h-12 bg-stripe-cyan bg-opacity-10 rounded-lg flex items-center justify-center flex-shrink-0">
              <svg className="w-6 h-6 text-stripe-cyan" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
            </div>
            <div>
              <p className="text-white font-semibold text-base">Get Faster Diagnostics</p>
              <p className="text-gray-400 text-sm">Upload photos of issues — mechanics prep before you arrive</p>
            </div>
          </div>
          <div className="flex items-center space-x-3 bg-white bg-opacity-5 rounded-xl p-5 border-l-4 border-petrol-green">
            <div className="w-12 h-12 bg-petrol-green bg-opacity-10 rounded-lg flex items-center justify-center flex-shrink-0">
              <svg className="w-6 h-6 text-petrol-green" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" /></svg>
            </div>
            <div>
              <p className="text-white font-semibold text-base">Zero Risk — Pay After Service</p>
              <p className="text-gray-400 text-sm">No deposits, no surprises. Pay only when you&apos;re satisfied</p>
            </div>
          </div>
        </div>
      </div>

      {/* Pay After Badge */}
      <div className="mb-14 bg-gradient-to-br from-petrol-green/20 to-petrol-green/5 border-2 border-petrol-green/30 rounded-2xl p-7 text-center">
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

      <div className="speed-line mb-14"></div>

      {/* Interactive Services */}
      <div className="mb-14">
        <p className="text-gray-500 text-sm uppercase tracking-wider font-semibold mb-2 text-center">Our Services</p>
        <p className="text-gray-600 text-sm text-center mb-6">Tap any service for details and pricing</p>
        <div className="grid grid-cols-2 gap-2.5">
          {SERVICES.map(service => (
            <button
              key={service.name}
              onClick={() => setExpandedService(expandedService === service.name ? null : service.name)}
              className={`text-left rounded-xl p-4 transition-all border service-card ${
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
                    onClick={(e) => { e.stopPropagation(); goToBooking() }}
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

      {/* Bottom CTA */}
      <div className="mb-14">
        <button
          onClick={goToBooking}
          className="w-full bg-petrol-green text-petrol-black font-bold py-5 rounded-xl hover:brightness-110 transition-all text-xl shadow-[0_0_20px_rgba(57,255,20,0.15)] hover:shadow-[0_0_30px_rgba(57,255,20,0.25)] active:scale-[0.96]"
        >
          Book in 30 Seconds
        </button>
      </div>

      {/* Hours & Location */}
      <div className="pt-8 border-t border-white border-opacity-5">
        <div className="grid grid-cols-2 gap-8 text-center">
          <div>
            <p className="text-gray-500 text-sm uppercase tracking-wider font-semibold mb-2">Hours</p>
            <p className="text-white text-base font-medium">Mon — Sat</p>
            <p className="text-gray-400 text-base">8:00 AM — 6:00 PM</p>
            <p className="text-gray-600 text-sm mt-1">Closed Sundays</p>
          </div>
          <div>
            <p className="text-gray-500 text-sm uppercase tracking-wider font-semibold mb-2">Follow Us</p>
            <a href="https://instagram.com/petrol_goons" target="_blank" rel="noopener noreferrer" className="inline-flex items-center space-x-1 text-petrol-green hover:text-green-300 transition-colors text-base font-medium">
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z"/></svg>
              <span>@petrol_goons</span>
            </a>
            <p className="text-gray-600 text-sm mt-2">DM us anytime</p>
          </div>
        </div>
      </div>
    </div>
  )
}

// ===== GARAGE OWNER VIEW =====
function GarageOwnerView({ goToDemo }: { goToDemo: () => void }) {
  return (
    <div className="transition-opacity duration-300">
      {/* Hero */}
      <div className="text-center mb-10">
        <h2 className="text-3xl sm:text-4xl font-bold text-white leading-tight mb-4">
          Run Your Garage Like a<br />
          <span className="text-petrol-yellow">Performance Machine</span>
        </h2>
        <p className="text-gray-400 text-lg leading-relaxed mb-2">
          Manage bookings, track jobs, store records, and increase revenue — all in one platform.
        </p>
        <p className="text-gray-600 text-sm">
          Built for Kenya&apos;s next generation of garages.
        </p>
      </div>

      {/* CTA */}
      <div className="mb-12 space-y-3">
        <button
          onClick={goToDemo}
          className="w-full bg-petrol-yellow text-petrol-black font-bold py-5 rounded-xl hover:brightness-110 transition-all text-xl shadow-[0_0_20px_rgba(253,185,19,0.15)] hover:shadow-[0_0_30px_rgba(253,185,19,0.25)] active:scale-[0.96]"
        >
          See Live Demo
        </button>
        <button
          onClick={() => document.getElementById('the-problem')?.scrollIntoView({ behavior: 'smooth' })}
          className="w-full bg-transparent border border-white border-opacity-10 text-gray-400 font-medium py-3.5 rounded-xl hover:bg-white hover:bg-opacity-5 transition-all text-sm active:scale-[0.98]"
        >
          See How It Works
        </button>
      </div>

      <div className="speed-line mb-14"></div>

      {/* The Problem */}
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

      <div className="speed-line mb-14"></div>

      {/* The Solution */}
      <div className="mb-14">
        <p className="text-gray-500 text-sm uppercase tracking-wider font-semibold mb-3 text-center">The Solution</p>
        <h3 className="text-2xl font-bold text-white text-center mb-8">
          Petrol Goons gives you
        </h3>
        <div className="space-y-4">
          {[
            { num: '1', color: 'bg-petrol-yellow', title: 'Digital Booking System', desc: 'Customers book before arrival. You prepare before they arrive. No more walk-in chaos.' },
            { num: '2', color: 'bg-petrol-green', title: 'Job Tracking Dashboard', desc: 'See active cars, completed jobs, pending approvals, and revenue — all in one view.' },
            { num: '3', color: 'bg-stripe-cyan', title: 'Customer History & Records', desc: 'Every service logged. Every part recorded. Every visit tracked. Nothing gets lost.' },
            { num: '4', color: 'bg-petrol-yellow', title: 'Pay-After-Service Model', desc: 'Build trust with customers. Increase conversions. Reduce payment friction.' },
          ].map((item, i) => (
            <div key={i} className="bg-white bg-opacity-5 rounded-2xl p-6 border border-white border-opacity-5">
              <div className="flex items-center space-x-3 mb-3">
                <div className={`w-10 h-10 ${item.color} rounded-lg flex items-center justify-center flex-shrink-0`}>
                  <span className="text-petrol-black font-black text-lg">{item.num}</span>
                </div>
                <h4 className="text-white font-bold text-lg">{item.title}</h4>
              </div>
              <p className="text-gray-400 text-base pl-[52px]">{item.desc}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="speed-line mb-14"></div>

      {/* Benefits */}
      <div className="mb-14">
        <p className="text-gray-500 text-sm uppercase tracking-wider font-semibold mb-3 text-center">Why Garage Owners Choose Us</p>
        <h3 className="text-2xl font-bold text-white text-center mb-8">
          This is not software.<br />
          <span className="text-petrol-yellow">This is competitive advantage.</span>
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

      <div className="speed-line mb-14"></div>

      {/* Powered By */}
      <div className="mb-14 bg-gradient-to-br from-petrol-yellow/20 to-petrol-yellow/5 border-2 border-petrol-yellow/30 rounded-2xl p-7 text-center">
        <p className="text-gray-400 text-sm uppercase tracking-wider font-semibold mb-3">Your Garage Becomes</p>
        <h3 className="text-white text-2xl font-bold mb-2">XYZ Garage</h3>
        <p className="text-petrol-yellow text-sm font-semibold tracking-wider uppercase">Powered by Petrol Goons</p>
        <p className="text-gray-400 text-base mt-4">
          Look like a premium, tech-driven garage without building anything yourself.
        </p>
      </div>

      <div className="speed-line mb-14"></div>

      {/* Pricing */}
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
                  ? 'border-petrol-yellow bg-petrol-yellow/5'
                  : 'border-white border-opacity-10 bg-white bg-opacity-[0.03]'
              }`}
            >
              {plan.badge && (
                <span className="inline-block bg-petrol-yellow text-petrol-black text-xs font-bold px-3 py-1 rounded-full mb-3 uppercase tracking-wider">
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
                    <svg className="w-4 h-4 text-petrol-yellow flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
                    ? 'bg-petrol-yellow text-petrol-black hover:brightness-110 shadow-[0_0_15px_rgba(253,185,19,0.15)]'
                    : 'bg-white bg-opacity-10 text-white hover:bg-opacity-15'
                }`}
              >
                {plan.cta}
              </button>
            </div>
          ))}
        </div>
      </div>

      <div className="speed-line mb-14"></div>

      {/* Demo CTA */}
      <div className="mb-14 text-center">
        <h3 className="text-2xl font-bold text-white mb-3">See it in action</h3>
        <p className="text-gray-400 text-base mb-6">
          Try the live booking system your customers would use. No signup needed.
        </p>
        <button
          onClick={goToDemo}
          className="w-full bg-petrol-yellow text-petrol-black font-bold py-5 rounded-xl hover:brightness-110 transition-all text-xl shadow-[0_0_20px_rgba(253,185,19,0.15)] hover:shadow-[0_0_30px_rgba(253,185,19,0.25)] active:scale-[0.96]"
        >
          Try Live Demo
        </button>
      </div>

      {/* Contact */}
      <div className="pt-8 border-t border-white border-opacity-5">
        <div className="text-center">
          <p className="text-gray-500 text-sm uppercase tracking-wider font-semibold mb-3">Get In Touch</p>
          <a href="https://instagram.com/petrol_goons" target="_blank" rel="noopener noreferrer" className="inline-flex items-center space-x-2 text-petrol-yellow hover:text-yellow-300 transition-colors text-lg font-medium">
            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z"/></svg>
            <span>@petrol_goons</span>
          </a>
          <p className="text-gray-600 text-sm mt-2">DM us to get started or ask questions</p>
        </div>
      </div>
    </div>
  )
}

// ===== MAIN PAGE =====
export default function LandingPage() {
  const [checkingAuth, setCheckingAuth] = useState(true)
  const [isGarageView, setIsGarageView] = useState(false)
  const [expandedService, setExpandedService] = useState<string | null>(null)
  const [isTransitioning, setIsTransitioning] = useState(false)
  const [displayView, setDisplayView] = useState<'customer' | 'garage'>('customer')
  const contentRef = useRef<HTMLDivElement>(null)

  const goToBooking = () => { window.location.href = '/book' }

  // Smooth view transition handler
  const handleToggle = () => {
    if (isTransitioning) return
    setIsTransitioning(true)

    // Phase 1: Fade out + slide current view
    setTimeout(() => {
      setDisplayView(isGarageView ? 'customer' : 'garage')
      setIsGarageView(!isGarageView)
      // Phase 2: New view fades in
      setTimeout(() => {
        setIsTransitioning(false)
        // Scroll to top of content smoothly
        contentRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
      }, 50)
    }, 250)
  }

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
        } catch { /* redirect check failed */ }
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
        {/* Ambient glow shifts color based on active view */}
        <div
          className="absolute top-10 left-1/2 -translate-x-1/2 w-80 h-80 rounded-full blur-3xl transition-all duration-700"
          style={{
            background: isGarageView
              ? 'radial-gradient(circle, rgba(253,185,19,0.06) 0%, transparent 70%)'
              : 'radial-gradient(circle, rgba(57,255,20,0.06) 0%, transparent 70%)',
          }}
        />

        <div className="relative max-w-lg mx-auto px-6 pt-10 pb-10">

          {/* Logo */}
          <div className="text-center mb-6">
            <h1 className="text-4xl sm:text-5xl brand-text mb-2 whitespace-nowrap">
              <span className="text-petrol-green">PETROL</span>{' '}
              <span className="inline-block bg-petrol-yellow text-petrol-black px-3 py-0.5 -skew-x-6">GOONS</span>
            </h1>
            <p className="text-gray-500 text-sm tracking-[0.2em] font-medium uppercase mt-1">Garage</p>
            <div className="w-40 mx-auto mt-3 racing-stripe-diagonal rounded-sm overflow-hidden"></div>
          </div>

          {/* Fuel Pump Toggle */}
          <FuelPumpToggle isGarage={isGarageView} onToggle={handleToggle} />

          {/* View content with smooth transition */}
          <div
            ref={contentRef}
            className={`view-transition ${isTransitioning ? 'view-exit' : 'view-enter'}`}
          >
            {displayView === 'garage' ? (
              <GarageOwnerView goToDemo={goToBooking} />
            ) : (
              <CustomerView goToBooking={goToBooking} expandedService={expandedService} setExpandedService={setExpandedService} />
            )}
          </div>

          {/* Footer */}
          <div className="text-center mt-10 pb-8">
            <div className="w-full racing-stripe-diagonal mb-6 rounded-sm overflow-hidden"></div>
            <p className="text-gray-700 text-sm">
              &copy; 2026 Petrol Goons. Powering Kenya&apos;s modern garages.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
