import type { Metadata } from 'next'
import './globals.css'

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
      <body className="min-h-screen bg-background font-sans antialiased">{children}</body>
    </html>
  )
}
