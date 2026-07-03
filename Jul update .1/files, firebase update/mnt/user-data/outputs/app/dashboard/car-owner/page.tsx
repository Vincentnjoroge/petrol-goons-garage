import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { adminAuth, adminDb } from '@/lib/firebase/admin'
import { ServiceGauge } from '@/components/service-gauge'
import Link from 'next/link'

// NOTE: assumes a `cars` collection (ownerId, make, model, plate,
// lastServiceDate) and `bookings` with carOwnerId/garageId/scheduledFor.
// Adjust field names to your actual Firestore schema.

export default async function CarOwnerDashboard() {
  const cookieStore = await cookies()
  const sessionCookie = cookieStore.get('session')?.value
  if (!sessionCookie) redirect('/login')

  const decoded = await adminAuth.verifySessionCookie(sessionCookie, true).catch(() => null)
  if (!decoded) redirect('/login')
  const uid = decoded.uid

  const carsSnap = await adminDb.collection('cars').where('ownerId', '==', uid).limit(1).get()
  const car = carsSnap.docs[0]?.data() as
    | { make: string; model: string; plate: string; lastServiceDate?: string }
    | undefined

  const daysSinceService = car?.lastServiceDate
    ? Math.floor((Date.now() - new Date(car.lastServiceDate).getTime()) / 86_400_000)
    : null
  const percentRemaining =
    daysSinceService === null ? 100 : Math.max(0, 100 - Math.round((daysSinceService / 180) * 100))
  const status = percentRemaining > 50 ? 'good' : percentRemaining > 15 ? 'due-soon' : 'overdue'

  const upcomingSnap = await adminDb
    .collection('bookings')
    .where('carOwnerId', '==', uid)
    .orderBy('scheduledFor', 'asc')
    .limit(1)
    .get()

  let upcoming: { scheduledFor: string; garageId: string; garageName?: string } | undefined =
    upcomingSnap.docs[0]?.data() as any

  if (upcoming?.garageId) {
    const garageSnap = await adminDb.collection('garages').doc(upcoming.garageId).get()
    upcoming.garageName = garageSnap.data()?.name
  }

  return (
    <main className="mx-auto max-w-5xl px-6 py-10">
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

          {upcoming && (
            <p className="mt-4 inline-block rounded-md bg-[#FFB020]/15 px-3 py-1.5 text-xs font-medium text-[#B87400] dark:text-[#FFB020]">
              Next booking: {new Date(upcoming.scheduledFor).toLocaleDateString()} —{' '}
              {upcoming.garageName ?? 'Garage'}
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

      <section className="rounded-2xl border border-dashed border-black/15 p-8 text-center text-sm text-black/50 dark:border-white/15 dark:text-white/50">
        Booking history and reminders go here.
      </section>
    </main>
  )
}
