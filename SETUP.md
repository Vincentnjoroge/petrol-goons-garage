# Setup Guide - Petrol Goons Garage

This guide will help you get your booking system up and running with Firebase and Resend.

## Step 1: Create a Firebase Project

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Click "Add Project"
3. Name it "Petrol Goons Garage"
4. Disable Google Analytics (optional, you can enable it later)
5. Click "Create Project"

## Step 2: Enable Authentication

1. In your Firebase project, click "Authentication" in the left sidebar
2. Click "Get Started"
3. Enable the following sign-in methods:
   - **Google**: Click Google → Enable → Save
   - **Facebook**: Click Facebook → Enable → You'll need to create a Facebook App (instructions provided by Firebase)
   - **Apple**: Click Apple → Enable → You'll need an Apple Developer account (instructions provided by Firebase)
   - **Phone**: Click Phone → Enable → Save (Firebase provides free quota for phone auth)

## Step 3: Create Firestore Database

1. Click "Firestore Database" in the left sidebar
2. Click "Create Database"
3. Choose "Start in test mode" (we'll add security rules later)
4. Choose your location (select closest to Kenya - probably europe-west)
5. Click "Enable"

## Step 4: Enable Firebase Storage

1. Click "Storage" in the left sidebar
2. Click "Get Started"
3. Choose "Start in test mode"
4. Use the same location as Firestore
5. Click "Done"

## Step 5: Get Firebase Configuration

1. Click the gear icon (⚙️) next to "Project Overview"
2. Click "Project Settings"
3. Scroll down to "Your apps"
4. Click the web icon (</>)
5. Register your app (name it "Petrol Goons Garage Web")
6. Copy the `firebaseConfig` values

## Step 6: Create Resend Account

1. Go to [Resend](https://resend.com/)
2. Sign up for a free account
3. Go to "API Keys" in the dashboard
4. Create a new API key
5. Copy the API key (starts with `re_`)

**Note**: On the free tier, you can only send emails from `onboarding@resend.dev`. To use your own domain (`bookings@petrolgoonsgarage.com`), you'll need to:
- Buy your domain
- Add it to Resend
- Verify DNS records
This is free but requires owning the domain first.

## Step 7: Configure Environment Variables

1. In your project folder, create a file called `.env.local`
2. Copy the contents from `.env.example`
3. Fill in your Firebase values:
```
NEXT_PUBLIC_FIREBASE_API_KEY=your_api_key_here
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your_project.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=your_project_id
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=your_project.appspot.com
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
NEXT_PUBLIC_FIREBASE_APP_ID=your_app_id
```
4. Add server-only Firebase Admin values:
```
FIREBASE_PROJECT_ID=your_project_id
FIREBASE_CLIENT_EMAIL=your_service_account_email@your-project.iam.gserviceaccount.com
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
```
5. Add email and auth secrets:
```
RESEND_API_KEY=re_your_api_key_here
RESEND_ADMIN_EMAILS=admin1@example.com,admin2@example.com
EMAIL_API_SECRET=some-long-secret-value
CRON_SECRET=some-long-cron-secret
```

> Notes:
> - `FIREBASE_PRIVATE_KEY` should be the full service account private key string, with `\n` escaped if set in the `.env.local` file.
> - `EMAIL_API_SECRET` is required to protect the internal email route and should never be exposed to the browser.

## Step 8: Test Locally

1. Make sure you've saved `.env.local`
2. Restart your development server:
   - Press `Ctrl+C` in the terminal to stop it
   - Run `npm run dev` again
3. Open `http://localhost:3000`
4. Try logging in with Google (easiest to test first)
5. Create a test booking
6. Check your Firebase Console → Firestore Database to see the booking appear

## Step 9: Add Firebase Security Rules

Once you've tested that everything works, secure your database:

### Firestore Rules
1. Go to Firestore Database → Rules
2. Replace with:
```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Users can read their own data
    match /users/{userId} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
    }

    // Users can create bookings, read their own bookings
    match /bookings/{bookingId} {
      allow create: if request.auth != null;
      allow read: if request.auth != null &&
                     (resource.data.userId == request.auth.uid ||
                      request.auth.token.email in ['your-admin-email@gmail.com']);
      allow update: if request.auth != null &&
                       request.auth.token.email in ['your-admin-email@gmail.com'];
    }
  }
}
```
Replace `'your-admin-email@gmail.com'` with your email.

### Storage Rules
1. Go to Storage → Rules
2. Replace with:
```
rules_version = '2';
service firebase.storage {
  match /b/{bucket}/o {
    match /bookings/{bookingId}/{allPaths=**} {
      allow read: if request.auth != null;
      allow write: if request.auth != null && request.resource.size < 10 * 1024 * 1024;
    }
  }
}
```

## Step 10: Deploy to Vercel (Free)

1. Create a GitHub account if you don't have one
2. Create a new repository called "petrol-goons-garage"
3. Push your code to GitHub:
```bash
git remote add origin https://github.com/your-username/petrol-goons-garage.git
git branch -M main
git push -u origin main
```

4. Go to [Vercel](https://vercel.com/)
5. Sign up with GitHub
6. Click "New Project"
7. Import your "petrol-goons-garage" repository
8. Add your environment variables (same ones from `.env.local`)
9. Click "Deploy"

Vercel will give you a URL like `petrol-goons-garage.vercel.app` - this is your live site!

## Step 11: Connect Your Domain (Optional)

If you've bought `petrolgoonsgarage.com`:

1. In Vercel, go to your project → Settings → Domains
2. Add your domain
3. Follow the DNS configuration instructions
4. Wait for DNS to propagate (can take up to 48 hours)

## Troubleshooting

### Login not working
- Check Firebase Authentication is enabled
- Make sure you added your localhost to authorized domains (Firebase → Authentication → Settings → Authorized domains)
- Verify `.env.local` has correct Firebase config

### Bookings not saving
- Check Firestore Database is created
- Verify firestore rules allow writes
- Check browser console for errors

### Emails not sending
- Verify Resend API key is correct
- Check you're using `onboarding@resend.dev` as sender (or verified domain)
- Look for errors in browser console or Vercel logs

### Deployment issues
- Make sure all environment variables are added in Vercel
- Check build logs in Vercel dashboard
- Ensure all dependencies are in `package.json`

## Free Tier Limits

**Firebase (free "Spark" plan):**
- 50,000 document reads/day
- 20,000 document writes/day
- 20,000 document deletes/day
- 1GB storage
- 10GB/month data transfer

**Resend (free tier):**
- 100 emails/day
- 3,000 emails/month

**Vercel (free "Hobby" plan):**
- Unlimited deployments
- 100GB bandwidth/month
- Automatic HTTPS

These limits are more than enough to get started. You can upgrade later as you grow.

## Need Help?

If you run into issues:
1. Check the browser console for errors (F12 → Console tab)
2. Check Vercel deployment logs
3. Verify all environment variables are set correctly
4. Make sure Firebase services are enabled

---

Once everything is set up, you'll have:
✅ Working login with Google/Facebook/Apple/Phone
✅ Customers can book services
✅ You can approve/reject bookings from dashboard
✅ Email notifications sent automatically
✅ All data tracked in Firebase
✅ Live website you can share on Instagram!
