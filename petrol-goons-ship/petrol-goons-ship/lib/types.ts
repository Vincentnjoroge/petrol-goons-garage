/**
 * Petrol Goons Garage SaaS — Core Type Definitions
 *
 * Multi-tenant data model supporting:
 * - Multiple garages with data isolation
 * - Role-based access (Super Admin, Owner, Manager, Mechanic, Reception, Specialist)
 * - 9-state job lifecycle
 * - Subscription tiers (Basic, Pro, Enterprise)
 * - Activity logging for all state changes
 */

import { Timestamp } from 'firebase/firestore'

// ==============================
// ROLES & PERMISSIONS
// ==============================

// FIX: was declared twice — caused TS "Duplicate identifier" compilation error
export type UserRole =
  | 'super_admin'
  | 'garage_owner'
  | 'garage_manager'
  | 'mechanic'
  | 'reception'
  | 'independent_specialist'
  | 'customer'

export interface UserProfile {
  id?: string
  uid: string
  email: string
  displayName: string
  photoURL?: string
  phoneNumber?: string
  role: UserRole
  garageId?: string | null       // null for super_admin, customer, independent_specialist
  pin_hash?: string | null       // optional PIN for lock screen
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
  slug: string                    // URL-safe identifier
  ownerId: string                 // Firebase UID of garage owner
  ownerName: string
  ownerEmail: string
  ownerPhone: string
  location: string
  county?: string
  area?: string
  googleMapsLink?: string
  country: string
  currency: string
  region?: string
  status: GarageStatus
  description?: string
  photos?: string[]
  operatingHours?: OperatingHours
  subscriptionPlan: SubscriptionPlan
  subscriptionStatus: SubscriptionStatus
  planLimits: PlanLimits
  servicesOffered: string[]
  mechanicCount: string
  currentSystem: string
  logoUrl?: string
  primaryColor?: string
  parentGarageId?: string | null
  createdAt: Timestamp
  updatedAt: Timestamp
}

export interface PlanLimits {
  maxJobsPerMonth: number
  maxStaff: number
  maxLocations: number
  analyticsAccess: boolean
  franchiseView: boolean
}

export interface OperatingHours {
  weekdays: DayHours
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
  userId: string
  garageId: string
  name: string
  email: string
  phone?: string
  role: 'garage_owner' | 'garage_manager' | 'mechanic' | 'reception'
  skills?: string[]
  certifications?: string[]
  isActive: boolean
  joinedAt: Timestamp
  updatedAt: Timestamp
}

// ==============================
// CUSTOMER (Subcollection of Garage)
// ==============================

export interface GarageCustomer {
  id?: string
  userId: string
  garageId: string
  name: string
  email: string
  phone?: string
  vehicles: CustomerVehicle[]
  totalVisits: number
  totalSpend: number
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
  nickname?: string
}

// ==============================
// SERVICE CATALOG
// ==============================

export interface ServiceCategory {
  id?: string
  garageId: string
  name: string
  sortOrder: number
  createdAt: Timestamp
}

export interface ServiceItem {
  id?: string
  garageId: string
  categoryId?: string
  name: string
  description?: string
  basePrice: number
  estimatedDuration: number
  isActive: boolean
  createdAt: Timestamp
  updatedAt: Timestamp
}

// ==============================
// BOOKINGS / JOBS
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
  'booking_created', 'checked_in', 'diagnosis', 'awaiting_parts',
  'repair_in_progress', 'quality_check', 'ready_for_pickup', 'completed',
]

export const JOB_STATUS_COLORS: Record<JobStatus, { bg: string; text: string }> = {
  booking_created:    { bg: 'bg-yellow-100',  text: 'text-yellow-800' },
  checked_in:         { bg: 'bg-blue-100',    text: 'text-blue-800' },
  diagnosis:          { bg: 'bg-purple-100',  text: 'text-purple-800' },
  awaiting_parts:     { bg: 'bg-orange-100',  text: 'text-orange-800' },
  repair_in_progress: { bg: 'bg-indigo-100',  text: 'text-indigo-800' },
  quality_check:      { bg: 'bg-cyan-100',    text: 'text-cyan-800' },
  ready_for_pickup:   { bg: 'bg-green-100',   text: 'text-green-800' },
  completed:          { bg: 'bg-emerald-100', text: 'text-emerald-800' },
  cancelled:          { bg: 'bg-gray-100',    text: 'text-gray-500' },
}

export const JOB_TRANSITIONS: Record<JobStatus, JobStatus[]> = {
  booking_created:    ['checked_in', 'cancelled'],
  checked_in:         ['diagnosis', 'repair_in_progress', 'cancelled'],
  diagnosis:          ['awaiting_parts', 'repair_in_progress', 'cancelled'],
  awaiting_parts:     ['repair_in_progress', 'cancelled'],
  repair_in_progress: ['quality_check', 'awaiting_parts', 'cancelled'],
  quality_check:      ['ready_for_pickup', 'repair_in_progress'],
  ready_for_pickup:   ['completed'],
  completed:          [],
  cancelled:          [],
}

