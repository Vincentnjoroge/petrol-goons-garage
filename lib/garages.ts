/**
 * Petrol Goons Garage SaaS — Garage Management
 *
 * Firestore Structure:
 *   garages/{garageId}                    — Garage profile + subscription
 *   garages/{garageId}/staff/{staffId}    — Staff members (owner, manager, mechanic, reception)
 *   garages/{garageId}/customers/{custId} — Customer records per garage
 *   garages/{garageId}/services/{svcId}   — Service catalog
 *   garages/{garageId}/jobs/{jobId}       — Bookings / work orders
 *   garages/{garageId}/activity/{logId}   — Audit trail
 *
 *   users/{userId}                        — Global user profile with role + garageId
 */

import {
  collection,
  addDoc,
  getDoc,
  doc,
  updateDoc,
  query,
  where,
  getDocs,
  orderBy,
  serverTimestamp,
  Timestamp,
  setDoc,
  deleteDoc,
  limit,
} from 'firebase/firestore'
import { db } from './firebase'
import {
  Garage,
  GarageStatus,
  StaffMember,
  GarageCustomer,
  ServiceItem,
  UserProfile,
  UserRole,
  SubscriptionPlan,
  SUBSCRIPTION_PLANS,
  GARAGE_SERVICES,
  CURRENT_SYSTEMS,
  MECHANIC_COUNTS,
} from './types'

// Re-export constants for backward compatibility
export { GARAGE_SERVICES, CURRENT_SYSTEMS, MECHANIC_COUNTS }

// Legacy type alias for backward compatibility with existing pages
export type GarageProfile = Garage

// ==============================
// SLUG GENERATION
// ==============================

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

export async function createGarage(
  data: {
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
    description?: string
    photos?: string[]
    operatingHours?: any
    servicesOffered: string[]
    mechanicCount: string
    currentSystem: string
    plan?: SubscriptionPlan
  }
): Promise<{ success: boolean; garageId?: string; error?: string }> {
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
      description: data.description || '',
      photos: data.photos || [],
      operatingHours: data.operatingHours || null,
      status: 'pending' as GarageStatus,
      subscriptionPlan: plan,
      subscriptionStatus: 'trial',
      planLimits: planConfig.limits,
      servicesOffered: data.servicesOffered,
      mechanicCount: data.mechanicCount,
      currentSystem: data.currentSystem,
      createdAt: serverTimestamp() as unknown as Timestamp,
      updatedAt: serverTimestamp() as unknown as Timestamp,
    }

    const garageRef = await addDoc(collection(db, 'garages'), garageData)

    // Also create the owner as a staff member in the garage
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

    // Update the user's profile with their role and garageId
    const userRef = doc(db, 'users', data.ownerId)
    const userSnap = await getDoc(userRef)
    if (userSnap.exists()) {
      await updateDoc(userRef, {
        role: 'garage_owner',
        garageId: garageRef.id,
        updatedAt: serverTimestamp(),
      })
    } else {
      await setDoc(userRef, {
        uid: data.ownerId,
        email: data.ownerEmail,
        displayName: data.ownerName,
        phoneNumber: data.ownerPhone,
        role: 'garage_owner',
        garageId: garageRef.id,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      })
    }

    return { success: true, garageId: garageRef.id }
  } catch (error: any) {
    console.error('Error creating garage:', error)
    return { success: false, error: error.message }
  }
}

// Legacy alias for backward compat
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
    mechanicCount: data.mechanicCount,
    currentSystem: data.currentSystem,
  })
}

export async function getGarageById(garageId: string): Promise<Garage | null> {
  try {
    const docRef = doc(db, 'garages', garageId)
    const snap = await getDoc(docRef)
    if (!snap.exists()) return null
    return { id: snap.id, ...snap.data() } as Garage
  } catch (error) {
    console.error('Error getting garage by ID:', error)
    return null
  }
}

