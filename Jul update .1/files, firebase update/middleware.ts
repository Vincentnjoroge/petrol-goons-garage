import { NextResponse, type NextRequest } from 'next/server'
import { adminAuth, adminDb } from '@/lib/firebase/admin'

// firebase-admin needs Node APIs (crypto, etc.) that aren't available on the
// default Edge runtime. Requires Next.js 15.2+ for middleware runtime config.
// If your Next.js version doesn't support this, see the fallback note at
// the bottom of this file.
export const runtime = 'nodejs'

const PROTECTED_PREFIXES = ['/dashboard']
const AUTH_ENTRY_PATHS = ['/', '/login']

export async function middleware(request: NextRequest) {
  const sessionCookie = request.cookies.get('session')?.value
  const path = request.nextUrl.pathname
  const isProtected = PROTECTED_PREFIXES.some((p) => path.startsWith(p))
  const isAuthEntry = AUTH_ENTRY_PATHS.includes(path)
  const isOnboarding = path.startsWith('/onboarding')

  let uid: string | null = null
  if (sessionCookie) {
    try {
      const decoded = await adminAuth.verifySessionCookie(sessionCookie, true)
      uid = decoded.uid
    } catch {
      uid = null // expired or tampered cookie
    }
  }

  // Not logged in, trying to hit a protected route -> bounce to login
  if (!uid && isProtected) {
    return NextResponse.redirect(new URL('/login', request.url))
  }

  // Logged in -> figure out role and route accordingly
  if (uid && (isProtected || isAuthEntry || isOnboarding)) {
    const profileSnap = await adminDb.collection('profiles').doc(uid).get()
    const role = profileSnap.data()?.role as 'car_owner' | 'garage_owner' | null | undefined

    if (!role && !isOnboarding) {
      return NextResponse.redirect(new URL('/onboarding', request.url))
    }

    if (role && (isAuthEntry || isOnboarding)) {
      const dest = role === 'car_owner' ? '/dashboard/car-owner' : '/dashboard/garage-owner'
      return NextResponse.redirect(new URL(dest, request.url))
    }
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)'],
}

// ------------------------------------------------------------
// FALLBACK if your Next.js version can't run middleware on Node:
// Do a cheap cookie-presence check here for redirect UX only
// (no verifySessionCookie call), and move the *real* auth + role
// check into each protected page/layout via a shared server
// helper that calls adminAuth.verifySessionCookie — Server
// Components and Route Handlers always run on Node, so the
// Admin SDK works fine there regardless of middleware limits.
// ------------------------------------------------------------
