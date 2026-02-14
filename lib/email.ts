import { Booking } from './bookings'

// Booking received email — sent immediately when customer submits a request
export function getBookingReceivedEmailHtml(booking: Booking): string {
  const dateFormatted = new Date(booking.preferredDate).toLocaleDateString('en-KE', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric'
  })

  return `
<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; }
    .container { max-width: 600px; margin: 0 auto; }
    .header { background: #0A0A0A; color: white; padding: 30px; text-align: center; }
    .header .brand { color: #FDB913; font-size: 24px; font-weight: bold; }
    .header .subtitle { color: #6B7280; font-size: 18px; margin-top: 4px; }
    .content { background: white; padding: 30px; border: 1px solid #e5e7eb; }
    .received-badge { background: #FEF3C7; color: #92400E; padding: 12px 24px; border-radius: 8px; text-align: center; font-weight: bold; font-size: 18px; margin: 20px 0; }
    .booking-details { background: #f9fafb; padding: 20px; border-radius: 8px; margin: 20px 0; }
    .detail-row { margin: 10px 0; }
    .detail-label { font-weight: bold; color: #6B7280; }
    .footer { text-align: center; padding: 20px; color: #6B7280; font-size: 14px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <div class="brand">PETROL GOONS</div>
      <div class="subtitle">GARAGE</div>
    </div>

    <div class="content">
      <div class="received-badge">📋 Request Received!</div>

      <p>Hi ${booking.customerName},</p>
      <p>We've received your booking request! Our team is reviewing it now and will confirm shortly.</p>

      <div class="booking-details">
        <h3 style="margin-top: 0;">Your Request</h3>
        <div class="detail-row">
          <span class="detail-label">📅 Date:</span> ${dateFormatted}
        </div>
        <div class="detail-row">
          <span class="detail-label">🕐 Time:</span> ${booking.preferredTime}
        </div>
        ${booking.service ? `<div class="detail-row"><span class="detail-label">🔧 Service:</span> ${booking.service}${booking.otherService ? ` — ${booking.otherService}` : ''}</div>` : ''}
        ${booking.vinNumber ? `<div class="detail-row"><span class="detail-label">🚗 Vehicle:</span> ${booking.vinNumber}</div>` : ''}
        ${booking.description ? `<div class="detail-row"><span class="detail-label">📝 Notes:</span> ${booking.description}</div>` : ''}
      </div>

      <p><strong>What happens next:</strong></p>
      <ul>
        <li>Our team reviews your request and preps for your visit</li>
        <li>You'll get a confirmation email once approved</li>
        <li>No payment needed until after service is done</li>
      </ul>

      <p>Questions? DM us on Instagram <strong>@petrol_goons</strong></p>

      <p>Talk soon! 🏁<br><strong>The Petrol Goons Team</strong></p>
    </div>

    <div class="footer">
      <p>&copy; 2026 Petrol Goons Garage. Built with ❤️ for Kenya's car community.</p>
      <p>Instagram: @petrol_goons</p>
    </div>
  </div>
</body>
</html>
  `
}

// Admin notification email — sent to team when a new booking comes in
export function getNewBookingAdminEmailHtml(booking: Booking): string {
  const dateFormatted = new Date(booking.preferredDate).toLocaleDateString('en-KE', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  })

  return `
<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; }
    .container { max-width: 600px; margin: 0 auto; }
    .header { background: #0A0A0A; color: white; padding: 20px; text-align: center; }
    .header .brand { color: #FDB913; font-size: 20px; font-weight: bold; }
    .content { background: white; padding: 24px; border: 1px solid #e5e7eb; }
    .alert { background: #FDB913; color: #0A0A0A; padding: 12px 24px; border-radius: 8px; text-align: center; font-weight: bold; font-size: 16px; margin: 16px 0; }
    .details { background: #f9fafb; padding: 16px; border-radius: 8px; margin: 16px 0; }
    .detail-row { margin: 8px 0; font-size: 14px; }
    .detail-label { font-weight: bold; color: #6B7280; }
    .cta-button { display: inline-block; background: #FDB913; color: #0A0A0A; padding: 12px 28px; text-decoration: none; border-radius: 8px; font-weight: bold; margin: 16px 0; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <div class="brand">PETROL GOONS — NEW BOOKING</div>
    </div>
    <div class="content">
      <div class="alert">New Booking Request</div>
      <div class="details">
        <div class="detail-row"><span class="detail-label">Customer:</span> ${booking.customerName}</div>
        <div class="detail-row"><span class="detail-label">Date:</span> ${dateFormatted} @ ${booking.preferredTime}</div>
        ${booking.service ? `<div class="detail-row"><span class="detail-label">Service:</span> ${booking.service}${booking.otherService ? ` — ${booking.otherService}` : ''}</div>` : ''}
        ${booking.vinNumber ? `<div class="detail-row"><span class="detail-label">VIN:</span> ${booking.vinNumber}</div>` : ''}
        ${booking.description ? `<div class="detail-row"><span class="detail-label">Issue:</span> ${booking.description}</div>` : ''}
        ${booking.customerEmail ? `<div class="detail-row"><span class="detail-label">Email:</span> ${booking.customerEmail}</div>` : ''}
        ${booking.photos && booking.photos.length > 0 ? `<div class="detail-row"><span class="detail-label">Photos:</span> ${booking.photos.length} attached</div>` : ''}
      </div>
      <p style="text-align: center;">
        <a href="https://petrol-goons-garage.vercel.app/dashboard" class="cta-button">Review in Dashboard</a>
      </p>
    </div>
  </div>
</body>
</html>
  `
}

