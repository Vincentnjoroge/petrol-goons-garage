/**
 * Petrol Goons Garage SaaS — Role-Based Access Control (RBAC)
 *
 * Replaces the old email-whitelist approach.
 * Roles are stored on each user doc in Firestore.
 * Super Admin emails are still whitelisted for bootstrap access.
 */

import { UserRole, UserProfile } from './types'

// Super Admin emails — platform-level access (Petrol Goons team)
export const SUPER_ADMIN_EMAILS: string[] = [
  'michaeldiro@gmail.com',
  'mwololokimanthi@gmail.com',
  'thomasaquinas689@gmail.com',
  'viny.njoroge1@gmail.com',
]

// Legacy compatibility — keep isAdmin working for existing pages during migration
export const ADMIN_EMAILS = SUPER_ADMIN_EMAILS
export function isAdmin(email: string | null | undefined): boolean {
  if (!email) return false
  return SUPER_ADMIN_EMAILS.includes(email.toLowerCase())
}

// Check if user is a super admin
export function isSuperAdmin(email: string | null | undefined): boolean {
  if (!email) return false
  return SUPER_ADMIN_EMAILS.includes(email.toLowerCase())
}

// Permission checks based on role
export function canAccessGarage(user: UserProfile, garageId: string): boolean {
  if (user.role === 'super_admin') return true
  return user.garageId === garageId
}

export function canManageStaff(role: UserRole): boolean {
  return ['super_admin', 'garage_owner'].includes(role)
}

export function canManageJobs(role: UserRole): boolean {
  return ['super_admin', 'garage_owner', 'garage_manager', 'reception'].includes(role)
}

export function canUpdateJobStatus(role: UserRole): boolean {
  return ['super_admin', 'garage_owner', 'garage_manager', 'mechanic'].includes(role)
}

export function canViewAllJobs(role: UserRole): boolean {
  return ['super_admin', 'garage_owner', 'garage_manager', 'reception'].includes(role)
}

export function canViewAssignedJobsOnly(role: UserRole): boolean {
  return role === 'mechanic'
}

export function canCreateInvoice(role: UserRole): boolean {
  return ['super_admin', 'garage_owner', 'garage_manager', 'reception'].includes(role)
}

export function canViewAnalytics(role: UserRole): boolean {
  return ['super_admin', 'garage_owner', 'garage_manager'].includes(role)
}

export function canApproveGarages(role: UserRole): boolean {
  return role === 'super_admin'
}

export function canManageSubscriptions(role: UserRole): boolean {
  return role === 'super_admin'
}

export function canConfigureServices(role: UserRole): boolean {
  return ['super_admin', 'garage_owner'].includes(role)
}

// Get display label for a role
export function getRoleLabel(role: UserRole): string {
  switch (role) {
    case 'super_admin': return 'Super Admin'
    case 'garage_owner': return 'Garage Owner'
    case 'garage_manager': return 'Manager'
    case 'mechanic': return 'Mechanic'
    case 'reception': return 'Reception'
    case 'customer': return 'Customer'
    default: return 'Unknown'
  }
}

// Roles available for a garage owner to assign to their staff
export function getAssignableRoles(): { value: UserRole; label: string }[] {
  return [
    { value: 'garage_manager', label: 'Manager' },
    { value: 'mechanic', label: 'Mechanic' },
    { value: 'reception', label: 'Reception / Front Desk' },
  ]
}
