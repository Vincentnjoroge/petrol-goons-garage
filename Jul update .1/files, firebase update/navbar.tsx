import Link from 'next/link'
import { cookies } from 'next/headers'
import { adminAuth, adminDb } from '@/lib/firebase/admin'
import { ThemeToggle } from '@/components/theme-toggle'
import { SignOutButton } from '@/components/sign-out-button'

const CAR_OWNER_LINKS = [
  { href: '/dashboard/car-owner', label: 'Dashboard' },
  { href: '/dashboard/car-owner/bookings', label: 'My Bookings' },
  { href: '/garages', label: 'Find a Garage' },
]

const GARAGE_OWNER_LINKS = [
  { href: '/dashboard/garage-owner', label: 'Dashboard' },
  { href: '/dashboard/garage-owner/bays', label: 'Bays' },
  { href: '/dashboard/garage-owner/bookings', label: 'Bookings' },
]

export async function Navbar() {
  const cookieStore = await cookies()
  const sessionCookie = cookieStore.get('session')?.value

  let uid: string | null = null
  let role: 'car_owner' | 'garage_owner' | null = null

  if (sessionCookie) {
    try {
      const decoded = await adminAuth.verifySessionCookie(sessionCookie, true)
      uid = decoded.uid
      const snap = await adminDb.collection('profiles').doc(uid).get()
      role = (snap.data()?.role as typeof role) ?? null
    } catch {
      uid = null // expired/invalid cookie — render as logged out
    }
  }

  const links = role === 'garage_owner' ? GARAGE_OWNER_LINKS : role === 'car_owner' ? CAR_OWNER_LINKS : []

  return (
    <nav className="sticky top-0 z-40 border-b border-black/10 bg-[#F7F5F0]/90 backdrop-blur dark:border-white/10 dark:bg-[#0A0B0D]/90">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-6">
        <Link
          href={role ? (role === 'garage_owner' ? '/dashboard/garage-owner' : '/dashboard/car-owner') : '/'}
          className="text-lg font-bold uppercase tracking-tight text-[#1A1A1A] dark:text-[#F2F0EA]"
          style={{ fontFamily: '"Oswald", ui-sans-serif, system-ui' }}
        >
          Petrol Goons
        </Link>

        <div className="hidden items-center gap-6 md:flex">
          {links.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="text-sm font-medium text-black/60 transition hover:text-[#FFB020] dark:text-white/60"
            >
              {link.label}
            </Link>
          ))}
        </div>

        <div className="flex items-center gap-4">
          <ThemeToggle />
          {uid ? (
            <SignOutButton />
          ) : (
            <Link
              href="/login"
              className="rounded-md bg-[#FFB020] px-4 py-1.5 text-sm font-semibold text-[#0A0B0D] transition hover:bg-[#FFC24D]"
            >
              Sign in
            </Link>
          )}
        </div>
      </div>

      {links.length > 0 && (
        <div className="flex gap-4 overflow-x-auto border-t border-black/5 px-6 py-2 md:hidden dark:border-white/5">
          {links.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="whitespace-nowrap text-xs font-medium text-black/60 dark:text-white/60"
            >
              {link.label}
            </Link>
          ))}
        </div>
      )}
    </nav>
  )
}
