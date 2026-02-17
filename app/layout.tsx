import type { Metadata, Viewport } from 'next'
import { Analytics } from '@vercel/analytics/react'
import './globals.css'
import NetworkStatus from './components/NetworkStatus'

export const metadata: Metadata = {
  metadataBase: new URL('https://petrol-goons-garage.vercel.app'),
  title: 'Petrol Goons — Book Car Services & Garage Platform for Kenya',
  description: 'Book car services in seconds or power your garage with digital tools. Bookings, job tracking, customer records, and revenue tools — all in one platform. Built for Kenya.',
  keywords: ['garage management', 'garage software', 'Kenya', 'Nairobi', 'booking system', 'car service', 'SaaS', 'petrol goons', 'garage platform'],
  authors: [{ name: 'Petrol Goons' }],
  openGraph: {
    title: 'Petrol Goons — Book Car Services & Garage Platform for Kenya',
    description: 'Book car services in seconds or manage your garage digitally. Built for Kenya\'s next generation of garages.',
    url: 'https://petrol-goons-garage.vercel.app',
    siteName: 'Petrol Goons',
    locale: 'en_KE',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Petrol Goons — Book Car Services & Garage Platform for Kenya',
    description: 'Digital bookings, job tracking, customer records & revenue tools. Powering Kenya\'s modern garages.',
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
