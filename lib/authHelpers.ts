import type { NextRequest } from 'next/server'
import { getAdminAuth } from './serverAdmin'

export function getBearerToken(request: NextRequest): string | null {
  const authHeader = request.headers?.get?.('authorization')
  if (typeof authHeader !== 'string') return null
  if (!authHeader.startsWith('Bearer ')) return null
  return authHeader.slice(7).trim()
}

export async function verifyFirebaseToken(token: string) {
  if (!token) return null

  const adminAuth = getAdminAuth()
  if (!adminAuth) return null

  const expectedProjectId = process.env.FIREBASE_PROJECT_ID || process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID

  try {
    const decoded = await adminAuth.verifyIdToken(token)
    if (expectedProjectId && decoded.aud && decoded.aud !== expectedProjectId) {
      return null
    }
    return decoded
  } catch {
    return null
  }
}
