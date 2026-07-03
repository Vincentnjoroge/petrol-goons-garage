'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { setUserRole } from '@/lib/firebase/profile'

type Role = 'car_owner' | 'garage_owner'

export default function OnboardingPage() {
  const router = useRouter()
  const [loading, setLoading] = useState<Role | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function chooseRole(role: Role) {
    setLoading(role)
    setError(null)

    const res = await setUserRole(role)

    if (!res.success) {
      setError(res.error ?? 'Could not set role')
      setLoading(null)
      return
    }

    router.replace(role === 'car_owner' ? '/dashboard/car-owner' : '/dashboard/garage-owner')
    router.refresh()
  }

  return (
    <div className="mx-auto flex min-h-screen max-w-md flex-col justify-center gap-6 px-6">
      <div className="text-center">
        <h1 className="text-2xl font-semibold">One quick thing</h1>
        <p className="mt-2 text-sm text-neutral-500">
          Tell us how you&apos;ll be using Petrol Goons Garage.
        </p>
      </div>

      <div className="flex flex-col gap-3">
        <button
          onClick={() => chooseRole('car_owner')}
          disabled={loading !== null}
          className="rounded-lg border border-neutral-300 px-4 py-3 text-left transition hover:border-neutral-500 disabled:opacity-50"
        >
          <span className="font-medium">I own a car</span>
          <span className="block text-sm text-neutral-500">Book services and track my vehicle</span>
        </button>

        <button
          onClick={() => chooseRole('garage_owner')}
          disabled={loading !== null}
          className="rounded-lg border border-neutral-300 px-4 py-3 text-left transition hover:border-neutral-500 disabled:opacity-50"
        >
          <span className="font-medium">I run a garage</span>
          <span className="block text-sm text-neutral-500">Manage bookings and bays</span>
        </button>
      </div>

      {error && <p className="text-center text-sm text-red-500">{error}</p>}
    </div>
  )
}
