import { requireAuth } from '@/lib/auth'
import { Sidebar } from '@/components/layout/sidebar'
import { Topbar } from '@/components/layout/topbar'

export default async function BackofficeLayout({ children }: { children: React.ReactNode }) {
  const user = await requireAuth()

  const roleLabel = user.role === 'ADMIN' ? 'Administrador' : 'Agente'

  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar />

      <div className="flex flex-1 flex-col overflow-hidden">
        <Topbar userName={user.name} userEmail={user.email} userRole={roleLabel} />

        <main className="flex-1 overflow-y-auto p-6">{children}</main>
      </div>
    </div>
  )
}