// Admin-approval confirmation email (kept for manual approvals of old pending bookings)
export function getBookingConfirmationEmailHtml(booking: Booking): string {
  return `
<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background: #0A0A0A; color: white; padding: 30px; text-align: center; }
    .header h1 { margin: 0; }
    .header .brand { color: #FDB913; font-size: 24px; font-weight: bold; }
    .header .subtitle { color: #6B7280; font-size: 18px; }
    .content { background: white; padding: 30px; border: 1px solid #e5e7eb; }
    .booking-details { background: #f9fafb; padding: 20px; border-radius: 8px; margin: 20px 0; }
    .detail-row { margin: 10px 0; }
    .detail-label { font-weight: bold; color: #6B7280; }
    .button { display: inline-block; background: #FDB913; color: #0A0A0A; padding: 12px 30px; text-decoration: none; border-radius: 6px; font-weight: bold; margin: 20px 0; }
    .footer { text-align: center; padding: 20px; color: #6B7280; font-size: 14px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1><span class="brand">PETROL GOONS</span></h1>
      <p class="subtitle">GARAGE</p>
    </div>

    <div class="content">
      <h2>🎉 Your Booking is Confirmed!</h2>
      <p>Hi ${booking.customerName},</p>
      <p>Great news! Your service booking has been approved and confirmed.</p>

      <div class="booking-details">
        <h3>Booking Details</h3>
        ${booking.vinNumber ? `<div class="detail-row"><span class="detail-label">Vehicle:</span> ${booking.vinNumber}</div>` : ''}
        ${booking.service ? `<div class="detail-row"><span class="detail-label">Service:</span> ${booking.service}${booking.otherService ? ` - ${booking.otherService}` : ''}</div>` : ''}
        <div class="detail-row">
          <span class="detail-label">Date:</span> ${booking.preferredDate}
        </div>
        <div class="detail-row">
          <span class="detail-label">Time:</span> ${booking.preferredTime}
        </div>
        ${booking.description ? `<div class="detail-row"><span class="detail-label">Notes:</span> ${booking.description}</div>` : ''}
      </div>

      <p><strong>What to bring:</strong></p>
      <ul>
        <li>Your vehicle registration documents</li>
        <li>Any previous service records (if available)</li>
        <li>Payment for the service</li>
      </ul>

      <p>If you need to reschedule or have any questions, please contact us as soon as possible.</p>

      <p>We look forward to serving you!</p>

      <p>Best regards,<br>The Petrol Goons Team</p>
    </div>

    <div class="footer">
      <p>&copy; 2026 Petrol Goons Garage. Built with ❤️ for Kenya's car community.</p>
      <p>Instagram: @petrol_goons</p>
    </div>
  </div>
</body>
</html>
  `
}

export function getBookingRejectionEmailHtml(booking: Booking): string {
  return `
<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background: #0A0A0A; color: white; padding: 30px; text-align: center; }
    .header h1 { margin: 0; }
    .header .brand { color: #FDB913; font-size: 24px; font-weight: bold; }
    .header .subtitle { color: #6B7280; font-size: 18px; }
    .content { background: white; padding: 30px; border: 1px solid #e5e7eb; }
    .footer { text-align: center; padding: 20px; color: #6B7280; font-size: 14px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1><span class="brand">PETROL GOONS</span></h1>
      <p class="subtitle">GARAGE</p>
    </div>

    <div class="content">
      <h2>Booking Update</h2>
      <p>Hi ${booking.customerName},</p>
      <p>Unfortunately, we're unable to accommodate your booking request for ${booking.preferredDate} at ${booking.preferredTime}.</p>
      <p>This could be due to our schedule being fully booked or the service requiring specialized attention.</p>
      <p>Please contact us directly to discuss alternative dates or to learn more about your service needs. We're here to help!</p>
      <p>Best regards,<br>The Petrol Goons Team</p>
    </div>

    <div class="footer">
      <p>© 2026 Petrol Goons Garage. Built with ❤️ for Kenya's car community.</p>
      <p>Instagram: @petrol_goons</p>
    </div>
  </div>
</body>
</html>
  `
}

