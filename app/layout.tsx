import type { Metadata, Viewport } from 'next'
import { Analytics } from '@vercel/analytics/react'
import './globals.css'
import NetworkStatus from './components/NetworkStatus'

export const metadata: Metadata = {
  metadataBase: new URL('https://petrol-goons-garage.vercel.app'),
  title: 'Petrol Goons Garage — Book Your Car Service',
  description: 'Book your car service in 30 seconds. Oil change, brakes, suspension, diagnostics & more. No upfront payment. Nairobi\'s car culture, refined.',
  keywords: ['car service', 'garage', 'Nairobi', 'Kenya', 'oil change', 'brake pads', 'car mechanic', 'book mechanic', 'petrol goons'],
  authors: [{ name: 'Petrol Goons Garage' }],
  openGraph: {
    title: 'Petrol Goons Garage — Book Your Car Service',
    description: 'Book your car service in 30 seconds. No more showing up and waiting. Book ahead, we prep everything, you drive in and out.',
    url: 'https://petrol-goons-garage.vercel.app',
    siteName: 'Petrol Goons Garage',
    locale: 'en_KE',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Petrol Goons Garage — Book Your Car Service',
    description: 'Book your car service in 30 seconds. Oil change, brakes, suspension, diagnostics & more.',
  },
  manifest: '/manifest.json',
  robots: {
    index: true,
    follow: true,
  },
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  themeColor: '#0A0A0A',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <head>
        <link rel="icon" href="/icons/icon-192.svg" type="image/svg+xml" />
        <link rel="apple-touch-icon" href="/icons/icon-192.svg" />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <meta name="apple-mobile-web-app-title" content="Petrol Goons" />
      </head>
      <body className="antialiased">
        <NetworkStatus />
        {children}
        <Analytics />
      </body>
    </html>
  )
}
