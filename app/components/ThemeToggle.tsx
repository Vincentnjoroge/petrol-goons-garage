'use client'

import { useTheme } from './ThemeProvider'

export default function ThemeToggle() {
  const { theme, toggleTheme } = useTheme()
  const isDark = theme === 'dark'

  return (
    <button
      onClick={toggleTheme}
      aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
      className="fixed bottom-6 right-5 z-50 w-12 h-12 rounded-full flex items-center justify-center transition-all duration-300 active:scale-90 hover:scale-105 shadow-lg"
      style={{
        background: isDark
          ? 'linear-gradient(145deg, #1a1a1a, #0A0A0A)'
          : 'linear-gradient(145deg, #FFFFFF, #F3F4F6)',
        border: isDark
          ? '2px solid rgba(253,185,19,0.4)'
          : '2px solid rgba(0,0,0,0.12)',
        boxShadow: isDark
          ? '0 4px 16px rgba(253,185,19,0.15), 0 2px 4px rgba(0,0,0,0.4)'
          : '0 4px 16px rgba(0,0,0,0.12), 0 2px 4px rgba(0,0,0,0.06)',
      }}
    >
      {isDark ? (
        /* Sun icon — shows in dark mode to switch to light */
        <svg
          className="w-5 h-5 text-petrol-yellow transition-transform duration-300"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
          strokeWidth={2}
        >
          <circle cx="12" cy="12" r="5" />
          <line x1="12" y1="1" x2="12" y2="3" strokeLinecap="round" />
          <line x1="12" y1="21" x2="12" y2="23" strokeLinecap="round" />
          <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" strokeLinecap="round" />
          <line x1="18.36" y1="18.36" x2="19.78" y2="19.78" strokeLinecap="round" />
          <line x1="1" y1="12" x2="3" y2="12" strokeLinecap="round" />
          <line x1="21" y1="12" x2="23" y2="12" strokeLinecap="round" />
          <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" strokeLinecap="round" />
          <line x1="18.36" y1="5.64" x2="19.78" y2="4.22" strokeLinecap="round" />
        </svg>
      ) : (
        /* Moon icon — shows in light mode to switch to dark */
        <svg
          className="w-5 h-5 transition-transform duration-300"
          style={{ color: '#0A0A0A' }}
          fill="currentColor"
          viewBox="0 0 24 24"
        >
          <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
        </svg>
      )}
    </button>
  )
}
