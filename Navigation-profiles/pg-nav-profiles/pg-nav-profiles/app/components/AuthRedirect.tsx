'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuthRole, homeRouteFor } from '@/hooks/useAuthRole'

/**
 * Drop into app/page.tsx (top of the returned JSX).
 * Logged-in users are sent to their role home:
 *   garage staff → /garage · customer → /my-bookings
 *   specialist → /chat · super_admin → /admin
 * Guests see the landing page untouched.
 */
export default function AuthRedirect() {
  const router = useRouter()
  const { user, role, garageId, isLoading } = useAuthRole()

  useEffect(() => {
    if (isLoading || !user) return
    const dest = homeRouteFor(role, garageId)
    if (dest !== '/') router.replace(dest)
  }, [isLoading, user, role, garageId, router])

  // Brief overlay while deciding, so the signup page never flashes for logged-in users
  if (isLoading || user) {
    return (
      <div className="fixed inset-0 z-[100] bg-petrol-black flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-petrol-yellow border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }
  return null
}
