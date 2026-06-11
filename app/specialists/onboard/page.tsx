'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { onAuthStateChanged, User } from 'firebase/auth'
import { doc, getDoc } from 'firebase/firestore'
import { auth, db } from '@/lib/firebase'
import {
  SpecialtyArea,
  SPECIALTY_LABELS,
  registerSpecialist,
  becomeSpecialist,
  getSpecialist,
} from '@/lib/specialists'
import type { UserProfile } from '@/lib/types'

const ALL_SPECIALTIES: SpecialtyArea[] = [
  'engine', 'electrical', 'transmission', 'diagnostics',
  'performance', 'ev_hybrid', 'bodywork', 'general',
]

type Step = 0 | 1 | 2 | 3 // 3 = success

export default function SpecialistOnboardPage() {
  const router = useRouter()
  const [user, setUser] = useState<User | null>(null)
  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [checking, setChecking] = useState(true)
  const [step, setStep] = useState<Step>(0)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Form state
  const [name, setName] = useState('')
  const [headline, setHeadline] = useState('')
  const [location, setLocation] = useState('')
  const [years, setYears] = useState('')
  const [specialties, setSpecialties] = useState<SpecialtyArea[]>([])
  const [bio, setBio] = useState('')
  const [rate, setRate] = useState('')
  const [phone, setPhone] = useState('')

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (u) => {
      setUser(u)
      if (!u) { setChecking(false); return }
      const snap = await getDoc(doc(db, 'users', u.uid))
      const p = snap.exists() ? ({ id: snap.id, ...snap.data() } as UserProfile) : null
      setProfile(p)
      setName(p?.displayName || u.displayName || '')

      // Already a specialist? Jump to status view.
      if (p?.role === 'independent_specialist') {
        setStep(3)
      } else {
        // If they started a profile before but didn't finish the role upgrade, prefill.
        const existing = await getSpecialist(u.uid)
        if (existing) {
          setName(existing.name)
          setHeadline(existing.headline)
          setLocation(existing.location || '')
          setYears(existing.yearsExperience ? String(existing.yearsExperience) : '')
          setSpecialties(existing.specialties || [])
          setBio(existing.bio || '')
          setRate(existing.consultRate ? String(existing.consultRate) : '')
          setPhone(existing.phone || '')
        }
      }
      setChecking(false)
    })
    return () => unsub()
  }, [])

  const toggleSpecialty = (s: SpecialtyArea) => {
    setSpecialties((prev) =>
      prev.includes(s) ? prev.filter((x) => x !== s) : [...prev, s]
    )
  }

  const canNext0 = name.trim().length >= 2 && headline.trim().length >= 4
  const canNext1 = specialties.length >= 1
  const canSubmit = canNext0 && canNext1

  const handleSubmit = async () => {
    if (!user || !canSubmit) return
    setSubmitting(true)
    setError(null)

    const reg = await registerSpecialist({
      uid: user.uid,
      name: name.trim(),
      headline: headline.trim(),
      specialties,
      bio: bio.trim(),
      yearsExperience: years ? parseInt(years, 10) : 0,
      location: location.trim(),
      consultRate: rate ? parseInt(rate, 10) : null,
      phone: phone.trim() || null,
      photoURL: user.photoURL,
    })
    if (!reg.success) { setError(reg.error || 'Could not save profile.'); setSubmitting(false); return }

    const up = await becomeSpecialist(user.uid)
    if (!up.success) { setError(up.error || 'Could not upgrade account.'); setSubmitting(false); return }

    setSubmitting(false)
    setStep(3)
  }

  // ---- Not signed in ----
  if (!checking && !user) {
    return (
      <Shell>
        <div className="flex flex-col items-center justify-center py-24 text-center px-8">
          <h1 className="text-xl font-bold text-petrol-black mb-2">Become a Specialist</h1>
          <p className="text-sm text-gray-500 mb-6">Sign in to apply as an independent mechanic.</p>
          <button onClick={() => router.push('/')} className="bg-petrol-yellow text-petrol-black font-semibold rounded-xl px-6 py-3">Sign In</button>
        </div>
      </Shell>
    )
  }

  if (checking) {
    return <Shell><div className="flex justify-center py-24"><Spinner /></div></Shell>
  }

  // ---- Success / pending state ----
  if (step === 3) {
    const isApproved = false // freshly submitted profiles are always pending
    return (
      <Shell title="Application Submitted">
        <div className="flex flex-col items-center text-center px-6 py-16">
          <div className="w-20 h-20 rounded-full bg-petrol-yellow/15 flex items-center justify-center mb-5">
            <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#FDB913" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" /><polyline points="22 4 12 14.01 9 11.01" />
            </svg>
          </div>
          <h2 className="text-xl font-bold text-petrol-black mb-2">You're in review</h2>
          <p className="text-sm text-gray-500 leading-relaxed mb-6">
            Your specialist profile has been submitted. Our team will review and approve it,
            after which you'll appear in the specialist directory and start receiving
            consultation requests. You can already chat with anyone who has your link.
          </p>
          <div className="w-full bg-white rounded-2xl p-4 text-left shadow-sm mb-6">
            <p className="text-[13px] font-semibold text-petrol-black">{name}</p>
            <p className="text-[13px] text-gray-500 mt-0.5">{headline}</p>
            <div className="flex flex-wrap gap-1 mt-2">
              {specialties.map((s) => (
                <span key={s} className="text-[10px] font-semibold text-blue-700 bg-blue-50 px-2 py-0.5 rounded">{SPECIALTY_LABELS[s]}</span>
              ))}
            </div>
          </div>
          <button onClick={() => router.push('/chat')} className="w-full bg-petrol-yellow text-petrol-black font-semibold rounded-xl py-3.5">Go to Messages</button>
          <button onClick={() => router.push('/specialists')} className="mt-3 text-sm font-semibold text-gray-500">Browse other specialists</button>
        </div>
      </Shell>
    )
  }

  // ---- Wizard ----
  return (
    <Shell title="Become a Specialist" onBack={step === 0 ? () => router.back() : () => setStep((s) => (s - 1) as Step)}>
      {/* Progress */}
      <div className="flex gap-1.5 px-4 pt-3">
        {[0, 1, 2].map((i) => (
          <div key={i} className={`h-1.5 flex-1 rounded-full ${i <= step ? 'bg-petrol-yellow' : 'bg-gray-200'}`} />
        ))}
      </div>

      <div className="px-4 py-5">
        {/* STEP 0 — Basics */}
        {step === 0 && (
          <div className="space-y-5">
            <div>
              <h2 className="text-lg font-bold text-petrol-black">Tell us about you</h2>
              <p className="text-sm text-gray-500 mt-1">This is what customers and garages will see.</p>
            </div>
            <Field label="Full name">
              <input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. James Mwangi" className={inputCls} />
            </Field>
            <Field label="Headline" hint="One line that sells your expertise">
              <input value={headline} onChange={(e) => setHeadline(e.target.value)} placeholder="e.g. Subaru & turbo specialist, 12 yrs" className={inputCls} maxLength={80} />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Location">
                <input value={location} onChange={(e) => setLocation(e.target.value)} placeholder="Nairobi" className={inputCls} />
              </Field>
              <Field label="Years experience">
                <input value={years} onChange={(e) => setYears(e.target.value.replace(/[^0-9]/g, ''))} placeholder="10" inputMode="numeric" className={inputCls} maxLength={2} />
              </Field>
            </div>
            <button disabled={!canNext0} onClick={() => setStep(1)} className={nextBtn(canNext0)}>Continue</button>
          </div>
        )}

        {/* STEP 1 — Expertise */}
        {step === 1 && (
          <div className="space-y-5">
            <div>
              <h2 className="text-lg font-bold text-petrol-black">Your expertise</h2>
              <p className="text-sm text-gray-500 mt-1">Pick all areas you can advise on.</p>
            </div>
            <div className="flex flex-wrap gap-2">
              {ALL_SPECIALTIES.map((s) => {
                const active = specialties.includes(s)
                return (
                  <button key={s} onClick={() => toggleSpecialty(s)}
                    className={`px-3.5 py-2 rounded-xl text-sm font-semibold transition-all active:scale-95 ${active ? 'bg-petrol-yellow text-petrol-black' : 'bg-gray-100 text-gray-600'}`}>
                    {SPECIALTY_LABELS[s]}
                  </button>
                )
              })}
            </div>
            <Field label="About you" hint="Optional — your background, certifications, notable work">
              <textarea value={bio} onChange={(e) => setBio(e.target.value)} rows={4} placeholder="I've spent 12 years working on rally and performance builds..." className={`${inputCls} resize-none`} maxLength={600} />
            </Field>
            <button disabled={!canNext1} onClick={() => setStep(2)} className={nextBtn(canNext1)}>Continue</button>
          </div>
        )}

        {/* STEP 2 — Consult details + review */}
        {step === 2 && (
          <div className="space-y-5">
            <div>
              <h2 className="text-lg font-bold text-petrol-black">Consult details</h2>
              <p className="text-sm text-gray-500 mt-1">Optional now — you can change these anytime.</p>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Consult rate (KSh)" hint="Per session">
                <input value={rate} onChange={(e) => setRate(e.target.value.replace(/[^0-9]/g, ''))} placeholder="500" inputMode="numeric" className={inputCls} />
              </Field>
              <Field label="Phone" hint="Optional">
                <input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="0712345678" inputMode="tel" className={inputCls} />
              </Field>
            </div>

            {/* Review */}
            <div className="bg-white rounded-2xl p-4 shadow-sm">
              <p className="text-[11px] font-bold text-gray-400 uppercase tracking-wide mb-2">Preview</p>
              <div className="flex items-start gap-3">
                <div className="w-12 h-12 rounded-full bg-petrol-yellow/15 flex items-center justify-center shrink-0">
                  <span className="text-petrol-black font-bold">{(name || '?').charAt(0).toUpperCase()}</span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[15px] font-bold text-petrol-black">{name || 'Your name'}</p>
                  <p className="text-[13px] text-gray-600">{headline || 'Your headline'}</p>
                  <div className="flex flex-wrap gap-1 mt-1.5">
                    {specialties.map((s) => (
                      <span key={s} className="text-[10px] font-semibold text-blue-700 bg-blue-50 px-2 py-0.5 rounded">{SPECIALTY_LABELS[s]}</span>
                    ))}
                  </div>
                  <div className="flex items-center gap-3 mt-1.5 text-[11px] text-gray-400">
                    {location && <span>📍 {location}</span>}
                    {years && <span>{years} yrs</span>}
                    {rate && <span>KSh {Number(rate).toLocaleString()}</span>}
                  </div>
                </div>
              </div>
            </div>

            {error && <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</p>}

            <button disabled={!canSubmit || submitting} onClick={handleSubmit} className={nextBtn(canSubmit && !submitting)}>
              {submitting ? 'Submitting…' : 'Submit Application'}
            </button>
            <p className="text-[12px] text-gray-400 text-center">
              Your profile goes live in the directory after a quick review.
            </p>
          </div>
        )}
      </div>
    </Shell>
  )
}

