import {
  collection,
  addDoc,
  getDocs,
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
  vinNumber: string
  service: string
  otherService?: string
  description: string
  photos: string[]
  preferredDate: string
  preferredTime: string
  status: 'pending' | 'approved' | 'rejected' | 'completed'
  submittedAt: Timestamp
  updatedAt: Timestamp
  approvedBy?: string
  completedAt?: Timestamp
}

// Upload photos to Firebase Storage
export async function uploadBookingPhotos(bookingId: string, photos: File[]): Promise<string[]> {
  const uploadPromises = photos.map(async (photo, index) => {
    const storageRef = ref(storage, `bookings/${bookingId}/photo-${index}-${Date.now()}`)
    await uploadBytes(storageRef, photo)
    return getDownloadURL(storageRef)
  })

  return Promise.all(uploadPromises)
}

// Create a new booking
export async function createBooking(bookingData: Omit<Booking, 'id' | 'submittedAt' | 'updatedAt' | 'status'>, photos: File[]) {
  try {
    // Create booking document first to get ID
    const bookingRef = await addDoc(collection(db, 'bookings'), {
      ...bookingData,
      photos: [],
      status: 'pending',
      submittedAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    })

    // Upload photos if any
    let photoUrls: string[] = []
    if (photos.length > 0) {
      photoUrls = await uploadBookingPhotos(bookingRef.id, photos)
      await updateDoc(bookingRef, { photos: photoUrls })
    }

    return { success: true, bookingId: bookingRef.id }
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

// Update booking status
export async function updateBookingStatus(
  bookingId: string,
  status: 'approved' | 'rejected' | 'completed',
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
