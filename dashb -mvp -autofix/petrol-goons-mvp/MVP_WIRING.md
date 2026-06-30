# MVP Build — Client Export + Search + Service Catalog

Three genuinely-missing pieces from the technical analysis (the rest was
already done on `master`). All build on existing schema — no rules changes
needed (services/customers rules already deployed).

## Files
- lib/clients.ts            — client records, search, sort, CSV export
- lib/services.ts           — service catalog CRUD
- app/garage/ClientsPanel.tsx   — drop-in Customers-tab panel (search + export)
- app/garage/ServicesPanel.tsx  — drop-in Settings-tab panel (catalog mgmt)

## Wiring into app/garage/page.tsx

### 1. Imports (top of file, with the other imports)
```tsx
import ClientsPanel from './ClientsPanel'
import ServicesPanel from './ServicesPanel'
```

### 2. Customers tab — replace the existing customers block
Find:  `{tab === 'customers' && (`
Replace the whole block's inner content with:
```tsx
{tab === 'customers' && (
  <ClientsPanel
    customers={customers}
    jobs={jobs}
    garageName={garage.name}
    canExport={isOwner}
  />
)}
```

### 3. Settings tab — add the catalog (owner only)
Inside `{tab === 'settings' && ( ... )}`, after the Staff card, add:
```tsx
{isOwner && garage.id && <ServicesPanel garageId={garage.id} />}
```

## What this delivers (MVP success criteria)
- ✅ Garage owner can add clients to a SEARCHABLE database  (search by name/phone/email/plate)
- ✅ Client data can be EXPORTED for marketing  (Marketing CSV = name/email/phone for Mailchimp/Resend; Full CSV = everything)
- ✅ Service catalog management  (custom services + pricing, replaces hardcoded list)

## Notes
- Export respects the current filter — owners can export a segment (e.g. search
  "Toyota" then export just those clients).
- CSV includes a UTF-8 BOM so Excel opens Kenyan names/characters correctly.
- ServicesPanel is gated to owners via `isOwner` (canConfigureServices).
- Optional next step: call seedServicesFromList(garageId, servicesOffered) once
  in createGarage() so new garages start with their signup services pre-loaded.

## Commit
```
cd C:\Users\san\Desktop\pg-live
xcopy "%USERPROFILE%\Downloads\petrol-goons-mvp\petrol-goons-mvp\*" "." /E /Y
git add -A
git commit -m "feat: client search + marketing CSV export + service catalog management"
git push origin master
```
