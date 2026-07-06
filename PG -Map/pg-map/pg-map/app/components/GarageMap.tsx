'use client'

import { useState, useEffect, useMemo } from 'react'
import dynamic from 'next/dynamic'
import { useRouter } from 'next/navigation'
import { collection, getDocs, query, where } from 'firebase/firestore'
import { db } from '@/lib/firebase'
import { useAuthRole } from '@/hooks/useAuthRole'
import { getCustomerJobsAllGarages } from '@/lib/jobs'
import { GeoGarage, rankGarages, distanceKm, formatDistance } from '@/lib/geo'

// SSR-safe: leaflet only loads in the browser
const MapInner = dynamic(() => import('./GarageMapInner'), {
  ssr: false,
  loading: () => (
    <div className="w-full h-full flex items-center justify-center bg-white/[0.04]">
      <div className="w-7 h-7 border-4 border-petrol-yellow border-t-transparent rounded-full animate-spin" />
    </div>
  ),
})

/**
 * Garage discovery: search + service filter + map + history-ranked list.
 * Drop into /book (garage selection step) or use standalone.
 *   <GarageMap onSelect={(g) => ...} />   // optional; defaults to /book?garage={id}
 */
export default function GarageMap({ onSelect }: { onSelect?: (g: GeoGarage) => void }) {
  const router = useRouter()
  const { user } = useAuthRole()
  const [garages, setGarages] = useState<GeoGarage[]>([])
  const [historyCounts, setHistoryCounts] = useState<Record<string, number>>({})
  const [userPos, setUserPos] = useState<{ lat: number; lng: number } | null>(null)
  const [search, setSearch] = useState('')
  const [service, setService] = useState('All')
  const [showMap, setShowMap] = useState(true)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    ;(async () => {
      // Live garages only — real schema fields
      const q = query(collection(db, 'garages'), where('status', 'in', ['active', 'approved']))
      const snap = await getDocs(q)
      setGarages(snap.docs.map(d => {
        const g = d.data()
        return {
          id: d.id, name: g.name, location: g.location || '',
          lat: g.lat ?? null, lng: g.lng ?? null,
          servicesOffered: g.servicesOffered || [], description: g.description,
        }
      }))
      setLoading(false)
    })()
    // Position (optional — ranking still works without it)
    if (typeof navigator !== 'undefined' && navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        p => setUserPos({ lat: p.coords.latitude, lng: p.coords.longitude }),
        () => {}, { timeout: 5000 }
      )
    }
  }, [])

  // History-based ranking: garages you've used come first
  useEffect(() => {
    if (!user) return
    getCustomerJobsAllGarages(user.uid).then(jobs => {
      const counts: Record<string, number> = {}
      jobs.forEach((j: any) => { if (j.garageId) counts[j.garageId] = (counts[j.garageId] || 0) + 1 })
      setHistoryCounts(counts)
    }).catch(() => {})
  }, [user])

  const allServices = useMemo(() => {
    const s = new Set<string>()
    garages.forEach(g => g.servicesOffered.forEach(x => s.add(x)))
    return ['All', ...Array.from(s).sort()]
  }, [garages])

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase()
    const filtered = garages.filter(g =>
      (!q || g.name.toLowerCase().includes(q) || g.location.toLowerCase().includes(q)) &&
      (service === 'All' || g.servicesOffered.some(s => s.toLowerCase().includes(service.toLowerCase())))
    )
    return rankGarages(filtered, historyCounts, userPos)
  }, [garages, search, service, historyCounts, userPos])

  const book = (id: string) => {
    const g = garages.find(x => x.id === id)
    if (onSelect && g) onSelect(g)
    else router.push(`/book?garage=${id}`)
  }

  return (
    <div className="space-y-3">
      {/* Search + filter */}
      <div className="flex gap-2">
        <input
          value={search} onChange={e => setSearch(e.target.value)}
          placeholder="Search garage or area…"
          className="flex-1 bg-white/[0.06] border border-white/10 rounded-xl px-4 py-3 text-white placeholder-gray-600 text-sm focus:border-petrol-yellow/50 focus:outline-none"
        />
        <select value={service} onChange={e => setService(e.target.value)}
          className="bg-white/[0.06] border border-white/10 rounded-xl px-3 py-3 text-white text-sm focus:border-petrol-yellow/50 focus:outline-none max-w-[130px]">
          {allServices.map(s => <option key={s} value={s}>{s}</option>)}
        </select>
      </div>

      {/* Map / list toggle */}
      <div className="flex gap-2">
        <button onClick={() => setShowMap(true)} className={`flex-1 py-2 rounded-xl text-sm font-semibold ${showMap ? 'bg-petrol-yellow text-petrol-black' : 'bg-white/5 text-gray-400 border border-white/10'}`}>🗺 Map</button>
        <button onClick={() => setShowMap(false)} className={`flex-1 py-2 rounded-xl text-sm font-semibold ${!showMap ? 'bg-petrol-yellow text-petrol-black' : 'bg-white/5 text-gray-400 border border-white/10'}`}>☰ List</button>
      </div>

      {showMap && (
        <div className="w-full h-[380px] rounded-2xl overflow-hidden border border-white/10">
          <MapInner garages={visible} onBook={book} />
        </div>
      )}

      {/* Ranked list (history first, then nearest) */}
      {!showMap && (
        loading ? <div className="h-24 bg-white/5 rounded-xl animate-pulse" /> :
        visible.length === 0 ? <p className="text-gray-500 text-sm text-center py-8">No garages match.</p> :
        <div className="space-y-2">
          {visible.map(g => {
            const used = historyCounts[g.id]
            const dist = userPos && g.lat && g.lng ? distanceKm(userPos.lat, userPos.lng, g.lat, g.lng) : null
            return (
              <button key={g.id} onClick={() => book(g.id)}
                className="w-full text-left bg-white/[0.06] border border-white/10 rounded-xl p-3 hover:border-petrol-yellow/30 transition-all">
                <div className="flex justify-between items-start">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-white text-sm font-semibold truncate">{g.name}</p>
                      {used && <span className="text-[9px] bg-petrol-green/15 text-petrol-green font-bold px-1.5 py-0.5 rounded shrink-0">✓ Used before</span>}
                    </div>
                    <p className="text-gray-500 text-xs truncate">{g.location}</p>
                  </div>
                  <div className="text-right shrink-0 ml-2">
                    {dist !== null && <p className="text-gray-400 text-xs">{formatDistance(dist)}</p>}
                    {!g.lat && <p className="text-gray-700 text-[10px]">no pin</p>}
                  </div>
                </div>
              </button>
            )
          })}
        </div>
      )}

      <p className="text-center text-gray-600 text-xs">{visible.length} garage{visible.length !== 1 ? 's' : ''} · map data © OpenStreetMap</p>
    </div>
  )
}
