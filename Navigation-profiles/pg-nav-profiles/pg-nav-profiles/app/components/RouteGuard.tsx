'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuthRole, homeRouteFor } from '@/hooks/useAuthRole'
import type { UserRole } from '@/lib/types'

/**
 * Wrap a page's content to restrict it by role.
 *   <RouteGuard allow={['customer']}> ...customer page... </RouteGuard>
 * Wrong-role users are bounced to their own home; guests to '/'.
 */
export default function RouteGuard({
  allow, children,
}: { allow: UserRole[]; children: React.ReactNode }) {
  const router = useRouter()
  const { user, role, garageId, isLoading } = useAuthRole()

  useEffect(() => {
    if (isLoading) return
    if (!user) { router.replace('/'); return }
    if (role && !allow.includes(role)) router.replace(homeRouteFor(role, garageId))
  }, [isLoading, user, role, garageId, allow, router])

  if (isLoading || !user || (role && !allow.includes(role))) {
    return (
      <div className="min-h-screen bg-petrol-black flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-petrol-yellow border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }
  return <>{children}</>
}
