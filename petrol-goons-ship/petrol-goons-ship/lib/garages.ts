/**
 * Petrol Goons Garage SaaS — Garage Management (fixed)
 *
 * Key fix: createGarage now updates the user doc BEFORE writing the staff
 * subcollection so that isGarageOwner() returns true when the staff doc write
 * is evaluated by Firestore rules.
 */

import {
  collection, addDoc, getDoc, doc, updateDoc,
  query, where, getDocs, orderBy,
  serverTimestamp, Timestamp, setDoc, deleteDoc, limit,
} from 'firebase/firestore'
import { db } from './firebase'
import {
  Garage, GarageStatus, StaffMember, GarageCustomer,
  ServiceItem, UserProfile, UserRole, SubscriptionPlan,
  SUBSCRIPTION_PLANS, GARAGE_SERVICES, CURRENT_SYSTEMS, MECHANIC_COUNTS,
} from './types'

export { GARAGE_SERVICES, CURRENT_SYSTEMS, MECHANIC_COUNTS }
export type GarageProfile = Garage

function generateSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .trim()
}

// ==============================
// GARAGE CRUD
// ==============================

export async function createGarage(data: {
  name: string
  ownerId: string
  ownerName: string
  ownerEmail: string
  ownerPhone: string
  location: string
  county?: string
  area?: string
  googleMapsLink?: string
  country?: string
  currency?: string
  region?: string
  servicesOffered: string[]
  mechanicCount: string
  currentSystem: string
  description?: string
  photos?: string[]
  operatingHours?: any
  plan?: SubscriptionPlan
}): Promise<{ success: boolean; garageId?: string; error?: string }> {
  try {
    const plan: SubscriptionPlan = data.plan || 'basic'
    const planConfig = SUBSCRIPTION_PLANS[plan]

    const garageData: Omit<Garage, 'id'> = {
      name: data.name,
      slug: generateSlug(data.name),
      ownerId: data.ownerId,
      ownerName: data.ownerName,
      ownerEmail: data.ownerEmail,
      ownerPhone: data.ownerPhone,
      location: data.location,
      county: data.county || '',
      area: data.area || '',
      googleMapsLink: data.googleMapsLink || '',
      country: data.country || 'KE',
      currency: data.currency || 'KES',
      region: data.region || '',
      // FIX: auto-approve so owner can use the dashboard immediately
      status: 'active' as GarageStatus,
      description: data.description || '',
      photos: data.photos || [],
      operatingHours: data.operatingHours || null,
      subscriptionPlan: plan,
      subscriptionStatus: 'trial',
      planLimits: planConfig.limits,
      servicesOffered: data.servicesOffered,
      mechanicCount: data.mechanicCount,
      currentSystem: data.currentSystem,
      createdAt: serverTimestamp() as unknown as Timestamp,
      updatedAt: serverTimestamp() as unknown as Timestamp,
    }

    // Step 1: create garage doc
    const garageRef = await addDoc(collection(db, 'garages'), garageData)

    // Step 2: FIX — update the user doc to garage_owner FIRST, before writing the
    // staff subcollection. The Firestore rule for staff write is isGarageOwner(garageId),
    // which reads the user doc at evaluation time. If user is still 'customer' when we
    // try to write staff, the rule rejects it.
    const userRef = doc(db, 'users', data.ownerId)
    const userSnap = await getDoc(userRef)
    if (userSnap.exists()) {
      await updateDoc(userRef, {
        role: 'garage_owner' as UserRole,
        garageId: garageRef.id,
        updatedAt: serverTimestamp(),
      })
    } else {
      await setDoc(userRef, {
        uid: data.ownerId,
        email: data.ownerEmail,
        displayName: data.ownerName,
        phoneNumber: data.ownerPhone,
        role: 'garage_owner' as UserRole,
        garageId: garageRef.id,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      })
    }

    // Step 3: NOW we can write the staff doc (isGarageOwner is now true)
    await addDoc(collection(db, 'garages', garageRef.id, 'staff'), {
      userId: data.ownerId,
      garageId: garageRef.id,
      name: data.ownerName,
      email: data.ownerEmail,
      phone: data.ownerPhone,
      role: 'garage_owner',
      isActive: true,
      joinedAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    })

    return { success: true, garageId: garageRef.id }
  } catch (error: any) {
    console.error('Error creating garage:', error)
    return { success: false, error: error.message }
  }
}

