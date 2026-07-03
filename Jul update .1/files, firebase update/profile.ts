import { doc, runTransaction } from 'firebase/firestore'
import { db, auth } from '@/lib/firebase/client'

type Role = 'car_owner' | 'garage_owner'

export async function setUserRole(role: Role) {
  const uid = auth.currentUser?.uid
  if (!uid) return { success: false, error: 'Not signed in' }

  try {
    await runTransaction(db, async (tx) => {
      const ref = doc(db, 'profiles', uid)
      const snap = await tx.get(ref)
      if (snap.exists() && snap.data().role) {
        throw new Error('Role already set')
      }
      tx.set(ref, { role }, { merge: true })
    })
    return { success: true }
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : 'Could not set role' }
  }
}
