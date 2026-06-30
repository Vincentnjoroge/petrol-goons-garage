'use client'

import { useState, useMemo } from 'react'
import { GarageCustomer, Job, JOB_STATUS_LABELS, JOB_STATUS_COLORS, JobStatus } from '@/lib/types'
import {
  ClientRecord, ClientSort, buildClientRecords, searchClients, sortClients, exportClients,
} from '@/lib/clients'

/**
 * Drop-in panel for the garage dashboard "Customers" tab.
 * Adds search, sort, and CSV export (marketing + full) on top of the client list.
 *
 * Usage in app/garage/page.tsx (Customers tab):
 *   <ClientsPanel customers={customers} jobs={jobs} garageName={garage.name} canExport={isOwner} />
 */
export default function ClientsPanel({
  customers, jobs, garageName, canExport,
}: {
  customers: GarageCustomer[]
  jobs: Job[]
  garageName: string
  canExport: boolean
}) {
  const [search, setSearch] = useState('')
  const [sort, setSort] = useState<ClientSort>('recent')
  const [exporting, setExporting] = useState(false)

  const records = useMemo(() => buildClientRecords(customers, jobs), [customers, jobs])
  const visible = useMemo(
    () => sortClients(searchClients(records, search), sort),
    [records, search, sort]
  )

  const doExport = (marketingOnly: boolean) => {
    setExporting(true)
    try {
      // Export what's currently filtered (so owners can export a segment)
      exportClients(visible, garageName, marketingOnly)
    } finally {
      setTimeout(() => setExporting(false), 600)
    }
  }

  return (
    <div>
      {/* Header + export */}
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-white font-bold text-lg">Clients ({records.length})</h2>
        {canExport && records.length > 0 && (
          <div className="flex gap-2">
            <button
              onClick={() => doExport(true)}
              disabled={exporting}
              className="bg-petrol-yellow text-petrol-black text-xs font-bold px-3 py-2 rounded-xl active:scale-95 transition-all disabled:opacity-50"
            >
              ⬇ Marketing CSV
            </button>
            <button
              onClick={() => doExport(false)}
              disabled={exporting}
              className="bg-white/5 border border-white/10 text-gray-300 text-xs font-semibold px-3 py-2 rounded-xl active:scale-95 transition-all disabled:opacity-50"
            >
              Full CSV
            </button>
          </div>
        )}
      </div>

      {/* Search + sort */}
      {records.length > 0 && (
        <div className="flex gap-2 mb-4">
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search name, phone, email, plate…"
            className="flex-1 bg-white/[0.06] border border-white/10 rounded-xl px-4 py-3 text-white placeholder-gray-600 text-sm focus:border-petrol-yellow/50 focus:outline-none"
          />
          <select
            value={sort}
            onChange={(e) => setSort(e.target.value as ClientSort)}
            className="bg-white/[0.06] border border-white/10 rounded-xl px-3 py-3 text-white text-sm focus:border-petrol-yellow/50 focus:outline-none"
          >
            <option value="recent">Recent</option>
            <option value="spend">Top spend</option>
            <option value="jobs">Most jobs</option>
            <option value="name">Name A–Z</option>
          </select>
        </div>
      )}

      {/* Marketing hint */}
      {canExport && records.length > 0 && (
        <p className="text-gray-600 text-[11px] mb-4">
          Export downloads the {search ? 'filtered' : 'full'} list. "Marketing CSV" = name, email, phone (ready for Mailchimp / Resend).
        </p>
      )}

      {/* List */}
      {records.length === 0 ? (
        <div className="text-center py-16">
          <div className="text-5xl mb-3">👤</div>
          <p className="text-gray-400 text-sm">Clients appear here after they book a service.</p>
        </div>
      ) : visible.length === 0 ? (
        <div className="text-center py-12 text-gray-500 text-sm">No clients match “{search}”.</div>
      ) : (
        <div className="space-y-3">
          {visible.map((c) => (
            <ClientCard key={c.id} client={c} jobs={jobs} />
          ))}
        </div>
      )}
    </div>
  )
}

function ClientCard({ client, jobs }: { client: ClientRecord; jobs: Job[] }) {
  const [open, setOpen] = useState(false)
  const custJobs = jobs.filter((j) => j.customerId === client.userId)
  const active = custJobs.filter((j) => !['completed', 'cancelled'].includes(j.status)).length

  return (
    <div className="bg-white/[0.06] border border-white/10 rounded-2xl p-4">
      <button onClick={() => setOpen(!open)} className="w-full text-left">
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <p className="text-white font-semibold text-sm">{client.name}</p>
              {active > 0 && (
                <span className="text-[10px] bg-petrol-yellow/20 text-petrol-yellow font-bold px-1.5 py-0.5 rounded">{active} active</span>
              )}
            </div>
            <p className="text-gray-500 text-xs mt-0.5">{client.phone || client.email || '—'}</p>
            {client.vehicles.length > 0 && (
              <p className="text-gray-600 text-[11px] mt-0.5 truncate">🚗 {client.vehicles.join(' · ')}</p>
            )}
          </div>
          <div className="text-right shrink-0">
            <p className="text-white font-bold text-sm">{client.totalJobs}</p>
            <p className="text-gray-600 text-[10px]">visits</p>
            {client.totalSpend > 0 && (
              <p className="text-petrol-green text-[11px] font-semibold mt-0.5">KSh {client.totalSpend.toLocaleString()}</p>
            )}
          </div>
        </div>
      </button>

      {open && custJobs.length > 0 && (
        <div className="mt-3 pt-3 border-t border-white/5">
          <p className="text-gray-500 text-[10px] font-semibold uppercase tracking-wider mb-2">Service History</p>
          <div className="space-y-1.5">
            {custJobs.slice(0, 6).map((j) => {
              const c = JOB_STATUS_COLORS[j.status as JobStatus]
              return (
                <div key={j.id} className="flex items-center justify-between bg-white/[0.03] rounded-lg px-3 py-2">
                  <div className="min-w-0">
                    <span className="text-[10px] font-mono text-gray-500 mr-2">{j.bookingTag}</span>
                    <span className="text-[11px] text-gray-300">{j.services?.slice(0, 2).join(', ')}</span>
                  </div>
                  <span className={`shrink-0 text-[10px] font-bold px-2 py-0.5 rounded-full ${c.bg} ${c.text}`}>
                    {JOB_STATUS_LABELS[j.status as JobStatus]}
                  </span>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
