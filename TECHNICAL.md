# TECHNICAL.md - Petrol Goons Garage

> Last updated: March 2026 — V2

## Technology Stack

### Frontend
- **Framework**: Next.js 15.5 (React 18)
- **Language**: TypeScript 5.3
- **Styling**: Tailwind CSS 3.4
- **Deployment**: Vercel (free tier)

### Backend
- **Authentication**: Firebase Auth (Google, Facebook, Apple, Phone/OTP)
- **Database**: Firebase Firestore (NoSQL)
- **Storage**: Firebase Storage (car photos, up to 5 per booking, max 5MB each)
- **Email**: Resend (free tier - 100 emails/day, 7 branded HTML templates)
- **Cron Jobs**: Vercel Cron (weekly service reminders)

### Why These Choices?

**Next.js 15**:
- Server-side rendering for fast mobile performance
- Built-in API routes (used for email sending and cron endpoints)
- Free hosting on Vercel with automatic SSL and CDN
- Great for SEO (important for eventual marketplace)

**Firebase**:
- Zero cost on Spark plan for low traffic
- Built-in authentication with all 4 required providers (Google, Facebook, Apple, Phone)
- Real-time database ideal for booking status updates
- Cloud Storage for photo uploads
- Scales automatically when needed

**Tailwind CSS**:
- Mobile-first utility classes
- Small production bundle (unused styles purged)
- Custom theme with Petrol Goons brand colors

**Resend**:
- Free tier (100 emails/day) sufficient for early stage
- Simple REST API
- HTML template support for branded emails

## Project Structure

```
petrol-goons-garage/
├── app/
│   ├── page.tsx                    # Landing / login page (4 auth methods)
│   ├── layout.tsx                  # Root layout with PWA manifest + metadata
│   ├── globals.css                 # Tailwind base + custom animations
│   ├── book/
│   │   └── page.tsx               # Booking form (services, VIN, photos, date/time)
│   ├── dashboard/
│   │   └── page.tsx               # Admin dashboard (approve, reject, assign, complete)
│   ├── my-bookings/
│   │   └── page.tsx               # Customer booking history + cancellation
│   └── api/
│       ├── send-email/
│       │   └── route.ts           # POST - send transactional emails via Resend
│       └── send-reminders/
│           └── route.ts           # POST - cron job: 90-day service reminders
├── lib/
│   ├── firebase.ts                # Firebase app init + auth + Firestore + Storage
│   ├── auth.ts                    # Auth helper functions
│   ├── bookings.ts                # Booking CRUD, slot availability, tags, mechanics
│   ├── email.ts                   # 7 HTML email templates (branded)
│   └── admin.ts                   # Admin email whitelist (4 team members)
├── public/
│   ├── icon-192.png               # PWA icon
│   └── manifest.json              # PWA manifest for "Add to Home Screen"
├── .gitattributes                 # Line-ending normalization
├── .gitignore                     # Excludes node_modules, .env files, build artifacts
├── eslint.config.mjs              # ESLint flat config for Next.js 15
├── next.config.js                 # Next.js config (image domains, output tracing)
├── tailwind.config.js             # Custom brand colors + theme extensions
├── tsconfig.json                  # TypeScript config (ES2017 target, path aliases)
├── vercel.json                    # Cron job schedule (Monday 9 AM UTC)
├── package.json                   # Dependencies and scripts
├── CLAUDE.md                      # User-facing project spec
├── TECHNICAL.md                   # This file
├── SETUP.md                       # Firebase + Resend setup guide
└── README.md                      # Project overview
```

## Data Model

### Users Collection (`users`)
```typescript
{
  uid: string                // Firebase Auth UID
  email: string
  displayName: string
  photoURL: string
  phoneNumber: string | null
  cars: string[]             // Array of saved VIN numbers
  createdAt: Timestamp
  updatedAt: Timestamp
}
```

### Bookings Collection (`bookings`)
```typescript
{
  id: string                 // Auto-generated document ID
  userId: string             // Firebase Auth UID
  customerName: string
  customerEmail: string
  customerPhone: string
  vinNumber: string          // Vehicle Identification Number
  service: string            // Selected service type
  otherService: string | null // Custom text if service = "Other"
  description: string        // Customer notes about the issue
  photos: string[]           // Firebase Storage URLs (up to 5)
  preferredDate: string      // YYYY-MM-DD
  preferredTime: string      // HH:MM (24h format)
  status: 'pending' | 'confirmed' | 'approved' | 'rejected' | 'completed' | 'cancelled'
  bookingTag: string         // Reference number (PG-XXXX format)
  mechanicPreference: string // 'garage-assigns' or specific mechanic name
  submittedAt: Timestamp
  updatedAt: Timestamp
  approvedBy: string | null  // Admin email who approved
  completedAt: Timestamp | null
  serviceNotes: string | null     // What work was actually done
  serviceNotesBy: string | null   // Admin who logged the notes
  reminderSentAt: Timestamp | null // When 90-day reminder was sent
}
```

## API Endpoints

### POST `/api/send-email`
- **Purpose**: Send booking-related emails via Resend
- **Auth**: None (called from frontend)
- **Body**: `{ to: string, subject: string, html: string }`
- **Fallback**: If RESEND_API_KEY is not set, logs email to console and returns success

### POST `/api/send-reminders` (Cron)
- **Purpose**: Automated service reminder emails
- **Auth**: Bearer token via `CRON_SECRET` environment variable
- **Schedule**: Monday 9:00 AM UTC (configured in `vercel.json`)
- **Logic**:
  1. Query all completed bookings older than 90 days
  2. Group by customer email (latest service per customer only)
  3. Skip if reminder already sent (`reminderSentAt` set)
  4. Send personalized reminder email
  5. Update booking with `reminderSentAt` timestamp

