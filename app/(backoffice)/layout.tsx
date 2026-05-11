import { requireAuth } from '@/lib/auth'
import { Sidebar } from '@/components/layout/sidebar'
import { Topbar } from '@/components/layout/topbar'
import { Toaster } from 'sonner'

export default async function BackofficeLayout({ children }: { children: React.ReactNode }) {
  const user = await requireAuth()

  const roleLabel = user.role === 'ADMIN' ? 'Administrador' : 'Agente'

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      <Sidebar isAdmin={user.role === 'ADMIN'} />

      <div className="flex flex-1 flex-col overflow-hidden">
        <Topbar userName={user.name} userEmail={user.email} userRole={roleLabel} />

        <main className="flex-1 overflow-y-auto bg-background p-6">{children}</main>
      </div>
      <Toaster richColors position="top-right" />
    </div>
  )
}
