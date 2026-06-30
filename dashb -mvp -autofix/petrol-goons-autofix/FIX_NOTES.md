# Garage Signup Fix — 3 Bugs, 3 Files

## What was broken and why

### Bug 1 — Submission always fails with "Something went wrong"
File: lib/garages.ts

createGarage() wrote the staff subcollection BEFORE updating the user's role.
Firestore rules check isGarageOwner(garageId) when writing staff — at that
moment the user is still 'customer', so the rule rejects it. The whole
function throws, returns { success: false }, and the page shows the error.

The garage document IS created (step 1 succeeds before the crash). That is
why the admin sees the submission. But the owner's user doc never gets updated
(role stays 'customer', garageId stays null), so the owner can't access /garage.

Fixed order:
  1. addDoc(garages)         — create garage (status: 'active', auto-approved)
  2. updateDoc(users/{uid})  — set role:'garage_owner' + garageId  ← moved up
  3. addDoc(staff)           — isGarageOwner() now passes ✓

### Bug 2 — Success screen says "our team will review you" (wrong)
File: app/garage-signup/page.tsx

The old success page told owners to wait for manual review and linked to
/book (demo) instead of /garage (their dashboard). Replaced with:
  - "Your garage is live!" with confetti
  - Shareable booking link + copy button
  - "Go to Garage Dashboard →" button
  - Real error messages instead of generic "Something went wrong"

### Bug 3 — Admin approve doesn't give owner dashboard access
File: app/admin/page.tsx

handleGarageStatus() only updated garage.status. It never touched
users/{ownerId}. So even after manual admin approval, the owner's user doc
still had role:'customer' and no garageId — they couldn't log into /garage.

Fixed: approval now also:
  - Sets users/{ownerId}.role = 'garage_owner'
  - Sets users/{ownerId}.garageId = garage.id
  - Sets garage.status = 'active' (not just 'approved') so dashboard check passes
  This also retroactively heals any orphaned accounts from before the fix.

## Deploy (Windows CMD)
cd C:\Users\san\Desktop\pg-live
xcopy "%USERPROFILE%\Downloads\petrol-goons-autofix\petrol-goons-autofix\*" "." /E /Y
git add -A
git status
git commit -m "fix: garage signup permission error + auto-approve + admin heals user doc"
git push origin master

## UPDATE — Service catalog auto-seed (added)

createGarage() now seeds garages/{id}/services from the services chosen at
signup (STEP 4), so the owner's catalog is never empty on day one. Prices
default to 0 ("On inspection") for the owner to set in Settings → Service Catalog.

The seed is wrapped in its own try/catch — if a service write fails, the
garage is still created successfully (non-fatal). Owner can add services
manually in the dashboard.

No extra import needed (inlined to avoid a circular dependency with lib/services.ts).
