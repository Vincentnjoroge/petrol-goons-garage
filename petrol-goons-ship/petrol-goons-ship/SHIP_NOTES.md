# Garage Signup Fix — Ship Notes

## Root causes of the createGarageProfile failure (now fixed)

### 1. Duplicate `UserRole` type (TypeScript compilation error)
`lib/types.ts` had the type declared twice — the original single-line union,
then a second `export type UserRole = ...` block added as the TYPES_PATCH.
TypeScript throws "Duplicate identifier 'UserRole'" and the whole app fails to
compile. Fixed: single clean declaration including `independent_specialist`.

### 2. Staff write fails because user role hasn't been promoted yet
`createGarage()` wrote the staff subcollection BEFORE updating the user doc.
Firestore rules for `garages/{id}/staff` check `isGarageOwner(garageId)`, which
reads the user's current `role` and `garageId` from Firestore. Since the user
is still `customer` at the point of the staff write, the rule rejects it.

Fixed: the operation order is now:
  1. Create garage doc  (status: 'active' — auto-approved)
  2. Update user doc    → role: 'garage_owner', garageId set
  3. Write staff doc    → isGarageOwner() now returns true ✓

### 3. Garage status was 'pending' — owners couldn't use the dashboard
Set to 'active' immediately on creation so owners land in a working dashboard.

## New 3-step wizard (app/garage-signup/page.tsx)

Steps: auth → basics → about → confirm → success

Step 1 — Garage Basics:
  - Garage Name
  - County / Town (Kenya counties dropdown)
  - Area / Landmark
  - Primary Phone (pre-filled from auth)
  - Services (multi-select chips)

Step 2 — About Your Garage:
  - Short description (200 chars)
  - Photo upload (3–5, optional)
  - Operating hours (Weekdays / Saturday / Sunday toggle + times)

Step 3 — Confirm & Go Live:
  - Summary card (name, location, services, hours, photos)
  - Ownership confirmation checkbox
  - "🚀 Publish My Garage" button

Success:
  - Confetti animation
  - "Your garage is now live on Petrol Goons!"
  - Shareable booking link + copy button
  - "Go to Garage Dashboard →" → /garage

## Files changed
- lib/types.ts       FIX duplicate UserRole
- lib/garages.ts     FIX operation order + auto-approve + KENYA_COUNTIES export
- app/garage-signup/page.tsx  NEW 3-step wizard

## To deploy
```
git add -A
git commit -m "fix: createGarageProfile failure + new 3-step garage signup wizard

- lib/types.ts: remove duplicate UserRole (TS compilation fix)
- lib/garages.ts: fix createGarage operation order (user role before staff write)
                  auto-approve garages to status 'active'
- app/garage-signup: new 3-step wizard (basics → about → confirm → success)
                     confetti success + shareable link + redirect to dashboard"
git push origin master
```
