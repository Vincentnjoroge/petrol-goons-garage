'use client'

import { useState } from 'react'
import { doc, updateDoc, serverTimestamp } from 'firebase/firestore'
import { db } from '@/lib/firebase'

/**
 * Captures the device's GPS position and saves lat/lng onto the garage doc.
 * Owners tap this while AT the garage (signup confirm step, or dashboard
 * Settings to backfill existing garages). Owner-only writes per rules.
 */
export default function SetLocationButton({
  garageId, hasLocation, onSaved,
}: { garageId: string; hasLocation?: boolean; onSaved?: (lat: number, lng: number) => void }) {
  const [state, setState] = useState<'idle' | 'locating' | 'saved' | 'error'>(hasLocation ? 'saved' : 'idle')
  const [msg, setMsg] = useState('')

  const capture = () => {
    if (!navigator.geolocation) { setState('error'); setMsg('Location not supported on this device.'); return }
    setState('locating')
    navigator.geolocation.getCurrentPosition(
      async (p) => {
        const lat = p.coords.latitude, lng = p.coords.longitude
        try {
          await updateDoc(doc(db, 'garages', garageId), { lat, lng, updatedAt: serverTimestamp() })
          setState('saved'); onSaved?.(lat, lng)
        } catch (e: any) { setState('error'); setMsg(e?.message || 'Could not save location.') }
      },
      (err) => {
        setState('error')
        setMsg(err.code === 1 ? 'Location permission denied — allow it in browser settings.' : 'Could not get your position. Try outdoors.')
      },
      { enableHighAccuracy: true, timeout: 10000 }
    )
  }

  return (
    <div>
      <button onClick={capture} disabled={state === 'locating'}
        className={`w-full py-3 rounded-xl text-sm font-semibold border transition-all ${
          state === 'saved'
            ? 'bg-petrol-green/10 border-petrol-green/30 text-petrol-green'
            : 'bg-petrol-yellow/10 border-petrol-yellow/30 text-petrol-yellow'
        } disabled:opacity-50`}>
        {state === 'locating' ? 'Getting your position…'
          : state === 'saved' ? '✓ Location set — tap to update'
          : '📍 Set garage location (stand at your garage)'}
      </button>
      {state === 'error' && <p className="text-red-400 text-xs mt-1.5">{msg}</p>}
      {state !== 'saved' && state !== 'error' && (
        <p className="text-gray-600 text-[11px] mt-1.5">Puts your garage on the map so customers nearby can find you.</p>
      )}
    </div>
  )
}
