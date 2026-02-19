/**
 * Petrol Goons Garage SaaS — Job Lifecycle Management
 *
 * Jobs are stored as subcollections under each garage:
 *   garages/{garageId}/jobs/{jobId}
 *
 * 9-state lifecycle:
 *   booking_created → checked_in → diagnosis → awaiting_parts →
 *   repair_in_progress → quality_check → ready_for_pickup → completed
 *   (any state except completed can → cancelled)
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
  limit as firestoreLimit,
} from 'firebase/firestore'
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage'
import { db, storage } from './firebase'
import {
  Job,
  JobStatus,
  StatusChange,
  ActivityLog,
  JOB_TRANSITIONS,
  JOB_STATUS_LABELS,
} from './types'

// ==============================
// BOOKING TAG GENERATION
// ==============================

function generateBookingTag(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  let tag = ''
  for (let i = 0; i < 4; i++) {
    tag += chars.charAt(Math.floor(Math.random() * chars.length))
  }
  return `PG-${tag}`
}

// ==============================
// TIME SLOT HELPERS
// ==============================

export function generateTimeSlots(): string[] {
  const slots: string[] = []
  for (let hour = 8; hour <= 17; hour++) {
    slots.push(`${hour.toString().padStart(2, '0')}:00`)
    if (hour < 17 || true) {
      slots.push(`${hour.toString().padStart(2, '0')}:30`)
    }
  }
  return slots.filter(s => s <= '17:30')
}

export function formatSlotTime(slot: string): string {
  const [h, m] = slot.split(':')
  const hour = parseInt(h)
  const ampm = hour >= 12 ? 'PM' : 'AM'
  const displayHour = hour > 12 ? hour - 12 : hour === 0 ? 12 : hour
  return `${displayHour}:${m} ${ampm}`
}

export function isSunday(dateStr: string): boolean {
  const date = new Date(dateStr + 'T00:00:00')
  return date.getDay() === 0
}

// ==============================
// JOB CRUD
// ==============================

export async function createJob(
  garageId: string,
  data: {
    customerId: string
    customerName: string
    customerEmail: string
    customerPhone: string
    vinNumber?: string
    vehicleMake?: string
    vehicleModel?: string
    vehicleYear?: string
    plateNumber?: string
    services: string[]
    otherService?: string
    description?: string
    preferredDate: string
    preferredTime: string
    assignedMechanicId?: string
    assignedMechanicName?: string
    createdBy: string
    photos?: File[]
  }
): Promise<{ success: boolean; jobId?: string; bookingTag?: string; error?: string }> {
  try {
    const bookingTag = generateBookingTag()
    const now = Timestamp.now()

    // Upload photos if any
    const photoUrls: string[] = []
    if (data.photos && data.photos.length > 0) {
      for (let i = 0; i < data.photos.length; i++) {
        const file = data.photos[i]
        const storageRef = ref(
          storage,
          `garages/${garageId}/jobs/${Date.now()}_${i}_${file.name}`
        )
        await uploadBytes(storageRef, file)
        const url = await getDownloadURL(storageRef)
        photoUrls.push(url)
      }
    }

    const jobData: Omit<Job, 'id'> = {
      garageId,
      bookingTag,
      customerId: data.customerId,
      customerName: data.customerName,
      customerEmail: data.customerEmail,
      customerPhone: data.customerPhone,
      vinNumber: data.vinNumber || '',
      vehicleMake: data.vehicleMake || '',
      vehicleModel: data.vehicleModel || '',
      vehicleYear: data.vehicleYear || '',
      plateNumber: data.plateNumber || '',
      services: data.services,
      otherService: data.otherService || '',
      description: data.description || '',
      photos: photoUrls,
      preferredDate: data.preferredDate,
      preferredTime: data.preferredTime,
      assignedMechanicId: data.assignedMechanicId || '',
      assignedMechanicName: data.assignedMechanicName || '',
      status: 'booking_created' as JobStatus,
      statusHistory: [],
      serviceNotes: '',
      serviceNotesBy: '',
      createdBy: data.createdBy,
      submittedAt: serverTimestamp() as unknown as Timestamp,
      updatedAt: serverTimestamp() as unknown as Timestamp,
    }

    const jobRef = await addDoc(
      collection(db, 'garages', garageId, 'jobs'),
      jobData
    )

    // Log activity
    await logActivity(garageId, {
      jobId: jobRef.id,
      bookingTag,
      action: 'job_created',
      changedBy: data.createdBy,
      changedByName: data.customerName,
      newValue: 'booking_created',
      details: `New booking created for ${data.services.join(', ')}`,
    })

    return { success: true, jobId: jobRef.id, bookingTag }
  } catch (error: any) {
    console.error('Error creating job:', error)
    return { success: false, error: error.message }
  }
}

export async function getJob(garageId: string, jobId: string): Promise<Job | null> {
  try {
    const jobRef = doc(db, 'garages', garageId, 'jobs', jobId)
    const snap = await getDoc(jobRef)
    if (!snap.exists()) return null
    return { id: snap.id, ...snap.data() } as Job
  } catch (error) {
    console.error('Error getting job:', error)
    return null
  }
}

export async function getGarageJobs(garageId: string): Promise<Job[]> {
  try {
    const q = query(
      collection(db, 'garages', garageId, 'jobs'),
      orderBy('submittedAt', 'desc')
    )
    const snapshot = await getDocs(q)
    return snapshot.docs.map(d => ({ id: d.id, ...d.data() })) as Job[]
  } catch (error) {
    console.error('Error getting garage jobs:', error)
    return []
  }
}

export async function getMechanicJobs(garageId: string, mechanicUserId: string): Promise<Job[]> {
  try {
    const q = query(
      collection(db, 'garages', garageId, 'jobs'),
      where('assignedMechanicId', '==', mechanicUserId),
      orderBy('submittedAt', 'desc')
    )
    const snapshot = await getDocs(q)
    return snapshot.docs.map(d => ({ id: d.id, ...d.data() })) as Job[]
  } catch (error) {
    console.error('Error getting mechanic jobs:', error)
    return []
  }
}

export async function getCustomerJobs(garageId: string, customerId: string): Promise<Job[]> {
  try {
    const q = query(
      collection(db, 'garages', garageId, 'jobs'),
      where('customerId', '==', customerId),
      orderBy('submittedAt', 'desc')
    )
    const snapshot = await getDocs(q)
    return snapshot.docs.map(d => ({ id: d.id, ...d.data() })) as Job[]
  } catch (error) {
    console.error('Error getting customer jobs:', error)
    return []
  }
}

// Get all jobs for a customer across ALL garages (for customer dashboard)
export async function getCustomerJobsAllGarages(customerId: string): Promise<(Job & { garageName?: string })[]> {
  try {
    // First get all garages
    const garagesSnap = await getDocs(collection(db, 'garages'))
    const allJobs: (Job & { garageName?: string })[] = []

    for (const garageDoc of garagesSnap.docs) {
      const garageData = garageDoc.data()
      const q = query(
        collection(db, 'garages', garageDoc.id, 'jobs'),
        where('customerId', '==', customerId),
        orderBy('submittedAt', 'desc')
      )
      const jobsSnap = await getDocs(q)
      for (const jobDoc of jobsSnap.docs) {
        allJobs.push({
          id: jobDoc.id,
          ...jobDoc.data(),
          garageName: garageData.name,
        } as Job & { garageName?: string })
      }
    }

    // Sort all combined by submittedAt desc
    allJobs.sort((a, b) => {
      const aTime = a.submittedAt?.toMillis?.() || 0
      const bTime = b.submittedAt?.toMillis?.() || 0
      return bTime - aTime
    })

    return allJobs
  } catch (error) {
    console.error('Error getting customer jobs across garages:', error)
    return []
  }
}

// ==============================
// JOB STATUS TRANSITIONS
// ==============================

export async function updateJobStatus(
  garageId: string,
  jobId: string,
  newStatus: JobStatus,
  changedBy: string,
  changedByName: string,
  notes?: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const jobRef = doc(db, 'garages', garageId, 'jobs', jobId)
    const snap = await getDoc(jobRef)
    if (!snap.exists()) return { success: false, error: 'Job not found' }

    const job = snap.data() as Job
    const currentStatus = job.status

    // Validate transition
    const allowedTransitions = JOB_TRANSITIONS[currentStatus]
    if (!allowedTransitions.includes(newStatus)) {
      return {
        success: false,
        error: `Cannot move from "${JOB_STATUS_LABELS[currentStatus]}" to "${JOB_STATUS_LABELS[newStatus]}"`,
      }
    }

    // Build status change record
    const statusChange: StatusChange = {
      from: currentStatus,
      to: newStatus,
      changedBy,
      changedByName,
      timestamp: Timestamp.now(),
      notes: notes || '',
    }

    const updateData: any = {
      status: newStatus,
      statusHistory: [...(job.statusHistory || []), statusChange],
      updatedAt: serverTimestamp(),
    }

    // If completing, add completion timestamp
    if (newStatus === 'completed') {
      updateData.completedAt = serverTimestamp()
    }

    await updateDoc(jobRef, updateData)

    // Log activity
    await logActivity(garageId, {
      jobId,
      bookingTag: job.bookingTag,
      action: 'status_changed',
      changedBy,
      changedByName,
      previousValue: currentStatus,
      newValue: newStatus,
      details: notes || `Status changed from ${JOB_STATUS_LABELS[currentStatus]} to ${JOB_STATUS_LABELS[newStatus]}`,
    })

    return { success: true }
  } catch (error: any) {
    console.error('Error updating job status:', error)
    return { success: false, error: error.message }
  }
}

// ==============================
// JOB NOTES & MECHANIC ASSIGNMENT
// ==============================

export async function addJobServiceNotes(
  garageId: string,
  jobId: string,
  notes: string,
  addedBy: string,
  addedByName: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const jobRef = doc(db, 'garages', garageId, 'jobs', jobId)
    await updateDoc(jobRef, {
      serviceNotes: notes,
      serviceNotesBy: addedByName,
      updatedAt: serverTimestamp(),
    })

    await logActivity(garageId, {
      jobId,
      bookingTag: '',
      action: 'notes_added',
      changedBy: addedBy,
      changedByName: addedByName,
      details: `Service notes updated`,
    })

    return { success: true }
  } catch (error: any) {
    console.error('Error adding service notes:', error)
    return { success: false, error: error.message }
  }
}

export async function assignMechanic(
  garageId: string,
  jobId: string,
  mechanicId: string,
  mechanicName: string,
  assignedBy: string,
  assignedByName: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const jobRef = doc(db, 'garages', garageId, 'jobs', jobId)
    await updateDoc(jobRef, {
      assignedMechanicId: mechanicId,
      assignedMechanicName: mechanicName,
      updatedAt: serverTimestamp(),
    })

    await logActivity(garageId, {
      jobId,
      bookingTag: '',
      action: 'mechanic_assigned',
      changedBy: assignedBy,
      changedByName: assignedByName,
      newValue: mechanicName,
      details: `Mechanic assigned: ${mechanicName}`,
    })

    return { success: true }
  } catch (error: any) {
    console.error('Error assigning mechanic:', error)
    return { success: false, error: error.message }
  }
}

export async function rescheduleJob(
  garageId: string,
  jobId: string,
  newDate: string,
  newTime: string,
  rescheduledBy: string,
  rescheduledByName: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const jobRef = doc(db, 'garages', garageId, 'jobs', jobId)
    await updateDoc(jobRef, {
      preferredDate: newDate,
      preferredTime: newTime,
      updatedAt: serverTimestamp(),
    })

    await logActivity(garageId, {
      jobId,
      bookingTag: '',
      action: 'rescheduled',
      changedBy: rescheduledBy,
      changedByName: rescheduledByName,
      newValue: `${newDate} ${newTime}`,
      details: `Rescheduled to ${newDate} at ${formatSlotTime(newTime)}`,
    })

    return { success: true }
  } catch (error: any) {
    console.error('Error rescheduling job:', error)
    return { success: false, error: error.message }
  }
}

// ==============================
// SLOT AVAILABILITY
// ==============================

export async function getBookedSlots(garageId: string, date: string): Promise<string[]> {
  try {
    const q = query(
      collection(db, 'garages', garageId, 'jobs'),
      where('preferredDate', '==', date),
      where('status', 'in', ['booking_created', 'checked_in', 'diagnosis', 'awaiting_parts', 'repair_in_progress', 'quality_check', 'ready_for_pickup'])
    )
    const snapshot = await getDocs(q)
    return snapshot.docs.map(d => d.data().preferredTime)
  } catch (error) {
    console.error('Error getting booked slots:', error)
    return []
  }
}

// ==============================
// ACTIVITY LOGGING
// ==============================

async function logActivity(
  garageId: string,
  data: Omit<ActivityLog, 'id' | 'garageId' | 'timestamp'>
): Promise<void> {
  try {
    await addDoc(collection(db, 'garages', garageId, 'activity'), {
      ...data,
      garageId,
      timestamp: serverTimestamp(),
    })
  } catch (error) {
    console.error('Error logging activity:', error)
  }
}

export async function getGarageActivity(
  garageId: string,
  maxItems: number = 50
): Promise<ActivityLog[]> {
  try {
    const q = query(
      collection(db, 'garages', garageId, 'activity'),
      orderBy('timestamp', 'desc'),
      firestoreLimit(maxItems)
    )
    const snapshot = await getDocs(q)
    return snapshot.docs.map(d => ({ id: d.id, ...d.data() })) as ActivityLog[]
  } catch (error) {
    console.error('Error getting activity log:', error)
    return []
  }
}

// ==============================
// ANALYTICS HELPERS
// ==============================

export async function getGarageStats(garageId: string): Promise<{
  totalJobs: number
  activeJobs: number
  completedJobs: number
  cancelledJobs: number
  todayJobs: number
}> {
  try {
    const jobs = await getGarageJobs(garageId)
    const today = new Date().toISOString().split('T')[0]

    return {
      totalJobs: jobs.length,
      activeJobs: jobs.filter(j =>
        !['completed', 'cancelled'].includes(j.status)
      ).length,
      completedJobs: jobs.filter(j => j.status === 'completed').length,
      cancelledJobs: jobs.filter(j => j.status === 'cancelled').length,
      todayJobs: jobs.filter(j => j.preferredDate === today).length,
    }
  } catch (error) {
    console.error('Error getting garage stats:', error)
    return { totalJobs: 0, activeJobs: 0, completedJobs: 0, cancelledJobs: 0, todayJobs: 0 }
  }
}

// ==============================
// LEGACY COMPATIBILITY
// ==============================

// These types and functions maintain backward compatibility with old booking pages
// that haven't been migrated yet

export type Booking = Job & {
  userId?: string
  service?: string
}

// Map old booking fields to new job fields
export function jobToLegacyBooking(job: Job): Booking {
  return {
    ...job,
    userId: job.customerId,
    service: job.services?.[0] || '',
  }
}

export function getMechanicName(mechanicId: string): string {
  // Legacy hardcoded — will be replaced by dynamic staff lookup
  const names: Record<string, string> = {
    'mike-d': 'Mike D',
    'kimanthi': 'Kimanthi',
    'thomas': 'Thomas',
    'viny': 'Viny',
  }
  return names[mechanicId] || mechanicId
}
