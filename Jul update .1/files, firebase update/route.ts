import { NextResponse } from 'next/server'
import { adminAuth, adminDb } from '@/lib/firebase/admin'

const SESSION_COOKIE_NAME = 'session'
const EXPIRES_IN_MS = 60 * 60 * 24 * 5 * 1000 // 5 days

// Called right after any successful client-side sign-in (email, phone, or
// Google). Creates the httpOnly session cookie middleware/pages rely on,
// AND provisions a bare profile doc if one doesn't exist yet — this is the
// Firebase equivalent of the Postgres trigger, and it fires for every auth
// method since they all end up calling this same route.
export async function POST(request: Request) {
  const { idToken } = await request.json()

  if (!idToken) {
    return NextResponse.json({ error: 'Missing idToken' }, { status: 400 })
  }

  try {
    const decoded = await adminAuth.verifyIdToken(idToken)
    const sessionCookie = await adminAuth.createSessionCookie(idToken, { expiresIn: EXPIRES_IN_MS })

    const profileRef = adminDb.collection('profiles').doc(decoded.uid)
    const profileSnap = await profileRef.get()

    if (!profileSnap.exists) {
      await profileRef.set({
        email: decoded.email ?? null,
        phone: decoded.phone_number ?? null,
        fullName: decoded.name ?? null,
        role: null, // set later via onboarding
        createdAt: new Date().toISOString(),
      })
    }

    const response = NextResponse.json({ success: true })
    response.cookies.set(SESSION_COOKIE_NAME, sessionCookie, {
      maxAge: EXPIRES_IN_MS / 1000,
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      path: '/',
      sameSite: 'lax',
    })
    return response
  } catch (err) {
    console.error('Session creation failed', err)
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
}

// Called on sign out to clear the cookie
export async function DELETE() {
  const response = NextResponse.json({ success: true })
  response.cookies.delete(SESSION_COOKIE_NAME)
  return response
}
