import { requireAuth } from '@/lib/auth'
import { Sidebar } from '@/components/layout/sidebar'
import { MobileSidebar } from '@/components/layout/mobile-sidebar'
import { Topbar } from '@/components/layout/topbar'
import { CrmMobileTabBar } from '@/components/layout/crm-mobile-tabbar'
import { Toaster } from 'sonner'

const ROLE_LABELS: Record<string, string> = {
  ADMIN: 'Administrador',
  AGENTE: 'Agente',
  TALLER: 'Taller',
  ENTREGAS: 'Entregas',
  MARKETING: 'Marketing',
}

export default async function BackofficeLayout({ children }: { children: React.ReactNode }) {
  const user = await requireAuth()

  const roleLabel = ROLE_LABELS[user.role] ?? user.role

  return (
    <div className="crm-theme flex h-screen overflow-hidden bg-background font-sans text-foreground">
      <Sidebar userRole={user.role} userName={user.name} roleLabel={roleLabel} />

      <div className="flex flex-1 flex-col overflow-hidden">
        {/* Header del shell (mockup 60px): buscador ⌘K + Nuevo lead + campana.
            En móvil, `leading` inyecta la hamburguesa del drawer. */}
        <Topbar
          userName={user.name}
          userEmail={user.email}
          userRole={roleLabel}
          leading={
            <MobileSidebar userRole={user.role} userName={user.name} roleLabel={roleLabel} />
          }
        />

        {/* En móvil, hueco inferior para la tab bar fija (~84px con safe area) */}
        <main className="flex-1 overflow-y-auto bg-canvas p-6 pb-[96px] lg:pb-6">{children}</main>
      </div>
      {/* Tab bar inferior — solo móvil (mockups M*) */}
      <CrmMobileTabBar userRole={user.role} />
      <Toaster richColors position="top-right" />
    </div>
  )
}
