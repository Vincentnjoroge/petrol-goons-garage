import { NextRequest, NextResponse } from 'next/server'
import { collection, getDocs, query, where, orderBy, doc, updateDoc, serverTimestamp } from 'firebase/firestore'
import { db } from '@/lib/firebase'
import { Resend } from 'resend'
import { getServiceReminderEmailHtml } from '@/lib/email'

// How many days after last service to send a reminder
const REMINDER_AFTER_DAYS = 90 // ~3 months

export async function POST(request: NextRequest) {
  try {
    // Simple auth check - require a secret key to call this endpoint
    const { authorization } = Object.fromEntries(request.headers)
    const cronSecret = process.env.CRON_SECRET

    if (cronSecret && authorization !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    if (!process.env.RESEND_API_KEY) {
      return NextResponse.json({ error: 'Email service not configured' }, { status: 500 })
    }

    const resend = new Resend(process.env.RESEND_API_KEY)

    // Get all completed bookings
    const bookingsQuery = query(
      collection(db, 'bookings'),
      where('status', '==', 'completed'),
      orderBy('completedAt', 'desc')
    )
    const snapshot = await getDocs(bookingsQuery)

    // Group by customer email — only care about the LATEST completed booking per customer
    const latestByCustomer = new Map<string, any>()
    snapshot.docs.forEach(docSnap => {
      const data = docSnap.data()
      if (!data.customerEmail) return
      const email = data.customerEmail.toLowerCase()
      if (!latestByCustomer.has(email)) {
        latestByCustomer.set(email, { id: docSnap.id, ...data })
      }
    })

    const now = new Date()
    const cutoff = new Date(now.getTime() - REMINDER_AFTER_DAYS * 24 * 60 * 60 * 1000)
    let sentCount = 0
    const errors: string[] = []

    for (const [email, booking] of latestByCustomer) {
      // Check if their last completed service was before the cutoff
      const completedAt = booking.completedAt?.toDate?.()
      if (!completedAt || completedAt > cutoff) continue

      // Check if we already sent a reminder for this booking
      if (booking.reminderSentAt) continue

      // Send reminder
      try {
        const lastDate = completedAt.toLocaleDateString('en-KE', {
          day: 'numeric',
          month: 'long',
          year: 'numeric'
        })

        const html = getServiceReminderEmailHtml(
          booking.customerName || 'there',
          booking.service || 'car service',
          lastDate,
          booking.vinNumber
        )

        await resend.emails.send({
          from: 'Petrol Goons Garage <onboarding@resend.dev>',
          to: [email],
          subject: "Time for your next service — Petrol Goons Garage",
          html,
        })

        // Mark reminder as sent so we don't send again
        await updateDoc(doc(db, 'bookings', booking.id), {
          reminderSentAt: serverTimestamp(),
        })

        sentCount++
      } catch (err: any) {
        errors.push(`Failed to send to ${email}: ${err.message}`)
      }
    }

    return NextResponse.json({
      success: true,
      reminders_sent: sentCount,
      customers_checked: latestByCustomer.size,
      errors: errors.length > 0 ? errors : undefined,
    })
  } catch (error: any) {
    console.error('Reminder error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
