import { initializeApp, getApps, cert, type App } from 'firebase-admin/app'
import { getAuth, type Auth } from 'firebase-admin/auth'
import { getFirestore, type Firestore } from 'firebase-admin/firestore'

function getAdminApp(): App | null {
  if (getApps().length) return getApps()[0]

  const projectId = process.env.FIREBASE_PROJECT_ID
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL
  const privateKey = process.env.FIREBASE_PRIVATE_KEY

  if (!projectId || !clientEmail || !privateKey) {
    return null
  }

  return initializeApp({
    credential: cert({
      projectId,
      clientEmail,
      privateKey: privateKey.replace(/\\n/g, '\n'),
    }),
  })
}

function getRequiredAdminApp(): App {
  const adminApp = getAdminApp()
  if (!adminApp) {
    throw new Error('Missing Firebase Admin SDK environment variables: FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY')
  }
  return adminApp
}

export function getAdminAuth(): Auth | null {
  const adminApp = getAdminApp()
  return adminApp ? getAuth(adminApp) : null
}

export function getAdminDb(): Firestore {
  return getFirestore(getRequiredAdminApp())
}
