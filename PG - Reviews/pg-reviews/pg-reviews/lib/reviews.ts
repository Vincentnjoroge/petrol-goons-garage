/**
 * Reviews — customer submission side.
 * Display + owner-reply already exist (dashboard Analytics, /garage/[id] profile).
 *
 * Doc: garages/{garageId}/reviews/{jobId}  ← review ID = job ID:
 *   - one review per job, guaranteed (setDoc on same ID would be an update,
 *     which rules deny to customers → duplicates impossible)
 *   - "already reviewed?" check is a single getDoc
 * Fields match both existing renderers (customerName, rating, comment,
 * isPublic, garageResponse added later by owner).
 */

import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore'
import { db } from './firebase'
import type { Job } from './types'

export interface ReviewInput {
  job: Job
  customerId: string
  customerName: string
  rating: number        // 1–5
  comment: string
  isPublic?: boolean
}

export async function hasReviewedJob(garageId: string, jobId: string): Promise<boolean> {
  try {
    const snap = await getDoc(doc(db, 'garages', garageId, 'reviews', jobId))
    return snap.exists()
  } catch { return false }
}

export async function submitReview(
  input: ReviewInput
): Promise<{ success: boolean; error?: string }> {
  const { job, customerId, customerName, rating, comment } = input
  if (!job.id || !job.garageId) return { success: false, error: 'Missing job reference.' }
  if (job.status !== 'completed') return { success: false, error: 'You can review once the job is completed.' }
  if (rating < 1 || rating > 5) return { success: false, error: 'Pick a star rating.' }

  try {
    await setDoc(doc(db, 'garages', job.garageId, 'reviews', job.id), {
      garageId: job.garageId,
      jobId: job.id,
      bookingTag: job.bookingTag || '',
      customerId,
      customerName,
      rating,
      comment: comment.trim().slice(0, 500),
      services: job.services || [],
      isPublic: input.isPublic !== false,
      createdAt: serverTimestamp(),
    })
    return { success: true }
  } catch (error: any) {
    // Rules deny update → friendly message if they somehow retry
    const msg = String(error?.message || '')
    if (msg.toLowerCase().includes('permission')) {
      return { success: false, error: 'This job has already been reviewed.' }
    }
    return { success: false, error: msg || 'Could not submit review.' }
  }
}
