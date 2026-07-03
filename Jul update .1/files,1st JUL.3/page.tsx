import { createClient } from '@/lib/supabase/server'
import { ServiceGauge } from '@/components/service-gauge'
import Link from 'next/link'

// NOTE: assumes a `cars` table (owner_id, make, model, plate, last_service_date, ...)
// and a `bookings` table for upcoming service. Adjust the queries below to your
// actual schema — this page renders correctly with placeholder data either way.

export default async function CarOwnerDashboard() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  const { data: cars } = await supabase
    .from('cars')
    .select('id, make, model, plate, last_service_date')
    .eq('owner_id', user?.id)
    .limit(1)

  const car = cars?.[0]

  // Rough "health" estimate from last service date — swap for real business logic.
  const daysSinceService = car?.last_service_date
    ? Math.floor((Date.now() - new Date(car.last_service_date).getTime()) / 86_400_000)
    : null
  const percentRemaining = daysSinceService === null ? 100 : Math.max(0, 100 - Math.round((daysSinceService / 180) * 100))
  const status = percentRemaining > 50 ? 'good' : percentRemaining > 15 ? 'due-soon' : 'overdue'

  const { data: upcoming } = await supabase
    .from('bookings')
    .select('id, scheduled_for, status, garages(name)')
    .eq('car_owner_id', user?.id)
    .order('scheduled_for', { ascending: true })
    .limit(1)

  return (
    <main className="mx-auto max-w-5xl px-6 py-10">
      {/* Hero */}
      <section className="mb-8 grid gap-6 rounded-2xl border border-black/10 bg-white p-8 dark:border-white/10 dark:bg-[#111318] md:grid-cols-[1fr_auto]">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-[#8A8F98]">
            Your vehicle
          </p>
          <h1
            className="mt-1 text-3xl font-bold text-[#1A1A1A] dark:text-[#F2F0EA]"
            style={{ fontFamily: '"Oswald", ui-sans-serif, system-ui' }}
          >
            {car ? `${car.make} ${car.model}` : 'No car on file yet'}
          </h1>
          <p className="mt-1 text-sm text-black/50 dark:text-white/50">
            {car ? car.plate : 'Add your vehicle details to unlock service tracking.'}
          </p>

          {upcoming?.[0] && (
            <p className="mt-4 inline-block rounded-md bg-[#FFB020]/15 px-3 py-1.5 text-xs font-medium text-[#B87400] dark:text-[#FFB020]">
              Next booking: {new Date(upcoming[0].scheduled_for).toLocaleDateString()} —{' '}
              {(upcoming[0] as any).garages?.name ?? 'Garage'}
            </p>
          )}

          <div className="mt-6">
            <Link
              href="/garages"
              className="inline-block rounded-md bg-[#FFB020] px-5 py-2.5 text-sm font-semibold text-[#0A0B0D] transition hover:bg-[#FFC24D]"
            >
              Book service
            </Link>
          </div>
        </div>

        <ServiceGauge percentRemaining={percentRemaining} status={status} />
      </section>

      {/* Placeholder for booking history / additional widgets */}
      <section className="rounded-2xl border border-dashed border-black/15 p-8 text-center text-sm text-black/50 dark:border-white/15 dark:text-white/50">
        Booking history and reminders go here.
      </section>
    </main>
  )
}
