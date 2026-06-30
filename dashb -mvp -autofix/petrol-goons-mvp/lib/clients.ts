/**
 * Petrol Goons Garage SaaS — Client Database: search + marketing export
 *
 * Serves the MVP north star: "database clients for future marketing."
 * Builds an enriched client list from garage customers + their job history,
 * supports search, and exports to CSV (the format Mailchimp / Resend imports).
 *
 * Privacy note: export is owner-only (enforced by Firestore rules + UI gating).
 * We export only fields the garage already holds via its own bookings.
 */

import { GarageCustomer, Job } from './types'

export interface ClientRecord {
  id: string
  userId: string
  name: string
  email: string
  phone: string
  totalJobs: number
  completedJobs: number
  totalSpend: number
  lastService: string | null      // ISO date or readable label
  vehicles: string[]              // ["Toyota Premio KDA 123A", ...]
  topServices: string[]
}

/**
 * Merge customer docs with their job history into enriched client records.
 */
export function buildClientRecords(
  customers: GarageCustomer[],
  jobs: Job[]
): ClientRecord[] {
  return customers.map((c) => {
    const custJobs = jobs.filter((j) => j.customerId === c.userId)
    const completed = custJobs.filter((j) => j.status === 'completed')

    // Vehicles from job records (richer than the customer doc)
    const vehicleSet = new Set<string>()
    custJobs.forEach((j) => {
      const parts = [j.vehicleMake, j.vehicleModel, j.plateNumber].filter(Boolean)
      if (parts.length) vehicleSet.add(parts.join(' '))
    })
    // Fall back to stored vehicles
    ;(c.vehicles || []).forEach((v) => {
      const parts = [v.make, v.model, v.plateNumber].filter(Boolean)
      if (parts.length) vehicleSet.add(parts.join(' '))
    })

    // Top services across this client's jobs
    const svcCount: Record<string, number> = {}
    custJobs.forEach((j) => j.services?.forEach((s) => { svcCount[s] = (svcCount[s] || 0) + 1 }))
    const topServices = Object.entries(svcCount).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([s]) => s)

    // Most recent service date
    let lastService: string | null = null
    const dated = custJobs
      .map((j) => j.completedAt?.toMillis?.() || j.submittedAt?.toMillis?.() || 0)
      .filter(Boolean)
      .sort((a, b) => b - a)
    if (dated[0]) lastService = new Date(dated[0]).toISOString().split('T')[0]

    const totalSpend = completed.reduce((sum, j) => sum + (j.actualCost || j.estimatedCost || 0), 0)

    return {
      id: c.id || c.userId,
      userId: c.userId,
      name: c.name || 'Unknown',
      email: c.email || '',
      phone: c.phone || '',
      totalJobs: custJobs.length,
      completedJobs: completed.length,
      totalSpend,
      lastService,
      vehicles: Array.from(vehicleSet),
      topServices,
    }
  })
}

/**
 * Case-insensitive search across name, phone, email, and vehicle/plate.
 */
export function searchClients(records: ClientRecord[], queryRaw: string): ClientRecord[] {
  const q = queryRaw.trim().toLowerCase()
  if (!q) return records
  return records.filter((r) =>
    r.name.toLowerCase().includes(q) ||
    r.phone.toLowerCase().includes(q) ||
    r.email.toLowerCase().includes(q) ||
    r.vehicles.some((v) => v.toLowerCase().includes(q))
  )
}

export type ClientSort = 'recent' | 'spend' | 'jobs' | 'name'

export function sortClients(records: ClientRecord[], sort: ClientSort): ClientRecord[] {
  const copy = [...records]
  switch (sort) {
    case 'spend': return copy.sort((a, b) => b.totalSpend - a.totalSpend)
    case 'jobs':  return copy.sort((a, b) => b.totalJobs - a.totalJobs)
    case 'name':  return copy.sort((a, b) => a.name.localeCompare(b.name))
    case 'recent':
    default:
      return copy.sort((a, b) => (b.lastService || '').localeCompare(a.lastService || ''))
  }
}

// ─── CSV EXPORT ───────────────────────────────────────────────────────────────

function csvEscape(value: string | number): string {
  const s = String(value ?? '')
  // Quote if it contains comma, quote, or newline; double-up internal quotes
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`
  return s
}

/**
 * Build a CSV string from client records.
 * `marketingOnly` trims to the fields a marketing tool needs (name/email/phone).
 */
export function clientsToCSV(records: ClientRecord[], marketingOnly = false): string {
  if (marketingOnly) {
    const header = ['Name', 'Email', 'Phone']
    const rows = records.map((r) => [r.name, r.email, r.phone].map(csvEscape).join(','))
    return [header.join(','), ...rows].join('\n')
  }
  const header = [
    'Name', 'Email', 'Phone', 'Total Jobs', 'Completed Jobs',
    'Total Spend (KES)', 'Last Service', 'Vehicles', 'Top Services',
  ]
  const rows = records.map((r) => [
    r.name, r.email, r.phone, r.totalJobs, r.completedJobs,
    r.totalSpend, r.lastService || '',
    r.vehicles.join('; '), r.topServices.join('; '),
  ].map(csvEscape).join(','))
  return [header.join(','), ...rows].join('\n')
}

/**
 * Trigger a browser download of the CSV. Client-side only.
 */
export function downloadCSV(filename: string, csv: string): void {
  if (typeof window === 'undefined') return
  // Prepend BOM so Excel opens UTF-8 correctly
  const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

export function exportClients(
  records: ClientRecord[],
  garageName: string,
  marketingOnly = false
): void {
  const csv = clientsToCSV(records, marketingOnly)
  const date = new Date().toISOString().split('T')[0]
  const slug = garageName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
  const suffix = marketingOnly ? 'marketing' : 'full'
  downloadCSV(`${slug}-clients-${suffix}-${date}.csv`, csv)
}
