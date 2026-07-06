'use client'

import { useState, useEffect } from 'react'
import { hasReviewedJob, submitReview } from '@/lib/reviews'
import type { Job } from '@/lib/types'

/**
 * Drop-in review CTA for a COMPLETED job. Renders nothing for other statuses.
 *   <ReviewPrompt job={job} customerId={user.uid} customerName={user.displayName ?? 'Customer'} />
 * States: not reviewed → "★ Rate this service" → bottom-sheet (stars, comment,
 * public toggle) → "✓ Reviewed". Already-reviewed detected on mount.
 */
export default function ReviewPrompt({
  job, customerId, customerName,
}: { job: Job; customerId: string; customerName: string }) {
  const [reviewed, setReviewed] = useState<boolean | null>(null)
  const [open, setOpen] = useState(false)
  const [rating, setRating] = useState(0)
  const [comment, setComment] = useState('')
  const [isPublic, setIsPublic] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (job.status !== 'completed' || !job.id || !job.garageId) return
    hasReviewedJob(job.garageId, job.id).then(setReviewed)
  }, [job.id, job.garageId, job.status])

  if (job.status !== 'completed') return null
  if (reviewed === null) return null

  if (reviewed) {
    return (
      <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-petrol-green bg-petrol-green/10 px-2.5 py-1 rounded-lg">
        ✓ Reviewed
      </span>
    )
  }

  const send = async () => {
    setSaving(true); setError('')
    const res = await submitReview({ job, customerId, customerName, rating, comment, isPublic })
    if (res.success) { setReviewed(true); setOpen(false) }
    else setError(res.error || 'Failed.')
    setSaving(false)
  }

  return (
    <>
      <button onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1 text-[11px] font-bold text-petrol-yellow bg-petrol-yellow/10 border border-petrol-yellow/30 px-2.5 py-1 rounded-lg active:scale-95 transition-all">
        ★ Rate this service
      </button>

      {open && (
        <div className="fixed inset-0 bg-black/70 z-50 flex items-end" onClick={() => !saving && setOpen(false)}>
          <div className="bg-[#1a1a1a] w-full max-w-[430px] mx-auto rounded-t-2xl p-6" onClick={e => e.stopPropagation()}>
            <h3 className="text-white font-bold text-base">How was your service?</h3>
            <p className="text-gray-500 text-xs mb-4">{job.bookingTag} · {job.services?.slice(0, 2).join(', ')}</p>

            {/* Stars */}
            <div className="flex justify-center gap-2 mb-4">
              {[1, 2, 3, 4, 5].map(s => (
                <button key={s} onClick={() => setRating(s)} className="text-4xl active:scale-90 transition-transform">
                  <span className={s <= rating ? 'text-amber-400' : 'text-white/15'}>★</span>
                </button>
              ))}
            </div>
            {rating > 0 && (
              <p className="text-center text-gray-400 text-xs mb-3">
                {['', 'Poor', 'Fair', 'Good', 'Very good', 'Excellent'][rating]}
              </p>
            )}

            <textarea value={comment} onChange={e => setComment(e.target.value.slice(0, 500))} rows={3}
              placeholder="What went well? What could be better? (optional)"
              className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-gray-600 text-sm focus:border-petrol-yellow/50 focus:outline-none resize-none mb-3" />

            <label className="flex items-center gap-2.5 mb-4 cursor-pointer">
              <input type="checkbox" checked={isPublic} onChange={e => setIsPublic(e.target.checked)}
                className="w-4 h-4 rounded accent-petrol-yellow" />
              <span className="text-gray-400 text-xs">Show my review on the garage's public profile</span>
            </label>

            {error && <p className="text-red-400 text-xs mb-3 bg-red-500/10 rounded-lg p-2">{error}</p>}

            <div className="flex gap-3">
              <button onClick={() => setOpen(false)} disabled={saving}
                className="flex-1 bg-white/5 text-gray-400 py-3 rounded-xl text-sm">Later</button>
              <button onClick={send} disabled={rating === 0 || saving}
                className="flex-[2] bg-petrol-yellow text-petrol-black font-bold py-3 rounded-xl text-sm disabled:opacity-40">
                {saving ? 'Sending…' : 'Submit Review'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