## Email Templates (7 total)

| Template | Trigger | Recipient |
|----------|---------|-----------|
| Booking Received | Customer submits booking | Customer |
| New Booking Alert | Customer submits booking | Admin team |
| Booking Approved | Admin approves booking | Customer |
| Booking Rejected | Admin rejects booking | Customer |
| Service Completed | Admin marks as complete | Customer |
| Booking Rescheduled | Admin reschedules | Customer |
| Service Reminder | Cron (90 days post-service) | Customer |

## Services Offered

1. Oil change
2. Air filter exchange
3. Tyres
4. Brake pads
5. Suspension changes/fixes
6. Computer diagnostics
7. Body kits
8. Detailing services
9. Other (with custom description)

## Operating Hours

- **Days**: Monday - Saturday (Sunday closed)
- **Hours**: 8:00 AM - 5:30 PM
- **Slot duration**: 30 minutes
- **Slots per day**: 20

## Admin Team

Admin access is controlled via email whitelist in `lib/admin.ts`:
1. michaeldiro@gmail.com
2. mwololokimanthi@gmail.com
3. thomasaquinas689@gmail.com
4. viny.njoroge1@gmail.com

## Mechanics

Configurable list in `lib/bookings.ts`:
- Mike D
- Kimanthi
- Thomas
- Viny

## Environment Variables

```
# Firebase (public — safe for NEXT_PUBLIC_ prefix)
NEXT_PUBLIC_FIREBASE_API_KEY=
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=
NEXT_PUBLIC_FIREBASE_PROJECT_ID=
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=
NEXT_PUBLIC_FIREBASE_APP_ID=

# Email (secret — server-side only)
RESEND_API_KEY=

# Cron job authentication (secret)
CRON_SECRET=
```

## Development

```bash
# Install dependencies
npm install

# Run dev server
npm run dev

# Build for production
npm run build

# Lint code
npm run lint

# Lint and auto-fix
npm run lint:fix
```

## Deployment

**Vercel (Free Tier)**
- Push to GitHub → automatic deployment
- SSL and CDN included
- Serverless functions for API routes
- Cron jobs via `vercel.json`

**Important**: Set all environment variables in Vercel dashboard → Settings → Environment Variables.

## Security

- Firebase Auth for all user operations
- Admin whitelist for dashboard access
- Bearer token authentication on cron endpoint
- Input validation on booking form (client + server)
- File upload restrictions (type: image/*, max 5MB, max 5 files)
- Environment variables for all secrets (never hardcoded)
- Firestore security rules should be configured in Firebase Console

## Performance

- Next.js automatic code splitting per route
- Image optimization via Next.js Image component
- Tailwind CSS purging for minimal CSS bundle
- Server-side rendering for initial page load
- PWA manifest for "Add to Home Screen" on Android

## V2 Features (March 2026)

### 1. Dark / Light Mode Theme Toggle
- **Strategy**: CSS custom properties + `html.light` class toggle
- **Storage**: `localStorage` key `pg-theme` (`'dark'` | `'light'`)
- **Files**:
  - `tailwind.config.js` — `darkMode: 'class'` enabled
  - `app/globals.css` — CSS variables `:root` (dark) and `html.light` overrides
  - `app/components/ThemeProvider.tsx` — React context, reads/writes localStorage
  - `app/components/ThemeToggle.tsx` — Floating sun/moon button (bottom-right)
  - `app/layout.tsx` — Wraps with `<ThemeProvider>`, renders `<ThemeToggle>`

### 2. Community Feed (`/feed`)
- **Route**: `/feed`
- **Files**: `app/feed/page.tsx`, `lib/feed.ts`
- **Firestore collection**: `/posts/{postId}` with `/comments` subcollection
- **Features**:
  - Create posts (text + up to 4 photos) — authenticated users only
  - 7 post tags: My Build, Service Tip, For Sale, Event, Spotted, Question, General
  - Like / unlike (optimistic update)
  - Inline comments with real-time loading
  - Image lightbox on tap
  - Filter strip by tag
  - Paginated feed (15 posts/page)
  - Image upload to Firebase Storage at `feed/{uid}/{timestamp}_{filename}`
  - Share via Web Share API
  - Sign-in prompt for unauthenticated users

### Feed Data Model

#### Posts (`/posts/{postId}`)
```typescript
{
  authorId: string          // Firebase UID
  authorName: string
  authorPhoto?: string      // Firebase Auth photoURL
  content: string           // Max 500 chars
  mediaUrls: string[]       // Firebase Storage URLs (max 4)
  tag: PostTag              // 'my-build' | 'service-tip' | 'for-sale' | 'event' | 'spotted' | 'question' | 'general'
  likes: string[]           // Array of UIDs
  commentCount: number      // Denormalized count
  createdAt: Timestamp
  updatedAt: Timestamp
}
```

#### Comments (`/posts/{postId}/comments/{commentId}`)
```typescript
{
  postId: string
  authorId: string
  authorName: string
  authorPhoto?: string
  content: string           // Max 300 chars
  createdAt: Timestamp
}
```

## Future Enhancements (Not in V1/V2)

### Phase 3
- Individual mechanic profiles and schedules
- SMS notifications (Africa's Talking API)
- Customer reviews and ratings

### Phase 3
- M-Pesa payment integration
- Online payment processing
- Invoicing system

### Phase 4+
- Marketplace (buy/sell cars)
- Content management system (car news, rally coverage)
- Events and ticketing
- Community features (chat, loyalty program)
- AR tools
- Multi-garage platform support
