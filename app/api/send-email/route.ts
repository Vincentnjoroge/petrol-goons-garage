import { NextRequest, NextResponse } from 'next/server'
import { Resend } from 'resend'

export async function POST(request: NextRequest) {
  try {
    const { to, subject, html } = await request.json()

    // Validate inputs
    if (!to || !subject || !html) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      )
    }

    // Check if Resend API key is configured
    if (!process.env.RESEND_API_KEY) {
      console.log('Email would be sent to:', to)
      console.log('Subject:', subject)
      // Return success but log that email is not configured
      return NextResponse.json({
        success: true,
        data: { message: 'Email service not configured yet - booking saved' }
      })
    }

    const resend = new Resend(process.env.RESEND_API_KEY)

    // Send email
    const data = await resend.emails.send({
      from: 'Petrol Goons Garage <onboarding@resend.dev>',
      to: [to],
      subject,
      html,
    })

    return NextResponse.json({ success: true, data })
  } catch (error: any) {
    console.error('Error sending email:', error)
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    )
  }
}
