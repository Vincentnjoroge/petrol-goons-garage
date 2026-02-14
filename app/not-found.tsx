'use client'

import { useRouter } from 'next/navigation'

export default function NotFound() {
  const router = useRouter()

  return (
    <div className="min-h-screen bg-petrol-black flex items-center justify-center p-6">
      <div className="text-center max-w-md">
        {/* Logo */}
        <div className="mb-8">
          <h1 className="text-4xl brand-text mb-1">
            <span className="text-petrol-green">PETROL</span>
            <span className="inline-block bg-petrol-yellow text-petrol-black px-3 py-0.5 ml-1 -skew-x-6">GOONS</span>
          </h1>
          <div className="w-40 mx-auto mt-3 racing-stripe rounded-full overflow-hidden"></div>
        </div>

        {/* 404 message */}
        <div className="mb-8">
          <p className="text-7xl font-black text-petrol-yellow mb-2">404</p>
          <h2 className="text-2xl font-bold text-white mb-3">Wrong turn!</h2>
          <p className="text-gray-400 text-lg">
            This page doesn&apos;t exist. Maybe you took a detour — let&apos;s get you back on track.
          </p>
        </div>

        {/* Actions */}
        <div className="space-y-3">
          <button
            onClick={() => router.push('/book')}
            className="w-full bg-petrol-green text-petrol-black font-bold py-4 rounded-xl hover:brightness-110 transition-all text-lg active:scale-[0.98]"
          >
            Book a Service
          </button>
          <button
            onClick={() => router.push('/')}
            className="w-full bg-white bg-opacity-10 border border-white border-opacity-20 text-white font-medium py-4 rounded-xl hover:bg-opacity-15 transition-all text-lg active:scale-[0.98]"
          >
            Back to Home
          </button>
        </div>

        {/* Instagram plug */}
        <div className="mt-10 pt-6 border-t border-white border-opacity-5">
          <a
            href="https://instagram.com/petrol_goons"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center space-x-2 text-petrol-green hover:text-green-300 transition-colors text-base font-medium"
          >
            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
              <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z"/>
            </svg>
            <span>@petrol_goons</span>
          </a>
        </div>
      </div>
    </div>
  )
}
