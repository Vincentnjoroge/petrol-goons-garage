import {
  collection,
  addDoc,
  getDocs,
  getDoc,
  setDoc,
  doc,
  updateDoc,
  query,
  where,
  orderBy,
  serverTimestamp,
  Timestamp,
} from 'firebase/firestore'
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage'
import { db, storage } from './firebase'

export interface Booking {
  id?: string
  userId: string
  customerName: string
  customerEmail: string
  customerPhone: string
  vinNumber?: string
  service?: string
  otherService?: string
  description?: string
  photos: string[]
  preferredDate: string
  preferredTime: string
  status: 'pending' | 'confirmed' | 'approved' | 'rejected' | 'completed' | 'cancelled'
  submittedAt: Timestamp
  updatedAt: Timestamp
  approvedBy?: string
  completedAt?: Timestamp
  serviceNotes?: string
  serviceNotesBy?: string
  bookingTag?: string
  mechanicPreference?: string
}

// Generate a unique booking tag like "PG-A3F7"
export function generateBookingTag(): string {
  return 'PG-' + Math.random().toString(36).substring(2, 6).toUpperCase()
}

// Mechanic list
export const MECHANICS = [
  { id: 'mike-d', name: 'Mike D' },
  { id: 'kimanthi', name: 'Kimanthi' },
  { id: 'thomas', name: 'Thomas' },
  { id: 'viny', name: 'Viny' },
] as const

export function getMechanicName(id: string): string {
  if (id === 'garage-assigns') return 'Garage will assign'
  const mech = MECHANICS.find(m => m.id === id)
  return mech ? mech.name : id
}

// Save or update user's car info (so they don't re-type VIN on repeat bookings)
export async function saveUserCar(userId: string, vinNumber: string) {
  try {
    const userRef = doc(db, 'users', userId)
    const snap = await getDoc(userRef)
    if (snap.exists()) {
      const data = snap.data()
      const cars: string[] = data.cars || []
      if (!cars.map(c => c.toLowerCase()).includes(vinNumber.toLowerCase())) {
        cars.push(vinNumber)
        await updateDoc(userRef, { cars, updatedAt: serverTimestamp() })
      }
    } else {
      await setDoc(userRef, { cars: [vinNumber], createdAt: serverTimestamp(), updatedAt: serverTimestamp() })
    }
  } catch (error) {
    console.error('Error saving user car:', error)
  }
}

// Get user's saved cars (VIN numbers)
export async function getUserCars(userId: string): Promise<string[]> {
  try {
    const userRef = doc(db, 'users', userId)
    const snap = await getDoc(userRef)
    if (snap.exists()) {
      return snap.data().cars || []
    }
    return []
  } catch (error) {
    console.error('Error getting user cars:', error)
    return []
  }
}

// Generate all 30-min time slots from 8:00 AM to 5:30 PM (last slot starts at 17:30)
export function generateTimeSlots(): string[] {
  const slots: string[] = []
  for (let hour = 8; hour < 18; hour++) {
    const hStr = hour.toString().padStart(2, '0')
    slots.push(`${hStr}:00`)
    if (hour < 18) {
      slots.push(`${hStr}:30`)
    }
  }
  // Remove the 18:00 slot — last slot is 17:30
  return slots.filter(s => s !== '18:00')
}

// Format a slot string like "08:00" to "8:00 AM"
export function formatSlotTime(slot: string): string {
  const [hourStr, min] = slot.split(':')
  const hour = parseInt(hourStr, 10)
  const amPm = hour >= 12 ? 'PM' : 'AM'
  const displayHour = hour > 12 ? hour - 12 : hour === 0 ? 12 : hour
  return `${displayHour}:${min} ${amPm}`
}

// Check if a date is a Sunday
export function isSunday(dateStr: string): boolean {
  const date = new Date(dateStr + 'T00:00:00')
  return date.getDay() === 0
}

// Get booked slots for a given date (returns array of time strings like ["08:00", "09:30"])
export async function getBookedSlots(date: string): Promise<string[]> {
  try {
    const bookingsQuery = query(
      collection(db, 'bookings'),
      where('preferredDate', '==', date),
      where('status', 'in', ['confirmed', 'approved', 'pending'])
    )
    const snapshot = await getDocs(bookingsQuery)
    return snapshot.docs.map(doc => doc.data().preferredTime as string)
  } catch (error: any) {
    console.error('Error getting booked slots:', error)
    return []
  }
}

// Upload photos to Firebase Storage and return download URLs
async function uploadPhotos(userId: string, bookingId: string, photos: File[]): Promise<string[]> {
  const urls: string[] = []
  for (let i = 0; i < photos.length; i++) {
    const file = photos[i]
    const fileRef = ref(storage, `bookings/${userId}/${bookingId}/${Date.now()}_${i}_${file.name}`)
    await uploadBytes(fileRef, file)
    const url = await getDownloadURL(fileRef)
    urls.push(url)
  }
  return urls
}

