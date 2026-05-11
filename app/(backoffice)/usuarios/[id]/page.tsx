import { notFound } from 'next/navigation'
import { requireAdmin } from '@/lib/auth'
import { db } from '@/lib/db'
import { UserForm } from '../user-form'

export const metadata = { title: 'Editar usuario · CampersNova CRM' }

interface Props {
  params: { id: string }
}

export default async function EditarUsuarioPage({ params }: Props) {
  const actor = await requireAdmin()

  const user = await db.user.findUnique({ where: { id: params.id } })
  if (!user) notFound()

  const [sellerCount, buyerCount] = await Promise.all([
    db.sellerLead.count({
      where: { agentId: params.id, status: { notIn: ['CERRADO', 'DESCARTADO'] } },
    }),
    db.buyerLead.count({
      where: { agentId: params.id, status: { notIn: ['CERRADO', 'PERDIDO'] } },
    }),
  ])
  const activeLeadCount = sellerCount + buyerCount

  return (
    <div className="p-6 lg:p-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-cn-teal-900">Editar usuario</h1>
        <p className="mt-1 text-sm text-cn-ink-500">{user.email}</p>
      </div>
      <UserForm
        mode="edit"
        user={user}
        isSelf={actor.id === user.id}
        activeLeadCount={activeLeadCount}
      />
    </div>
  )
}
