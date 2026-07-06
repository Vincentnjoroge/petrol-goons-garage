# Map Build (Leaflet + OpenStreetMap) — Wiring & Tests

## Install (NOT the pasted list — cluster lib dropped, see review)
npm install leaflet react-leaflet @types/leaflet

## Files
- lib/geo.ts — haversine distance + rankGarages (history first → nearest → A–Z)
- app/components/GarageMapInner.tsx — leaflet map (client-only, brand pins)
- app/components/GarageMap.tsx — SSR-safe wrapper: search, service filter, Map/List toggle, history-ranked list, Book Now
- app/components/SetLocationButton.tsx — owner GPS capture → saves lat/lng on garage doc

## Why the pasted component was replaced
1. Read wrong fields (services/address/lat/lng/rating) → 0 pins with our schema
2. Top-level leaflet import crashes Next.js SSR → fixed with next/dynamic ssr:false
3. react-leaflet-markercluster: version-compat risk, unnecessary at our scale → cut
4. Blue/light styling + /book?garageId= param → rebranded, fixed to /book?garage=
5. No coordinate capture existed anywhere → SetLocationButton added

## Wire-up (3 spots)
1. BOOKING FLOW (app/book/page.tsx) — garage selection step:
   import GarageMap from '@/app/components/GarageMap'
   <GarageMap onSelect={(g) => setSelectedGarage(g)} />
   (omit onSelect to use default /book?garage={id} navigation)

2. SIGNUP (app/garage-signup/page.tsx) — success screen, after garage created:
   import SetLocationButton from '@/app/components/SetLocationButton'
   {createdGarageId && <SetLocationButton garageId={createdGarageId} />}

3. DASHBOARD BACKFILL (app/garage/page.tsx) — Settings tab, existing garages:
   <SetLocationButton garageId={garage.id!} hasLocation={!!(garage as any).lat} />

## Schema: adds optional lat/lng (number) to garages/{id}. No rules change —
## owner update path already permits it (status/ownerId still immutable).

## Test flow (localhost)
[ ] npm run dev with no SSR "window is not defined" error
[ ] Owner: dashboard Settings → Set location (allow GPS) → shows "✓ Location set"
[ ] /book garage step: map renders, your garage pin appears (yellow pin)
[ ] Pin popup → Book Now → /book?garage={id} preselected
[ ] List view: garage you've booked before shows "✓ Used before" at top
[ ] Deny GPS: list still works (no distance column, no crash)
[ ] Garage without location: appears in list with "no pin", absent from map
[ ] Search "Westlands" filters; service dropdown filters

## Commit
xcopy "%USERPROFILE%\Downloads\pg-map\pg-map\*" "C:\Users\san\Desktop\pg-live\" /E /Y
npm install leaflet react-leaflet @types/leaflet
git add -A && git commit -m "feat: Leaflet garage map, GPS location capture, history-ranked discovery" && git push origin master
