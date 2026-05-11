'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { toast } from 'sonner'
import { createUser, updateUser, toggleUserActive } from './actions'

interface UserData {
  id: string
  name: string
  email: string
  role: 'ADMIN' | 'AGENTE'
  active: boolean
  notifyOnNewLead: boolean
}

interface Props {
  mode: 'create' | 'edit'
  user?: UserData
  isSelf?: boolean
  activeLeadCount?: number
}

export function UserForm({ mode, user, isSelf = false, activeLeadCount = 0 }: Props) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [errors, setErrors] = useState<Record<string, string[]>>({})

  const [name, setName] = useState(user?.name ?? '')
  const [email, setEmail] = useState(user?.email ?? '')
  const [role, setRole] = useState<'ADMIN' | 'AGENTE'>(user?.role ?? 'AGENTE')
  const [active, setActive] = useState(user?.active ?? true)
  const [notifyOnNewLead, setNotifyOnNewLead] = useState(user?.notifyOnNewLead ?? true)

  const [showDeactivateWarning, setShowDeactivateWarning] = useState(false)

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setErrors({})

    startTransition(async () => {
      const data = { name, email, role, active, notifyOnNewLead }

      const result = mode === 'create' ? await createUser(data) : await updateUser(user!.id, data)

      if (!result.ok) {
        setErrors(result.fieldErrors ?? {})
        toast.error(result.error)
        return
      }

      toast.success(
        mode === 'create'
          ? 'Usuario creado. Podrá entrar con su email en /login cuando quiera (magic link).'
          : 'Cambios guardados.'
      )
      router.push('/usuarios')
    })
  }

  function handleToggleActive() {
    if (!user) return
    if (!active && activeLeadCount > 0) {
      setShowDeactivateWarning(true)
      return
    }
    startTransition(async () => {
      const result = await toggleUserActive(user.id, !active)
      if (!result.ok) {
        toast.error(result.error)
        return
      }
      setActive((v) => !v)
      toast.success(active ? 'Usuario desactivado.' : 'Usuario reactivado.')
    })
  }

  return (
    <form onSubmit={handleSubmit} className="max-w-lg space-y-5">
      {/* Nombre */}
      <div>
        <label className="mb-1.5 block text-sm font-medium text-cn-teal-900">Nombre</label>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
          minLength={2}
          className="h-10 w-full rounded-lg border border-cn-line bg-white px-3 text-sm focus:outline-none focus:ring-2 focus:ring-cn-teal-900/20"
        />
        {errors.name && <p className="mt-1 text-xs text-red-600">{errors.name[0]}</p>}
      </div>

      {/* Email — solo en creación */}
      {mode === 'create' && (
        <div>
          <label className="mb-1.5 block text-sm font-medium text-cn-teal-900">Email</label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            className="h-10 w-full rounded-lg border border-cn-line bg-white px-3 text-sm focus:outline-none focus:ring-2 focus:ring-cn-teal-900/20"
          />
          {errors.email && <p className="mt-1 text-xs text-red-600">{errors.email[0]}</p>}
        </div>
      )}

      {/* Rol */}
      <div>
        <label className="mb-1.5 block text-sm font-medium text-cn-teal-900">Rol</label>
        <select
          value={role}
          onChange={(e) => setRole(e.target.value as 'ADMIN' | 'AGENTE')}
          disabled={isSelf}
          className="h-10 w-full rounded-lg border border-cn-line bg-white px-3 text-sm focus:outline-none focus:ring-2 focus:ring-cn-teal-900/20 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <option value="AGENTE">Agente</option>
          <option value="ADMIN">Admin</option>
        </select>
        {isSelf && <p className="mt-1 text-xs text-cn-ink-500">No puedes cambiar tu propio rol.</p>}
      </div>

      {/* Checkboxes */}
      <div className="space-y-3 rounded-lg border border-cn-line p-4">
        <label className="flex cursor-pointer items-center gap-3">
          <input
            type="checkbox"
            checked={active}
            onChange={(e) => setActive(e.target.checked)}
            className="h-4 w-4 rounded"
          />
          <span className="text-sm text-cn-ink-700">
            <strong>Activo</strong> — puede acceder al CRM
          </span>
        </label>
        <label className="flex cursor-pointer items-center gap-3">
          <input
            type="checkbox"
            checked={notifyOnNewLead}
            onChange={(e) => setNotifyOnNewLead(e.target.checked)}
            className="h-4 w-4 rounded"
          />
          <span className="text-sm text-cn-ink-700">
            <strong>Notificaciones de leads</strong> — recibe email cuando entra un lead nuevo
          </span>
        </label>
      </div>

      {/* Aviso leads activos */}
      {showDeactivateWarning && activeLeadCount > 0 && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
          Este usuario tiene{' '}
          <strong>
            {activeLeadCount} lead{activeLeadCount > 1 ? 's' : ''} activo
            {activeLeadCount > 1 ? 's' : ''}
          </strong>
          . Reasígnalos antes de desactivar.{' '}
          <Link
            href={`/vendedores?agentId=${user?.id}`}
            className="underline hover:no-underline"
            target="_blank"
          >
            Ver vendedores →
          </Link>
        </div>
      )}

      {/* Acciones */}
      <div className="flex items-center gap-3 pt-2">
        <button
          type="submit"
          disabled={isPending}
          className="rounded-lg bg-cn-teal-900 px-5 py-2.5 text-sm font-medium text-white transition hover:opacity-90 disabled:opacity-50"
        >
          {mode === 'create' ? 'Crear usuario' : 'Guardar cambios'}
        </button>

        {mode === 'edit' && user && (
          <button
            type="button"
            onClick={handleToggleActive}
            disabled={isPending}
            className={`rounded-lg border px-5 py-2.5 text-sm font-medium transition disabled:opacity-50 ${
              user.active
                ? 'border-red-200 text-red-600 hover:bg-red-50'
                : 'border-green-200 text-green-700 hover:bg-green-50'
            }`}
          >
            {user.active ? 'Desactivar usuario' : 'Reactivar usuario'}
          </button>
        )}

        <Link href="/usuarios" className="text-sm text-cn-ink-500 hover:text-cn-teal-900">
          Cancelar
        </Link>
      </div>
    </form>
  )
}
