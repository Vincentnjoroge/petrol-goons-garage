// Admin email addresses — add your team's emails here
// Only these accounts can access the admin dashboard
export const ADMIN_EMAILS: string[] = [
  'michaeldiro@gmail.com',
  'mwololokimanthi@gmail.com',
  'thomasaquinas689@gmail.com',
  'viny.njoroge1@gmail.com',
]

// Check if a user email is an admin
export function isAdmin(email: string | null | undefined): boolean {
  if (!email) return false

  // If no admin emails configured yet, allow everyone (for development)
  if (ADMIN_EMAILS.length === 0) return true

  return ADMIN_EMAILS.map(e => e.toLowerCase()).includes(email.toLowerCase())
}
