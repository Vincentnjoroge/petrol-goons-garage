'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { onAuthStateChanged, User } from 'firebase/auth'
import { doc, getDoc } from 'firebase/firestore'
import { auth, db } from '@/lib/firebase'
import {
  SpecialistProfile,
  SpecialtyArea,
  listSpecialists,
  SPECIALTY_LABELS,
} from '@/lib/specialists'
import { getOrCreateConversation, buildConversationId } from '@/lib/chat'
import type { UserProfile } from '@/lib/types'

const FILTERS: (SpecialtyArea | 'all')[] = [
  'all', 'engine', 'electrical', 'transmission', 'diagnostics', 'performance', 'ev_hybrid', 'bodywork',
]

export default function SpecialistsPage() {
  const router = useRouter()
  const [user, setUser] = useState<User | null>(null)
  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [specialists, setSpecialists] = useState<SpecialistProfile[]>([])
  const [filter, setFilter] = useState<SpecialtyArea | 'all'>('all')
  const [loading, setLoading] = useState(true)
  const [starting, setStarting] = useState<string | null>(null)

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (u) => {
      setUser(u)
      if (u) {
        const snap = await getDoc(doc(db, 'users', u.uid))
        setProfile(snap.exists() ? ({ id: snap.id, ...snap.data() } as UserProfile) : null)
      }
    })
    return () => unsub()
  }, [])

  useEffect(() => {
    setLoading(true)
    listSpecialists(filter === 'all' ? undefined : filter)
      .then(setSpecialists)
      .finally(() => setLoading(false))
  }, [filter])

  const startConsult = async (s: SpecialistProfile) => {
    if (!user) { router.push('/'); return }
    setStarting(s.uid)
    try {
      const isGarage = !!profile?.garageId && (profile?.role as string) !== 'customer' && (profile?.role as string) !== 'independent_specialist'
      if (isGarage && profile?.garageId) {
        await getOrCreateConversation({
          type: 'garage_specialist',
          garageId: profile.garageId,
          garageName: (profile as any).garageName || 'Garage',
          specialistId: s.uid,
          specialistName: s.name,
        })
        router.push(`/chat/${buildConversationId({ type: 'garage_specialist', garageId: profile.garageId, specialistId: s.uid })}`)
      } else {
        await getOrCreateConversation({
          type: 'customer_specialist',
          customerId: user.uid,
          customerName: profile?.displayName || user.displayName || 'Customer',
          specialistId: s.uid,
          specialistName: s.name,
        })
        router.push(`/chat/${buildConversationId({ type: 'customer_specialist', customerId: user.uid, specialistId: s.uid })}`)
      }
    } catch {
      setStarting(null)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 max-w-[430px] mx-auto">
      <div className="sticky top-0 z-40 bg-white border-b border-gray-100">
        <div className="flex items-center px-4 pt-3 pb-3">
          <button onClick={() => router.back()} className="text-petrol-black p-1">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6" /></svg>
          </button>
          <h1 className="flex-1 text-center text-xl font-extrabold text-petrol-black pr-[22px]">Specialists</h1>
        </div>
        <div className="flex gap-2 px-4 pb-3 overflow-x-auto no-scrollbar">
          {FILTERS.map((f) => (
            <button key={f} onClick={() => setFilter(f)}
              className={`shrink-0 px-3.5 py-1.5 rounded-full text-[13px] font-semibold transition-colors ${filter === f ? 'bg-petrol-yellow text-petrol-black' : 'bg-gray-100 text-gray-500'}`}>
              {f === 'all' ? 'All' : SPECIALTY_LABELS[f as SpecialtyArea]}
            </button>
          ))}
        </div>
      </div>

      {/* Become a specialist CTA — only for users who aren't already one */}
      {(profile?.role as string) !== 'independent_specialist' && (
        <button
          onClick={() => router.push('/specialists/onboard')}
          className="mx-4 mt-3 w-[calc(100%-2rem)] flex items-center justify-between bg-petrol-black rounded-2xl px-4 py-3.5 active:scale-[0.99] transition-transform"
        >
          <div className="text-left">
            <p className="text-[14px] font-bold text-white">Are you a specialist mechanic?</p>
            <p className="text-[12px] text-gray-300 mt-0.5">List your expertise and earn from consults</p>
          </div>
          <span className="text-petrol-yellow font-bold text-sm shrink-0 ml-2">Join →</span>
        </button>
      )}

      {loading ? (
        <div className="flex justify-center py-24"><div className="w-8 h-8 border-2 border-petrol-yellow border-t-transparent rounded-full animate-spin" /></div>
      ) : specialists.length === 0 ? (
        <div className="flex flex-col items-center justify-center px-8 py-24 text-center">
          <p className="text-base font-bold text-petrol-black mb-1">No specialists yet</p>
          <p className="text-sm text-gray-500">Check back soon — experts are being onboarded.</p>
        </div>
      ) : (
        <div className="p-4 space-y-3">
          {specialists.map((s) => (
            <div key={s.uid} className="bg-white rounded-2xl p-4 shadow-sm">
              <div className="flex items-start gap-3">
                <div className="w-14 h-14 rounded-full bg-petrol-yellow/15 flex items-center justify-center shrink-0">
                  <span className="text-petrol-black font-bold text-lg">{s.name.charAt(0).toUpperCase()}</span>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <h3 className="text-[15px] font-bold text-petrol-black truncate">{s.name}</h3>
                    {!!s.rating && s.rating > 0 && (
                      <span className="text-[12px] text-amber-500 font-semibold">★ {s.rating.toFixed(1)}</span>
                    )}
                  </div>
                  <p className="text-[13px] text-gray-600 mt-0.5">{s.headline}</p>
                  <div className="flex flex-wrap gap-1 mt-2">
                    {s.specialties.slice(0, 3).map((sp) => (
                      <span key={sp} className="text-[10px] font-semibold text-blue-700 bg-blue-50 px-2 py-0.5 rounded">
                        {SPECIALTY_LABELS[sp]}
                      </span>
                    ))}
                  </div>
                  <div className="flex items-center gap-3 mt-2 text-[11px] text-gray-400">
                    {s.location && <span>📍 {s.location}</span>}
                    {!!s.yearsExperience && <span>{s.yearsExperience} yrs exp</span>}
                    {s.consultRate ? <span>KSh {s.consultRate.toLocaleString()}/consult</span> : null}
                  </div>
                </div>
              </div>
              <button
                onClick={() => startConsult(s)}
                disabled={starting === s.uid}
                className="mt-3 w-full bg-petrol-yellow text-petrol-black font-semibold rounded-xl py-2.5 text-sm active:scale-95 transition-transform disabled:opacity-60"
              >
                {starting === s.uid ? 'Opening…' : 'Start Consultation'}
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
