/**
 * Petrol Goons Garage — Staff Invites & Owner Bootstrap
 *
 * These helpers pair with the hardened firestore.rules. Because the app has no
 * Admin SDK, role assignment is done client-side but constrained by rules:
 *
 *   - A user becomes garage_owner ONLY by claiming a garage they created
 *     (rules verify garage.ownerId == uid).
 *   - A user becomes staff ONLY if an invite exists for their email
 *     (rules verify the invite doc + matching role).
 *
 * Invite doc id = the invitee's lowercased email.
 *   garages/{garageId}/invites/{email}
 */

import {
  doc,
  setDoc,
  getDoc,
  getDocs,
  deleteDoc,
  updateDoc,
  collection,
  collectionGroup,
  query,
  where,
  serverTimestamp,
  Timestamp,
} from 'firebase/firestore'
import { db } from './firebase'
import type { UserRole } from './types'

export type StaffRole = 'garage_manager' | 'mechanic' | 'reception'

export interface StaffInvite {
  email: string
  role: StaffRole
  garageId: string
  garageName: string
  invitedBy: string          // owner uid
  invitedByName: string
  status: 'pending' | 'accepted'
  createdAt: Timestamp | null
  acceptedAt?: Timestamp | null
}

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase()
}

// ---- OWNER: create an invite ----
export async function createStaffInvite(params: {
  garageId: string
  garageName: string
  email: string
  role: StaffRole
  invitedBy: string
  invitedByName: string
}): Promise<{ success: boolean; error?: string }> {
  try {
    const email = normalizeEmail(params.email)
    const ref = doc(db, 'garages', params.garageId, 'invites', email)
    const invite: StaffInvite = {
      email,
      role: params.role,
      garageId: params.garageId,
      garageName: params.garageName,
      invitedBy: params.invitedBy,
      invitedByName: params.invitedByName,
      status: 'pending',
      createdAt: serverTimestamp() as unknown as Timestamp,
    }
    await setDoc(ref, invite)
    return { success: true }
  } catch (error: any) {
    return { success: false, error: error?.message || 'Failed to create invite.' }
  }
}

// ---- OWNER: revoke an invite ----
export async function revokeStaffInvite(garageId: string, email: string): Promise<void> {
  await deleteDoc(doc(db, 'garages', garageId, 'invites', normalizeEmail(email)))
}

// ---- OWNER: list invites for a garage ----
export async function listGarageInvites(garageId: string): Promise<StaffInvite[]> {
  const snap = await getDocs(collection(db, 'garages', garageId, 'invites'))
  return snap.docs.map((d) => d.data() as StaffInvite)
}

// ---- INVITEE: find invites addressed to my email (across garages) ----
// Requires a collectionGroup index on invites(email).
export async function findMyInvites(email: string): Promise<StaffInvite[]> {
  const q = query(collectionGroup(db, 'invites'), where('email', '==', normalizeEmail(email)))
  const snap = await getDocs(q)
  return snap.docs
    .map((d) => d.data() as StaffInvite)
    .filter((i) => i.status === 'pending')
}

// ---- INVITEE: accept an invite (promotes own user doc to staff role) ----
export async function acceptStaffInvite(params: {
  userId: string
  garageId: string
  role: StaffRole
}): Promise<{ success: boolean; error?: string }> {
  try {
    // 1) Promote own user doc — rules verify the matching invite exists.
    await updateDoc(doc(db, 'users', params.userId), {
      role: params.role,
      garageId: params.garageId,
      updatedAt: serverTimestamp(),
    })
    // 2) Mark the invite accepted (owner-readable audit; invitee can write own email doc? No —
    //    only owner can write invites, so we just leave it. Owner UI can prune accepted ones,
    //    or you can add a Cloud Function later. Acceptance is proven by the user doc.)
    return { success: true }
  } catch (error: any) {
    return { success: false, error: error?.message || 'Failed to accept invite.' }
  }
}

// ---- OWNER BOOTSTRAP: claim a garage you just created ----
// Rules verify garage.ownerId == uid before allowing the role change.
export async function claimGarageOwnership(params: {
  userId: string
  garageId: string
}): Promise<{ success: boolean; error?: string }> {
  try {
    // Sanity check client-side (rules enforce server-side too)
    const garageSnap = await getDoc(doc(db, 'garages', params.garageId))
    if (!garageSnap.exists()) return { success: false, error: 'Garage not found.' }
    if (garageSnap.data().ownerId !== params.userId) {
      return { success: false, error: 'You do not own this garage.' }
    }
    await updateDoc(doc(db, 'users', params.userId), {
      role: 'garage_owner' as UserRole,
      garageId: params.garageId,
      updatedAt: serverTimestamp(),
    })
    return { success: true }
  } catch (error: any) {
    return { success: false, error: error?.message || 'Failed to claim ownership.' }
  }
}