// Reschedule email — sent when admin suggests a different date/time
export function getBookingRescheduledEmailHtml(booking: Booking, newDate: string, newTime: string): string {
  const oldDateFormatted = new Date(booking.preferredDate).toLocaleDateString('en-KE', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric'
  })
  const newDateFormatted = new Date(newDate).toLocaleDateString('en-KE', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric'
  })

  return `
<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; }
    .container { max-width: 600px; margin: 0 auto; }
    .header { background: #0A0A0A; color: white; padding: 30px; text-align: center; }
    .header .brand { color: #FDB913; font-size: 24px; font-weight: bold; }
    .header .subtitle { color: #6B7280; font-size: 18px; margin-top: 4px; }
    .content { background: white; padding: 30px; border: 1px solid #e5e7eb; }
    .reschedule-badge { background: #FEF3C7; color: #92400E; padding: 12px 24px; border-radius: 8px; text-align: center; font-weight: bold; font-size: 18px; margin: 20px 0; }
    .time-change { display: flex; align-items: center; gap: 16px; margin: 20px 0; }
    .old-time { background: #FEE2E2; color: #991B1B; padding: 12px 20px; border-radius: 8px; text-decoration: line-through; flex: 1; text-align: center; }
    .new-time { background: #D1FAE5; color: #065F46; padding: 12px 20px; border-radius: 8px; font-weight: bold; flex: 1; text-align: center; }
    .arrow { font-size: 24px; color: #6B7280; }
    .cta-button { display: inline-block; background: #FDB913; color: #0A0A0A; padding: 14px 32px; text-decoration: none; border-radius: 8px; font-weight: bold; margin: 20px 0; }
    .footer { text-align: center; padding: 20px; color: #6B7280; font-size: 14px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <div class="brand">PETROL GOONS</div>
      <div class="subtitle">GARAGE</div>
    </div>

    <div class="content">
      <div class="reschedule-badge">📅 Booking Rescheduled</div>

      <p>Hi ${booking.customerName},</p>
      <p>We've rescheduled your booking to a new time. Here are the updated details:</p>

      <table width="100%" cellpadding="0" cellspacing="0" style="margin: 20px 0;">
        <tr>
          <td style="background: #FEE2E2; color: #991B1B; padding: 12px 16px; border-radius: 8px; text-align: center; text-decoration: line-through; width: 42%;">
            ${oldDateFormatted}<br>${booking.preferredTime}
          </td>
          <td style="text-align: center; font-size: 24px; color: #6B7280; width: 16%;">→</td>
          <td style="background: #D1FAE5; color: #065F46; padding: 12px 16px; border-radius: 8px; text-align: center; font-weight: bold; width: 42%;">
            ${newDateFormatted}<br>${newTime}
          </td>
        </tr>
      </table>

      ${booking.service ? `<p><strong>Service:</strong> ${booking.service}${booking.otherService ? ` — ${booking.otherService}` : ''}</p>` : ''}

      <p>Your booking is <strong>confirmed</strong> for the new time above. No need to re-book!</p>

      <p style="text-align: center;">
        <a href="https://petrol-goons-garage.vercel.app/my-bookings" class="cta-button">View My Bookings</a>
      </p>

      <p>Questions? DM us on Instagram <strong>@petrol_goons</strong></p>

      <p>See you soon! 🏁<br><strong>The Petrol Goons Team</strong></p>
    </div>

    <div class="footer">
      <p>&copy; 2026 Petrol Goons Garage. Built with ❤️ for Kenya's car community.</p>
      <p>Instagram: @petrol_goons</p>
    </div>
  </div>
</body>
</html>
  `
}

