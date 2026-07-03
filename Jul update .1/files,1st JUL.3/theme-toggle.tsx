'use client'

import { useEffect, useState } from 'react'

export function ThemeToggle() {
  const [isDark, setIsDark] = useState(true)

  useEffect(() => {
    const stored = localStorage.getItem('theme')
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches
    const dark = stored ? stored === 'dark' : prefersDark
    setIsDark(dark)
    document.documentElement.classList.toggle('dark', dark)
  }, [])

  function toggle() {
    const next = !isDark
    setIsDark(next)
    document.documentElement.classList.toggle('dark', next)
    localStorage.setItem('theme', next ? 'dark' : 'light')
  }

  return (
    <button
      onClick={toggle}
      aria-label={isDark ? 'Switch to Showroom (light) mode' : 'Switch to Night Track (dark) mode'}
      className="flex h-8 w-8 items-center justify-center rounded-full border border-black/10 text-sm transition hover:border-[#FFB020] dark:border-white/10"
      title={isDark ? 'Night Track' : 'Showroom'}
    >
      {isDark ? (
        // moon
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
          <path
            d="M21 12.8A9 9 0 1111.2 3 7 7 0 0021 12.8z"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinejoin="round"
          />
        </svg>
      ) : (
        // sun
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
          <circle cx="12" cy="12" r="4.5" stroke="currentColor" strokeWidth="1.8" />
          <path
            d="M12 2v2.2M12 19.8V22M4.2 4.2l1.5 1.5M18.3 18.3l1.5 1.5M2 12h2.2M19.8 12H22M4.2 19.8l1.5-1.5M18.3 5.7l1.5-1.5"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
          />
        </svg>
      )}
    </button>
  )
}
