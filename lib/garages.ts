import {
  collection,
  addDoc,
  getDoc,
  setDoc,
  doc,
  updateDoc,
  query,
  where,
  getDocs,
  orderBy,
  serverTimestamp,
  Timestamp,
} from 'firebase/firestore'
import { db } from './firebase'

// Garage profile — what a garage owner fills in during onboarding
export interface GarageProfile {
  id?: string
  ownerId: string              // Firebase Auth UID
  ownerName: string
  ownerEmail: string
  ownerPhone: string
  garageName: string
  location: string             // Area/neighborhood (e.g. "Westlands, Nairobi")
  googleMapsLink?: string      // Optional pin
  servicesOffered: string[]    // From predefined list
  mechanicCount: string        // "1-2", "3-5", "6-10", "10+"
  currentSystem: string        // How they manage now
  status: 'pending' | 'approved' | 'active' | 'suspended'
  plan?: string                // Selected pricing plan
  createdAt: Timestamp
  updatedAt: Timestamp
}

// Predefined services garages can offer
export const GARAGE_SERVICES = [
  'Oil Change',
  'Brake Service',
  'Tyre Service',
  'Suspension',
  'Diagnostics',
  'Body Work',
  'Detailing',
  'Air Filter',
  'Electrical',
  'Engine Work',
  'Transmission',
  'AC Service',
  'Wheel Alignment',
  'General Repair',
] as const

// Current management options
export const CURRENT_SYSTEMS = [
  'Paper & notebooks',
  'WhatsApp messages',
  'Phone calls only',
  'Simple spreadsheet',
  'Another software',
  'Nothing — just walk-ins',
] as const

// Mechanic count options
export const MECHANIC_COUNTS = [
  { value: '1-2', label: '1–2 mechanics' },
  { value: '3-5', label: '3–5 mechanics' },
  { value: '6-10', label: '6–10 mechanics' },
  { value: '10+', label: '10+ mechanics' },
] as const

// Create a new garage profile
export async function createGarageProfile(
  data: Omit<GarageProfile, 'id' | 'createdAt' | 'updatedAt' | 'status'>
): Promise<{ success: boolean; garageId?: string; error?: string }> {
  try {
    const garageRef = await addDoc(collection(db, 'garages'), {
      ...data,
      status: 'pending',
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    })
    return { success: true, garageId: garageRef.id }
  } catch (error: any) {
    console.error('Error creating garage profile:', error)
    return { success: false, error: error.message }
  }
}

// Get garage profile by owner's user ID
export async function getGarageByOwner(ownerId: string): Promise<GarageProfile | null> {
  try {
    const q = query(
      collection(db, 'garages'),
      where('ownerId', '==', ownerId)
    )
    const snapshot = await getDocs(q)
    if (snapshot.empty) return null
    const doc = snapshot.docs[0]
    return { id: doc.id, ...doc.data() } as GarageProfile
  } catch (error) {
    console.error('Error getting garage profile:', error)
    return null
  }
}

// Get garage profile by ID
export async function getGarageById(garageId: string): Promise<GarageProfile | null> {
  try {
    const docRef = doc(db, 'garages', garageId)
    const snap = await getDoc(docRef)
    if (!snap.exists()) return null
    return { id: snap.id, ...snap.data() } as GarageProfile
  } catch (error) {
    console.error('Error getting garage by ID:', error)
    return null
  }
}

// Get all garage profiles (for admin dashboard)
export async function getAllGarages(): Promise<GarageProfile[]> {
  try {
    const q = query(
      collection(db, 'garages'),
      orderBy('createdAt', 'desc')
    )
    const snapshot = await getDocs(q)
    return snapshot.docs.map(d => ({ id: d.id, ...d.data() })) as GarageProfile[]
  } catch (error) {
    console.error('Error getting all garages:', error)
    return []
  }
}

// Update garage profile
export async function updateGarageProfile(
  garageId: string,
  data: Partial<GarageProfile>
): Promise<{ success: boolean; error?: string }> {
  try {
    const garageRef = doc(db, 'garages', garageId)
    await updateDoc(garageRef, {
      ...data,
      updatedAt: serverTimestamp(),
    })
    return { success: true }
  } catch (error: any) {
    console.error('Error updating garage profile:', error)
    return { success: false, error: error.message }
  }
}
