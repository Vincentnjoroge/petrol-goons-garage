# Week 1 — Security Foundation (RBAC + Multi-Tenant + Specialists)

Status target: **done before any real customer or payment data enters the system.**

## 1. Audit — what was wrong (and is now fixed)

| # | Severity | Issue (old rules) | Fix |
|---|----------|-------------------|-----|
| 1 | 🔴 Critical | `users` had `allow update: if request.auth != null` — any user could rewrite ANY user doc and self-assign `super_admin` / change `garageId` | role + garageId now immutable on self-update; escalation only via owner-claim, invite, or specialist path |
| 2 | 🔴 Critical | `staff` `allow create: if request.auth != null` | staff roster is owner-only; access via invites |
| 3 | 🟠 High | `garages` create had no `ownerId` check; owners could self-approve | create must set `ownerId == uid`, `status == 'pending'`; status change super-admin only |
| 4 | 🟠 High | No signup validation — could self-assign `garage_owner` | signup forced to `customer`, `garageId: null` |
| 5 | 🟡 Medium | `customers` / `activity` open creates | scoped to garage staff / own-record |

## 2. Account types & promotion paths (serverless RBAC)

No Admin SDK — rules are the only trust boundary, so every promotion is constrained:

**customer** (default at signup) — `garageId: null`.

**garage_owner** (bootstrap):
1. Create garage (`ownerId = uid`, `status = pending`).
2. `claimGarageOwnership()` promotes user doc. Rule verifies `garage.ownerId == uid`.
3. Super admin approves the garage.

**staff** (garage_manager / mechanic / reception) — invite-based:
1. Owner `createStaffInvite(garageId, email, role)`.
2. Invitee `acceptStaffInvite()`. Rule verifies invite exists for their email + matching role.

**independent_specialist** (NEW) — profile-gated:
1. `registerSpecialist()` creates `/specialists/{uid}` with `status: 'pending'`.
2. `becomeSpecialist()` flips user role. Rule requires the profile to exist; `garageId` stays null.
3. Super admin sets `status: 'approved'` → visible in `/specialists` discovery.
   Specialists **cannot self-approve** (status change is super-admin only).

## 3. Why specialists don't widen the attack surface
`independent_specialist` grants **no access to anyone else's data**. A specialist can
only read/write conversations they are a participant of — identical to a customer.
Discovery visibility is gated behind super-admin approval, so unapproved specialists
can chat (if someone has their link) but won't appear in the public list.

## 4. Files (this drop)
- `firestore.rules` — REPLACE root: hardened RBAC + specialists + top-level conversations.
- `storage.rules` — REPLACE root.
- `firestore.indexes.json` — REPLACE root (4 indexes).
- `lib/invites.ts`, `lib/chat.ts` (v2), `lib/specialists.ts` (new).
- `app/chat/*`, `app/specialists/page.tsx`, `app/components/MessageButton.tsx`.
- `lib/types.ts` — add `'independent_specialist'` (see TYPES_PATCH.md).

## 5. Deploy
```bash
firebase deploy --only firestore:rules,storage:rules,firestore:indexes
```

## 6. Test checklist (staging project)

**Privilege escalation — must all FAIL:**
- [ ] Self-set `users/{uid}.role = 'super_admin'` → denied.
- [ ] Self-set own `garageId` to another garage → denied.
- [ ] Write another user's doc → denied.
- [ ] Create `staff` doc in a garage you don't own → denied.
- [ ] Signup with `role: 'garage_owner'` → denied.
- [ ] Owner sets own garage `status: 'active'` → denied.
- [ ] Self-set `role: 'independent_specialist'` WITHOUT a `/specialists/{uid}` profile → denied.
- [ ] Specialist sets own profile `status: 'approved'` → denied.

**Legitimate flows — must all SUCCEED:**
- [ ] Signup → customer.
- [ ] Create garage → claim ownership → garage_owner.
- [ ] Owner invites staff → staff accepts → staff role.
- [ ] Register specialist profile → become specialist → super admin approves → appears in /specialists.
- [ ] Customer↔garage, customer↔specialist, garage↔specialist chats each work for their members only.

**Tenant / thread isolation — must FAIL:**
- [ ] Staff of Garage A read `garages/{B}/jobs` → denied.
- [ ] Non-member opens a conversation URL → denied (no composer).

## 7. Deferred (post-July)
- Migrate to **custom claims** (server-set role/garageId in the auth token) once the
  Admin SDK exists — removes per-request `get()` lookups, fully tamper-proof.
- Specialist consult **payments** via M-Pesa (ties into the Week 2–3 Daraja work).

## 8. Next in Week 1
Daraja (M-Pesa) **sandbox** setup: env credentials, server-side STK Push route, and the
public callback endpoint skeleton. Sandbox only — no real money yet.