// Service completed email — sent when mechanic marks a job as done
export function getServiceCompletedEmailHtml(booking: Booking, serviceNotes?: string): string {
  const dateFormatted = new Date(booking.preferredDate).toLocaleDateString('en-KE', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric'
  })

  return `
<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; }
    .container { max-width: 600px; margin: 0 auto; }
    .header { background: #0A0A0A; color: white; padding: 30px; text-align: center; }
    .header .brand { color: #FDB913; font-size: 24px; font-weight: bold; }
    .header .subtitle { color: #6B7280; font-size: 18px; margin-top: 4px; }
    .content { background: white; padding: 30px; border: 1px solid #e5e7eb; }
    .completed-badge { background: #DBEAFE; color: #1E40AF; padding: 12px 24px; border-radius: 8px; text-align: center; font-weight: bold; font-size: 18px; margin: 20px 0; }
    .booking-details { background: #f9fafb; padding: 20px; border-radius: 8px; margin: 20px 0; }
    .service-notes { background: #EFF6FF; padding: 16px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #3B82F6; }
    .detail-row { margin: 10px 0; }
    .detail-label { font-weight: bold; color: #6B7280; }
    .cta-button { display: inline-block; background: #FDB913; color: #0A0A0A; padding: 14px 32px; text-decoration: none; border-radius: 8px; font-weight: bold; margin: 20px 0; }
    .footer { text-align: center; padding: 20px; color: #6B7280; font-size: 14px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <div class="brand">PETROL GOONS</div>
      <div class="subtitle">GARAGE</div>
    </div>

    <div class="content">
      <div class="completed-badge">Service Complete</div>

      <p>Hi ${booking.customerName},</p>
      <p>Your service on <strong>${dateFormatted}</strong> has been completed. Here's a summary of what was done:</p>

      <div class="booking-details">
        <h3 style="margin-top: 0;">Service Summary</h3>
        ${booking.service ? `<div class="detail-row"><span class="detail-label">Service:</span> ${booking.service}${booking.otherService ? ` — ${booking.otherService}` : ''}</div>` : ''}
        ${booking.vinNumber ? `<div class="detail-row"><span class="detail-label">Vehicle:</span> ${booking.vinNumber}</div>` : ''}
        <div class="detail-row">
          <span class="detail-label">Date:</span> ${dateFormatted}
        </div>
      </div>

      ${serviceNotes ? `
      <div class="service-notes">
        <p style="margin: 0 0 8px 0; font-weight: bold; color: #1E40AF;">Mechanic's Notes:</p>
        <p style="margin: 0; color: #1E3A5F;">${serviceNotes}</p>
      </div>
      ` : ''}

      <p>This service has been saved to your service history. You can view all your records anytime.</p>

      <p style="text-align: center;">
        <a href="https://petrol-goons-garage.vercel.app/my-bookings" class="cta-button">View Service History</a>
      </p>

      <p>Thanks for choosing Petrol Goons! We recommend your next service in <strong>3-6 months</strong> depending on usage. We'll send you a reminder when it's time.</p>

      <p>Drive safe! 🏁<br><strong>The Petrol Goons Team</strong></p>
    </div>

    <div class="footer">
      <p>&copy; 2026 Petrol Goons Garage. Built with ❤️ for Kenya's car community.</p>
      <p>Instagram: @petrol_goons</p>
    </div>
  </div>
</body>
</html>
  `
}

// Service reminder email — sent when it's time for another visit
export function getServiceReminderEmailHtml(customerName: string, lastService: string, lastDate: string, vinNumber?: string): string {
  return `
<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; }
    .container { max-width: 600px; margin: 0 auto; }
    .header { background: #0A0A0A; color: white; padding: 30px; text-align: center; }
    .header .brand { color: #FDB913; font-size: 24px; font-weight: bold; }
    .header .subtitle { color: #6B7280; font-size: 18px; margin-top: 4px; }
    .content { background: white; padding: 30px; border: 1px solid #e5e7eb; }
    .reminder-badge { background: #FEF3C7; color: #92400E; padding: 12px 24px; border-radius: 8px; text-align: center; font-weight: bold; font-size: 18px; margin: 20px 0; }
    .cta-button { display: inline-block; background: #FDB913; color: #0A0A0A; padding: 14px 32px; text-decoration: none; border-radius: 8px; font-weight: bold; margin: 20px 0; }
    .footer { text-align: center; padding: 20px; color: #6B7280; font-size: 14px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <div class="brand">PETROL GOONS</div>
      <div class="subtitle">GARAGE</div>
    </div>

    <div class="content">
      <div class="reminder-badge">Time for a Check-up</div>

      <p>Hi ${customerName},</p>
      <p>It's been a while since your last visit! Your <strong>${lastService}</strong>${vinNumber ? ` for vehicle <strong>${vinNumber}</strong>` : ''} was on <strong>${lastDate}</strong>.</p>

      <p>Regular servicing keeps your car running smooth and prevents costly breakdowns. We recommend booking your next appointment soon.</p>

      <p style="text-align: center;">
        <a href="https://petrol-goons-garage.vercel.app" class="cta-button">Book Your Next Service</a>
      </p>

      <p>See you soon! 🏁<br><strong>The Petrol Goons Team</strong></p>
    </div>

    <div class="footer">
      <p>&copy; 2026 Petrol Goons Garage. Built with ❤️ for Kenya's car community.</p>
      <p>Instagram: @petrol_goons</p>
    </div>
  </div>
</body>
</html>
  `
}

// Send email via API route
export async function sendBookingEmail(
  to: string,
  subject: string,
  html: string
) {
  try {
    const response = await fetch('/api/send-email', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ to, subject, html }),
    })

    if (!response.ok) {
      throw new Error('Failed to send email')
    }

    return { success: true }
  } catch (error: any) {
    console.error('Error sending email:', error)
    return { success: false, error: error.message }
  }
}
