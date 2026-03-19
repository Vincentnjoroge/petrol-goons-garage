'use client'

import { usePathname, useRouter } from 'next/navigation'

const navItems = [
  {
    id: 'home',
    label: 'Home',
    href: '/',
    icon: (active: boolean) => (
      <svg width="22" height="22" viewBox="0 0 24 24" fill={active ? '#FDB913' : 'none'} stroke={active ? '#FDB913' : '#6B7280'} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
        <polyline points="9 22 9 12 15 12 15 22" />
      </svg>
    ),
  },
  {
    id: 'marketplace',
    label: 'Marketplace',
    href: '/marketplace',
    dot: true,
    icon: (active: boolean) => (
      <svg width="22" height="22" viewBox="0 0 24 24" fill={active ? '#FDB913' : 'none'} stroke={active ? '#FDB913' : '#6B7280'} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="9" cy="21" r="1" />
        <circle cx="20" cy="21" r="1" />
        <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6" />
      </svg>
    ),
  },
  {
    id: 'events',
    label: 'Events',
    href: '/events',
    icon: (active: boolean) => (
      <svg width="22" height="22" viewBox="0 0 24 24" fill={active ? '#FDB913' : 'none'} stroke={active ? '#FDB913' : '#6B7280'} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
        <line x1="16" y1="2" x2="16" y2="6" />
        <line x1="8" y1="2" x2="8" y2="6" />
        <line x1="3" y1="10" x2="21" y2="10" />
      </svg>
    ),
  },
  {
    id: 'rewards',
    label: 'Rewards',
    href: '/rewards',
    icon: (active: boolean) => (
      <svg width="22" height="22" viewBox="0 0 24 24" fill={active ? '#FDB913' : 'none'} stroke={active ? '#FDB913' : '#6B7280'} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="8" r="7" />
        <polyline points="8.21 13.89 7 23 12 20 17 23 15.79 13.88" />
      </svg>
    ),
  },
  {
    id: 'pro',
    label: 'Pro',
    href: '/pro',
    icon: (active: boolean) => (
      <svg width="22" height="22" viewBox="0 0 24 24" fill={active ? '#FDB913' : 'none'} stroke={active ? '#FDB913' : '#6B7280'} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
      </svg>
    ),
  },
]

export default function BottomNav() {
  const pathname = usePathname()
  const router = useRouter()

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-100 z-50 safe-area-bottom">
      <div className="max-w-[430px] mx-auto flex justify-around items-center py-2 px-1">
        {navItems.map((item) => {
          const isActive = pathname === item.href
          return (
            <button
              key={item.id}
              onClick={() => router.push(item.href)}
              className="relative flex flex-col items-center gap-0.5 px-2 py-1"
            >
              {item.dot && (
                <span className="absolute -top-0.5 right-1.5 w-1 h-1 rounded-full bg-petrol-yellow" />
              )}
              {item.icon(isActive)}
              <span
                className="text-[10px] font-semibold"
                style={{ color: isActive ? '#FDB913' : '#6B7280' }}
              >
                {item.label}
              </span>
            </button>
          )
        })}
      </div>
    </nav>
  )
}