export interface Job {
  id?: string
  garageId: string
  bookingTag: string
  customerId: string
  customerName: string
  customerEmail: string
  customerPhone: string
  vinNumber?: string
  vehicleMake?: string
  vehicleModel?: string
  vehicleYear?: string
  plateNumber?: string
  services: string[]
  otherService?: string
  description?: string
  photos: string[]
  preferredDate: string
  preferredTime: string
  assignedMechanicId?: string
  assignedMechanicName?: string
  status: JobStatus
  statusHistory: StatusChange[]
  serviceNotes?: string
  serviceNotesBy?: string
  completedAt?: Timestamp
  estimatedCost?: number
  actualCost?: number
  createdBy: string
  submittedAt: Timestamp
  updatedAt: Timestamp
  reminderSentAt?: Timestamp
}

export interface StatusChange {
  from: JobStatus
  to: JobStatus
  changedBy: string
  changedByName: string
  timestamp: Timestamp
  notes?: string
}

// ==============================
// ACTIVITY LOG
// ==============================

export interface ActivityLog {
  id?: string
  garageId: string
  jobId: string
  bookingTag: string
  action: string
  changedBy: string
  changedByName: string
  previousValue?: string
  newValue?: string
  details?: string
  timestamp: Timestamp
}

// ==============================
// CUSTOMER REVIEWS
// ==============================

export interface CustomerReview {
  id?: string
  garageId: string
  jobId: string
  bookingTag: string
  customerId: string
  customerName: string
  rating: number
  comment: string
  mechanicId?: string
  mechanicName?: string
  services: string[]
  isPublic: boolean
  garageResponse?: string
  respondedAt?: Timestamp
  createdAt: Timestamp
}

// ==============================
// INVOICES (SaaS Billing)
// ==============================

export type InvoiceStatus = 'draft' | 'sent' | 'paid' | 'overdue' | 'cancelled'

export interface SaasInvoice {
  id?: string
  invoiceNumber: string
  garageId: string
  garageName: string
  plan: SubscriptionPlan
  amount: number
  currency: string
  periodStart: string
  periodEnd: string
  status: InvoiceStatus
  paidAt?: Timestamp
  dueDate: string
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
    limits: { maxJobsPerMonth: 50, maxStaff: 3, maxLocations: 1, analyticsAccess: false, franchiseView: false },
    features: ['Up to 50 jobs/month', 'Up to 3 staff accounts', 'Basic booking management', 'Customer records', 'Email notifications'],
  },
  pro: {
    name: 'Growth',
    price: 9999,
    currency: 'KES',
    limits: { maxJobsPerMonth: -1, maxStaff: 15, maxLocations: 1, analyticsAccess: true, franchiseView: false },
    features: ['Unlimited jobs', 'Up to 15 staff accounts', 'Full analytics dashboard', 'Priority support', 'Custom service catalog', 'Job lifecycle tracking'],
  },
  enterprise: {
    name: 'Performance',
    price: 0,
    currency: 'KES',
    limits: { maxJobsPerMonth: -1, maxStaff: -1, maxLocations: -1, analyticsAccess: true, franchiseView: true },
    features: ['Everything in Growth', 'Unlimited staff', 'Multi-location support', 'Franchise dashboard', 'Consolidated reporting', 'Dedicated support', 'Custom integrations'],
  },
}

// ==============================
// PREDEFINED LISTS
// ==============================

export const GARAGE_SERVICES = [
  'Oil Change', 'Air Filter Exchange', 'Tyres', 'Brake Pads',
  'Suspension', 'Computer Diagnostics', 'Body Kits', 'Detailing',
  'Engine Repair', 'Electrical Systems', 'Transmission', 'AC & Cooling',
  'Wheel Alignment & Balancing', 'General Inspection',
]

export const MECHANIC_SKILLS = [
  'Engine & Mechanical', 'Electrical & Electronics', 'Body & Paint',
  'Suspension & Steering', 'Transmission', 'AC & Climate', 'Diagnostics',
  'Tyres & Brakes', 'Detailing',
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
  { value: '1-2',  label: '1–2 mechanics' },
  { value: '3-5',  label: '3–5 mechanics' },
  { value: '6-10', label: '6–10 mechanics' },
  { value: '10+',  label: '10+ mechanics' },
]

export const KENYA_COUNTIES = [
  'Nairobi', 'Mombasa', 'Kisumu', 'Nakuru', 'Eldoret', 'Thika',
  'Machakos', 'Meru', 'Kilifi', 'Nyeri', 'Garissa', 'Kakamega',
  'Kisii', 'Kitale', 'Malindi', 'Other',
]

export const COUNTRIES = [
  { code: 'KE', name: 'Kenya',        currency: 'KES' },
  { code: 'NG', name: 'Nigeria',      currency: 'NGN' },
  { code: 'ZA', name: 'South Africa', currency: 'ZAR' },
  { code: 'GH', name: 'Ghana',        currency: 'GHS' },
  { code: 'TZ', name: 'Tanzania',     currency: 'TZS' },
  { code: 'UG', name: 'Uganda',       currency: 'UGX' },
]
