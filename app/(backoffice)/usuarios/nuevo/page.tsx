import { requireAdmin } from '@/lib/auth'
import { UserForm } from '../user-form'

export const metadata = { title: 'Nuevo usuario · CampersNova CRM' }

export default async function NuevoUsuarioPage() {
  await requireAdmin()
  return (
    <div className="p-6 lg:p-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-cn-teal-900">Nuevo usuario</h1>
        <p className="mt-1 text-sm text-cn-ink-500">
          El usuario podrá entrar con su email en /login cuando quiera (magic link).
        </p>
      </div>
      <UserForm mode="create" />
    </div>
  )
}
