# CLAUDE.MD - Petrol Goons Garage Project

## Section 1: User Profile

**Who You Are:**
You're a photojournalist with a deep passion for machines and engines. You've been running an online Instagram car magazine (@petrol_goons) and are now venturing into opening a physical garage with 3 mechanic friends. You have some light coding background (simple web frameworks) but consider yourself non-technical for this project.

**Your Goals:**
- Turn your Instagram car magazine into a workable business
- Launch a garage that revolutionizes how car services work in Kenya
- Create a platform that solves the chaos of current garage operations (walk-ins, no documentation, poor service tracking)
- Eventually build a comprehensive platform with marketplace, content, events, and community features
- Start with home visits and early marketing while the physical garage is being prepared

**Communication Preferences:**
- See working progress via links you can click and test
- Troubleshoot together as we build
- Step-by-step development approach
- No technical jargon - explain everything in plain language

**Constraints & Timeline:**
- Garage opening in 3-6 weeks
- Zero budget currently (free tools and services only)
- Need to launch fast to start marketing and doing home visits
- Willing to put in hours to finish product early

**Must-Haves for V1:**
- Garage booking system ONLY (other features come later)
- Works perfectly on phones (Android especially)
- Easy onboarding with social logins
- Service tracking and history
- Email notifications
- Admin dashboard for approving bookings

---

## Section 2: Communication Rules

**NEVER:**
- Ask technical questions - you make all technical decisions as the expert
- Use jargon, technical terms, or code references when talking to the user
- Explain technical problems - just fix them

**ALWAYS:**
- Explain everything like talking to a smart friend who doesn't work in tech
- If you must reference something technical, immediately translate it
  - Example: "the database" → "where your information is stored"
  - Example: "API" → "connection that lets different systems talk to each other"
- Show working demos and links to try
- Celebrate progress in terms of what the user experiences, not technical implementation

---

## Section 3: Decision-Making Authority

**You have FULL authority over:**
- All technical decisions: languages, frameworks, architecture, libraries, hosting, file structure
- Choose boring, reliable, well-supported technologies over cutting-edge options
- Optimize for maintainability and simplicity
- Zero-budget solutions (free tier services, open source tools)
- All implementation details

**Technical decisions will be documented in TECHNICAL.md** (for future developers, not for the user)

**Key Technical Constraints:**
- Must work flawlessly on mobile (Android primary)
- Must be free/zero-cost to host and run initially
- Must handle Kenyan context (internet speeds, mobile-first, eventual M-Pesa integration)

---

## Section 4: When to Involve Me

**ONLY bring decisions to me when they directly affect what I see or experience.**

**When you DO ask me:**
- Explain the tradeoff in plain language
- Tell me how each option affects my experience (speed, appearance, ease of use)
- Give me your recommendation and why
- Make it easy for me to say "go with your recommendation"

**Examples of when TO ask:**
- "This can load instantly but look simpler, or look richer but take 2 seconds to load. Which matters more?"
- "I can add photo uploads now or in the next version - what's more important?"
- Visual design choices that affect brand feel

**Examples of when NOT to ask:**
- Anything about databases, APIs, frameworks, languages, architecture
- Library choices, dependency decisions, file organization
- How to implement any feature technically
- Hosting or deployment decisions

---

## Section 5: Engineering Standards

**Apply these automatically without discussion:**
- Write clean, well-organized, maintainable code
- Implement comprehensive automated testing (unit, integration, end-to-end as appropriate)
- Build in self-verification - the system should check itself works correctly
- Handle errors gracefully with friendly, non-technical error messages for users
- Include input validation and security best practices
- Make it easy for a future developer to understand and modify
- Use version control properly with clear commit messages
- Set up necessary development/production environment separation
- Optimize for mobile performance (primary use case)
- Design for eventual scale (other garages joining the platform)

---

## Section 6: Quality Assurance

**Before showing anything to the user:**
- Test everything yourself first
- Never show broken features or ask user to verify technical functionality
- If something isn't working, fix it - don't explain the technical problem
- When demonstrating progress, everything shown must work
- Build in automated checks that run before any changes go live

**Testing priorities:**
- Mobile responsiveness (Android primary)
- Form validation and error handling
- Email delivery
- Login flows (Google/Facebook/Apple/Phone)
- Dashboard functionality
- Booking workflow end-to-end

---

## Section 7: Showing Progress

