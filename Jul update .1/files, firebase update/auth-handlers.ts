import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signInWithPopup,
  GoogleAuthProvider,
  RecaptchaVerifier,
  signInWithPhoneNumber,
  type ConfirmationResult,
  signOut as firebaseSignOut,
  updateProfile,
} from 'firebase/auth'
import { auth } from '@/lib/firebase/client'

async function establishSession(idToken: string) {
  const res = await fetch('/api/auth/session', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ idToken }),
  })
  if (!res.ok) throw new Error('Could not establish session')
}

// ============================================================
// EMAIL / PASSWORD
// ============================================================

export async function signUpWithEmail(email: string, password: string, fullName?: string) {
  try {
    const cred = await createUserWithEmailAndPassword(auth, email, password)
    if (fullName) await updateProfile(cred.user, { displayName: fullName })
    await establishSession(await cred.user.getIdToken())
    return { success: true, user: cred.user }
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : 'Could not sign up' }
  }
}

export async function signInWithEmail(email: string, password: string) {
  try {
    const cred = await signInWithEmailAndPassword(auth, email, password)
    await establishSession(await cred.user.getIdToken())
    return { success: true, user: cred.user }
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : 'Could not sign in' }
  }
}

// ============================================================
// GOOGLE  (popup — no redirect/callback route needed)
// ============================================================

export async function signInWithGoogle() {
  try {
    const cred = await signInWithPopup(auth, new GoogleAuthProvider())
    await establishSession(await cred.user.getIdToken())
    return { success: true, user: cred.user }
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : 'Could not sign in with Google' }
  }
}

// ============================================================
// PHONE OTP
// Requires a <div id="recaptcha-container" /> present in the DOM
// (invisible — it renders nothing visible, but Firebase needs the node).
// ============================================================

let recaptchaVerifier: RecaptchaVerifier | null = null
let pendingConfirmation: ConfirmationResult | null = null

function getRecaptcha() {
  if (!recaptchaVerifier) {
    recaptchaVerifier = new RecaptchaVerifier(auth, 'recaptcha-container', { size: 'invisible' })
  }
  return recaptchaVerifier
}

export async function sendPhoneOtp(phone: string) {
  try {
    pendingConfirmation = await signInWithPhoneNumber(auth, phone, getRecaptcha())
    return { success: true }
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : 'Could not send code' }
  }
}

export async function verifyPhoneOtp(_phone: string, code: string) {
  try {
    if (!pendingConfirmation) throw new Error('Request a code first')
    const cred = await pendingConfirmation.confirm(code)
    await establishSession(await cred.user.getIdToken())
    return { success: true, user: cred.user }
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : 'Invalid code' }
  }
}

// ============================================================
// SIGN OUT
// ============================================================

export async function signOut() {
  try {
    await firebaseSignOut(auth)
    await fetch('/api/auth/session', { method: 'DELETE' })
    return { success: true }
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : 'Could not sign out' }
  }
}
