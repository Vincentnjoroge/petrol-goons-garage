import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Petrol Goons Garage - Book Your Service',
  description: 'Professional car service booking for Kenya\'s car community',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}