export async function getGarageByOwner(ownerId: string): Promise<Garage | null> {
  try {
    const q = query(
      collection(db, 'garages'),
      where('ownerId', '==', ownerId)
    )
    const snapshot = await getDocs(q)
    if (snapshot.empty) return null
    const d = snapshot.docs[0]
    return { id: d.id, ...d.data() } as Garage
  } catch (error) {
    console.error('Error getting garage by owner:', error)
    return null
  }
}

export async function getAllGarages(): Promise<Garage[]> {
  try {
    const q = query(
      collection(db, 'garages'),
      orderBy('createdAt', 'desc')
    )
    const snapshot = await getDocs(q)
    return snapshot.docs.map(d => ({ id: d.id, ...d.data() })) as Garage[]
  } catch (error) {
    console.error('Error getting all garages:', error)
    return []
  }
}

export async function getApprovedGarages(): Promise<Garage[]> {
  try {
    const q = query(
      collection(db, 'garages'),
      where('status', 'in', ['approved', 'active']),
      orderBy('createdAt', 'desc')
    )
    const snapshot = await getDocs(q)
    return snapshot.docs.map(d => ({ id: d.id, ...d.data() })) as Garage[]
  } catch (error) {
    console.error('Error getting approved garages:', error)
    return []
  }
}

export async function updateGarageProfile(
  garageId: string,
  data: Partial<Garage>
): Promise<{ success: boolean; error?: string }> {
  try {
    const garageRef = doc(db, 'garages', garageId)
    await updateDoc(garageRef, {
      ...data,
      updatedAt: serverTimestamp(),
    })
    return { success: true }
  } catch (error: any) {
    console.error('Error updating garage:', error)
    return { success: false, error: error.message }
  }
}

// ==============================
// STAFF MANAGEMENT
// ==============================

export async function addStaffMember(
  garageId: string,
  data: {
    userId: string
    name: string
    email: string
    phone?: string
    role: 'garage_manager' | 'mechanic' | 'reception'
    skills?: string[]
  }
): Promise<{ success: boolean; staffId?: string; error?: string }> {
  try {
    const staffRef = await addDoc(collection(db, 'garages', garageId, 'staff'), {
      ...data,
      garageId,
      isActive: true,
      joinedAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    })

    // Update user profile
    const userRef = doc(db, 'users', data.userId)
    const userSnap = await getDoc(userRef)
    if (userSnap.exists()) {
      await updateDoc(userRef, {
        role: data.role,
        garageId,
        updatedAt: serverTimestamp(),
      })
    } else {
      await setDoc(userRef, {
        uid: data.userId,
        email: data.email,
        displayName: data.name,
        phoneNumber: data.phone || '',
        role: data.role,
        garageId,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      })
    }

    return { success: true, staffId: staffRef.id }
  } catch (error: any) {
    console.error('Error adding staff:', error)
    return { success: false, error: error.message }
  }
}

export async function getGarageStaff(garageId: string): Promise<StaffMember[]> {
  try {
    const q = query(
      collection(db, 'garages', garageId, 'staff'),
      where('isActive', '==', true)
    )
    const snapshot = await getDocs(q)
    return snapshot.docs.map(d => ({ id: d.id, ...d.data() })) as StaffMember[]
  } catch (error) {
    console.error('Error getting staff:', error)
    return []
  }
}

export async function getGarageMechanics(garageId: string): Promise<StaffMember[]> {
  try {
    const q = query(
      collection(db, 'garages', garageId, 'staff'),
      where('role', '==', 'mechanic'),
      where('isActive', '==', true)
    )
    const snapshot = await getDocs(q)
    return snapshot.docs.map(d => ({ id: d.id, ...d.data() })) as StaffMember[]
  } catch (error) {
    console.error('Error getting mechanics:', error)
    return []
  }
}

export async function updateStaffMember(
  garageId: string,
  staffId: string,
  data: Partial<StaffMember>
): Promise<{ success: boolean; error?: string }> {
  try {
    const staffRef = doc(db, 'garages', garageId, 'staff', staffId)
    await updateDoc(staffRef, {
      ...data,
      updatedAt: serverTimestamp(),
    })
    return { success: true }
  } catch (error: any) {
    console.error('Error updating staff:', error)
    return { success: false, error: error.message }
  }
}