// Legacy alias kept for backward compat with any remaining callers
export async function createGarageProfile(
  data: Omit<any, 'id' | 'createdAt' | 'updatedAt' | 'status'>
): Promise<{ success: boolean; garageId?: string; error?: string }> {
  return createGarage({
    name: data.garageName,
    ownerId: data.ownerId,
    ownerName: data.ownerName,
    ownerEmail: data.ownerEmail,
    ownerPhone: data.ownerPhone,
    location: data.location,
    googleMapsLink: data.googleMapsLink,
    servicesOffered: data.servicesOffered,
    mechanicCount: data.mechanicCount || '1-2',
    currentSystem: data.currentSystem || 'Nothing — just memory',
    description: data.description,
    photos: data.photos,
    operatingHours: data.operatingHours,
  })
}

export async function getGarageById(garageId: string): Promise<Garage | null> {
  try {
    const snap = await getDoc(doc(db, 'garages', garageId))
    if (!snap.exists()) return null
    return { id: snap.id, ...snap.data() } as Garage
  } catch { return null }
}

export async function getGarageByOwner(ownerId: string): Promise<Garage | null> {
  try {
    const q = query(collection(db, 'garages'), where('ownerId', '==', ownerId))
    const snap = await getDocs(q)
    if (snap.empty) return null
    const d = snap.docs[0]
    return { id: d.id, ...d.data() } as Garage
  } catch { return null }
}

export async function getAllGarages(): Promise<Garage[]> {
  try {
    const q = query(collection(db, 'garages'), orderBy('createdAt', 'desc'))
    const snap = await getDocs(q)
    return snap.docs.map(d => ({ id: d.id, ...d.data() })) as Garage[]
  } catch { return [] }
}

export async function getApprovedGarages(): Promise<Garage[]> {
  try {
    const q = query(
      collection(db, 'garages'),
      where('status', 'in', ['approved', 'active']),
      orderBy('createdAt', 'desc')
    )
    const snap = await getDocs(q)
    return snap.docs.map(d => ({ id: d.id, ...d.data() })) as Garage[]
  } catch { return [] }
}

export async function updateGarageProfile(
  garageId: string,
  data: Partial<Garage>
): Promise<{ success: boolean; error?: string }> {
  try {
    await updateDoc(doc(db, 'garages', garageId), { ...data, updatedAt: serverTimestamp() })
    return { success: true }
  } catch (error: any) {
    return { success: false, error: error.message }
  }
}

// ==============================
// STAFF MANAGEMENT
// ==============================

export async function addStaffMember(
  garageId: string,
  data: { userId: string; name: string; email: string; phone?: string; role: 'garage_manager' | 'mechanic' | 'reception'; skills?: string[] }
): Promise<{ success: boolean; staffId?: string; error?: string }> {
  try {
    const staffRef = await addDoc(collection(db, 'garages', garageId, 'staff'), {
      ...data, garageId, isActive: true, joinedAt: serverTimestamp(), updatedAt: serverTimestamp(),
    })
    const userRef = doc(db, 'users', data.userId)
    const userSnap = await getDoc(userRef)
    if (userSnap.exists()) {
      await updateDoc(userRef, { role: data.role, garageId, updatedAt: serverTimestamp() })
    } else {
      await setDoc(userRef, {
        uid: data.userId, email: data.email, displayName: data.name,
        phoneNumber: data.phone || '', role: data.role, garageId,
        createdAt: serverTimestamp(), updatedAt: serverTimestamp(),
      })
    }
    return { success: true, staffId: staffRef.id }
  } catch (error: any) {
    return { success: false, error: error.message }
  }
}

