import { NextRequest, NextResponse } from 'next/server'
import { adminAuth, adminDb } from '@/lib/serverAdmin'
import { getBookingReceivedEmailHtml, getNewBookingAdminEmailHtml } from '@/lib/email'
import { collection, query, where, getDocs, serverTimestamp, addDoc, doc } from 'firebase-admin/firestore'
import { Resend } from 'resend'

function generateBookingTag() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  let tag = ''
  for (let i = 0; i < 4; i++) tag += chars.charAt(Math.floor(Math.random() * chars.length))
  return `PG-${tag}`
}

export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization') || ''
    if (!authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    const idToken = authHeader.replace('Bearer ', '')

    const decoded = await adminAuth.verifyIdToken(idToken).catch(() => null)
    if (!decoded) return NextResponse.json({ error: 'Invalid token' }, { status: 401 })

    const body = await request.json()
    const { garageId, preferredDate, preferredTime, customerName, customerEmail, customerPhone, vinNumber, services, otherService, description, assignedMechanicId, assignedMechanicName } = body

    if (!garageId || !preferredDate || !preferredTime) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    // Transactional availability check: query for jobs on same date/time with active statuses
    const jobsRef = collection(adminDb, 'garages', garageId, 'jobs')
    const q = query(jobsRef, where('preferredDate', '==', preferredDate), where('preferredTime', '==', preferredTime))
    const snapshot = await getDocs(q)
    // if any job exists with a non-final status, reject
    for (const d of snapshot.docs) {
      const status = d.data().status
      if (['booking_created','checked_in','diagnosis','awaiting_parts','repair_in_progress','quality_check','ready_for_pickup'].includes(status)) {
        return NextResponse.json({ success: false, error: 'Slot already taken' }, { status: 409 })
      }
    }

    // Create job document server-side
    const bookingTag = generateBookingTag()
    const jobData: any = {
      garageId,
      bookingTag,
      customerId: decoded.uid,
      customerName: customerName || decoded.name || '',
      customerEmail: customerEmail || decoded.email || '',
      customerPhone: customerPhone || '',
      vinNumber: vinNumber || '',
      services: services || [],
      otherService: otherService || '',
      description: description || '',
      photos: [],
      preferredDate,
      preferredTime,
      assignedMechanicId: assignedMechanicId || '',
      assignedMechanicName: assignedMechanicName || '',
      status: 'booking_created',
      statusHistory: [],
      serviceNotes: '',
      serviceNotesBy: '',
      createdBy: decoded.uid,
      submittedAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    }

    const jobRef = await addDoc(jobsRef as any, jobData)

    // Send emails server-side if configured
    if (process.env.RESEND_API_KEY) {
      try {
        const resend = new Resend(process.env.RESEND_API_KEY)
        const bookingObj = { ...jobData, id: jobRef.id }
        const customerHtml = getBookingReceivedEmailHtml(bookingObj)
        const adminHtml = getNewBookingAdminEmailHtml(bookingObj)

        // send to customer
        if (bookingObj.customerEmail) {
          await resend.emails.send({ from: 'Petrol Goons Garage <onboarding@resend.dev>', to: [bookingObj.customerEmail], subject: `Booking Request Received — ${bookingObj.bookingTag}`, html: customerHtml })
        }
        // notify admin list (from lib/admin.ts or TECHNICAL.md) — fallback: use RESEND_ADMIN_EMAILS env var CSV
        const adminList = (process.env.RESEND_ADMIN_EMAILS || '')
          .split(',')
          .map(s => s.trim())
          .filter(Boolean)
        for (const adminEmail of adminList) {
          await resend.emails.send({ from: 'Petrol Goons Garage <onboarding@resend.dev>', to: [adminEmail], subject: `New Booking: ${bookingObj.customerName} — ${bookingObj.preferredDate}`, html: adminHtml })
        }
      } catch (emailErr) {
        console.error('Email send failed:', emailErr)
      }
    } else {
      console.log('RESEND_API_KEY not set; skipped sending emails')
    }

    return NextResponse.json({ success: true, jobId: jobRef.id, bookingTag })
  } catch (err: any) {
    console.error('create-job error:', err)
    return NextResponse.json({ success: false, error: err.message }, { status: 500 })
  }
}
