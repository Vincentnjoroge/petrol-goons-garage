'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { getOrCreateConversation, buildConversationId, ConversationType } from '@/lib/chat'

interface MessageButtonProps {
  type: ConversationType
  customerId?: string
  customerName?: string
  garageId?: string
  garageName?: string
  specialistId?: string
  specialistName?: string
  jobId?: string | null
  bookingTag?: string | null
  label?: string
  variant?: 'solid' | 'outline'
  fullWidth?: boolean
}

/**
 * Drop-in button that opens (or creates) the right conversation and navigates to it.
 *
 * Examples:
 *  - Customer → Garage:      type="customer_garage"   customerId garageId garageName
 *  - Customer → Specialist:  type="customer_specialist" customerId specialistId specialistName
 *  - Garage   → Specialist:  type="garage_specialist"  garageId garageName specialistId specialistName
 */
export default function MessageButton(props: MessageButtonProps) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const { label = 'Message', variant = 'outline', fullWidth = false } = props

  const open = async () => {
    if (loading) return
    setLoading(true)
    try {
      await getOrCreateConversation(props)
      const id = buildConversationId({
        type: props.type,
        customerId: props.customerId,
        garageId: props.garageId,
        specialistId: props.specialistId,
        jobId: props.jobId,
      })
      router.push(`/chat/${id}`)
    } catch {
      setLoading(false)
    }
  }

  const base = 'inline-flex items-center justify-center gap-1.5 rounded-xl px-4 py-2.5 text-sm font-semibold transition-all active:scale-95'
  const styles = variant === 'solid'
    ? 'bg-petrol-yellow text-petrol-black'
    : 'border border-petrol-yellow text-petrol-black bg-petrol-yellow/5'

  return (
    <button onClick={open} disabled={loading} className={`${base} ${styles} ${fullWidth ? 'w-full' : ''} ${loading ? 'opacity-60' : ''}`}>
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" />
      </svg>
      {loading ? 'Opening…' : label}
    </button>
  )
}
