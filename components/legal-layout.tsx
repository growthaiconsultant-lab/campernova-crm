import { PublicNav } from '@/components/public-nav'
import { PublicFooter } from '@/components/public-footer'

interface LegalLayoutProps {
  title: string
  lastUpdated: string
  children: React.ReactNode
}

export function LegalLayout({ title, lastUpdated, children }: LegalLayoutProps) {
  return (
    <div className="flex min-h-screen flex-col bg-background">
      <PublicNav />

      {/* Header */}
      <section className="bg-[#162820] px-4 py-12">
        <div className="container mx-auto max-w-3xl">
          <h1 className="cn-interior-title mb-2 text-3xl font-bold text-white md:text-4xl">
            {title}
          </h1>
          <p className="text-sm text-white/60">Última actualización: {lastUpdated}</p>
        </div>
      </section>

      {/* Content */}
      <main className="flex-1 px-4 py-16">
        <div className="container mx-auto max-w-3xl space-y-6 text-sm leading-relaxed text-foreground">
          {children}
        </div>
      </main>

      <PublicFooter />
    </div>
  )
}
