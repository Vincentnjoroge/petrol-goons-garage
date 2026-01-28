import { Booking } from './bookings'

// Email templates
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
        <div class="detail-row">
          <span class="detail-label">Vehicle:</span> ${booking.vinNumber}
        </div>
        <div class="detail-row">
          <span class="detail-label">Service:</span> ${booking.service}${booking.otherService ? ` - ${booking.otherService}` : ''}
        </div>
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
      <p>© 2026 Petrol Goons Garage. Built with ❤️ for Kenya's car community.</p>
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