/* ---------- small UI helpers ---------- */

const inputCls = 'w-full bg-gray-100 rounded-xl px-4 py-3 text-[15px] text-petrol-black placeholder:text-gray-400 outline-none focus:ring-2 focus:ring-petrol-yellow/40'

function nextBtn(enabled: boolean) {
  return `w-full rounded-xl py-3.5 font-semibold transition-all ${enabled ? 'bg-petrol-yellow text-petrol-black active:scale-95' : 'bg-gray-200 text-gray-400'}`
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="text-[13px] font-semibold text-petrol-black">{label}</span>
      {hint && <span className="block text-[11px] text-gray-400 mb-1.5 mt-0.5">{hint}</span>}
      {!hint && <span className="block mb-1.5" />}
      {children}
    </label>
  )
}

function Spinner() {
  return <div className="w-8 h-8 border-2 border-petrol-yellow border-t-transparent rounded-full animate-spin" />
}

function Shell({ title, onBack, children }: { title?: string; onBack?: () => void; children: React.ReactNode }) {
  const router = useRouter()
  return (
    <div className="min-h-screen bg-gray-50 max-w-[430px] mx-auto">
      <div className="sticky top-0 z-40 bg-white border-b border-gray-100">
        <div className="flex items-center px-4 pt-3 pb-3">
          <button onClick={onBack || (() => router.back())} className="text-petrol-black p-1">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6" /></svg>
          </button>
          <h1 className="flex-1 text-center text-lg font-extrabold text-petrol-black pr-[22px]">{title || 'Become a Specialist'}</h1>
        </div>
      </div>
      {children}
    </div>
  )
}
