import { initializeApp, getApps, FirebaseApp } from 'firebase/app'
import { getAuth, GoogleAuthProvider, FacebookAuthProvider, OAuthProvider, Auth } from 'firebase/auth'
import { getFirestore, Firestore } from 'firebase/firestore'
import { getStorage, FirebaseStorage } from 'firebase/storage'

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
}

// Initialize Firebase — safe initialization that won't crash on import
let app: FirebaseApp = undefined as unknown as FirebaseApp
let auth: Auth = undefined as unknown as Auth
let db: Firestore = undefined as unknown as Firestore
let storage: FirebaseStorage = undefined as unknown as FirebaseStorage

function initFirebase() {
  if (getApps().length > 0) {
    app = getApps()[0]
  } else {
    app = initializeApp(firebaseConfig)
  }
  auth = getAuth(app)
  db = getFirestore(app)
  storage = getStorage(app)
}

try {
  initFirebase()
} catch (error) {
  console.error('Firebase initialization error:', error)
  // Try once more — sometimes getApps() state is stale after hot reload
  try {
    initFirebase()
  } catch (retryError) {
    console.error('Firebase retry failed:', retryError)
  }
}

// Auth providers
export const googleProvider = new GoogleAuthProvider()
export const facebookProvider = new FacebookAuthProvider()
export const appleProvider = new OAuthProvider('apple.com')

export { auth, db, storage }
export default app
