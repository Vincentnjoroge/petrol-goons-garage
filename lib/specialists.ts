/**
 * Petrol Goons Garage — Independent Specialist Mechanics
 *
 * A specialist is an independent expert (not tied to a garage) who consults
 * with customers and garages via chat. They:
 *   - have role 'independent_specialist' on their user doc (garageId stays null)
 *   - have a public profile under /specialists/{uid}
 *   - appear in discovery once a super admin approves them (status: 'approved')
 *
 * Promotion path (serverless, rule-enforced):
 *   1. registerSpecialist() creates /specialists/{uid} with status 'pending'
 *   2. becomeSpecialist() flips the user doc role -> 'independent_specialist'
 *      (rules require the specialist profile to exist first)
 *   3. Super admin approves the profile -> visible in discovery
 */

import {
  doc,
  setDoc,
  getDoc,
  getDocs,
  updateDoc,
  collection,
  query,
  where,
  orderBy,
  serverTimestamp,
  Timestamp,
} from 'firebase/firestore'
import { db } from './firebase'
import type { UserRole } from './types'

export type SpecialtyArea =
  | 'engine'
  | 'electrical'
  | 'transmission'
  | 'diagnostics'
  | 'bodywork'
  | 'performance'
  | 'ev_hybrid'
  | 'general'

export interface SpecialistProfile {
  uid: string
  name: string
  photoURL?: string | null
  headline: string                 // e.g. "Subaru & turbo specialist, 12 yrs"
  bio?: string
  specialties: SpecialtyArea[]
  yearsExperience?: number
  location?: string                // e.g. "Nairobi"
  consultRate?: number | null      // KSh per consult/hour (optional, display only for now)
  phone?: string | null
  status: 'pending' | 'approved' | 'suspended'
  rating?: number
  consultCount?: number
  createdAt: Timestamp | null
  updatedAt: Timestamp | null
}

// ---- Create / register a specialist profile (status starts 'pending') ----
export async function registerSpecialist(params: {
  uid: string
  name: string
  headline: string
  specialties: SpecialtyArea[]
  bio?: string
  yearsExperience?: number
  location?: string
  consultRate?: number | null
  phone?: string | null
  photoURL?: string | null
}): Promise<{ success: boolean; error?: string }> {
  try {
    const profile: SpecialistProfile = {
      uid: params.uid,
      name: params.name,
      photoURL: params.photoURL ?? null,
      headline: params.headline,
      bio: params.bio ?? '',
      specialties: params.specialties.length ? params.specialties : ['general'],
      yearsExperience: params.yearsExperience ?? 0,
      location: params.location ?? '',
      consultRate: params.consultRate ?? null,
      phone: params.phone ?? null,
      status: 'pending',
      rating: 0,
      consultCount: 0,
      createdAt: serverTimestamp() as unknown as Timestamp,
      updatedAt: serverTimestamp() as unknown as Timestamp,
    }
    await setDoc(doc(db, 'specialists', params.uid), profile)
    return { success: true }
  } catch (error: any) {
    return { success: false, error: error?.message || 'Failed to register specialist.' }
  }
}

// ---- Promote own user doc to independent_specialist (profile must exist) ----
export async function becomeSpecialist(uid: string): Promise<{ success: boolean; error?: string }> {
  try {
    const profileSnap = await getDoc(doc(db, 'specialists', uid))
    if (!profileSnap.exists()) {
      return { success: false, error: 'Create your specialist profile first.' }
    }
    await updateDoc(doc(db, 'users', uid), {
      role: 'independent_specialist' as UserRole,
      garageId: null,
      updatedAt: serverTimestamp(),
    })
    return { success: true }
  } catch (error: any) {
    return { success: false, error: error?.message || 'Failed to upgrade account.' }
  }
}

// ---- Update own specialist profile (cannot change status) ----
export async function updateSpecialistProfile(
  uid: string,
  patch: Partial<Omit<SpecialistProfile, 'uid' | 'status' | 'createdAt'>>
): Promise<void> {
  await updateDoc(doc(db, 'specialists', uid), {
    ...patch,
    updatedAt: serverTimestamp(),
  })
}

export async function getSpecialist(uid: string): Promise<SpecialistProfile | null> {
  const snap = await getDoc(doc(db, 'specialists', uid))
  return snap.exists() ? (snap.data() as SpecialistProfile) : null
}

// ---- Discovery: list approved specialists, optionally filtered by specialty ----
export async function listSpecialists(specialty?: SpecialtyArea): Promise<SpecialistProfile[]> {
  let q
  if (specialty) {
    q = query(
      collection(db, 'specialists'),
      where('status', '==', 'approved'),
      where('specialties', 'array-contains', specialty)
    )
  } else {
    q = query(collection(db, 'specialists'), where('status', '==', 'approved'))
  }
  const snap = await getDocs(q)
  return snap.docs.map((d) => d.data() as SpecialistProfile)
}

export const SPECIALTY_LABELS: Record<SpecialtyArea, string> = {
  engine: 'Engine',
  electrical: 'Electrical',
  transmission: 'Transmission',
  diagnostics: 'Diagnostics',
  bodywork: 'Bodywork',
  performance: 'Performance',
  ev_hybrid: 'EV / Hybrid',
  general: 'General',
}
