import { Analytics } from '@vercel/analytics/next'
import type { Metadata, Viewport } from 'next'
import { Dancing_Script, Playfair_Display } from 'next/font/google'
import './globals.css'

const logoSerif = Playfair_Display({ subsets: ['latin'], weight: ['800'], variable: '--font-logo-serif', display: 'swap' })
const logoScript = Dancing_Script({ subsets: ['latin'], weight: ['700'], variable: '--font-logo-script', display: 'swap' })

export const metadata: Metadata = {
  title: 'Chasma Ghar | Shop Dashboard',
  description: 'A simple, fast shop management system for Chasma Ghar.',
  generator: 'v0.app',
  icons: {
    icon: [
      {
        url: '/icon-light-32x32.png',
        media: '(prefers-color-scheme: light)',
      },
      {
        url: '/icon-dark-32x32.png',
      },
      {
        url: '/icon.svg',
        type: 'image/svg+xml',
      },
    ],
    apple: '/apple-icon.png',
  },
}

export const viewport: Viewport = {
  colorScheme: 'light',
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: 'white' },
  ],
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en" className={`${logoSerif.variable} ${logoScript.variable}`}>
      <body className="antialiased">
        {children}
        {process.env.NODE_ENV === 'production' && <Analytics />}
      </body>
    </html>
  )
}
