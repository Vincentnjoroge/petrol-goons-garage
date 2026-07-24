/**
 * Petrol Goons Garage SaaS — Core Type Definitions
 *
 * Multi-tenant data model supporting:
 * - Multiple garages with data isolation
 * - Role-based access (Super Admin, Owner, Manager, Mechanic, Reception)
 * - 9-state job lifecycle
 * - Subscription tiers (Basic, Pro, Enterprise)
 * - Activity logging for all state changes
 */

import { Timestamp } from 'firebase/firestore'

// ==============================
// ROLES & PERMISSIONS
// ==============================

export type UserRole =
  | 'super_admin'
  | 'garage_owner'
  | 'garage_manager'
  | 'mechanic'
  | 'reception'
  | 'independent_specialist'   // ← Add this line
  | 'customer'

export interface UserProfile {
  id?: string
  uid: string
  email: string
  displayName: string
  photoURL?: string
  phoneNumber?: string
  role: UserRole
  garageId?: string | null       // null for super_admin and customer
  createdAt: Timestamp
  updatedAt: Timestamp
}

// ==============================
// GARAGE (Top-Level Entity)
// ==============================

export type GarageStatus = 'pending' | 'approved' | 'active' | 'suspended'
export type SubscriptionPlan = 'basic' | 'pro' | 'enterprise'
export type SubscriptionStatus = 'active' | 'trial' | 'past_due' | 'cancelled' | 'none'

export interface Garage {
  id?: string
  name: string
  slug: string                    // URL-safe identifier (e.g. "petrol-goons-westlands")
  ownerId: string                 // Firebase UID of garage owner
  ownerName: string
  ownerEmail: string
  ownerPhone: string
  location: string
  googleMapsLink?: string
  county?: string
  area?: string
  country: string                 // e.g. "KE"
  currency: string                // e.g. "KES"
  region?: string                 // e.g. "Nairobi"
  status: GarageStatus
  // Subscription
  subscriptionPlan: SubscriptionPlan
  subscriptionStatus: SubscriptionStatus
  planLimits: PlanLimits
  // Operations
  servicesOffered: string[]
  mechanicCount: string           // "1-2", "3-5", "6-10", "10+"
  currentSystem: string           // What they used before
  operatingHours?: OperatingHours
  description?: string
  photos?: string[]
  // Branding (future)
  logoUrl?: string
  primaryColor?: string
  // Franchise
  parentGarageId?: string | null  // For franchise/multi-location
  // Timestamps
  createdAt: Timestamp
  updatedAt: Timestamp
}

export interface PlanLimits {
  maxJobsPerMonth: number         // -1 = unlimited
  maxStaff: number                // -1 = unlimited
  maxLocations: number            // 1 for Basic, -1 for Enterprise
  analyticsAccess: boolean
  franchiseView: boolean
}

export interface OperatingHours {
  monday: DayHours
  tuesday: DayHours
  wednesday: DayHours
  thursday: DayHours
  friday: DayHours
  saturday: DayHours
  sunday: DayHours
}

export interface DayHours {
  open: boolean
  start: string                   // "08:00"
  end: string                     // "17:30"
}

// ==============================
// STAFF / MECHANICS (Subcollection of Garage)
// ==============================

export interface StaffMember {
  id?: string
  userId: string                  // Firebase UID
  garageId: string
  name: string
  email: string
  phone?: string
  role: 'garage_owner' | 'garage_manager' | 'mechanic' | 'reception'
  // Mechanic-specific
  skills?: string[]               // e.g. ["Engine", "Electrical", "Body"]
  certifications?: string[]
  // Status
  isActive: boolean
  joinedAt: Timestamp
  updatedAt: Timestamp
}

// ==============================
// CUSTOMER (Subcollection of Garage)
// ==============================

export interface GarageCustomer {
  id?: string
  userId: string                  // Firebase UID
  garageId: string
  name: string
  email: string
  phone?: string
  vehicles: CustomerVehicle[]
  totalVisits: number
  totalSpend: number              // Cumulative (future)
  lastVisit?: Timestamp
  createdAt: Timestamp
  updatedAt: Timestamp
}

export interface CustomerVehicle {
  vinNumber: string
  make?: string
  model?: string
  year?: string
  plateNumber?: string
  nickname?: string               // e.g. "My Daily"
}

// ==============================
// SERVICE CATALOG (Subcollection of Garage)
// ==============================

export interface ServiceCategory {
  id?: string
  garageId: string
  name: string                    // e.g. "Engine & Mechanical"
  sortOrder: number
  createdAt: Timestamp
}

