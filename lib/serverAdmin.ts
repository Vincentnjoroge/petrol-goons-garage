import { initializeApp, getApps, cert, type App } from 'firebase-admin/app'
import { getAuth } from 'firebase-admin/auth'
import { getFirestore } from 'firebase-admin/firestore'

// Server-side Firebase admin init helper.
// Requires server-only env vars: FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY
function getAdminApp(): App {
  if (getApps().length) return getApps()[0]

  return initializeApp({
    credential: cert({
      projectId: process.env.FIREBASE_PROJECT_ID!,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL!,
      privateKey: process.env.FIREBASE_PRIVATE_KEY!.replace(/\\n/g, '\n'),
    }),
  })
}

export const adminAuth = getAuth(getAdminApp())
export const adminDb = getFirestore(getAdminApp())
