import {
  signInWithPopup,
  signInWithPhoneNumber,
  RecaptchaVerifier,
  User,
  signOut as firebaseSignOut,
} from 'firebase/auth'
import { doc, setDoc, getDoc, serverTimestamp } from 'firebase/firestore'
import { auth, googleProvider, facebookProvider, appleProvider, db } from './firebase'

// Save user to Firestore
export async function saveUserToFirestore(user: User) {
  const userRef = doc(db, 'users', user.uid)
  const userSnap = await getDoc(userRef)

  if (!userSnap.exists()) {
    await setDoc(userRef, {
      uid: user.uid,
      email: user.email,
      displayName: user.displayName,
      photoURL: user.photoURL,
      phoneNumber: user.phoneNumber,
      createdAt: serverTimestamp(),
    })
  }
}

// Sign in with Google
export async function signInWithGoogle() {
  try {
    const result = await signInWithPopup(auth, googleProvider)
    await saveUserToFirestore(result.user)
    return { success: true, user: result.user }
  } catch (error: any) {
    return { success: false, error: error.message }
  }
}

// Sign in with Facebook
export async function signInWithFacebook() {
  try {
    const result = await signInWithPopup(auth, facebookProvider)
    await saveUserToFirestore(result.user)
    return { success: true, user: result.user }
  } catch (error: any) {
    return { success: false, error: error.message }
  }
}

// Sign in with Apple
export async function signInWithApple() {
  try {
    const result = await signInWithPopup(auth, appleProvider)
    await saveUserToFirestore(result.user)
    return { success: true, user: result.user }
  } catch (error: any) {
    return { success: false, error: error.message }
  }
}

// Sign in with Phone
export async function setupRecaptcha(containerId: string) {
  return new RecaptchaVerifier(auth, containerId, {
    size: 'invisible',
  })
}

export async function signInWithPhone(phoneNumber: string, recaptchaVerifier: RecaptchaVerifier) {
  try {
    const confirmationResult = await signInWithPhoneNumber(auth, phoneNumber, recaptchaVerifier)
    return { success: true, confirmationResult }
  } catch (error: any) {
    return { success: false, error: error.message }
  }
}

// Sign out
export async function signOut() {
  try {
    await firebaseSignOut(auth)
    return { success: true }
  } catch (error: any) {
    return { success: false, error: error.message }
  }
}
