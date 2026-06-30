/**
 * Petrol Goons Garage SaaS — Service Catalog Management
 *
 * Lets each garage owner define their own services + pricing instead of the
 * hardcoded GARAGE_SERVICES list. Stored at garages/{garageId}/services/{id}.
 *
 * Firestore rules (already deployed) allow:
 *   read:  any signed-in user + garage staff
 *   write: garage owner only (canConfigureServices)
 */

import {
  collection, addDoc, getDocs, doc, updateDoc, deleteDoc,
  query, orderBy, serverTimestamp, Timestamp,
} from 'firebase/firestore'
import { db } from './firebase'
import { ServiceItem } from './types'

export interface GarageService {
  id?: string
  garageId: string
  name: string
  description?: string
  basePrice: number          // KES; 0 = "from" / quote on inspection
  estimatedDuration: number  // minutes
  isActive: boolean
  sortOrder: number
  createdAt?: Timestamp
  updatedAt?: Timestamp
}

export async function listServices(garageId: string): Promise<GarageService[]> {
  try {
    const q = query(collection(db, 'garages', garageId, 'services'), orderBy('sortOrder', 'asc'))
    const snap = await getDocs(q)
    return snap.docs.map((d) => ({ id: d.id, ...(d.data() as GarageService) }))
  } catch {
    // If the sortOrder index isn't present, fall back to unordered
    try {
      const snap = await getDocs(collection(db, 'garages', garageId, 'services'))
      return snap.docs.map((d) => ({ id: d.id, ...(d.data() as GarageService) }))
    } catch { return [] }
  }
}

export async function addService(
  garageId: string,
  data: { name: string; description?: string; basePrice: number; estimatedDuration: number; sortOrder?: number }
): Promise<{ success: boolean; id?: string; error?: string }> {
  try {
    const ref = await addDoc(collection(db, 'garages', garageId, 'services'), {
      garageId,
      name: data.name.trim(),
      description: data.description?.trim() || '',
      basePrice: data.basePrice || 0,
      estimatedDuration: data.estimatedDuration || 60,
      isActive: true,
      sortOrder: data.sortOrder ?? 999,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    })
    return { success: true, id: ref.id }
  } catch (error: any) {
    return { success: false, error: error?.message || 'Failed to add service' }
  }
}

export async function updateService(
  garageId: string,
  serviceId: string,
  data: Partial<GarageService>
): Promise<{ success: boolean; error?: string }> {
  try {
    await updateDoc(doc(db, 'garages', garageId, 'services', serviceId), {
      ...data, updatedAt: serverTimestamp(),
    })
    return { success: true }
  } catch (error: any) {
    return { success: false, error: error?.message || 'Failed to update service' }
  }
}

export async function deleteService(
  garageId: string,
  serviceId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    await deleteDoc(doc(db, 'garages', garageId, 'services', serviceId))
    return { success: true }
  } catch (error: any) {
    return { success: false, error: error?.message || 'Failed to delete service' }
  }
}

/**
 * Seed a new garage's catalog from the services they selected at signup.
 * Idempotent-ish: only call when the catalog is empty.
 */
export async function seedServicesFromList(
  garageId: string,
  serviceNames: string[]
): Promise<void> {
  try {
    await Promise.all(
      serviceNames.map((name, i) =>
        addService(garageId, { name, basePrice: 0, estimatedDuration: 60, sortOrder: i })
      )
    )
  } catch { /* non-fatal */ }
}

export function formatPrice(kes: number): string {
  if (!kes || kes <= 0) return 'On inspection'
  return `KSh ${kes.toLocaleString()}`
}

export function formatDuration(mins: number): string {
  if (!mins) return '—'
  if (mins < 60) return `${mins} min`
  const h = Math.floor(mins / 60)
  const m = mins % 60
  return m ? `${h}h ${m}m` : `${h}h`
}
