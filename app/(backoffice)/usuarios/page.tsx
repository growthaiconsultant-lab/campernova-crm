import Link from 'next/link'
import { requireAdmin } from '@/lib/auth'
import { db } from '@/lib/db'
import { UserPlus } from 'lucide-react'
import { UserToggleButton } from './user-toggle-button'

export const metadata = { title: 'Usuarios · CampersNova CRM' }

export default async function UsuariosPage() {
  await requireAdmin()

  const users = await db.user.findMany({
    orderBy: [{ active: 'desc' }, { role: 'asc' }, { name: 'asc' }],
  })

  return (
    <div className="p-6 lg:p-8">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-cn-teal-900">Usuarios</h1>
          <p className="mt-1 text-sm text-cn-ink-500">Gestiona el equipo que accede al CRM.</p>
        </div>
        <Link
          href="/usuarios/nuevo"
          className="inline-flex items-center gap-2 rounded-lg bg-cn-teal-900 px-4 py-2.5 text-sm font-medium text-white transition hover:opacity-90"
        >
          <UserPlus className="h-4 w-4" />
          Nuevo usuario
        </Link>
      </div>

      <div className="overflow-hidden rounded-xl border border-cn-line bg-white">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-cn-line bg-cn-cream-50">
              <th className="px-5 py-3 text-left font-medium text-cn-ink-500">Nombre</th>
              <th className="px-5 py-3 text-left font-medium text-cn-ink-500">Email</th>
              <th className="px-5 py-3 text-left font-medium text-cn-ink-500">Rol</th>
              <th className="px-5 py-3 text-center font-medium text-cn-ink-500">Activo</th>
              <th className="px-5 py-3 text-center font-medium text-cn-ink-500">Notif. leads</th>
              <th className="px-5 py-3 text-right font-medium text-cn-ink-500">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {users.map((user) => (
              <tr key={user.id} className="border-b border-cn-line last:border-0">
                <td className="px-5 py-3.5 font-medium text-cn-teal-900">
                  <span className={user.active ? '' : 'opacity-50'}>{user.name}</span>
                </td>
                <td className="px-5 py-3.5 text-cn-ink-700">{user.email}</td>
                <td className="px-5 py-3.5">
                  <RoleBadge role={user.role} />
                </td>
                <td className="px-5 py-3.5 text-center">
                  <UserToggleButton userId={user.id} field="active" value={user.active} />
                </td>
                <td className="px-5 py-3.5 text-center">
                  <UserToggleButton
                    userId={user.id}
                    field="notifyOnNewLead"
                    value={user.notifyOnNewLead}
                  />
                </td>
                <td className="px-5 py-3.5 text-right">
                  <Link href={`/usuarios/${user.id}`} className="text-cn-teal-700 hover:underline">
                    Editar
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

const ROLE_BADGE: Record<string, { label: string; className: string }> = {
  ADMIN: { label: 'Admin', className: 'bg-blue-950 text-white' },
  AGENTE: { label: 'Agente', className: 'bg-cn-teal-900/10 text-cn-teal-900' },
  TALLER: { label: 'Taller', className: 'bg-amber-100 text-amber-800' },
  ENTREGAS: { label: 'Entregas', className: 'bg-indigo-100 text-indigo-800' },
  MARKETING: { label: 'Marketing', className: 'bg-pink-100 text-pink-800' },
}

function RoleBadge({ role }: { role: string }) {
  const badge = ROLE_BADGE[role] ?? { label: role, className: 'bg-gray-100 text-gray-700' }
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${badge.className}`}
    >
      {badge.label}
    </span>
  )
}
