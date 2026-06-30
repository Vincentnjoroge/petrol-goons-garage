# Garage Owner Dashboard — Build Notes

## What changed vs the old app/garage/page.tsx

| Old | New |
|-----|-----|
| One-time fetch, manual refresh | **Firestore onSnapshot** — real-time updates |
| 800-line monolithic component | Modular: StatCard, JobCard, GettingStarted, BottomNav |
| 6000ms timeout redirect (brittle) | Clean onAuthStateChanged with error states |
| No loading skeletons | Skeleton component, progressive load |
| Desktop-first (max-w-6xl) | Mobile-first (max-w-[430px]) |
| Jobs tab buried behind nav | **New bookings shown immediately on Overview** |
| No getting started flow | GettingStarted checklist for new garages |
| No live indicator | Animated "LIVE" badge in header |
| All actions deep in tabs | One-tap status advance on every job card |
| Inline admin badge checks | Proper canUpdate/canManage/isOwner from roles lib |

## Tab structure

- **Overview** — new bookings (pulsing badge), today's schedule, recent activity
- **Jobs** — full filterable job list (active / today / done / all) + search
- **Customers** — customer list with visit history
- **Analytics** — completion rate, top services, reviews with reply
- **Settings** — garage info, staff list, booking link, sign out

## Real-time implementation

Jobs and activity use `onSnapshot` subscriptions. Staff/customers/reviews
use one-time `getDoc`/`getDocs` since they change infrequently.

Subscriptions are stored in a `useRef` array and cleaned up on unmount or
when `garageId`/`role` changes (e.g. staff becoming owner).

## Commit
```
cd C:\Users\san\Desktop\pg-live
xcopy "%USERPROFILE%\Downloads\garage-dashboard\garage-dashboard\*" "." /E /Y
git add -A
git commit -m "feat: Rebuild garage owner dashboard (real-time, mobile-first)"
git push origin master
```