export async function getGarageStaff(garageId: string): Promise<StaffMember[]> {
  try {
    const q = query(collection(db, 'garages', garageId, 'staff'), where('isActive', '==', true))
    const snap = await getDocs(q)
    return snap.docs.map(d => ({ id: d.id, ...d.data() })) as StaffMember[]
  } catch { return [] }
}

export async function getGarageMechanics(garageId: string): Promise<StaffMember[]> {
  try {
    const q = query(
      collection(db, 'garages', garageId, 'staff'),
      where('role', '==', 'mechanic'),
      where('isActive', '==', true)
    )
    const snap = await getDocs(q)
    return snap.docs.map(d => ({ id: d.id, ...d.data() })) as StaffMember[]
  } catch { return [] }
}

export async function updateStaffMember(
  garageId: string, staffId: string, data: Partial<StaffMember>
): Promise<{ success: boolean; error?: string }> {
  try {
    await updateDoc(doc(db, 'garages', garageId, 'staff', staffId), { ...data, updatedAt: serverTimestamp() })
    return { success: true }
  } catch (error: any) {
    return { success: false, error: error.message }
  }
}

export async function removeStaffMember(
  garageId: string, staffId: string, userId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    await updateDoc(doc(db, 'garages', garageId, 'staff', staffId), { isActive: false, updatedAt: serverTimestamp() })
    await updateDoc(doc(db, 'users', userId), { role: 'customer', garageId: null, updatedAt: serverTimestamp() })
    return { success: true }
  } catch (error: any) {
    return { success: false, error: error.message }
  }
}

// ==============================
// CUSTOMER MANAGEMENT
// ==============================

export async function getOrCreateGarageCustomer(
  garageId: string,
  data: { userId: string; name: string; email: string; phone?: string }
): Promise<GarageCustomer | null> {
  try {
    const q = query(collection(db, 'garages', garageId, 'customers'), where('userId', '==', data.userId))
    const snap = await getDocs(q)
    if (!snap.empty) return { id: snap.docs[0].id, ...snap.docs[0].data() } as GarageCustomer
    const ref = await addDoc(collection(db, 'garages', garageId, 'customers'), {
      ...data, garageId, vehicles: [], totalVisits: 0, totalSpend: 0,
      createdAt: serverTimestamp(), updatedAt: serverTimestamp(),
    })
    return { id: ref.id, ...data, garageId, vehicles: [], totalVisits: 0, totalSpend: 0 } as unknown as GarageCustomer
  } catch { return null }
}

export async function getGarageCustomers(garageId: string): Promise<GarageCustomer[]> {
  try {
    const q = query(collection(db, 'garages', garageId, 'customers'), orderBy('createdAt', 'desc'))
    const snap = await getDocs(q)
    return snap.docs.map(d => ({ id: d.id, ...d.data() })) as GarageCustomer[]
  } catch { return [] }
}

// ==============================
// USER PROFILE
// ==============================

export async function getUserProfile(userId: string): Promise<UserProfile | null> {
  try {
    const snap = await getDoc(doc(db, 'users', userId))
    if (!snap.exists()) return null
    return { id: snap.id, ...snap.data() } as UserProfile
  } catch { return null }
}

export async function saveUserProfile(
  userId: string,
  data: { email: string; displayName: string; photoURL?: string; phoneNumber?: string; role?: UserRole; garageId?: string | null }
): Promise<void> {
  try {
    const userRef = doc(db, 'users', userId)
    const snap = await getDoc(userRef)
    if (snap.exists()) {
      await updateDoc(userRef, {
        email: data.email, displayName: data.displayName,
        ...(data.photoURL && { photoURL: data.photoURL }),
        ...(data.phoneNumber && { phoneNumber: data.phoneNumber }),
        updatedAt: serverTimestamp(),
      })
    } else {
      await setDoc(userRef, {
        uid: userId, email: data.email, displayName: data.displayName,
        photoURL: data.photoURL || '', phoneNumber: data.phoneNumber || '',
        role: data.role || 'customer', garageId: data.garageId || null,
        createdAt: serverTimestamp(), updatedAt: serverTimestamp(),
      })
    }
  } catch (error) {
    console.error('Error saving user profile:', error)
  }
}
