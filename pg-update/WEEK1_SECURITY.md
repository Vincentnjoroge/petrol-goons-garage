# Week 1 — Security Foundation (Firestore RBAC + Multi-Tenant Lockdown)

Status target: **done before any real customer or payment data enters the system.**

## 1. Audit — what was wrong (and is now fixed)

| # | Severity | Issue (old rules) | Fix |
|---|----------|-------------------|-----|
| 1 | 🔴 Critical | `users` had `allow update: if request.auth != null` — any user could rewrite ANY user doc and self-assign `super_admin` / change `garageId` | role + garageId now immutable on self-update; escalation only via owner-claim or invite |
| 2 | 🔴 Critical | `staff` `allow create: if request.auth != null` — anyone could add themselves as staff anywhere | staff roster is owner-only; access granted only through invites |
| 3 | 🟠 High | `garages` create had no `ownerId` check; owners could self-approve `status` | create must set `ownerId == uid` and `status == 'pending'`; status change is super-admin only |
| 4 | 🟠 High | No validation on signup — could self-assign `garage_owner` at create | signup forced to `role: 'customer'`, `garageId: null` |
| 5 | 🟡 Medium | `customers` / `activity` open creates | scoped to garage staff or own-record |

## 2. How roles work now (serverless RBAC)

There is **no Admin SDK** — rules are the only trust boundary, so promotion paths are constrained:

**Becoming a garage owner (bootstrap):**
1. User signs up → user doc is `role: customer`, `garageId: null`.
2. User creates a garage → `ownerId = their uid`, `status = pending`.
3. `claimGarageOwnership()` promotes their user doc to `garage_owner`.
   Rules verify `garage.ownerId == uid` — you can't claim a garage you didn't create.
4. Super admin approves the garage (`status: approved/active`). Owners can't self-approve.

**Becoming staff (invite-based):**
1. Owner calls `createStaffInvite(garageId, email, role)` → `garages/{id}/invites/{email}`.
2. Invitee signs in, `findMyInvites(email)` shows pending invites.
3. `acceptStaffInvite()` promotes their user doc to the invited role.
   Rules verify the invite doc exists AND its role matches — no self-promotion.

## 3. Files in this drop

- `firestore.rules` — REPLACE the repo root file.
- `storage.rules` — REPLACE the repo root file.
- `lib/invites.ts` — NEW: invite + owner-bootstrap helpers.
- (Chat from prior drop: `lib/chat.ts`, `app/chat/*`, `MessageButton.tsx`.)

## 4. Required Firestore indexes

Add to `firestore.indexes.json` (or follow the console link on first query):

```json
{
  "indexes": [
    {
      "collectionGroup": "conversations",
      "queryScope": "COLLECTION_GROUP",
      "fields": [
        { "fieldPath": "customerId", "order": "ASCENDING" },
        { "fieldPath": "lastMessageAt", "order": "DESCENDING" }
      ]
    },
    {
      "collectionGroup": "invites",
      "queryScope": "COLLECTION_GROUP",
      "fields": [
        { "fieldPath": "email", "order": "ASCENDING" }
      ]
    }
  ]
}
```

## 5. Deploy

```bash
firebase deploy --only firestore:rules,storage:rules,firestore:indexes
```

## 6. Test checklist (do this in a staging project, not prod)

Use two accounts: a "customer" and an "attacker". Verify each line FAILS where it should.

**Privilege escalation (must all FAIL):**
- [ ] Attacker tries to set their own `users/{uid}.role = 'super_admin'` → denied.
- [ ] Attacker tries to set their own `garageId` to another garage → denied.
- [ ] Attacker writes to another user's `users/{otherUid}` doc → denied.
- [ ] Attacker creates a `staff` doc in a garage they don't own → denied.
- [ ] New signup tries to create user doc with `role: 'garage_owner'` → denied.
- [ ] Owner tries to set their garage `status: 'active'` themselves → denied.

**Legitimate flows (must all SUCCEED):**
- [ ] Sign up → user doc created as customer.
- [ ] Create garage (ownerId=self, status=pending) → ok.
- [ ] `claimGarageOwnership()` → user becomes garage_owner.
- [ ] Owner creates an invite → ok; invitee accepts → becomes staff.
- [ ] Customer books a job; reads only their own jobs.
- [ ] Garage staff read all jobs for their garage, none from other garages.
- [ ] Customer messages garage; garage replies; neither can read another garage's threads.

**Tenant isolation (must FAIL):**
- [ ] Staff of Garage A reads `garages/{B}/jobs` → denied.
- [ ] Staff of Garage A reads `garages/{B}/conversations` → denied.

## 7. What's intentionally deferred

- Migrating to **custom claims** (server-set `role`/`garageId` in the auth token) is the
  long-term hardening — it removes the per-request `get()` lookups and is tamper-proof.
  It needs the Admin SDK + an API route. Recommended for August, not blocking July pilot.
- Until then, the `get(users/{uid})` lookups in rules add read cost per request but are correct.

## 8. Next in Week 1

With the trust boundary locked, the rest of Week 1 is Daraja (M-Pesa) **sandbox** setup:
credentials in env, a server API route for STK Push (server-side only), and the public
callback endpoint skeleton. No real money — sandbox only. That's the next build step.
