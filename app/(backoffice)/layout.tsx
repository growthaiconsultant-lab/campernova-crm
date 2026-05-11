import { requireAuth } from '@/lib/auth'
import { Sidebar } from '@/components/layout/sidebar'
import { Topbar } from '@/components/layout/topbar'
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
    <div className="flex h-screen overflow-hidden bg-background">
      <Sidebar userRole={user.role} />

      <div className="flex flex-1 flex-col overflow-hidden">
        <Topbar userName={user.name} userEmail={user.email} userRole={roleLabel} />

        <main className="flex-1 overflow-y-auto bg-background p-6">{children}</main>
      </div>
      <Toaster richColors position="top-right" />
    </div>
  )
}
