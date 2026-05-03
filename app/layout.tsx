import type { Metadata } from 'next'
import { Inter, Fraunces, JetBrains_Mono } from 'next/font/google'
import './globals.css'
import { CookieBanner } from '@/components/cookie-banner'
import { PostHogProvider } from '@/components/posthog-provider'

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
  display: 'swap',
})

const fraunces = Fraunces({
  subsets: ['latin'],
  variable: '--font-fraunces',
  display: 'swap',
  axes: ['opsz', 'SOFT', 'WONK'],
})

const jetbrainsMono = JetBrains_Mono({
  subsets: ['latin'],
  variable: '--font-jetbrains-mono',
  display: 'swap',
})

export const metadata: Metadata = {
  title: 'CampersNova CRM',
  description: 'CRM interno para gestión de compraventa de autocaravanas y campers',
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="es">
      <body
        className={`${inter.variable} ${fraunces.variable} ${jetbrainsMono.variable} min-h-screen font-sans antialiased`}
      >
        <PostHogProvider>{children}</PostHogProvider>
        <CookieBanner />
      </body>
    </html>
  )
}
