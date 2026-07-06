# Review Submission Flow — Wiring & Tests

Closes the loop: dashboard + public profile already DISPLAY reviews; this lets
customers CREATE them. One review per job, immutable, no rules changes.

## Files
- lib/reviews.ts — submitReview / hasReviewedJob (review doc ID = job ID)
- app/components/ReviewPrompt.tsx — drop-in "★ Rate this service" + modal

## Wire-up (2 spots, one line each)

1. /my-bookings (app/my-bookings/page.tsx) — inside each booking card:
   import ReviewPrompt from '@/app/components/ReviewPrompt'
   <ReviewPrompt job={booking as any} customerId={user.uid}
     customerName={user.displayName ?? 'Customer'} />
   (Renders ONLY on completed jobs; shows "✓ Reviewed" once done.)

2. /profile service history (app/profile/page.tsx) — inside the job card,
   next to the status pill:
   <ReviewPrompt job={j} customerId={user!.uid}
     customerName={user!.displayName ?? 'Customer'} />

## Design guarantees
- Review ID = job ID → duplicate submits hit the rules' update-deny → caught
  and shown as "already reviewed". No double reviews possible.
- Only status === 'completed' renders the CTA (lib re-checks too).
- isPublic checkbox (default ON) controls public-profile visibility; owner
  reply flow in the dashboard is untouched and works on these docs as-is.
- Comment capped 500 chars; fields match both existing renderers exactly.

## Test flow (localhost)
[ ] In-progress job: no review button appears
[ ] Complete a job from the garage dashboard → customer's /my-bookings now
    shows "★ Rate this service" on it
[ ] Submit 4★ + comment → button flips to "✓ Reviewed"
[ ] Garage dashboard → Analytics: review appears; owner Reply works
[ ] /garage/{garageId} → Reviews tab: review visible (public ✓)
[ ] Submit with "Show publicly" unchecked (second test job): NOT on public
    profile, but visible in owner dashboard
[ ] Refresh /my-bookings: still "✓ Reviewed" (no re-prompt)

## Commit
xcopy "%USERPROFILE%\Downloads\pg-reviews\pg-reviews\*" "C:\Users\san\Desktop\pg-live\" /E /Y
(+ the two one-line insertions above)
git add -A && git commit -m "feat: customer review submission (one per job, public toggle)" && git push origin master
