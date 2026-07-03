'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { signOut } from '@/lib/supabase/auth-handlers'

export function SignOutButton() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)

  async function handleClick() {
    setLoading(true)
    await signOut()
    router.replace('/login')
    router.refresh()
  }

  return (
    <button
      onClick={handleClick}
      disabled={loading}
      className="text-sm font-medium text-black/60 transition hover:text-[#FFB020] disabled:opacity-50 dark:text-white/60"
    >
      {loading ? 'Signing out…' : 'Sign out'}
    </button>
  )
}
