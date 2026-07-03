import { createClient } from '@/lib/supabase/server'
import { BayGrid, type Bay } from '@/components/bay-grid'
import { RevenueChart, type RevenuePoint } from '@/components/revenue-chart'

// NOTE: `bays` and monthly revenue aggregation aren't in the original schema
// (garages / profiles / bookings only). This queries `bookings` for the
// notification feed, which does exist, and falls back to placeholder data
// for bays/revenue until those tables/views are added — swap in real queries
// once you have them.

export default async function GarageOwnerDashboard() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  const { data: garage } = await supabase
    .from('garages')
    .select('id, name')
    .eq('owner_id', user?.id)
    .single()

  const { data: pendingBookings } = await supabase
    .from('bookings')
    .select('id, scheduled_for, status, car_owner_id')
    .eq('garage_id', garage?.id)
    .eq('status', 'pending')
    .order('scheduled_for', { ascending: true })
    .limit(8)

  // Placeholder data — replace once a `bays` table exists
  const bays: Bay[] = [
    { id: '1', label: 'Bay 1', status: 'occupied', occupiedBy: 'KDA 123B' },
    { id: '2', label: 'Bay 2', status: 'free' },
    { id: '3', label: 'Bay 3', status: 'maintenance' },
    { id: '4', label: 'Bay 4', status: 'free' },
  ]

  // Placeholder data — replace with a real monthly aggregation query/view
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
            <h2 className="mb-3 text-sm font-semibold text-[#1A1A1A] dark:text-[#F2F0EA]">
              Bays
            </h2>
            <BayGrid bays={bays} />
          </section>

          <RevenueChart data={revenue} />
        </div>

        {/* Notification feed */}
        <section className="rounded-xl border border-black/10 bg-white p-4 dark:border-white/10 dark:bg-[#111318]">
          <h2 className="mb-3 text-sm font-semibold text-[#1A1A1A] dark:text-[#F2F0EA]">
            Pending bookings
          </h2>

          {!pendingBookings || pendingBookings.length === 0 ? (
            <p className="text-sm text-black/50 dark:text-white/50">Nothing pending. Nice.</p>
          ) : (
            <ul className="flex flex-col gap-3">
              {pendingBookings.map((b) => (
                <li
                  key={b.id}
                  className="flex items-center justify-between rounded-lg border border-black/5 px-3 py-2 text-sm dark:border-white/5"
                >
                  <span className="text-[#1A1A1A] dark:text-[#F2F0EA]">
                    {new Date(b.scheduled_for).toLocaleDateString()}
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
