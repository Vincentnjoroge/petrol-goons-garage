import { NextRequest, NextResponse } from 'next/server'
import { getAdminDb } from '@/lib/serverAdmin'
import admin from 'firebase-admin'
import { getBearerToken, verifyFirebaseToken } from '@/lib/authHelpers'

export async function POST(request: NextRequest, context: { params: Promise<{ garageId: string; jobId: string }> }) {
  try {
    const token = getBearerToken(request)
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const decoded = await verifyFirebaseToken(token)
    if (!decoded) return NextResponse.json({ error: 'Invalid token' }, { status: 401 })

    const { garageId, jobId } = await context.params
    if (!garageId || !jobId) return NextResponse.json({ error: 'Missing path params' }, { status: 400 })

    const body = await request.json()
    const { photos } = body
    if (!Array.isArray(photos)) return NextResponse.json({ error: 'Missing photos array' }, { status: 400 })

    const adminDb = getAdminDb()
    const jobRef = adminDb.collection('garages').doc(garageId).collection('jobs').doc(jobId)
    await jobRef.update({ photos, updatedAt: admin.firestore.FieldValue.serverTimestamp() })

    return NextResponse.json({ success: true })
  } catch (err: any) {
    console.error('add-photos error:', err)
    return NextResponse.json({ success: false, error: err.message }, { status: 500 })
  }
}
