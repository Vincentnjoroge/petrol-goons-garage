'use client'

import { useState, useEffect } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { doc, getDoc, updateDoc, collection, getDocs, query, where, serverTimestamp } from 'firebase/firestore'
import { db } from '@/lib/firebase'
import { useAuthRole } from '@/hooks/useAuthRole'
import { listServices, formatPrice, formatDuration, GarageService } from '@/lib/services'

interface Offer { id: string; title: string; discountPercent: number; validUntil: string }
type Tab = 'services' | 'offers' | 'reviews'

export default function GaragePublicProfile() {
  const router = useRouter()
  const params = useParams()
  const garageId = String(params?.garageId || '')
  const { user, garageId: myGarageId, role } = useAuthRole()

  const [garage, setGarage] = useState<any>(null)
  const [services, setServices] = useState<GarageService[]>([])
  const [reviews, setReviews] = useState<any[]>([])
  const [tab, setTab] = useState<Tab>('services')
  const [loading, setLoading] = useState(true)
  const [offerForm, setOfferForm] = useState<Offer | null>(null)
  const [saving, setSaving] = useState(false)

  const isOwner = role === 'garage_owner' && myGarageId === garageId

  useEffect(() => {
    if (!garageId) return
    ;(async () => {
      const snap = await getDoc(doc(db, 'garages', garageId))
      if (!snap.exists()) { setLoading(false); return }
      setGarage({ id: snap.id, ...snap.data() })
      setServices((await listServices(garageId)).filter(s => s.isActive))
      try {
        const rq = query(collection(db, 'garages', garageId, 'reviews'), where('isPublic', '==', true))
        const rs = await getDocs(rq)
        setReviews(rs.docs.map(d => ({ id: d.id, ...d.data() })))
      } catch {}
      setLoading(false)
    })()
  }, [garageId])

  const offers: Offer[] = (garage?.currentOffers || []).filter(
    (o: Offer) => !o.validUntil || o.validUntil >= new Date().toISOString().split('T')[0]
  )
  const avgRating = reviews.length ? (reviews.reduce((a, r) => a + (r.rating || 0), 0) / reviews.length) : 0

  const saveOffer = async () => {
    if (!offerForm?.title.trim() || !garage) return
    setSaving(true)
    const next = [...(garage.currentOffers || []), { ...offerForm, id: String(Date.now()) }]
    await updateDoc(doc(db, 'garages', garageId), { currentOffers: next, updatedAt: serverTimestamp() }).catch(() => {})
    setGarage({ ...garage, currentOffers: next })
    setOfferForm(null); setSaving(false)
  }

  const removeOffer = async (id: string) => {
    if (!garage) return
    const next = (garage.currentOffers || []).filter((o: Offer) => o.id !== id)
    await updateDoc(doc(db, 'garages', garageId), { currentOffers: next, updatedAt: serverTimestamp() }).catch(() => {})
    setGarage({ ...garage, currentOffers: next })
  }

  if (loading) return (
    <div className="min-h-screen bg-petrol-black flex items-center justify-center">
      <div className="w-8 h-8 border-4 border-petrol-yellow border-t-transparent rounded-full animate-spin" />
    </div>
  )

  if (!garage) return (
    <div className="min-h-screen bg-petrol-black flex flex-col items-center justify-center px-8 text-center">
      <p className="text-white font-bold text-lg mb-2">Garage not found</p>
      {!user && <p className="text-gray-500 text-sm mb-4">You may need to sign in to view garage profiles.</p>}
      <button onClick={() => router.push('/')} className="bg-petrol-yellow text-petrol-black font-bold px-6 py-3 rounded-xl text-sm">Back to Home</button>
    </div>
  )

  return (
    <div className="min-h-screen bg-petrol-black pb-28 max-w-[430px] mx-auto">
      {/* Cover / header */}
      <div className="relative h-32 bg-gradient-to-br from-petrol-yellow/25 to-petrol-black">
        <button onClick={() => router.back()} className="absolute top-3 left-3 bg-black/40 rounded-full p-2 text-white">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
        </button>
        {garage.photos?.[0] && <img src={garage.photos[0]} alt="" className="w-full h-full object-cover opacity-60" />}
      </div>

      <div className="px-4 -mt-8 relative">
        <div className="w-16 h-16 rounded-2xl bg-petrol-yellow flex items-center justify-center border-4 border-petrol-black mb-2">
          <span className="text-petrol-black font-black text-2xl">{garage.name?.charAt(0)}</span>
        </div>
        <h1 className="text-white text-xl font-extrabold">{garage.name}</h1>
        <p className="text-gray-400 text-sm">📍 {garage.location}</p>
        <div className="flex items-center gap-2 mt-1">
          {avgRating > 0 && (
            <span className="text-amber-400 text-sm font-bold">★ {avgRating.toFixed(1)} <span className="text-gray-500 font-normal">({reviews.length})</span></span>
          )}
          {['active', 'approved'].includes(garage.status) && (
            <span className="text-[10px] bg-petrol-green/15 text-petrol-green font-bold px-2 py-0.5 rounded-full">✓ Verified</span>
          )}
        </div>
        {garage.description && <p className="text-gray-400 text-sm mt-2">{garage.description}</p>}

        {/* Offer banner */}
        {offers.length > 0 && (
          <div className="mt-3 bg-petrol-yellow/10 border border-petrol-yellow/30 rounded-xl px-3 py-2">
            <p className="text-petrol-yellow text-xs font-bold">🔥 {offers[0].title} {offers[0].discountPercent ? `— ${offers[0].discountPercent}% off` : ''}</p>
          </div>
        )}

        {/* Tabs */}
        <div className="flex gap-2 mt-4 mb-4">
          {(['services', 'offers', 'reviews'] as Tab[]).map(t => (
            <button key={t} onClick={() => setTab(t)}
              className={`flex-1 py-2 rounded-xl text-sm font-semibold capitalize ${tab === t ? 'bg-petrol-yellow text-petrol-black' : 'bg-white/5 text-gray-400 border border-white/10'}`}>
              {t}{t === 'reviews' && reviews.length > 0 && ` (${reviews.length})`}
            </button>
          ))}
        </div>

        {/* SERVICES */}
        {tab === 'services' && (
          services.length === 0
            ? <p className="text-gray-600 text-sm py-6 text-center">No services listed yet.</p>
            : <div className="space-y-2">
                {services.map(s => (
                  <div key={s.id} className="bg-white/[0.06] border border-white/10 rounded-xl p-3 flex justify-between items-center">
                    <div className="min-w-0">
                      <p className="text-white text-sm font-medium">{s.name}</p>
                      {s.description && <p className="text-gray-500 text-xs">{s.description}</p>}
                    </div>
                    <div className="text-right shrink-0 ml-2">
                      <p className="text-petrol-yellow text-sm font-bold">{formatPrice(s.basePrice)}</p>
                      <p className="text-gray-600 text-[10px]">{formatDuration(s.estimatedDuration)}</p>
                    </div>
                  </div>
                ))}
              </div>
        )}

        {/* OFFERS */}
        {tab === 'offers' && (
          <div>
            {offers.length === 0 && !offerForm && (
              <p className="text-gray-600 text-sm py-6 text-center">No current offers.</p>
            )}
            <div className="space-y-2">
              {offers.map((o: Offer) => (
                <div key={o.id} className="bg-petrol-yellow/10 border border-petrol-yellow/30 rounded-xl p-3 flex justify-between items-center">
                  <div>
                    <p className="text-petrol-yellow text-sm font-bold">{o.title}</p>
                    <p className="text-gray-400 text-xs">{o.discountPercent ? `${o.discountPercent}% off` : ''}{o.validUntil && ` · until ${o.validUntil}`}</p>
                  </div>
                  {isOwner && <button onClick={() => removeOffer(o.id)} className="text-red-500/70 text-xs shrink-0">✕</button>}
                </div>
              ))}
            </div>
            {isOwner && !offerForm && (
              <button onClick={() => setOfferForm({ id: '', title: '', discountPercent: 0, validUntil: '' })}
                className="mt-3 w-full bg-white/5 border border-dashed border-petrol-yellow/30 text-petrol-yellow py-3 rounded-xl text-sm font-semibold">+ Add Offer</button>
            )}
            {isOwner && offerForm && (
              <div className="mt-3 bg-white/[0.04] border border-petrol-yellow/20 rounded-xl p-3 space-y-2">
                <input value={offerForm.title} onChange={e => setOfferForm({ ...offerForm, title: e.target.value })} placeholder="Offer title (e.g. 20% off oil change)"
                  className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-sm placeholder-gray-600" />
                <div className="grid grid-cols-2 gap-2">
                  <input value={offerForm.discountPercent || ''} onChange={e => setOfferForm({ ...offerForm, discountPercent: parseInt(e.target.value.replace(/[^0-9]/g, '') || '0', 10) })} placeholder="% off" inputMode="numeric"
                    className="bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-sm placeholder-gray-600" />
                  <input type="date" value={offerForm.validUntil} onChange={e => setOfferForm({ ...offerForm, validUntil: e.target.value })}
                    className="bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-sm" />
                </div>
                <div className="flex gap-2">
                  <button onClick={() => setOfferForm(null)} className="flex-1 bg-white/5 text-gray-400 py-2 rounded-lg text-sm">Cancel</button>
                  <button onClick={saveOffer} disabled={!offerForm.title.trim() || saving} className="flex-[2] bg-petrol-yellow text-petrol-black font-bold py-2 rounded-lg text-sm disabled:opacity-40">{saving ? 'Saving…' : 'Publish Offer'}</button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* REVIEWS */}
        {tab === 'reviews' && (
          reviews.length === 0
            ? <p className="text-gray-600 text-sm py-6 text-center">No reviews yet — be the first after your service.</p>
            : <div className="space-y-3">
                {reviews.map(r => (
                  <div key={r.id} className="bg-white/[0.06] border border-white/10 rounded-xl p-3">
                    <div className="flex justify-between items-center mb-1">
                      <p className="text-white text-sm font-medium">{r.customerName}</p>
                      <span className="text-amber-400 text-sm">{'★'.repeat(r.rating || 0)}<span className="text-white/10">{'★'.repeat(5 - (r.rating || 0))}</span></span>
                    </div>
                    <p className="text-gray-400 text-xs">{r.comment}</p>
                    {r.garageResponse && <p className="mt-2 text-xs text-petrol-green bg-petrol-green/5 rounded-lg p-2">↳ {r.garageResponse}</p>}
                  </div>
                ))}
              </div>
        )}
      </div>

      {/* Sticky Book CTA */}
      {!isOwner && (
        <div className="fixed bottom-0 left-0 right-0 max-w-[430px] mx-auto p-4 bg-gradient-to-t from-petrol-black via-petrol-black/95 to-transparent">
          <button onClick={() => router.push(`/book?garage=${garageId}`)}
            className="w-full bg-petrol-yellow text-petrol-black font-bold py-4 rounded-xl text-lg shadow-lg active:scale-[0.98] transition-all">
            Book at {garage.name} →
          </button>
        </div>
      )}
    </div>
  )
}