export interface ServiceItem {
  id?: string
  garageId: string
  categoryId?: string
  name: string                    // e.g. "Oil Change"
  description?: string
  basePrice: number               // In local currency
  estimatedDuration: number       // Minutes
  isActive: boolean
  createdAt: Timestamp
  updatedAt: Timestamp
}

// ==============================
// BOOKINGS / JOBS (Subcollection of Garage)
// ==============================

export type JobStatus =
  | 'booking_created'
  | 'checked_in'
  | 'diagnosis'
  | 'awaiting_parts'
  | 'repair_in_progress'
  | 'quality_check'
  | 'ready_for_pickup'
  | 'completed'
  | 'cancelled'

export const JOB_STATUS_LABELS: Record<JobStatus, string> = {
  booking_created: 'Booking Created',
  checked_in: 'Vehicle Checked-In',
  diagnosis: 'Diagnosis In Progress',
  awaiting_parts: 'Awaiting Parts',
  repair_in_progress: 'Repair In Progress',
  quality_check: 'Quality Check',
  ready_for_pickup: 'Ready for Pickup',
  completed: 'Completed',
  cancelled: 'Cancelled',
}

export const JOB_STATUS_ORDER: JobStatus[] = [
  'booking_created',
  'checked_in',
  'diagnosis',
  'awaiting_parts',
  'repair_in_progress',
  'quality_check',
  'ready_for_pickup',
  'completed',
]

export const JOB_STATUS_COLORS: Record<JobStatus, { bg: string; text: string }> = {
  booking_created: { bg: 'bg-yellow-100', text: 'text-yellow-800' },
  checked_in: { bg: 'bg-blue-100', text: 'text-blue-800' },
  diagnosis: { bg: 'bg-purple-100', text: 'text-purple-800' },
  awaiting_parts: { bg: 'bg-orange-100', text: 'text-orange-800' },
  repair_in_progress: { bg: 'bg-indigo-100', text: 'text-indigo-800' },
  quality_check: { bg: 'bg-cyan-100', text: 'text-cyan-800' },
  ready_for_pickup: { bg: 'bg-green-100', text: 'text-green-800' },
  completed: { bg: 'bg-emerald-100', text: 'text-emerald-800' },
  cancelled: { bg: 'bg-gray-100', text: 'text-gray-500' },
}

// Valid transitions for the state machine
export const JOB_TRANSITIONS: Record<JobStatus, JobStatus[]> = {
  booking_created: ['checked_in', 'cancelled'],
  checked_in: ['diagnosis', 'repair_in_progress', 'cancelled'],
  diagnosis: ['awaiting_parts', 'repair_in_progress', 'cancelled'],
  awaiting_parts: ['repair_in_progress', 'cancelled'],
  repair_in_progress: ['quality_check', 'awaiting_parts', 'cancelled'],
  quality_check: ['ready_for_pickup', 'repair_in_progress'],
  ready_for_pickup: ['completed'],
  completed: [],
  cancelled: [],
}

export interface Job {
  id?: string
  garageId: string
  bookingTag: string              // "PG-XXXX" unique reference
  // Customer info
  customerId: string              // Firebase UID
  customerName: string
  customerEmail: string
  customerPhone: string
  // Vehicle
  vinNumber?: string
  vehicleMake?: string
  vehicleModel?: string
  vehicleYear?: string
  plateNumber?: string
  // Service details
  services: string[]              // Selected services
  otherService?: string           // If "Other" selected
  description?: string            // Customer's issue description
  photos: string[]                // Photo URLs
  // Scheduling
  preferredDate: string           // YYYY-MM-DD
  preferredTime: string           // HH:MM
  // Assignment
  assignedMechanicId?: string     // Staff member ID
  assignedMechanicName?: string
  // Job lifecycle
  status: JobStatus
  statusHistory: StatusChange[]   // Full audit trail
  // Completion
  serviceNotes?: string           // What was done
  serviceNotesBy?: string         // Who wrote notes
  completedAt?: Timestamp
  // Financial (future-ready)
  estimatedCost?: number
  actualCost?: number
  // Metadata
  createdBy: string               // UID of who created (customer or reception)
  submittedAt: Timestamp
  updatedAt: Timestamp
  // Reminder
  reminderSentAt?: Timestamp
}

export interface StatusChange {
  from: JobStatus
  to: JobStatus
  changedBy: string               // UID
  changedByName: string
  timestamp: Timestamp
  notes?: string                  // Reason for change
}

// ==============================
// ACTIVITY LOG (Subcollection of Garage)
// ==============================

export interface ActivityLog {
  id?: string
  garageId: string
  jobId: string
  bookingTag: string
  action: string                  // e.g. "status_changed", "mechanic_assigned", "notes_added"
  changedBy: string               // UID
  changedByName: string
  previousValue?: string
  newValue?: string
  details?: string
  timestamp: Timestamp
}

