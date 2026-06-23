'use client'

import { useState, useEffect, useRef } from 'react'
import { onAuthStateChanged, signInWithPopup, signInWithRedirect, getRedirectResult } from 'firebase/auth'
import { ref as storageRef, uploadBytes, getDownloadURL } from 'firebase/storage'
import { createGarage, getGarageByOwner } from '@/lib/garages'
import { GARAGE_SERVICES, KENYA_COUNTIES } from '@/lib/types'

// step: 'auth' | 'basics' | 'about' | 'confirm' | 'success'
type Step = 'auth' | 'basics' | 'about' | 'confirm' | 'success'

const STEP_ORDER: Step[] = ['auth', 'basics', 'about', 'confirm']
const STEP_LABELS = ['Basics', 'About', 'Confirm']

const DEFAULT_HOURS = {
  weekdays: { open: true,  start: '08:00', end: '18:00' },
  saturday: { open: true,  start: '08:00', end: '14:00' },
  sunday:   { open: false, start: '09:00', end: '13:00' },
}

function Confetti() {
  const COLORS = ['#FDB913', '#39FF14', '#ffffff', '#FFD700', '#00FFFF']
  const pieces = Array.from({ length: 40 }, (_, i) => ({
    left: `${(i / 40) * 100}%`,
    delay: `${(i % 8) * 0.1}s`,
    color: COLORS[i % COLORS.length],
    size: `${6 + (i % 4) * 3}px`,
    duration: `${1.0 + (i % 5) * 0.18}s`,
  }))
  return (
    <div className="fixed inset-0 pointer-events-none z-50 overflow-hidden">
      {pieces.map((p, i) => (
        <span key={i}
          className="absolute top-0 opacity-0 confetti-anim"
          style={{
            left: p.left, animationDelay: p.delay, animationDuration: p.duration,
            width: p.size, height: p.size, background: p.color,
            borderRadius: i % 3 === 0 ? '50%' : '2px',
            transform: `rotate(${i * 30}deg)`,
          }}
        />
      ))}
      <style>{`
        @keyframes confettiFall {
          0%   { transform: translateY(-20px) rotate(0deg);   opacity: 1; }
          100% { transform: translateY(100vh) rotate(720deg); opacity: 0; }
        }
        .confetti-anim { animation: confettiFall linear forwards; }
      `}</style>
    </div>
  )
}

function Logo() {
  return (
    <div className="text-center">
      <h1 className="text-3xl brand-text whitespace-nowrap">
        <span className="text-petrol-green">PETROL</span>{' '}
        <span className="inline-block bg-petrol-yellow text-petrol-black px-3 py-0.5 -skew-x-6">GOONS</span>
      </h1>
    </div>
  )
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <div className="flex items-baseline justify-between mb-1.5">
        <span className="text-gray-400 text-sm font-medium">{label}</span>
        {hint && <span className="text-gray-600 text-xs">{hint}</span>}
      </div>
      {children}
    </label>
  )
}

const inputCls = 'w-full bg-white/[0.06] border border-white/10 rounded-xl px-4 py-3.5 text-white placeholder-gray-600 focus:border-petrol-yellow/50 focus:outline-none transition-all'

