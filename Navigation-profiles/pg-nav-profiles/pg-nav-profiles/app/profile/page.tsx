'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { signOut } from 'firebase/auth'
import { doc, getDoc, updateDoc, serverTimestamp } from 'firebase/firestore'
import { auth, db } from '@/lib/firebase'
import { useAuthRole } from '@/hooks/useAuthRole'
import { getCustomerJobsAllGarages } from '@/lib/jobs'
import ThemeToggle from '@/app/components/ThemeToggle'
import { Job, JOB_STATUS_LABELS, JOB_STATUS_COLORS, JobStatus } from '@/lib/types'

interface Car { id: string; make: string; model: string; year: string; plateNumber: string; color: string }

export default function ProfilePage() {
  const router = useRouter()
  const { user, role, isLoading } = useAuthRole()
  const [bio, setBio] = useState('')
  const [phone, setPhone] = useState('')
  const [cars, setCars] = useState<Car[]>([])
  const [jobs, setJobs] = useState<Job[]>([])
  const [editing, setEditing] = useState(false)
  const [carForm, setCarForm] = useState<Car | null>(null)
  const [saving, setSaving] = useState(false)
  const [loaded, setLoaded] = useState(false)
  const [carFilter, setCarFilter] = useState<string>('all')

  useEffect(() => {
    if (isLoading) return
    if (!user) { router.replace('/'); return }
    ;(async () => {
      const snap = await getDoc(doc(db, 'users', user.uid))
      const d = snap.exists() ? snap.data() : {}
      setBio(d.bio || '')
      setPhone(d.phoneNumber || '')
      setCars(d.cars || [])
      try { setJobs(await getCustomerJobsAllGarages(user.uid)) } catch {}
      setLoaded(true)
    })()
  }, [isLoading, user, router])

  const saveProfile = async () => {
    if (!user) return
    setSaving(true)
    await updateDoc(doc(db, 'users', user.uid), {
      bio: bio.slice(0, 160), phoneNumber: phone, updatedAt: serverTimestamp(),
    }).catch(() => {})
    setEditing(false); setSaving(false)
  }

  const saveCar = async () => {
    if (!user || !carForm?.make?.trim()) return
    setSaving(true)
    const next = carForm.id && cars.some(c => c.id === carForm.id)
      ? cars.map(c => c.id === carForm.id ? carForm : c)
      : [...cars, { ...carForm, id: String(Date.now()) }]
    setCars(next)
    await updateDoc(doc(db, 'users', user.uid), { cars: next, updatedAt: serverTimestamp() }).catch(() => {})
    setCarForm(null); setSaving(false)
  }

  const removeCar = async (id: string) => {
    if (!user) return
    const next = cars.filter(c => c.id !== id)
    setCars(next)
    await updateDoc(doc(db, 'users', user.uid), { cars: next, updatedAt: serverTimestamp() }).catch(() => {})
  }

  const completed = jobs.filter(j => j.status === 'completed')
  const totalSpend = completed.reduce((s, j) => s + (j.actualCost || j.estimatedCost || 0), 0)
  // Favourite garage = most jobs (uses names from job docs)
  const garageCount: Record<string, number> = {}
  jobs.forEach(j => { if ((j as any).garageName) garageCount[(j as any).garageName] = (garageCount[(j as any).garageName] || 0) + 1 })
  const favGarage = Object.entries(garageCount).sort((a, b) => b[1] - a[1])[0]?.[0] || '—'

  const visibleJobs = carFilter === 'all' ? jobs
    : jobs.filter(j => j.plateNumber === carFilter)

  if (isLoading || !loaded) return (
    <div className="min-h-screen bg-petrol-black flex items-center justify-center">
      <div className="w-8 h-8 border-4 border-petrol-yellow border-t-transparent rounded-full animate-spin" />
    </div>
  )

  return (
    <div className="min-h-screen bg-petrol-black pb-24 max-w-[430px] mx-auto">
      {/* Header */}
      <div className="sticky top-0 z-40 bg-petrol-black/95 backdrop-blur-sm border-b border-white/5 flex items-center px-4 py-3">
        <button onClick={() => router.back()} className="text-white p-1">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
        </button>
        <h1 className="flex-1 text-center text-lg font-extrabold text-white pr-[22px]">Profile</h1>
      </div>

      <div className="px-4 pt-6">
        {/* IG-style header */}
        <div className="flex items-center gap-4 mb-4">
          <div className="w-20 h-20 rounded-full bg-petrol-yellow/15 border-2 border-petrol-yellow/40 flex items-center justify-center overflow-hidden shrink-0">
            {user?.photoURL
              ? <img src={user.photoURL} alt="" className="w-full h-full object-cover" />
              : <span className="text-petrol-yellow font-black text-2xl">{(user?.displayName || '?').charAt(0)}</span>}
          </div>
          <div className="flex-1 grid grid-cols-3 text-center">
            <div><p className="text-white font-bold text-lg">{jobs.length}</p><p className="text-gray-500 text-[10px]">Services</p></div>
            <div><p className="text-white font-bold text-lg">{cars.length}</p><p className="text-gray-500 text-[10px]">Cars</p></div>
            <div><p className="text-petrol-green font-bold text-sm mt-1">KSh {totalSpend.toLocaleString()}</p><p className="text-gray-500 text-[10px]">Spent</p></div>
          </div>
        </div>

        <p className="text-white font-bold">{user?.displayName}</p>
        {editing ? (
          <div className="mt-2 space-y-2">
            <textarea value={bio} onChange={e => setBio(e.target.value.slice(0, 160))} rows={2} placeholder="Your bio…"
              className="w-full bg-white/[0.06] border border-white/10 rounded-xl px-3 py-2 text-white text-sm placeholder-gray-600 focus:border-petrol-yellow/50 focus:outline-none resize-none" />
            <input value={phone} onChange={e => setPhone(e.target.value)} placeholder="Phone" inputMode="tel"
              className="w-full bg-white/[0.06] border border-white/10 rounded-xl px-3 py-2 text-white text-sm placeholder-gray-600 focus:border-petrol-yellow/50 focus:outline-none" />
            <div className="flex gap-2">
              <button onClick={() => setEditing(false)} className="flex-1 bg-white/5 text-gray-400 py-2 rounded-xl text-sm">Cancel</button>
              <button onClick={saveProfile} disabled={saving} className="flex-[2] bg-petrol-yellow text-petrol-black font-bold py-2 rounded-xl text-sm disabled:opacity-50">{saving ? 'Saving…' : 'Save'}</button>
            </div>
          </div>
        ) : (
          <>
            <p className="text-gray-400 text-sm mt-1">{bio || 'No bio yet.'}</p>
            <p className="text-gray-600 text-xs mt-0.5">{phone || user?.email}</p>
            <button onClick={() => setEditing(true)} className="mt-3 w-full bg-white/5 border border-white/10 text-white font-semibold py-2 rounded-xl text-sm">Edit Profile</button>
          </>
        )}

        {/* Fav garage */}
        <div className="mt-4 bg-white/[0.04] border border-white/10 rounded-xl px-4 py-3 flex justify-between items-center">
          <span className="text-gray-400 text-xs">Favourite garage</span>
          <span className="text-petrol-yellow text-sm font-semibold">{favGarage}</span>
        </div>

        {/* My Cars */}
        <div className="mt-6">
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-white font-bold text-sm">My Cars</h2>
            {!carForm && <button onClick={() => setCarForm({ id: '', make: '', model: '', year: '', plateNumber: '', color: '' })} className="text-petrol-yellow text-xs font-bold">+ Add Car</button>}
          </div>
          {cars.length === 0 && !carForm && <p className="text-gray-600 text-sm">Add your car to track its full service history.</p>}
          <div className="space-y-2">
            {cars.map(c => (
              <div key={c.id} className="bg-white/[0.06] border border-white/10 rounded-xl p-3 flex justify-between items-center">
                <div>
                  <p className="text-white text-sm font-semibold">{c.make} {c.model} {c.year && `(${c.year})`}</p>
                  <p className="text-gray-500 text-xs">{c.plateNumber}{c.color && ` · ${c.color}`}</p>
                </div>
                <div className="flex gap-3">
                  <button onClick={() => setCarForm(c)} className="text-gray-400 text-xs underline">Edit</button>
                  <button onClick={() => removeCar(c.id)} className="text-red-500/70 text-xs">✕</button>
                </div>
              </div>
            ))}
          </div>
          {carForm && (
            <div className="mt-2 bg-white/[0.04] border border-petrol-yellow/20 rounded-xl p-3 space-y-2">
              <div className="grid grid-cols-2 gap-2">
                <input value={carForm.make} onChange={e => setCarForm({ ...carForm, make: e.target.value })} placeholder="Make *" className="bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-sm placeholder-gray-600" />
                <input value={carForm.model} onChange={e => setCarForm({ ...carForm, model: e.target.value })} placeholder="Model" className="bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-sm placeholder-gray-600" />
                <input value={carForm.year} onChange={e => setCarForm({ ...carForm, year: e.target.value.replace(/[^0-9]/g, '') })} placeholder="Year" inputMode="numeric" className="bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-sm placeholder-gray-600" />
                <input value={carForm.plateNumber} onChange={e => setCarForm({ ...carForm, plateNumber: e.target.value.toUpperCase() })} placeholder="Plate (KDA 123A)" className="bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-sm placeholder-gray-600" />
              </div>
              <div className="flex gap-2">
                <button onClick={() => setCarForm(null)} className="flex-1 bg-white/5 text-gray-400 py-2 rounded-lg text-sm">Cancel</button>
                <button onClick={saveCar} disabled={!carForm.make.trim() || saving} className="flex-[2] bg-petrol-yellow text-petrol-black font-bold py-2 rounded-lg text-sm disabled:opacity-40">{carForm.id ? 'Save' : 'Add Car'}</button>
              </div>
            </div>
          )}
        </div>

        {/* Service history */}
        <div className="mt-6">
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-white font-bold text-sm">Service History</h2>
            {cars.length > 0 && (
              <select value={carFilter} onChange={e => setCarFilter(e.target.value)}
                className="bg-white/[0.06] border border-white/10 rounded-lg px-2 py-1 text-white text-xs">
                <option value="all">All cars</option>
                {cars.map(c => <option key={c.id} value={c.plateNumber}>{c.plateNumber}</option>)}
              </select>
            )}
          </div>
          {visibleJobs.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-gray-500 text-sm mb-3">No services yet.</p>
              <button onClick={() => router.push('/book')} className="bg-petrol-yellow text-petrol-black font-bold px-5 py-2.5 rounded-xl text-sm">Book your first service</button>
            </div>
          ) : (
            <div className="space-y-2">
              {visibleJobs.map(j => {
                const c = JOB_STATUS_COLORS[j.status as JobStatus]
                return (
                  <div key={j.id} className="bg-white/[0.06] border border-white/10 rounded-xl p-3">
                    <div className="flex justify-between items-start">
                      <div className="min-w-0">
                        <p className="text-white text-sm font-medium truncate">{j.services?.join(', ')}</p>
                        <p className="text-gray-500 text-xs mt-0.5">{(j as any).garageName || ''} · {j.preferredDate}{j.plateNumber && ` · ${j.plateNumber}`}</p>
                        {j.serviceNotes && <p className="text-gray-400 text-xs mt-1 bg-white/[0.03] rounded p-1.5">📝 {j.serviceNotes}</p>}
                      </div>
                      <span className={`shrink-0 ml-2 text-[10px] font-bold px-2 py-0.5 rounded-full ${c.bg} ${c.text}`}>{JOB_STATUS_LABELS[j.status as JobStatus]}</span>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* Settings — theme toggle lives here now */}
        <div className="mt-6 bg-white/[0.04] border border-white/10 rounded-2xl p-4">
          <p className="text-gray-400 text-xs font-semibold uppercase tracking-wider mb-3">Settings</p>
          <div className="flex items-center justify-between mb-4">
            <span className="text-white text-sm">Appearance</span>
            <ThemeToggle />
          </div>
          <button onClick={async () => { await signOut(auth); router.replace('/') }}
            className="w-full bg-red-500/10 border border-red-500/20 text-red-400 font-semibold py-3 rounded-xl text-sm">Sign Out</button>
        </div>
      </div>
    </div>
  )
}
