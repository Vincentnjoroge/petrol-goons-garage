'use client'

import { useState, useEffect } from 'react'
import { onAuthStateChanged, User } from 'firebase/auth'
import { doc, getDoc } from 'firebase/firestore'
import { auth, db } from '@/lib/firebase'
import type { UserRole } from '@/lib/types'

export interface AuthRole {
  user: User | null
  role: UserRole | null
  garageId: string | null
  isLoading: boolean
}

/**
 * Single source of truth for "who is this and where do they belong".
 * Used by AuthRedirect, navbars, and RouteGuards.
 */
export function useAuthRole(): AuthRole {
  const [state, setState] = useState<AuthRole>({
    user: null, role: null, garageId: null, isLoading: true,
  })

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (u) => {
      if (!u) { setState({ user: null, role: null, garageId: null, isLoading: false }); return }
      try {
        const snap = await getDoc(doc(db, 'users', u.uid))
        const d = snap.exists() ? snap.data() : null
        setState({
          user: u,
          role: (d?.role as UserRole) || 'customer',
          garageId: d?.garageId || null,
          isLoading: false,
        })
      } catch {
        setState({ user: u, role: 'customer', garageId: null, isLoading: false })
      }
    })
    return () => unsub()
  }, [])

  return state
}

/** Where each role's "home" is. */
export function homeRouteFor(role: UserRole | null, garageId: string | null): string {
  if (!role) return '/'
  if (garageId && ['garage_owner', 'garage_manager', 'mechanic', 'reception'].includes(role)) return '/garage'
  if (role === 'independent_specialist') return '/chat'
  if (role === 'super_admin') return '/admin'
  return '/my-bookings'
}
