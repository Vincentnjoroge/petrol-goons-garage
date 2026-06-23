# Required edit to lib/types.ts

Add the specialist role to the `UserRole` union:

```ts
export type UserRole =
  | 'super_admin'
  | 'garage_owner'
  | 'garage_manager'
  | 'mechanic'
  | 'reception'
  | 'independent_specialist'   // ← ADD THIS
  | 'customer'
```

No other types.ts changes are required — Conversation, ChatMessage,
SpecialistProfile, and SpecialtyArea live in `lib/chat.ts` and `lib/specialists.ts`.
