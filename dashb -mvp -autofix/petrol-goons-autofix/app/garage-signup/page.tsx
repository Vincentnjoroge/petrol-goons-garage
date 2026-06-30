'use client'

import { useState, useEffect } from 'react'
import { onAuthStateChanged, signInWithPopup, signInWithRedirect, getRedirectResult } from 'firebase/auth'
import { createGarage, getGarageByOwner } from '@/lib/garages'
import { GARAGE_SERVICES } from '@/lib/types'

type Step = 'auth' | 'basics' | 'services' | 'confirm' | 'success'

const KENYA_COUNTIES = [
  'Nairobi','Mombasa','Kisumu','Nakuru','Eldoret','Thika',
  'Machakos','Meru','Kilifi','Nyeri','Kakamega','Kisii','Other',
]

const DEFAULT_HOURS = {
  weekdays: { open: true,  start: '08:00', end: '18:00' },
  saturday: { open: true,  start: '08:00', end: '14:00' },
  sunday:   { open: false, start: '09:00', end: '13:00' },
}

function Confetti() {
  const colors = ['#FDB913','#39FF14','#ffffff','#FFD700']
  const pieces = Array.from({ length: 36 }, (_, i) => ({
    left: `${(i / 36) * 100}%`, delay: `${(i % 6) * 0.12}s`,
    color: colors[i % colors.length], size: `${6 + (i % 4) * 3}px`,
    duration: `${0.9 + (i % 5) * 0.2}s`,
  }))
  return (
    <div className="fixed inset-0 pointer-events-none z-50 overflow-hidden">
      {pieces.map((p, i) => (
        <span key={i} className="absolute top-0 confetti-anim"
          style={{ left:p.left, animationDelay:p.delay, animationDuration:p.duration,
            width:p.size, height:p.size, background:p.color,
            borderRadius: i % 3 === 0 ? '50%' : '2px', opacity: 0 }} />
      ))}
      <style>{`
        @keyframes confettiFall {
          0%   { transform:translateY(-20px) rotate(0deg);   opacity:1; }
          100% { transform:translateY(100vh) rotate(720deg); opacity:0; }
        }
        .confetti-anim { animation:confettiFall linear forwards; }
      `}</style>
    </div>
  )
}

const iCls = 'w-full bg-white/[0.06] border border-white/10 rounded-xl px-4 py-3.5 text-white placeholder-gray-600 focus:border-petrol-yellow/50 focus:outline-none transition-all'

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

function NavRow({ onBack, onNext, canNext, nextLabel = 'Continue →' }: {
  onBack:()=>void; onNext:()=>void; canNext:boolean; nextLabel?:string
}) {
  return (
    <div className="flex gap-3 pt-4">
      <button onClick={onBack} className="flex-1 bg-white/5 text-gray-400 font-medium py-3.5 rounded-xl hover:bg-white/10">← Back</button>
      <button onClick={onNext} disabled={!canNext}
        className="flex-[2] bg-petrol-yellow text-petrol-black font-bold py-3.5 rounded-xl hover:brightness-110 disabled:opacity-40 disabled:cursor-not-allowed">
        {nextLabel}
      </button>
    </div>
  )
}

