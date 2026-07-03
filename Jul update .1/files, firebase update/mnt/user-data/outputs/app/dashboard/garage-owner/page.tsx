import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { adminAuth, adminDb } from '@/lib/firebase/admin'
import { BayGrid, type Bay } from '@/components/bay-grid'
import { RevenueChart, type RevenuePoint } from '@/components/revenue-chart'

// NOTE: `bays` and monthly revenue aggregation aren't in the original
// schema (garages / profiles / bookings only) — placeholders below until
// those collections/views exist. `bookings` is real and used for the
// pending-bookings feed.

export default async function GarageOwnerDashboard() {
  const cookieStore = await cookies()
  const sessionCookie = cookieStore.get('session')?.value
  if (!sessionCookie) redirect('/login')

  const decoded = await adminAuth.verifySessionCookie(sessionCookie, true).catch(() => null)
  if (!decoded) redirect('/login')
  const uid = decoded.uid

  const garageSnap = await adminDb.collection('garages').where('ownerId', '==', uid).limit(1).get()
  const garageDoc = garageSnap.docs[0]
  const garage = garageDoc?.data() as { name: string } | undefined
  const garageId = garageDoc?.id

  const pendingSnap = garageId
    ? await adminDb
        .collection('bookings')
        .where('garageId', '==', garageId)
        .where('status', '==', 'pending')
        .orderBy('scheduledFor', 'asc')
        .limit(8)
        .get()
    : null

  const pendingBookings =
    pendingSnap?.docs.map((d) => ({ id: d.id, ...(d.data() as { scheduledFor: string }) })) ?? []

  // Placeholder data — replace once a `bays` collection exists
  const bays: Bay[] = [
    { id: '1', label: 'Bay 1', status: 'occupied', occupiedBy: 'KDA 123B' },
    { id: '2', label: 'Bay 2', status: 'free' },
    { id: '3', label: 'Bay 3', status: 'maintenance' },
    { id: '4', label: 'Bay 4', status: 'free' },
  ]

  // Placeholder data — replace with a real monthly aggregation
  const revenue: RevenuePoint[] = [
    { period: 'Jan', revenue: 42000 },
    { period: 'Feb', revenue: 51000 },
    { period: 'Mar', revenue: 47500 },
    { period: 'Apr', revenue: 62000 },
    { period: 'May', revenue: 58000 },
    { period: 'Jun', revenue: 71000 },
  ]

  return (
    <main className="mx-auto max-w-6xl px-6 py-10">
      <p className="text-xs font-semibold uppercase tracking-wide text-[#8A8F98]">Garage</p>
      <h1
        className="mt-1 text-3xl font-bold text-[#1A1A1A] dark:text-[#F2F0EA]"
        style={{ fontFamily: '"Oswald", ui-sans-serif, system-ui' }}
      >
        {garage?.name ?? 'Your garage'}
      </h1>

      <div className="mt-8 grid gap-6 lg:grid-cols-[2fr_1fr]">
        <div className="flex flex-col gap-6">
          <section>
            <h2 className="mb-3 text-sm font-semibold text-[#1A1A1A] dark:text-[#F2F0EA]">Bays</h2>
            <BayGrid bays={bays} />
          </section>

          <RevenueChart data={revenue} />
        </div>

        <section className="rounded-xl border border-black/10 bg-white p-4 dark:border-white/10 dark:bg-[#111318]">
          <h2 className="mb-3 text-sm font-semibold text-[#1A1A1A] dark:text-[#F2F0EA]">
            Pending bookings
          </h2>

          {pendingBookings.length === 0 ? (
            <p className="text-sm text-black/50 dark:text-white/50">Nothing pending. Nice.</p>
          ) : (
            <ul className="flex flex-col gap-3">
              {pendingBookings.map((b) => (
                <li
                  key={b.id}
                  className="flex items-center justify-between rounded-lg border border-black/5 px-3 py-2 text-sm dark:border-white/5"
                >
                  <span className="text-[#1A1A1A] dark:text-[#F2F0EA]">
                    {new Date(b.scheduledFor).toLocaleDateString()}
                  </span>
                  <span className="rounded-full bg-[#FFB020]/15 px-2 py-0.5 text-[10px] font-bold uppercase text-[#B87400] dark:text-[#FFB020]">
                    Pending
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </main>
  )
}