export async function removeStaffMember(
  garageId: string,
  staffId: string,
  userId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    // Soft-delete: mark as inactive
    await updateDoc(doc(db, 'garages', garageId, 'staff', staffId), {
      isActive: false,
      updatedAt: serverTimestamp(),
    })
    // Remove garageId from user profile
    await updateDoc(doc(db, 'users', userId), {
      role: 'customer',
      garageId: null,
      updatedAt: serverTimestamp(),
    })
    return { success: true }
  } catch (error: any) {
    console.error('Error removing staff:', error)
    return { success: false, error: error.message }
  }
}

// ==============================
// CUSTOMER MANAGEMENT (per garage)
// ==============================

export async function getOrCreateGarageCustomer(
  garageId: string,
  data: { userId: string; name: string; email: string; phone?: string }
): Promise<GarageCustomer | null> {
  try {
    // Check if customer exists for this garage
    const q = query(
      collection(db, 'garages', garageId, 'customers'),
      where('userId', '==', data.userId)
    )
    const snapshot = await getDocs(q)

    if (!snapshot.empty) {
      return { id: snapshot.docs[0].id, ...snapshot.docs[0].data() } as GarageCustomer
    }

    // Create new customer record
    const customerRef = await addDoc(collection(db, 'garages', garageId, 'customers'), {
      userId: data.userId,
      garageId,
      name: data.name,
      email: data.email,
      phone: data.phone || '',
      vehicles: [],
      totalVisits: 0,
      totalSpend: 0,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    })

    return {
      id: customerRef.id,
      userId: data.userId,
      garageId,
      name: data.name,
      email: data.email,
      phone: data.phone,
      vehicles: [],
      totalVisits: 0,
      totalSpend: 0,
    } as unknown as GarageCustomer
  } catch (error) {
    console.error('Error getting/creating customer:', error)
    return null
  }
}

export async function getGarageCustomers(garageId: string): Promise<GarageCustomer[]> {
  try {
    const q = query(
      collection(db, 'garages', garageId, 'customers'),
      orderBy('createdAt', 'desc')
    )
    const snapshot = await getDocs(q)
    return snapshot.docs.map(d => ({ id: d.id, ...d.data() })) as GarageCustomer[]
  } catch (error) {
    console.error('Error getting customers:', error)
    return []
  }
}

// ==============================
// USER PROFILE MANAGEMENT
// ==============================

export async function getUserProfile(userId: string): Promise<UserProfile | null> {
  try {
    const userRef = doc(db, 'users', userId)
    const snap = await getDoc(userRef)
    if (!snap.exists()) return null
    return { id: snap.id, ...snap.data() } as UserProfile
  } catch (error) {
    console.error('Error getting user profile:', error)
    return null
  }
}

export async function saveUserProfile(
  userId: string,
  data: {
    email: string
    displayName: string
    photoURL?: string
    phoneNumber?: string
    role?: UserRole
    garageId?: string | null
  }
): Promise<void> {
  try {
    const userRef = doc(db, 'users', userId)
    const snap = await getDoc(userRef)

    if (snap.exists()) {
      await updateDoc(userRef, {
        email: data.email,
        displayName: data.displayName,
        ...(data.photoURL && { photoURL: data.photoURL }),
        ...(data.phoneNumber && { phoneNumber: data.phoneNumber }),
        updatedAt: serverTimestamp(),
      })
    } else {
      await setDoc(userRef, {
        uid: userId,
        email: data.email,
        displayName: data.displayName,
        photoURL: data.photoURL || '',
        phoneNumber: data.phoneNumber || '',
        role: data.role || 'customer',
        garageId: data.garageId || null,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      })
    }
  } catch (error) {
    console.error('Error saving user profile:', error)
  }
}
