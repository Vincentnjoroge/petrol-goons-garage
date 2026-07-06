import { NextRequest, NextResponse } from 'next/server'
import { adminAuth, adminDb } from '@/lib/serverAdmin'
import { doc, updateDoc } from 'firebase-admin/firestore'

export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization') || ''
    if (!authHeader.startsWith('Bearer ')) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const idToken = authHeader.replace('Bearer ', '')
    const decoded = await adminAuth.verifyIdToken(idToken).catch(() => null)
    if (!decoded) return NextResponse.json({ error: 'Invalid token' }, { status: 401 })

    const { params } = request.nextUrl as any
    const garageId = params?.garageId
    const jobId = params?.jobId
    if (!garageId || !jobId) return NextResponse.json({ error: 'Missing path params' }, { status: 400 })

    const body = await request.json()
    const { photos } = body
    if (!Array.isArray(photos)) return NextResponse.json({ error: 'Missing photos array' }, { status: 400 })

    const jobRef = doc(adminDb, 'garages', garageId, 'jobs', jobId)
    await updateDoc(jobRef as any, { photos, updatedAt: new Date() })

    return NextResponse.json({ success: true })
  } catch (err: any) {
    console.error('add-photos error:', err)
    return NextResponse.json({ success: false, error: err.message }, { status: 500 })
  }
}
