import Link from 'next/link'
import { Eyebrow } from '@/components/redesign'
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
    <div>
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <Eyebrow>CRM · Sistema</Eyebrow>
          <h1 className="mt-1 font-hanken text-[23px] font-bold tracking-[-0.02em] text-ink">
            Usuarios
          </h1>
          <p className="mt-1 font-hanken text-[13.5px] text-ink2">
            Gestiona el equipo que accede al CRM.
          </p>
        </div>
        <Link
          href="/usuarios/nuevo"
          className="inline-flex items-center gap-[7px] rounded-[10px] bg-brand px-[15px] py-[10px] font-hanken text-[13px] font-semibold text-white transition-colors hover:bg-brand2"
        >
          <UserPlus size={15} strokeWidth={2.2} />
          Nuevo usuario
        </Link>
      </div>

      <div className="overflow-x-auto rounded-[14px] border border-line bg-card">
        <table className="w-full min-w-[640px] text-sm">
          <thead>
            <tr className="border-y border-line2">
              <th className="px-5 py-2.5 text-left font-mono text-[10.5px] font-semibold uppercase tracking-[0.04em] text-ink3">
                Nombre
              </th>
              <th className="px-5 py-2.5 text-left font-mono text-[10.5px] font-semibold uppercase tracking-[0.04em] text-ink3">
                Email
              </th>
              <th className="px-5 py-2.5 text-left font-mono text-[10.5px] font-semibold uppercase tracking-[0.04em] text-ink3">
                Rol
              </th>
              <th className="px-5 py-2.5 text-center font-mono text-[10.5px] font-semibold uppercase tracking-[0.04em] text-ink3">
                Activo
              </th>
              <th className="px-5 py-2.5 text-center font-mono text-[10.5px] font-semibold uppercase tracking-[0.04em] text-ink3">
                Notif. leads
              </th>
              <th className="px-5 py-2.5 text-right font-mono text-[10.5px] font-semibold uppercase tracking-[0.04em] text-ink3">
                Acciones
              </th>
            </tr>
          </thead>
          <tbody>
            {users.map((user) => (
              <tr key={user.id} className="border-b border-line2 last:border-0">
                <td className="px-5 py-3.5 font-medium text-ink">
                  <span className={user.active ? '' : 'opacity-50'}>{user.name}</span>
                </td>
                <td className="px-5 py-3.5 text-ink2">{user.email}</td>
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
                  <Link href={`/usuarios/${user.id}`} className="text-brand hover:underline">
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
  ADMIN: { label: 'Admin', className: 'bg-primary/10 text-primary' },
  AGENTE: { label: 'Agente', className: 'bg-secondary text-secondary-foreground' },
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
