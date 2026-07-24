'use client'

import { useState, useEffect } from 'react'
import {
  GarageService, listServices, addService, updateService, deleteService,
  formatPrice, formatDuration,
} from '../../lib/services'

/**
 * Drop-in panel for the garage dashboard "Settings" tab.
 * Lets the owner manage their own service catalog + pricing.
 *
 * Usage in app/garage/page.tsx (Settings tab, owner only):
 *   {isOwner && <ServicesPanel garageId={garage.id!} />}
 */
export default function ServicesPanel({ garageId }: { garageId: string }) {
  const [services, setServices] = useState<GarageService[]>([])
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState<GarageService | null>(null)
  const [showAdd, setShowAdd] = useState(false)
  const [saving, setSaving] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null)

  const [name, setName] = useState('')
  const [price, setPrice] = useState('')
  const [duration, setDuration] = useState('60')
  const [description, setDescription] = useState('')

  useEffect(() => { load() }, [garageId])

  const load = async () => {
    setLoading(true)
    setServices(await listServices(garageId))
    setLoading(false)
  }

  const resetForm = () => {
    setName(''); setPrice(''); setDuration('60'); setDescription('')
    setEditing(null); setShowAdd(false)
  }

  const openEdit = (s: GarageService) => {
    setEditing(s)
    setName(s.name)
    setPrice(s.basePrice ? String(s.basePrice) : '')
    setDuration(String(s.estimatedDuration || 60))
    setDescription(s.description || '')
    setShowAdd(true)
  }

  const save = async () => {
    if (!name.trim()) return
    setSaving(true)
    const payload = {
      name: name.trim(),
      description: description.trim(),
      basePrice: price ? parseInt(price, 10) : 0,
      estimatedDuration: duration ? parseInt(duration, 10) : 60,
    }
    if (editing?.id) {
      await updateService(garageId, editing.id, payload)
    } else {
      await addService(garageId, { ...payload, sortOrder: services.length })
    }
    await load()
    resetForm()
    setSaving(false)
  }

  const remove = async (id: string) => {
    setSaving(true)
    await deleteService(garageId, id)
    await load()
    setConfirmDelete(null)
    setSaving(false)
  }

  const toggleActive = async (s: GarageService) => {
    if (!s.id) return
    await updateService(garageId, s.id, { isActive: !s.isActive })
    setServices((prev) => prev.map((x) => x.id === s.id ? { ...x, isActive: !x.isActive } : x))
  }

  return (
    <div className="bg-white/[0.06] border border-white/10 rounded-2xl p-4 mb-4">
      <div className="flex items-center justify-between mb-3">
        <p className="text-gray-400 text-xs font-semibold uppercase tracking-wider">
          Service Catalog ({services.length})
        </p>
        {!showAdd && (
          <button onClick={() => setShowAdd(true)}
            className="text-petrol-yellow text-xs font-bold">+ Add Service</button>
        )}
      </div>

      {loading ? (
        <div className="space-y-2">
          {[...Array(3)].map((_, i) => <div key={i} className="h-12 bg-white/5 rounded-xl animate-pulse" />)}
        </div>
      ) : (
        <>
          {/* List */}
          {services.length === 0 && !showAdd && (
            <p className="text-gray-600 text-sm py-3">No services yet. Add the work you offer with pricing so customers see it at booking.</p>
          )}

          <div className="space-y-2 mb-3">
            {services.map((s) => (
              <div key={s.id} className={`rounded-xl p-3 border ${s.isActive ? 'bg-white/[0.04] border-white/10' : 'bg-white/[0.02] border-white/5 opacity-60'}`}>
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <p className="text-white text-sm font-medium">{s.name}</p>
                    {s.description && <p className="text-gray-500 text-xs mt-0.5">{s.description}</p>}
                    <div className="flex items-center gap-3 mt-1">
                      <span className="text-petrol-yellow text-xs font-bold">{formatPrice(s.basePrice)}</span>
                      <span className="text-gray-500 text-[11px]">{formatDuration(s.estimatedDuration)}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <button onClick={() => toggleActive(s)}
                      className={`text-[10px] font-bold px-2 py-1 rounded ${s.isActive ? 'bg-petrol-green/15 text-petrol-green' : 'bg-white/5 text-gray-500'}`}>
                      {s.isActive ? 'Active' : 'Hidden'}
                    </button>
                    <button onClick={() => openEdit(s)} className="text-gray-400 text-xs underline">Edit</button>
                    {confirmDelete === s.id ? (
                      <button onClick={() => remove(s.id!)} disabled={saving}
                        className="text-red-400 text-[10px] font-bold">Confirm?</button>
                    ) : (
                      <button onClick={() => setConfirmDelete(s.id!)} className="text-red-500/70 text-xs">✕</button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Add / edit form */}
          {showAdd && (
            <div className="bg-white/[0.04] border border-petrol-yellow/20 rounded-xl p-3 space-y-3">
              <p className="text-white text-sm font-semibold">{editing ? 'Edit Service' : 'New Service'}</p>
              <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Service name (e.g. Full Service)"
                className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2.5 text-white placeholder-gray-600 text-sm focus:border-petrol-yellow/50 focus:outline-none" />
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-gray-500 text-[10px] block mb-1">Price (KSh) — 0 = on inspection</label>
                  <input value={price} onChange={(e) => setPrice(e.target.value.replace(/[^0-9]/g, ''))} placeholder="0" inputMode="numeric"
                    className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2.5 text-white placeholder-gray-600 text-sm focus:border-petrol-yellow/50 focus:outline-none" />
                </div>
                <div>
                  <label className="text-gray-500 text-[10px] block mb-1">Duration (min)</label>
                  <input value={duration} onChange={(e) => setDuration(e.target.value.replace(/[^0-9]/g, ''))} placeholder="60" inputMode="numeric"
                    className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2.5 text-white placeholder-gray-600 text-sm focus:border-petrol-yellow/50 focus:outline-none" />
                </div>
              </div>
              <input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Short description (optional)"
                className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2.5 text-white placeholder-gray-600 text-sm focus:border-petrol-yellow/50 focus:outline-none" />
              <div className="flex gap-2">
                <button onClick={resetForm} className="flex-1 bg-white/5 text-gray-400 py-2.5 rounded-lg text-sm">Cancel</button>
                <button onClick={save} disabled={!name.trim() || saving}
                  className="flex-[2] bg-petrol-yellow text-petrol-black font-bold py-2.5 rounded-lg text-sm disabled:opacity-40">
                  {saving ? 'Saving…' : editing ? 'Save Changes' : 'Add Service'}
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}