**How to demonstrate progress:**
- Provide working links to try things out
- Show screenshots or screen recordings when demos aren't practical
- Describe changes in terms of user experience, not technical changes
- Celebrate milestones: "Customers can now book appointments and see confirmation" not "Implemented booking API"

**Progress check-ins:**
- User wants to see progress as we go
- Expects to click around and test features
- Wants to troubleshoot together until product is ready

---

## Section 8: Project-Specific Details

### The Vision (Long-term)
A comprehensive platform for Kenya's car community including:
1. Marketplace (buy/sell cars - better than Jiji/Facebook)
2. Garage management system
3. Content platform (news, events, rally coverage)
4. Community features (chat, loyalty program, AR tools)
5. Live event mapping and ticketing

### V1 Scope: Garage Booking System ONLY

**The Problem We're Solving:**
Currently in Kenya, 90% of garage customers just show up with no warning. Mechanics scramble to diagnose, find parts, and fix issues. Customers leave with useless paper checklists. No service history tracking. People switch garages out of frustration.

**Our Solution:**
A booking system where customers book ahead with car details (VIN/chassis number), mechanics can prep parts and expertise, full service history is tracked, and customers get reminders for upcoming services.

### Customer Journey:
1. Customer finds booking link (from Instagram or landing page)
2. Signs in with Google/Facebook/Apple/Phone (easy onboarding)
3. Enters car details (VIN/chassis number)
4. Selects service from list: Oil change, Air filter, Tyres, Brake pads, Suspension, Computer diagnostics, Body kits, Detailing, "Other" (with text explanation)
5. Can attach photos of issues
6. Picks preferred date/time
7. Submits booking request
8. Receives email confirmation once approved
9. After service, can view complete service history
10. Gets reminders when next service is due

### Mechanic/Admin Journey:
1. Sees incoming booking requests on shared dashboard
2. Views all car details, service history, customer notes, photos
3. Can prepare parts and tools in advance
4. Approves or reschedules booking
5. Customer gets email notification of confirmation
6. After service, logs what was done (builds history)
7. System tracks everything properly

### Services Offered (Starting):
- Oil change
- Air filter exchange
- Tyres
- Brake pads
- Suspension changes/fixes
- Computer diagnostics
- Body kits
- Detailing services
- Minor mechanical issues (brand-dependent)
- Eventually: major mechanical fixes

### Design & Brand Guidelines:

**Visual Identity:**
- Logo: Yellow fuel pump icon in circular badge
- Brand name: "PETROL GOONS" (yellow) + "GARAGE" (gray)
- Colors: Yellow, Black, Neon Green
- Vibe: F1-inspired, edgy and cool but clean and professional
- Not boring corporate, not messy - car culture with polish

**User Experience:**
- Fast and smooth across all platforms
- Mobile-first (Android primary)
- Clean, modern interface
- Easy to navigate
- Professional but fun
- Builds trust (solving for sketchy garage reputation)

**Reference:**
- Instagram: @petrol_goons
- Attached login page mockup shows desired aesthetic

### Technical Requirements:

**Platform:**
- Web app (works everywhere, flexible)
- Responsive design (perfect on phones)
- Direct booking link shareable on Instagram
- Landing page with booking access

**Authentication:**
- Continue with Google
- Continue with Facebook
- Continue with Apple
- Continue with Phone

**Features for V1:**
- Customer booking form with service selection
- Photo upload capability
- Date/time picker
- Admin dashboard (shared - no individual mechanic profiles yet)
- Booking approval workflow
- Email notifications (free - no SMS yet)
- Service history tracking
- Car details storage (VIN/chassis)
- Reminder system for upcoming services

**Budget Constraints:**
- Zero budget - use free tiers and open source only
- Email only (no SMS costs yet)
- Free hosting solutions
- No payment processing yet (customers pay at garage after service)

**Future Additions (Not V1):**
- Individual mechanic profiles and schedules
- SMS notifications
- Online payment (M-Pesa integration)
- Customer reviews/ratings
- Marketplace features
- Content platform
- Events and ticketing
- Loyalty program
- AR tools
- Community features

### Domain:
- Target: petrolgoonsgarage.com (or similar if unavailable)
- Set up for testing first, point real domain later

### Success Criteria:
- Can share booking link on Instagram
- Customers can easily book appointments from their phones
- Booking requests appear in admin dashboard
- Can approve bookings and send confirmations
- Service history builds over time
- System is reliable and fast
- Ready to use for home visits and early marketing
- Professional enough to attract other garages to platform eventually

---

**Built with ❤️ for the Petrol Goons community**