// ==============================
// CUSTOMER REVIEWS (Subcollection of Garage)
// ==============================

export interface CustomerReview {
  id?: string
  garageId: string
  jobId: string
  bookingTag: string
  customerId: string              // Firebase UID
  customerName: string
  rating: number                  // 1-5 stars
  comment: string
  mechanicId?: string
  mechanicName?: string
  services: string[]              // What was serviced
  isPublic: boolean               // Show on garage profile
  garageResponse?: string         // Garage owner can reply
  respondedAt?: Timestamp
  createdAt: Timestamp
}

// ==============================
// INVOICES (SaaS Billing — PG → Garage)
// ==============================

export type InvoiceStatus = 'draft' | 'sent' | 'paid' | 'overdue' | 'cancelled'

export interface SaasInvoice {
  id?: string
  invoiceNumber: string           // "INV-001"
  garageId: string
  garageName: string
  plan: SubscriptionPlan
  amount: number
  currency: string
  periodStart: string             // YYYY-MM-DD
  periodEnd: string               // YYYY-MM-DD
  status: InvoiceStatus
  paidAt?: Timestamp
  dueDate: string                 // YYYY-MM-DD
  createdAt: Timestamp
  updatedAt: Timestamp
}

// ==============================
// SUBSCRIPTION PLAN CONFIGS
// ==============================

export const SUBSCRIPTION_PLANS: Record<SubscriptionPlan, {
  name: string
  price: number
  currency: string
  limits: PlanLimits
  features: string[]
}> = {
  basic: {
    name: 'Starter',
    price: 4999,
    currency: 'KES',
    limits: {
      maxJobsPerMonth: 50,
      maxStaff: 3,
      maxLocations: 1,
      analyticsAccess: false,
      franchiseView: false,
    },
    features: [
      'Up to 50 jobs/month',
      'Up to 3 staff accounts',
      'Basic booking management',
      'Customer records',
      'Email notifications',
    ],
  },
  pro: {
    name: 'Growth',
    price: 9999,
    currency: 'KES',
    limits: {
      maxJobsPerMonth: -1,
      maxStaff: 15,
      maxLocations: 1,
      analyticsAccess: true,
      franchiseView: false,
    },
    features: [
      'Unlimited jobs',
      'Up to 15 staff accounts',
      'Full analytics dashboard',
      'Priority support',
      'Custom service catalog',
      'Job lifecycle tracking',
    ],
  },
  enterprise: {
    name: 'Performance',
    price: 0, // Custom pricing
    currency: 'KES',
    limits: {
      maxJobsPerMonth: -1,
      maxStaff: -1,
      maxLocations: -1,
      analyticsAccess: true,
      franchiseView: true,
    },
    features: [
      'Everything in Growth',
      'Unlimited staff',
      'Multi-location support',
      'Franchise dashboard',
      'Consolidated reporting',
      'Dedicated support',
      'Custom integrations',
    ],
  },
}

// ==============================
// PREDEFINED LISTS
// ==============================

export const GARAGE_SERVICES = [
  'Oil Change',
  'Air Filter Exchange',
  'Tyres',
  'Brake Pads',
  'Suspension',
  'Computer Diagnostics',
  'Body Kits',
  'Detailing',
  'Engine Repair',
  'Electrical Systems',
  'Transmission',
  'AC & Cooling',
  'Wheel Alignment & Balancing',
  'General Inspection',
]

export const MECHANIC_SKILLS = [
  'Engine & Mechanical',
  'Electrical & Electronics',
  'Body & Paint',
  'Suspension & Steering',
  'Transmission',
  'AC & Climate',
  'Diagnostics',
  'Tyres & Brakes',
  'Detailing',
]

export const CURRENT_SYSTEMS = [
  'Paper & WhatsApp',
  'Spreadsheets (Excel/Google Sheets)',
  'Another garage software',
  'Nothing — just memory',
  'Custom-built system',
  'Other',
]

export const MECHANIC_COUNTS = [
  { value: '1-2', label: '1–2 mechanics' },
  { value: '3-5', label: '3–5 mechanics' },
  { value: '6-10', label: '6–10 mechanics' },
  { value: '10+', label: '10+ mechanics' },
]

export const COUNTRIES = [
  { code: 'KE', name: 'Kenya', currency: 'KES' },
  { code: 'NG', name: 'Nigeria', currency: 'NGN' },
  { code: 'ZA', name: 'South Africa', currency: 'ZAR' },
  { code: 'GH', name: 'Ghana', currency: 'GHS' },
  { code: 'TZ', name: 'Tanzania', currency: 'TZS' },
  { code: 'UG', name: 'Uganda', currency: 'UGX' },
]
