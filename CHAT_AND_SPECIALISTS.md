# Chat & Specialists — Integration Guide (v2)

Three-sided messaging for Petrol Goons: **customers, garages, and independent
specialist mechanics** can all chat. Real-time via Firestore, no backend.

## What changed from v1
- Conversations moved from `garages/{id}/conversations` (2-party only) to a
  **top-level `/conversations`** collection using a **participant model** so any
  two parties can chat: customer↔garage, customer↔specialist, garage↔specialist.
- Added **independent specialist mechanics** as a new account type.
- Chat route simplified to `/chat/{conversationId}` (no garage prefix).

## Account types
| Role | garageId | Can chat with | Discovery |
|------|----------|---------------|-----------|
| `customer` | null | garages, specialists | — |
| `garage_owner` / `garage_manager` / `mechanic` / `reception` | set | customers, specialists | garage listing |
| `independent_specialist` | null | customers, garages | `/specialists` (after approval) |
| `super_admin` | — | (oversight) | — |

## Files

**New / updated:**
- `lib/chat.ts` — top-level conversations, participant model, 3 pairings
- `lib/specialists.ts` — specialist registration, discovery, role upgrade
- `app/chat/page.tsx` — inbox (customer / specialist / garage views)
- `app/chat/[conversationId]/page.tsx` — real-time thread
- `app/components/MessageButton.tsx` — drop-in, supports all pairings
- `app/specialists/page.tsx` — specialist discovery + "Start Consultation"
- `app/specialists/onboard/page.tsx` — specialist onboarding wizard (register + upgrade)
- `firestore.rules` — top-level conversation rules + `specialists` collection + specialist role path
- `firestore.indexes.json` — required composite indexes
- `lib/types.ts` — add `'independent_specialist'` to `UserRole` (see TYPES_PATCH.md)

## Data model
```
/conversations/{conversationId}
  type: 'customer_garage' | 'customer_specialist' | 'garage_specialist'
  participants: string[]        // individual UIDs (customer and/or specialist)
  garageId: string | null       // set when a garage is one side (shared by staff)
  sideKeys: [k1, k2]            // a key is a UID or the literal 'garage'
  sideNames: { [k]: name }
  unread: { [k]: number }
  lastMessage, lastMessageAt, lastSenderKey
/conversations/{conversationId}/messages/{messageId}

/specialists/{uid}
  name, headline, bio, specialties[], yearsExperience, location,
  consultRate, status: 'pending'|'approved'|'suspended', rating, consultCount
```

**Deterministic conversation ids** (no duplicate threads):
- `cg__{customerId}__{garageId}` (+`__{jobId}` if booking-linked)
- `cs__{customerId}__{specialistId}`
- `gs__{garageId}__{specialistId}`

## Access model (enforced in rules)
A user may read/write a conversation if they are a **participant UID** OR they are
**staff of the conversation's `garageId`**. Messages inherit this and are
create-only with a non-spoofable `senderId`.

## Specialist onboarding (serverless, rule-enforced)
1. `registerSpecialist()` → creates `/specialists/{uid}` with `status: 'pending'`.
2. `becomeSpecialist()` → flips user role to `independent_specialist`
   (rules require the profile to exist; `garageId` stays null).
3. Super admin sets `status: 'approved'` → specialist appears in `/specialists`.
   (Owners/specialists can never self-approve.)

## Required Firestore indexes
Already in `firestore.indexes.json`:
- `conversations`: `participants` (array-contains) + `lastMessageAt` desc
- `conversations`: `garageId` asc + `lastMessageAt` desc
- `specialists`: `status` asc + `specialties` array-contains
- `invites`: `email` (collection-group)

Deploy:
```bash
firebase deploy --only firestore:rules,storage:rules,firestore:indexes
```

## Wiring entry points

**Customer → Garage** (in /my-bookings):
```tsx
<MessageButton type="customer_garage"
  customerId={user.uid} customerName={user.displayName ?? 'Customer'}
  garageId={booking.garageId} garageName={booking.garageName}
  jobId={booking.id} bookingTag={booking.bookingTag}
  label="Message Garage" variant="solid" />
```

**Customer → Specialist** (handled by /specialists page "Start Consultation").

**Become a specialist:** users tap the CTA on `/specialists` → `/specialists/onboard`
(3-step wizard) which calls `registerSpecialist()` then `becomeSpecialist()`.

**Garage → Specialist** (in dashboard, when viewing a specialist):
```tsx
<MessageButton type="garage_specialist"
  garageId={profile.garageId} garageName={garage.name}
  specialistId={specialist.uid} specialistName={specialist.name}
  label="Consult Specialist" />
```

**Links:** inbox at `/chat`, specialist discovery at `/specialists`.

## Test checklist (staging)
- [ ] Customer messages a garage → both sides see the thread; another garage cannot.
- [ ] Customer starts a specialist consult → only those two see it.
- [ ] Garage consults a specialist → garage staff + that specialist see it; customers don't.
- [ ] A non-member opening a conversation URL is denied (no input box shown).
- [ ] `senderId` spoofing is rejected by rules.
- [ ] A user cannot self-set `role: 'independent_specialist'` without a `/specialists/{uid}` profile.
- [ ] A specialist cannot self-approve (`status` change denied).