export default function GarageSignupPage() {
  const [user, setUser] = useState<any>(null)
  const [checkingAuth, setCheckingAuth] = useState(true)
  const [existingGarage, setExistingGarage] = useState<any>(null)
  const [step, setStep] = useState<Step>('auth')
  const [authLoading, setAuthLoading] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [createdGarageId, setCreatedGarageId] = useState<string|null>(null)

  const [garageName, setGarageName] = useState('')
  const [county, setCounty] = useState('')
  const [area, setArea] = useState('')
  const [ownerPhone, setOwnerPhone] = useState('')
  const [selectedServices, setSelectedServices] = useState<string[]>([])
  const [description, setDescription] = useState('')
  const [hours, setHours] = useState(DEFAULT_HOURS)
  const [ownerConfirmed, setOwnerConfirmed] = useState(false)

  useEffect(() => {
    let unsub: (()=>void)|undefined
    const init = async () => {
      try {
        const { auth } = await import('@/lib/firebase')
        try { await getRedirectResult(auth) } catch {}
        unsub = onAuthStateChanged(auth, async (u) => {
          setUser(u)
          if (u) {
            setOwnerPhone(u.phoneNumber || '')
            const g = await getGarageByOwner(u.uid)
            if (g) setExistingGarage(g)
            else if (step === 'auth') setStep('basics')
          }
          setCheckingAuth(false)
        })
      } catch { setCheckingAuth(false) }
    }
    init()
    return () => unsub?.()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const signIn = async () => {
    setAuthLoading(true); setError('')
    try {
      const { auth, googleProvider } = await import('@/lib/firebase')
      try { await signInWithPopup(auth, googleProvider) }
      catch (e: any) {
        if (e.code === 'auth/popup-blocked') await signInWithRedirect(auth, googleProvider)
        else throw e
      }
    } catch { setError('Sign-in failed. Try again.') }
    setAuthLoading(false)
  }

  const toggle = (s: string) =>
    setSelectedServices(p => p.includes(s) ? p.filter(x => x !== s) : [...p, s])

  const updateH = (day: keyof typeof hours, field: string, val: any) =>
    setHours(prev => ({ ...prev, [day]: { ...prev[day], [field]: val } }))

  const handlePublish = async () => {
    if (!user || !ownerConfirmed) return
    setSubmitting(true); setError('')
    try {
      const result = await createGarage({
        name: garageName.trim(),
        ownerId: user.uid,
        ownerName: user.displayName || 'Owner',
        ownerEmail: user.email || '',
        ownerPhone: ownerPhone.trim(),
        location: [area.trim(), county].filter(Boolean).join(', '),
        county, area: area.trim(),
        servicesOffered: selectedServices,
        mechanicCount: '1-2',
        currentSystem: 'Nothing — just memory',
        description: description.trim(),
        operatingHours: hours,
      })
      if (result.success) {
        setCreatedGarageId(result.garageId || null)
        setStep('success')
      } else {
        setError(result.error || 'Submission failed. Please try again.')
      }
    } catch (err: any) {
      setError(err?.message || 'An unexpected error occurred.')
    }
    setSubmitting(false)
  }

  const shareLink = createdGarageId
    ? `${typeof window !== 'undefined' ? window.location.origin : 'https://petrol-goons-garage.vercel.app'}/book?garage=${createdGarageId}`
    : ''

  const goBack = () => {
    const prev: Record<Step, Step|null> = {
      auth:null, basics:'auth', services:'basics', confirm:'services', success:null,
    }
    const p = prev[step]; if (p) setStep(p); else window.location.href = '/'
  }

  const si = { auth:-1, basics:0, services:1, confirm:2, success:3 }[step]

  if (checkingAuth) return (
    <div className="min-h-screen bg-petrol-black flex items-center justify-center">
      <div className="text-center">
        <h1 className="text-3xl brand-text mb-6">
          <span className="text-petrol-green">PETROL</span>{' '}
          <span className="inline-block bg-petrol-yellow text-petrol-black px-3 py-0.5 -skew-x-6">GOONS</span>
        </h1>
        <div className="w-8 h-8 border-4 border-petrol-yellow border-t-transparent rounded-full animate-spin mx-auto" />
      </div>
    </div>
  )

  if (existingGarage) return (
    <div className="min-h-screen bg-petrol-black flex items-center justify-center px-6">
      <div className="max-w-md w-full text-center">
        <Logo />
        <div className="bg-white/[0.06] border border-white/10 rounded-2xl p-8 mt-6">
          <h2 className="text-white text-xl font-bold mb-1">{existingGarage.name}</h2>
          <p className="text-gray-400 text-sm mb-4">{existingGarage.location}</p>
          <span className={`inline-block px-3 py-1 rounded-full text-sm font-bold mb-5 ${
            ['active','approved'].includes(existingGarage.status)
              ? 'bg-petrol-green/20 text-petrol-green'
              : 'bg-petrol-yellow/20 text-petrol-yellow'
          }`}>
            {['active','approved'].includes(existingGarage.status) ? '✓ Live' : '⏳ Setting up…'}
          </span>
          <button onClick={() => window.location.href = '/garage'}
            className="w-full bg-petrol-yellow text-petrol-black font-bold py-3 rounded-xl mb-3">
            Go to Dashboard
          </button>
          <button onClick={() => window.location.href = '/'}
            className="w-full bg-white/5 text-gray-400 py-3 rounded-xl text-sm">
            Back to Home
          </button>
        </div>
      </div>
    </div>
  )

  if (step === 'success') return (
    <div className="min-h-screen bg-petrol-black flex items-center justify-center px-6 py-12">
      <Confetti />
      <div className="max-w-md w-full text-center relative z-10">
        <div className="w-24 h-24 bg-petrol-green/20 rounded-full flex items-center justify-center mx-auto mb-6">
          <svg className="w-12 h-12 text-petrol-green" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <h1 className="text-white text-3xl font-extrabold mb-2">
          Your garage is now <span className="text-petrol-green">live!</span> 🎉
        </h1>
        <p className="text-gray-400 text-base mb-8">
          <span className="text-petrol-yellow font-semibold">{garageName}</span> is ready to receive bookings right now.
        </p>
        {shareLink && (
          <div className="bg-white/[0.06] border border-white/10 rounded-xl p-4 mb-6 text-left">
            <p className="text-gray-400 text-xs font-semibold uppercase tracking-wider mb-2">Booking Link</p>
            <p className="text-petrol-yellow text-sm font-mono break-all mb-3">{shareLink}</p>
            <button onClick={() => navigator.clipboard.writeText(shareLink).catch(()=>{})}
              className="w-full bg-white/10 text-white text-sm font-semibold py-2.5 rounded-lg">
              📋 Copy Link
            </button>
          </div>
        )}
        <button onClick={() => window.location.href = '/garage'}
          className="w-full bg-petrol-yellow text-petrol-black font-bold py-4 rounded-xl text-lg mb-3 hover:brightness-110">
          Go to Garage Dashboard →
        </button>
        <button onClick={() => window.location.href = '/'}
          className="w-full bg-white/5 text-gray-400 py-3 rounded-xl text-sm">
          Back to Home
        </button>
      </div>
    </div>
  )

  return (
    <div className="min-h-screen bg-petrol-black pb-12">
      <div className="max-w-lg mx-auto px-6 pt-8">
        <button onClick={goBack} className="text-gray-500 text-sm mb-4 inline-block hover:text-gray-400">← Back</button>
        <Logo />
        <p className="text-gray-500 text-sm tracking-[0.2em] font-medium uppercase text-center mt-1">For Garages</p>
        <div className="w-40 mx-auto mt-3 racing-stripe-diagonal rounded-sm overflow-hidden" />
        {step !== 'auth' && (
          <div className="flex gap-1.5 mt-8 mb-8">
            {[0,1,2].map(i => (
              <div key={i} className={`h-1.5 flex-1 rounded-full transition-all ${i <= si ? 'bg-petrol-yellow' : 'bg-white/10'}`} />
            ))}
          </div>
        )}
        {error && <div className="bg-red-500/10 border border-red-500/30 text-red-400 rounded-xl p-4 mb-6 text-sm">{error}</div>}

        {/* AUTH */}
        {step === 'auth' && (
          <div className="mt-8 bg-white/[0.06] border border-white/10 rounded-2xl p-8">
            <h2 className="text-white text-2xl font-bold text-center mb-2">Register Your Garage</h2>
            <p className="text-gray-400 text-sm text-center mb-5">Go live instantly — no waiting, no manual approval.</p>
            {['Digital booking page','Dashboard to manage jobs & customers','Service history for every car'].map((t,i) => (
              <div key={i} className="flex items-center gap-2.5 mb-2">
                <svg className="w-4 h-4 text-petrol-yellow shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" /></svg>
                <span className="text-gray-300 text-sm">{t}</span>
              </div>
            ))}
            <div className="mt-6">
              {user ? (
                <>
                  <p className="text-gray-400 text-sm text-center mb-3">Signed in as <span className="text-white font-medium">{user.email}</span></p>
                  <button onClick={() => setStep('basics')} className="w-full bg-petrol-yellow text-petrol-black font-bold py-4 rounded-xl text-lg">Start Setup →</button>
                </>
              ) : (
                <button onClick={signIn} disabled={authLoading}
                  className="w-full bg-white text-gray-800 font-semibold py-4 rounded-xl flex items-center justify-center gap-3 disabled:opacity-50">
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

        {/* STEP 1 */}
        {step === 'basics' && (
          <div className="space-y-5">
            <h2 className="text-white text-2xl font-bold">Step 1: Garage Basics</h2>
            <div>
              <label className="block text-gray-400 text-sm font-medium mb-1.5">Garage Name *</label>
              <input value={garageName} onChange={e=>setGarageName(e.target.value)} placeholder="e.g. Speedfix Auto Garage" className={iCls} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-gray-400 text-sm font-medium mb-1.5">County / Town *</label>
                <select value={county} onChange={e=>setCounty(e.target.value)} className={iCls}>
                  <option value="">Select</option>
                  {KENYA_COUNTIES.map(c=><option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-gray-400 text-sm font-medium mb-1.5">Area / Landmark</label>
                <input value={area} onChange={e=>setArea(e.target.value)} placeholder="e.g. Westlands" className={iCls} />
              </div>
            </div>
            <div>
              <label className="block text-gray-400 text-sm font-medium mb-1.5">Primary Phone *</label>
              <input value={ownerPhone} onChange={e=>setOwnerPhone(e.target.value)} placeholder="0712 345 678" inputMode="tel" className={iCls} />
            </div>
            <NavRow onBack={goBack} onNext={()=>setStep('services')} canNext={garageName.trim().length>=2 && !!county && ownerPhone.trim().length>=9} />
          </div>
        )}

        {/* STEP 2 */}
        {step === 'services' && (
          <div className="space-y-5">
            <h2 className="text-white text-2xl font-bold">Step 2: Services & Info</h2>
            <div>
              <label className="block text-gray-400 text-sm font-medium mb-3">Services You Offer * ({selectedServices.length} selected)</label>
              <div className="grid grid-cols-2 gap-2">
                {GARAGE_SERVICES.map(s=>(
                  <button key={s} onClick={()=>toggle(s)}
                    className={`text-left px-3.5 py-2.5 rounded-xl text-sm font-medium border transition-all ${
                      selectedServices.includes(s)
                        ? 'bg-petrol-yellow/15 border-petrol-yellow/40 text-petrol-yellow'
                        : 'bg-white/[0.04] border-white/10 text-gray-400'
                    }`}>
                    <span className="flex items-center gap-2">
                      {selectedServices.includes(s) && <svg className="w-3.5 h-3.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7"/></svg>}
                      {s}
                    </span>
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="block text-gray-400 text-sm font-medium mb-1.5">Short Description <span className="text-gray-600">{description.length}/200</span></label>
              <textarea value={description} onChange={e=>setDescription(e.target.value.slice(0,200))} rows={3}
                placeholder="e.g. Trusted garage for Japanese cars. Fast, honest pricing."
                className={`${iCls} resize-none`} />
            </div>
            <div>
              <label className="block text-gray-400 text-sm font-medium mb-3">Operating Hours</label>
              {([
                {key:'weekdays' as const,label:'Mon–Fri'},
                {key:'saturday' as const,label:'Saturday'},
                {key:'sunday'   as const,label:'Sunday'},
              ]).map(({key,label})=>(
                <div key={key} className="bg-white/[0.04] border border-white/10 rounded-xl p-3 mb-2">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-white text-sm font-medium">{label}</span>
                    <div onClick={()=>updateH(key,'open',!hours[key].open)}
                      className={`w-10 h-5 rounded-full flex items-center cursor-pointer transition-all ${hours[key].open?'bg-petrol-green':'bg-white/10'}`}>
                      <div className={`w-4 h-4 rounded-full bg-white shadow mx-0.5 transition-all ${hours[key].open?'translate-x-5':''}`}/>
                    </div>
                  </div>
                  {hours[key].open && (
                    <div className="flex items-center gap-2">
                      <input type="time" value={hours[key].start} onChange={e=>updateH(key,'start',e.target.value)}
                        className="bg-white/5 border border-white/10 rounded-lg px-2 py-1.5 text-white text-sm flex-1"/>
                      <span className="text-gray-600 text-sm">to</span>
                      <input type="time" value={hours[key].end} onChange={e=>updateH(key,'end',e.target.value)}
                        className="bg-white/5 border border-white/10 rounded-lg px-2 py-1.5 text-white text-sm flex-1"/>
                    </div>
                  )}
                </div>
              ))}
            </div>
            <NavRow onBack={goBack} onNext={()=>setStep('confirm')} canNext={selectedServices.length>=1} nextLabel="Review →"/>
          </div>
        )}

        {/* STEP 3 */}
        {step === 'confirm' && (
          <div className="space-y-4">
            <h2 className="text-white text-2xl font-bold">Step 3: Confirm & Go Live</h2>
            <div className="bg-white/[0.06] border border-white/10 rounded-2xl p-5 space-y-3">
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="text-white text-xl font-bold">{garageName}</h3>
                  <p className="text-gray-400 text-sm">📍 {[area,county].filter(Boolean).join(', ')}</p>
                  {ownerPhone && <p className="text-gray-400 text-sm mt-0.5">📞 {ownerPhone}</p>}
                </div>
                <button onClick={()=>setStep('basics')} className="text-petrol-yellow text-xs underline shrink-0 ml-2">Edit</button>
              </div>
              {selectedServices.length>0 && (
                <div>
                  <p className="text-gray-500 text-xs font-semibold uppercase tracking-wider mb-1.5">Services</p>
                  <div className="flex flex-wrap gap-1.5">
                    {selectedServices.map(s=>(
                      <span key={s} className="bg-petrol-yellow/10 text-petrol-yellow text-xs font-medium px-2.5 py-1 rounded-lg">{s}</span>
                    ))}
                  </div>
                </div>
              )}
              {description && <p className="text-gray-400 text-sm">{description}</p>}
            </div>
            <label className="flex items-start gap-3 cursor-pointer bg-white/[0.04] border border-white/10 rounded-xl p-4">
              <input type="checkbox" checked={ownerConfirmed} onChange={e=>setOwnerConfirmed(e.target.checked)}
                className="mt-0.5 w-5 h-5 rounded accent-petrol-yellow shrink-0"/>
              <span className="text-gray-300 text-sm leading-relaxed">
                I confirm I am the owner or authorised manager of <strong className="text-white">{garageName}</strong> and have the right to list it on Petrol Goons.
              </span>
            </label>
            {error && <div className="bg-red-500/10 border border-red-500/30 text-red-400 rounded-xl p-3 text-sm">{error}</div>}
            <button onClick={handlePublish} disabled={!ownerConfirmed||submitting}
              className="w-full bg-petrol-yellow text-petrol-black font-bold py-5 rounded-xl text-xl hover:brightness-110 disabled:opacity-40 flex items-center justify-center gap-2">
              {submitting
                ? <><div className="w-6 h-6 border-2 border-petrol-black/40 border-t-petrol-black rounded-full animate-spin"/><span>Publishing…</span></>
                : '🚀 Publish My Garage'}
            </button>
            <button onClick={goBack} className="w-full bg-white/5 text-gray-400 py-3 rounded-xl text-sm">← Back</button>
          </div>
        )}
      </div>
    </div>
  )
}