export default function GarageSignupPage() {
  const [user, setUser] = useState<any>(null)
  const [checkingAuth, setCheckingAuth] = useState(true)
  const [existingGarage, setExistingGarage] = useState<any>(null)
  const [step, setStep] = useState<Step>('auth')
  const [authLoading, setAuthLoading] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [createdGarageId, setCreatedGarageId] = useState<string | null>(null)
  const photoInputRef = useRef<HTMLInputElement>(null)

  // Step 1 — basics
  const [garageName, setGarageName] = useState('')
  const [county, setCounty] = useState('')
  const [area, setArea] = useState('')
  const [ownerPhone, setOwnerPhone] = useState('')
  const [selectedServices, setSelectedServices] = useState<string[]>([])

  // Step 2 — about
  const [description, setDescription] = useState('')
  const [photoFiles, setPhotoFiles] = useState<File[]>([])
  const [photoPreviews, setPhotoPreviews] = useState<string[]>([])
  const [hours, setHours] = useState(DEFAULT_HOURS)

  // Step 3 — confirm
  const [ownerConfirmed, setOwnerConfirmed] = useState(false)

  useEffect(() => {
    let unsub: (() => void) | undefined
    const init = async () => {
      try {
        const { auth } = await import('@/lib/firebase')
        try { await getRedirectResult(auth) } catch {}
        unsub = onAuthStateChanged(auth, async (u) => {
          setUser(u)
          if (u) {
            setOwnerPhone(u.phoneNumber || '')
            const g = await getGarageByOwner(u.uid)
            if (g) {
              setExistingGarage(g)
            } else if (step === 'auth') {
              setStep('basics')
            }
          }
          setCheckingAuth(false)
        })
      } catch { setCheckingAuth(false) }
    }
    init()
    return () => unsub?.()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const signInWithGoogle = async () => {
    setAuthLoading(true); setError('')
    try {
      const { auth, googleProvider } = await import('@/lib/firebase')
      try { await signInWithPopup(auth, googleProvider) }
      catch (e: any) {
        if (e.code === 'auth/popup-blocked') await signInWithRedirect(auth, googleProvider)
        else throw e
      }
    } catch { setError('Sign-in failed. Please try again.') }
    setAuthLoading(false)
  }

  const toggleService = (s: string) =>
    setSelectedServices(p => p.includes(s) ? p.filter(x => x !== s) : [...p, s])

  const handlePhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files) return
    const files = Array.from(e.target.files).slice(0, 5)
    setPhotoFiles(files)
    setPhotoPreviews(files.map(f => URL.createObjectURL(f)))
  }

  const removePhoto = (i: number) => {
    setPhotoFiles(p => p.filter((_, idx) => idx !== i))
    setPhotoPreviews(p => p.filter((_, idx) => idx !== i))
  }

  const updateHours = (day: keyof typeof hours, field: string, val: any) =>
    setHours(prev => ({ ...prev, [day]: { ...prev[day], [field]: val } }))

  const handlePublish = async () => {
    if (!user || !ownerConfirmed) return
    setSubmitting(true); setError('')
    try {
      let photoUrls: string[] = []
      if (photoFiles.length > 0) {
        try {
          const { storage } = await import('@/lib/firebase')
          photoUrls = await Promise.all(photoFiles.map(async (file, i) => {
            const r = storageRef(storage, `garages/${user.uid}/photos/${Date.now()}_${i}`)
            const snap = await uploadBytes(r, file)
            return getDownloadURL(snap.ref)
          }))
        } catch { /* photos optional */ }
      }

      const result = await createGarage({
        name: garageName.trim(),
        ownerId: user.uid,
        ownerName: user.displayName || 'Owner',
        ownerEmail: user.email || '',
        ownerPhone: ownerPhone.trim(),
        location: [area.trim(), county.trim()].filter(Boolean).join(', '),
        county: county.trim(),
        area: area.trim(),
        servicesOffered: selectedServices,
        mechanicCount: '1-2',
        currentSystem: 'Nothing — just memory',
        description: description.trim(),
        photos: photoUrls,
        operatingHours: hours,
      })

      if (result.success) {
        setCreatedGarageId(result.garageId || null)
        setStep('success')
      } else {
        setError(result.error || 'Something went wrong. Please try again.')
      }
    } catch (err: any) {
      setError(err.message || 'Something went wrong.')
    }
    setSubmitting(false)
  }

  const shareableLink = createdGarageId
    ? `${typeof window !== 'undefined' ? window.location.origin : 'https://petrol-goons-garage.vercel.app'}/book?garage=${createdGarageId}`
    : ''

  const progressIdx = STEP_ORDER.indexOf(step) - 1 // basics=0, about=1, confirm=2

  // ── Loading ────────────────────────────────────────────────────────────────
  if (checkingAuth) {
    return (
      <div className="min-h-screen bg-petrol-black flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-petrol-yellow border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  // ── Already registered ────────────────────────────────────────────────────
  if (existingGarage) {
    return (
      <div className="min-h-screen bg-petrol-black flex items-center justify-center px-6">
        <div className="max-w-md w-full">
          <Logo />
          <div className="bg-white/[0.06] border border-white/10 rounded-2xl p-8 mt-6 text-center">
            <div className="w-16 h-16 bg-petrol-yellow/20 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-petrol-yellow" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
              </svg>
            </div>
            <h2 className="text-white text-xl font-bold mb-1">{existingGarage.name}</h2>
            <p className="text-gray-400 text-sm mb-3">{existingGarage.location}</p>
            <span className={`inline-block px-3 py-1 rounded-full text-sm font-semibold mb-6 ${existingGarage.status === 'active' ? 'bg-petrol-green/20 text-petrol-green' : 'bg-petrol-yellow/20 text-petrol-yellow'}`}>
              {existingGarage.status === 'active' ? '✓ Live' : '⏳ Under Review'}
            </span>
            <button onClick={() => window.location.href = '/garage'} className="w-full bg-petrol-yellow text-petrol-black font-bold py-3 rounded-xl mb-3">
              Go to Dashboard
            </button>
            <button onClick={() => window.location.href = '/'} className="w-full bg-white/5 text-gray-400 py-3 rounded-xl text-sm">
              Back to Home
            </button>
          </div>
        </div>
      </div>
    )
  }

  // ── Success ────────────────────────────────────────────────────────────────
  if (step === 'success') {
    return (
      <div className="min-h-screen bg-petrol-black flex items-center justify-center px-6 py-12">
        <Confetti />
        <div className="max-w-md w-full text-center">
          <div className="w-24 h-24 bg-petrol-green/20 rounded-full flex items-center justify-center mx-auto mb-6">
            <svg className="w-12 h-12 text-petrol-green" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h1 className="text-white text-3xl font-extrabold mb-2">
            Your garage is now <span className="text-petrol-green">live</span> on Petrol Goons! 🎉
          </h1>
          <p className="text-gray-400 text-base mb-8">
            <span className="text-petrol-yellow font-semibold">{garageName}</span> is ready to receive digital bookings from across Kenya.
          </p>
          {shareableLink && (
            <div className="bg-white/[0.06] border border-white/10 rounded-xl p-4 mb-6 text-left">
              <p className="text-gray-400 text-xs font-semibold uppercase tracking-wider mb-2">Your shareable booking link</p>
              <p className="text-petrol-yellow text-sm font-mono break-all mb-3">{shareableLink}</p>
              <button
                onClick={() => navigator.clipboard.writeText(shareableLink).catch(() => {})}
                className="w-full bg-white/10 text-white text-sm font-semibold py-2.5 rounded-lg hover:bg-white/15 transition-all"
              >
                📋 Copy Link
              </button>
            </div>
          )}
          <button onClick={() => window.location.href = '/garage'} className="w-full bg-petrol-yellow text-petrol-black font-bold py-4 rounded-xl text-lg mb-3 hover:brightness-110 transition-all">
            Go to Garage Dashboard →
          </button>
          <button onClick={() => window.location.href = '/'} className="w-full bg-white/5 text-gray-400 font-medium py-3 rounded-xl hover:bg-white/10 text-sm">
            Back to Home
          </button>
        </div>
      </div>
    )
  }

  // ── Wizard Shell ───────────────────────────────────────────────────────────
  const goBack = () => {
    const prev: Record<Step, Step | null> = { auth: null, basics: 'auth', about: 'basics', confirm: 'about', success: null }
    const p = prev[step]
    if (p) setStep(p)
    else window.location.href = '/'
  }

  return (
    <div className="min-h-screen bg-petrol-black pb-12">
      <div className="max-w-lg mx-auto px-6 pt-8">
        <button onClick={goBack} className="text-gray-500 text-sm mb-4 inline-block hover:text-gray-400">← Back</button>
        <Logo />
        <p className="text-gray-500 text-sm tracking-[0.2em] font-medium uppercase text-center mt-1">For Garages</p>
        <div className="w-40 mx-auto mt-3 racing-stripe-diagonal rounded-sm overflow-hidden" />

        {/* Progress bar (only while filling steps) */}
        {step !== 'auth' && (
          <div className="flex gap-1.5 mt-8 mb-8">
            {STEP_LABELS.map((_, i) => (
              <div key={i} className={`h-1.5 flex-1 rounded-full transition-all duration-300 ${i <= progressIdx ? 'bg-petrol-yellow' : 'bg-white/10'}`} />
            ))}
          </div>
        )}

        {error && (
          <div className="bg-red-500/10 border border-red-500/30 text-red-400 rounded-xl p-4 mb-6 text-sm">{error}</div>
        )}

        {/* ── AUTH ── */}
        {step === 'auth' && (
          <div className="mt-8">
            <div className="bg-white/[0.06] border border-white/10 rounded-2xl p-8 mb-6">
              <div className="w-20 h-20 bg-petrol-yellow/20 rounded-full flex items-center justify-center mx-auto mb-5">
                <svg className="w-10 h-10 text-petrol-yellow" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                </svg>
              </div>
              <h2 className="text-white text-2xl font-bold text-center mb-2">Register Your Garage</h2>
              <p className="text-gray-400 text-sm text-center mb-6">Go live in 2 minutes. Takes 3 simple steps.</p>
              <div className="space-y-2.5 mb-6">
                {['Digital booking page', 'Dashboard to manage jobs & customers', 'Service history for every car', 'Branded "Powered by Petrol Goons"'].map((t, i) => (
                  <div key={i} className="flex items-center gap-2.5">
                    <svg className="w-4 h-4 text-petrol-yellow shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" /></svg>
                    <span className="text-gray-300 text-sm">{t}</span>
                  </div>
                ))}
              </div>
              {user ? (
                <div>
                  <p className="text-gray-400 text-sm text-center mb-3">Signed in as <span className="text-white font-medium">{user.email}</span></p>
                  <button onClick={() => setStep('basics')} className="w-full bg-petrol-yellow text-petrol-black font-bold py-4 rounded-xl text-lg">
                    Start Setting Up →
                  </button>
                </div>
              ) : (
                <button onClick={signInWithGoogle} disabled={authLoading}
                  className="w-full bg-white text-gray-800 font-semibold py-4 rounded-xl hover:bg-gray-50 flex items-center justify-center gap-3 disabled:opacity-50">
                  {authLoading
                    ? <div className="w-5 h-5 border-2 border-gray-400 border-t-transparent rounded-full animate-spin" />
                    : (<>
                        <svg className="w-5 h-5" viewBox="0 0 24 24">
                          <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/>
                          <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                          <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                          <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                        </svg>
                        <span>Continue with Google</span>
                      </>)
                  }
                </button>
              )}
            </div>
          </div>
        )}

        {/* ── STEP 1: GARAGE BASICS ── */}
        {step === 'basics' && (
          <div className="space-y-5">
            <div>
              <h2 className="text-white text-2xl font-bold">Step 1: Garage Basics</h2>
              <p className="text-gray-500 text-sm mt-1">Your garage's core details.</p>
            </div>

            <Field label="Garage Name *">
              <input value={garageName} onChange={e => setGarageName(e.target.value)} placeholder="e.g. Speedfix Auto Garage" className={inputCls} />
            </Field>

            <div className="grid grid-cols-2 gap-3">
              <Field label="County / Town *">
                <select value={county} onChange={e => setCounty(e.target.value)} className={inputCls}>
                  <option value="">Select county</option>
                  {KENYA_COUNTIES.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </Field>
              <Field label="Area / Landmark">
                <input value={area} onChange={e => setArea(e.target.value)} placeholder="e.g. Westlands" className={inputCls} />
              </Field>
            </div>

            <Field label="Primary Phone Number *" hint="Pre-filled if available">
              <input value={ownerPhone} onChange={e => setOwnerPhone(e.target.value)} placeholder="0712 345 678" inputMode="tel" className={inputCls} />
            </Field>

            <div>
              <label className="block text-gray-400 text-sm font-medium mb-3">
                Services You Offer * <span className="text-gray-600">({selectedServices.length} selected)</span>
              </label>
              <div className="grid grid-cols-2 gap-2">
                {GARAGE_SERVICES.map(s => (
                  <button key={s} onClick={() => toggleService(s)}
                    className={`text-left px-3.5 py-2.5 rounded-xl text-sm font-medium transition-all border ${selectedServices.includes(s) ? 'bg-petrol-yellow/15 border-petrol-yellow/40 text-petrol-yellow' : 'bg-white/[0.04] border-white/10 text-gray-400 hover:border-white/20'}`}>
                    <span className="flex items-center gap-2">
                      {selectedServices.includes(s) && (
                        <svg className="w-3.5 h-3.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                        </svg>
                      )}
                      {s}
                    </span>
                  </button>
                ))}
              </div>
            </div>

            <div className="flex gap-3 pt-4">
              <button onClick={goBack} className="flex-1 bg-white/5 text-gray-400 font-medium py-3.5 rounded-xl hover:bg-white/10">← Back</button>
              <button
                onClick={() => setStep('about')}
                disabled={!(garageName.trim().length >= 2 && county && ownerPhone.trim().length >= 9 && selectedServices.length >= 1)}
                className="flex-[2] bg-petrol-yellow text-petrol-black font-bold py-3.5 rounded-xl hover:brightness-110 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                Continue →
              </button>
            </div>
          </div>
        )}

        {/* ── STEP 2: ABOUT YOUR GARAGE ── */}
        {step === 'about' && (
          <div className="space-y-5">
            <div>
              <h2 className="text-white text-2xl font-bold">Step 2: About Your Garage</h2>
              <p className="text-gray-500 text-sm mt-1">Help customers know what makes you great.</p>
            </div>

            <Field label="Short Description" hint={`${description.length}/200`}>
              <textarea
                value={description}
                onChange={e => setDescription(e.target.value.slice(0, 200))}
                rows={3}
                placeholder="e.g. Nairobi's trusted garage for Japanese & European cars. Fast turnaround, honest pricing."
                className={`${inputCls} resize-none`}
              />
            </Field>

            {/* Photo upload */}
            <div>
              <label className="block text-gray-400 text-sm font-medium mb-2">
                Garage Photos <span className="text-gray-600">(optional, up to 5)</span>
              </label>
              {photoPreviews.length > 0 && (
                <div className="flex gap-2 mb-3 flex-wrap">
                  {photoPreviews.map((src, i) => (
                    <div key={i} className="relative w-16 h-16 rounded-lg overflow-hidden border border-white/10">
                      <img src={src} className="w-full h-full object-cover" alt="" />
                      <button onClick={() => removePhoto(i)}
                        className="absolute top-0.5 right-0.5 w-5 h-5 bg-black/60 rounded-full flex items-center justify-center text-white text-xs">
                        ✕
                      </button>
                    </div>
                  ))}
                </div>
              )}
              {photoFiles.length < 5 && (
                <>
                  <button onClick={() => photoInputRef.current?.click()}
                    className="w-full border-2 border-dashed border-white/10 rounded-xl p-6 text-center hover:border-petrol-yellow/30 transition-all">
                    <p className="text-gray-500 text-sm">📷 Tap to add photos</p>
                    <p className="text-gray-700 text-xs mt-1">JPG / PNG up to 5MB each</p>
                  </button>
                  <input ref={photoInputRef} type="file" accept="image/*" multiple className="hidden" onChange={handlePhotoChange} />
                </>
              )}
            </div>

            {/* Operating hours */}
            <div>
              <label className="block text-gray-400 text-sm font-medium mb-3">Operating Hours</label>
              <div className="space-y-2">
                {([
                  { key: 'weekdays' as const, label: 'Weekdays (Mon–Fri)' },
                  { key: 'saturday' as const, label: 'Saturday' },
                  { key: 'sunday'   as const, label: 'Sunday' },
                ]).map(({ key, label }) => (
                  <div key={key} className="bg-white/[0.04] border border-white/10 rounded-xl p-3">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-white text-sm font-medium">{label}</span>
                      <div onClick={() => updateHours(key, 'open', !hours[key].open)}
                        className={`w-10 h-5 rounded-full flex items-center cursor-pointer transition-all ${hours[key].open ? 'bg-petrol-green' : 'bg-white/10'}`}>
                        <div className={`w-4 h-4 rounded-full bg-white shadow transition-all mx-0.5 ${hours[key].open ? 'translate-x-5' : 'translate-x-0'}`} />
                      </div>
                    </div>
                    {hours[key].open && (
                      <div className="flex items-center gap-2">
                        <input type="time" value={hours[key].start} onChange={e => updateHours(key, 'start', e.target.value)}
                          className="bg-white/5 border border-white/10 rounded-lg px-2 py-1.5 text-white text-sm flex-1" />
                        <span className="text-gray-600 text-sm">to</span>
                        <input type="time" value={hours[key].end} onChange={e => updateHours(key, 'end', e.target.value)}
                          className="bg-white/5 border border-white/10 rounded-lg px-2 py-1.5 text-white text-sm flex-1" />
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>

            <div className="flex gap-3 pt-4">
              <button onClick={goBack} className="flex-1 bg-white/5 text-gray-400 font-medium py-3.5 rounded-xl hover:bg-white/10">← Back</button>
              <button onClick={() => setStep('confirm')}
                className="flex-[2] bg-petrol-yellow text-petrol-black font-bold py-3.5 rounded-xl hover:brightness-110">
                Review & Publish →
              </button>
            </div>
          </div>
        )}

        {/* ── STEP 3: CONFIRM & GO LIVE ── */}
        {step === 'confirm' && (
          <div className="space-y-4">
            <div>
              <h2 className="text-white text-2xl font-bold">Step 3: Confirm & Go Live</h2>
              <p className="text-gray-500 text-sm mt-1">Review your details before publishing.</p>
            </div>

            {/* Summary card */}
            <div className="bg-white/[0.06] border border-white/10 rounded-2xl p-5 space-y-3">
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="text-white text-xl font-bold">{garageName}</h3>
                  <p className="text-gray-400 text-sm">📍 {[area, county].filter(Boolean).join(', ')}</p>
                  {ownerPhone && <p className="text-gray-400 text-sm mt-0.5">📞 {ownerPhone}</p>}
                </div>
                <button onClick={() => setStep('basics')} className="text-petrol-yellow text-xs underline shrink-0 ml-2">Edit</button>
              </div>

              {selectedServices.length > 0 && (
                <div>
                  <p className="text-gray-500 text-xs font-semibold uppercase tracking-wider mb-1.5">Services ({selectedServices.length})</p>
                  <div className="flex flex-wrap gap-1.5">
                    {selectedServices.map(s => (
                      <span key={s} className="bg-petrol-yellow/10 text-petrol-yellow text-xs font-medium px-2.5 py-1 rounded-lg">{s}</span>
                    ))}
                  </div>
                </div>
              )}

              {description && (
                <div>
                  <p className="text-gray-500 text-xs font-semibold uppercase tracking-wider mb-1">About</p>
                  <p className="text-gray-300 text-sm">{description}</p>
                </div>
              )}

              <div className="flex items-center justify-between pt-2 border-t border-white/5">
                <div>
                  {['weekdays', 'saturday', 'sunday'].map((d) => {
                    const h = hours[d as keyof typeof hours]
                    const label = d === 'weekdays' ? 'Mon–Fri' : d.charAt(0).toUpperCase() + d.slice(1)
                    return h.open ? (
                      <p key={d} className="text-gray-400 text-xs">{label}: {h.start}–{h.end}</p>
                    ) : (
                      <p key={d} className="text-gray-600 text-xs">{label}: Closed</p>
                    )
                  })}
                </div>
                {photoPreviews.length > 0 && (
                  <div className="flex gap-1">
                    {photoPreviews.slice(0, 3).map((src, i) => (
                      <img key={i} src={src} className="w-8 h-8 rounded object-cover" alt="" />
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Ownership checkbox */}
            <label className="flex items-start gap-3 cursor-pointer bg-white/[0.04] border border-white/10 rounded-xl p-4">
              <input type="checkbox" checked={ownerConfirmed} onChange={e => setOwnerConfirmed(e.target.checked)}
                className="mt-0.5 w-5 h-5 rounded accent-petrol-yellow shrink-0" />
              <span className="text-gray-300 text-sm leading-relaxed">
                I confirm that I am the owner or authorised manager of <strong className="text-white">{garageName}</strong> and have the right to list it on Petrol Goons.
              </span>
            </label>

            {error && <p className="text-red-400 text-sm bg-red-500/10 border border-red-500/30 rounded-xl p-3">{error}</p>}

            <button onClick={handlePublish} disabled={!ownerConfirmed || submitting}
              className="w-full bg-petrol-yellow text-petrol-black font-bold py-5 rounded-xl text-xl hover:brightness-110 transition-all disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2">
              {submitting
                ? <><div className="w-6 h-6 border-2 border-petrol-black/40 border-t-petrol-black rounded-full animate-spin" /><span>Publishing...</span></>
                : '🚀 Publish My Garage'}
            </button>

            <button onClick={goBack} className="w-full bg-white/5 text-gray-400 font-medium py-3 rounded-xl hover:bg-white/10 text-sm">← Back</button>
          </div>
        )}
      </div>
    </div>
  )
}