// Create a new booking with double-booking guard
export async function createBooking(bookingData: Omit<Booking, 'id' | 'submittedAt' | 'updatedAt' | 'status' | 'photos'>, photos?: File[]) {
  try {
    // Server-side guard: check if slot is still available
    const bookedSlots = await getBookedSlots(bookingData.preferredDate)
    if (bookedSlots.includes(bookingData.preferredTime)) {
      return { success: false, error: 'This time slot was just taken. Please pick another one.' }
    }

    // Generate a unique booking tag if not provided
    const bookingTag = bookingData.bookingTag || generateBookingTag()

    // Create booking document first (so we have an ID for photo storage path)
    const bookingRef = await addDoc(collection(db, 'bookings'), {
      ...bookingData,
      bookingTag,
      photos: [],
      status: 'pending',
      submittedAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    })

    // Upload photos if provided
    let photoUrls: string[] = []
    if (photos && photos.length > 0) {
      try {
        photoUrls = await uploadPhotos(bookingData.userId, bookingRef.id, photos)
        // Update booking with photo URLs
        await updateDoc(doc(db, 'bookings', bookingRef.id), { photos: photoUrls })
      } catch (photoErr) {
        console.error('Photo upload failed (booking still saved):', photoErr)
      }
    }

    // Auto-save VIN to user profile for future auto-fill
    if (bookingData.vinNumber?.trim()) {
      saveUserCar(bookingData.userId, bookingData.vinNumber.trim()).catch(() => {})
    }

    return { success: true, bookingId: bookingRef.id, bookingTag, photos: photoUrls }
  } catch (error: any) {
    console.error('Error creating booking:', error)
    return { success: false, error: error.message }
  }
}

// Get all bookings
export async function getAllBookings(): Promise<Booking[]> {
  try {
    const bookingsQuery = query(
      collection(db, 'bookings'),
      orderBy('submittedAt', 'desc')
    )
    const snapshot = await getDocs(bookingsQuery)
    return snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
    })) as Booking[]
  } catch (error: any) {
    console.error('Error getting bookings:', error)
    return []
  }
}

// Get bookings for a specific user
export async function getUserBookings(userId: string): Promise<Booking[]> {
  try {
    const bookingsQuery = query(
      collection(db, 'bookings'),
      where('userId', '==', userId),
      orderBy('submittedAt', 'desc')
    )
    const snapshot = await getDocs(bookingsQuery)
    return snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
    })) as Booking[]
  } catch (error: any) {
    console.error('Error getting user bookings:', error)
    return []
  }
}

// Get bookings by VIN (service history)
export async function getBookingsByVin(vinNumber: string): Promise<Booking[]> {
  try {
    const bookingsQuery = query(
      collection(db, 'bookings'),
      where('vinNumber', '==', vinNumber),
      where('status', '==', 'completed'),
      orderBy('completedAt', 'desc')
    )
    const snapshot = await getDocs(bookingsQuery)
    return snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
    })) as Booking[]
  } catch (error: any) {
    console.error('Error getting bookings by VIN:', error)
    return []
  }
}

// Add service notes to a booking (mechanic logs what was done)
export async function addServiceNotes(bookingId: string, notes: string, addedBy: string) {
  try {
    const bookingRef = doc(db, 'bookings', bookingId)
    await updateDoc(bookingRef, {
      serviceNotes: notes,
      serviceNotesBy: addedBy,
      updatedAt: serverTimestamp(),
    })
    return { success: true }
  } catch (error: any) {
    console.error('Error adding service notes:', error)
    return { success: false, error: error.message }
  }
}

// Reschedule a booking (admin suggests a new date/time)
export async function rescheduleBooking(
  bookingId: string,
  newDate: string,
  newTime: string,
  rescheduledBy?: string
) {
  try {
    const bookingRef = doc(db, 'bookings', bookingId)
    await updateDoc(bookingRef, {
      preferredDate: newDate,
      preferredTime: newTime,
      status: 'approved',
      rescheduledBy: rescheduledBy || 'Admin',
      rescheduledAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    })
    return { success: true }
  } catch (error: any) {
    console.error('Error rescheduling booking:', error)
    return { success: false, error: error.message }
  }
}

// Update booking status
export async function updateBookingStatus(
  bookingId: string,
  status: 'confirmed' | 'approved' | 'rejected' | 'completed' | 'cancelled',
  approvedBy?: string
) {
  try {
    const bookingRef = doc(db, 'bookings', bookingId)
    const updateData: any = {
      status,
      updatedAt: serverTimestamp(),
    }

    if (approvedBy) {
      updateData.approvedBy = approvedBy
    }

    if (status === 'completed') {
      updateData.completedAt = serverTimestamp()
    }

    await updateDoc(bookingRef, updateData)
    return { success: true }
  } catch (error: any) {
    console.error('Error updating booking status:', error)
    return { success: false, error: error.message }
  }
}
