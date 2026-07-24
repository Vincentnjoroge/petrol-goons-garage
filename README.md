# Petrol Goons Garage - Booking System

🚗 A modern garage booking system built for Kenya's car community

## What This Is

Your customers can easily book car services online. You and your mechanics see all bookings on a dashboard, can prepare parts in advance, and track complete service history for every vehicle.

## Features

✅ **Easy Login** - Google, Facebook, Apple, or Phone number
✅ **Book Services** - Oil changes, brakes, suspension, diagnostics, and more
✅ **Upload Photos** - Customers can show you what's wrong
✅ **Admin Dashboard** - Approve/reject bookings, see all details
✅ **Email Notifications** - Automatic confirmations sent to customers
✅ **Service History** - Track everything by VIN/chassis number
✅ **Mobile-First** - Works perfectly on Android phones




```

## Project Structure

```
├── app/
│   ├── page.tsx              # Login page
│   ├── book/page.tsx         # Booking form
│   ├── dashboard/page.tsx    # Admin dashboard
│   └── api/send-email/       # Email sending API
├── lib/
│   ├── firebase.ts           # Firebase configuration
│   ├── auth.ts               # Authentication helpers
│   ├── bookings.ts           # Booking management
│   └── email.ts              # Email templates
├── CLAUDE.MD                 # How Claude should work on this project
├── TECHNICAL.MD              # Technical documentation
├── SETUP.md                  # Setup instructions
└── README.md                 # This file
```

## For Customers

### How to Book

1. Click the booking link from Instagram or website
2. Sign in with Google/Facebook/Apple/Phone
3. Enter your car's VIN or chassis number
4. Select the service you need
5. Describe the issue and upload photos
6. Pick your preferred date and time
7. Submit! You'll get email confirmation once approved

## For Mechanics/Admin

### How to Manage Bookings

1. Go to the dashboard
2. See all pending booking requests
3. View customer details, car info, photos
4. Click "Approve" or "Reject"
5. Customer gets automatic email notification
6. Service history builds over time

## Tech Stack

- **Frontend**: Next.js 15 (React) with TypeScript
- **Styling**: Tailwind CSS
- **Authentication**: Firebase Auth
- **Database**: Firebase Firestore
- **Storage**: Firebase Storage (for photos)
- **Email**: Resend
- **Hosting**: Vercel 

> Note: This project now uses a server-side Firebase Admin connection for transactional booking creation. The setup requires additional secret env vars: `FIREBASE_PROJECT_ID`, `FIREBASE_CLIENT_EMAIL`, `FIREBASE_PRIVATE_KEY`, `RESEND_ADMIN_EMAILS`, and `EMAIL_API_SECRET`.

## Roadmap

### Current (V1)
✅ Garage booking system
✅ Login & authentication
✅ Admin dashboard
✅ Email notifications

### Next (V2)
- Individual mechanic profiles
- SMS notifications (Africa's Talking)
- Service history page for customers
- Automated service reminders

### Future (V3+)
- M-Pesa payment integration
- Marketplace for buying/selling cars
- Content platform (news, events)
- Community features
- Loyalty program

## Support

Having trouble? Check:

1. [SETUP.md](./SETUP.md) - Step-by-step setup guide
2. [TECHNICAL.md](./TECHNICAL.md) - Technical details
3. Browser console (F12) - for error messages
4. Firebase Console - check if services are enabled
5. Vercel logs - if deployed, check deployment logs

## Brand

**Colors**: Yellow (`#FDB913`), Black (`#0A0A0A`), Neon Green (`#39FF14`)
**Logo**: Yellow fuel pump icon
**Vibe**: F1-inspired, edgy but professional
**Instagram**: [@petrol_goons](https://instagram.com/petrol_goons)

---


