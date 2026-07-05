# Nav + Profiles Build — Wiring & Test Flows
Priority order delivered: 1 nav/redirects · 2 navbar swap · 3 theme concealment · 4 profiles.
Maps deferred (needs Google Maps API key + billing). Hook point noted below.

## NEW FILES (drop in as-is)
- hooks/useAuthRole.ts            — role/garageId hook + homeRouteFor()
- app/components/AuthRedirect.tsx — landing-page redirector
- app/components/RouteGuard.tsx   — role-gate any page
- app/profile/page.tsx            — customer profile (IG-style, cars, history, settings+theme)
- app/garage/[garageId]/page.tsx  — public garage profile (services/offers/reviews, Book CTA)

## PRIORITY 1 — Role-based homepage (edit app/page.tsx)
1. Import at top:  import AuthRedirect from './components/AuthRedirect'
2. First line inside the returned JSX:  <AuthRedirect />
Result: guests see landing; logged-in users go to
customer→/my-bookings · garage staff→/garage · specialist→/chat · super_admin→/admin.
Signup page never flashes (overlay covers while deciding).

## PRIORITY 2 — Navbar label swap (edit app/page.tsx)
The landing page holds the customer/garage toggle in state (the fuel-pump toggle).
Find the nav button labelled "My Bookings" and make label+href conditional on that
state variable (rendered where isGarageView is your toggle boolean):
  <a href={isGarageView ? '/garage' : '/my-bookings'} ...>
    {isGarageView ? 'My Garage' : 'My Bookings'}
  </a>

## PRIORITY 3 — Theme toggle concealment
1. In app/page.tsx (and any other page header rendering <ThemeToggle />): REMOVE it.
2. It now lives in: /profile Settings section (already wired in the new page), and
   add one line in app/garage/page.tsx Settings tab card:
     import ThemeToggle from '../components/ThemeToggle'
     ...inside the Account card:  <div className="flex items-center justify-between mb-3"><span className="text-white text-sm">Appearance</span><ThemeToggle /></div>
NOTE (honest scope): pages are hardcoded dark (bg-petrol-black etc). The toggle now
persists + swaps the class, but a real LIGHT theme still requires adding light
variants across pages — deferred by agreement. Toggle relocation done.

## PRIORITY 4 — Profiles
- /profile stores bio + cars[] on the EXISTING users/{uid} doc (allowed by rules;
  role/garageId untouched). History uses getCustomerJobsAllGarages().
- /garage/[garageId] reads EXISTING garage doc + services + public reviews.
  Offers stored as currentOffers[] on the garage doc (owner-editable by rules).
  Owner sees +Add Offer inline; customers see sticky "Book at {name} →".
- NO new collections, NO rules changes, NO schema fork (rejects the pasted
  prompt's /garageProfiles + /reviews duplication).

## NAV ENTRY POINTS to add where convenient
- my-bookings header → link "Profile" → /profile
- garage dashboard Settings → "View Public Profile" → /garage/{garage.id}
- Booking-link share now best points at /garage/{id} (profile → book).

## MAPS HOOK POINT (deferred)
When API key ready: in /book garage selection, preferredGarages ranking can come
from profile cars/jobs history: rank garages by count of user's past jobs. The
data already exists via getCustomerJobsAllGarages() — no schema change needed.

## TEST FLOW CHECKLIST (run on http://172.25.224.1:3000)
Guest:
[ ] / shows landing, no redirect flash
[ ] Toggle "I run a garage" → nav shows "My Garage" (was "My Bookings")
[ ] /garage/{realGarageId} loads services/offers/reviews; Book CTA → /book?garage=…
Customer login:
[ ] visiting / auto-redirects to /my-bookings
[ ] /profile: edit bio+phone persists after refresh
[ ] Add car → appears; filter history by plate works
[ ] Theme toggle in /profile persists after refresh; no toggle in main nav
[ ] /garage (dashboard) bounces customer back to /my-bookings (if wrapped in RouteGuard)
Garage owner login:
[ ] visiting / auto-redirects to /garage
[ ] Own public profile /garage/{myId}: +Add Offer publishes; ✕ removes; no Book CTA shown
Specialist login:
[ ] visiting / redirects to /chat

## COMMIT
cd C:\Users\san\Desktop\pg-live
xcopy "%USERPROFILE%\Downloads\pg-nav-profiles\pg-nav-profiles\*" "." /E /Y
(then make the 3 small app/page.tsx edits + dashboard ThemeToggle line above)
git add -A && git commit -m "feat: role-based nav, profile pages, public garage profile, theme toggle to settings" && git push origin master
