# TECHNICAL.md - Petrol Goons Garage

## Technology Stack

### Frontend
- **Framework**: Next.js 15 (React 18)
- **Language**: TypeScript
- **Styling**: Tailwind CSS
- **Deployment**: Vercel (free tier)

### Backend
- **Authentication**: Firebase Auth (Google, Facebook, Apple, Phone)
- **Database**: Firebase Firestore (NoSQL)
- **Storage**: Firebase Storage (for car photos)
- **Email**: Resend (free tier - 100 emails/day)

### Why These Choices?

**Next.js**:
- Server-side rendering for fast mobile performance
- Built-in API routes
- Excellent developer experience
- Free hosting on Vercel
- Great for SEO (important for eventual marketplace)

**Firebase**:
- Zero cost for low traffic
- Built-in authentication with all required providers
- Real-time database perfect for booking updates
- Scales automatically
- Simple to implement

**Tailwind CSS**:
- Fast development
- Mobile-first by default
- Small bundle size
- Easy to maintain

**Resend**:
- Free tier sufficient for early stage
- Simple API
- Reliable email delivery

## Project Structure

```
petrol-goons-garage/
├── app/
│   ├── page.tsx              # Login page
│   ├── book/
│   │   └── page.tsx          # Booking form
│   ├── dashboard/
│   │   └── page.tsx          # Admin dashboard
│   ├── layout.tsx            # Root layout
│   └── globals.css           # Global styles
├── components/               # Reusable components (future)
├── lib/
│   ├── firebase.ts          # Firebase configuration
│   └── email.ts             # Email sending utilities
├── public/                   # Static assets
├── CLAUDE.md                 # User-facing documentation
├── TECHNICAL.md              # This file
├── package.json
└── tsconfig.json
```

## Data Model

### Users Collection
```typescript
{
  uid: string
  email: string
  displayName: string
  photoURL: string
  phoneNumber: string | null
  createdAt: timestamp
}
```

### Bookings Collection
```typescript
{
  id: string
  userId: string
  customerName: string
  customerEmail: string
  customerPhone: string
  vinNumber: string
  service: string
  otherService: string | null
  description: string
  photos: string[]  // URLs to Firebase Storage
  preferredDate: string
  preferredTime: string
  status: 'pending' | 'approved' | 'rejected' | 'completed'
  submittedAt: timestamp
  updatedAt: timestamp
  approvedBy: string | null
  completedAt: timestamp | null
}
```

### ServiceHistory Collection
```typescript
{
  id: string
  bookingId: string
  vinNumber: string
  userId: string
  service: string
  workDone: string
  mechanicNotes: string
  completedAt: timestamp
  nextServiceDue: timestamp | null
}
```

## Development Setup

1. Install dependencies:
```bash
npm install
```

2. Create `.env.local` with Firebase credentials:
```
NEXT_PUBLIC_FIREBASE_API_KEY=
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=
NEXT_PUBLIC_FIREBASE_PROJECT_ID=
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=
NEXT_PUBLIC_FIREBASE_APP_ID=
RESEND_API_KEY=
```

3. Run development server:
```bash
npm run dev
```

4. Build for production:
```bash
npm run build
```

## Deployment

**Vercel (Free Tier)**
- Automatic deployments from Git
- SSL included
- CDN included
- Serverless functions for API routes

Push to GitHub and connect to Vercel for automatic deployments.

## Future Enhancements

### Phase 2
- Real Firebase authentication
- Email notifications on booking approval
- Service history page for customers
- Reminder system for upcoming services

### Phase 3
- Individual mechanic profiles
- SMS notifications (Africa's Talking API)
- M-Pesa payment integration

### Phase 4+
- Marketplace features
- Content management system
- Events and ticketing
- Community features

## Performance Optimizations

- Image optimization with Next.js Image component
- Code splitting by route
- Lazy loading for non-critical components
- Tailwind CSS purging for small bundle size
- Server-side rendering for initial page load

## Security

- Firebase security rules for Firestore
- Authentication required for all booking operations
- Input validation on both client and server
- File upload restrictions (type, size)
- Rate limiting on API routes

## Testing Strategy

- Unit tests for utility functions
- Integration tests for booking flow
- E2E tests for critical paths (login, book, approve)
- Manual mobile testing on Android devices

## Maintenance

- Update dependencies monthly
- Monitor Firebase usage
- Review and optimize Firestore queries
- Check email delivery rates
- Monitor error logs on Vercel
