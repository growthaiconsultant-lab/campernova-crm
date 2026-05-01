'use client'

import { useState } from 'react'
import { sendMagicLink } from './actions'

interface LoginFormProps {
  callbackError?: string
}

export function LoginForm({ callbackError }: LoginFormProps) {
  const [email, setEmail] = useState('')
  const [status, setStatus] = useState<'idle' | 'loading' | 'sent' | 'error'>(
    callbackError ? 'error' : 'idle'
  )
  const [errorMessage, setErrorMessage] = useState(callbackError ?? '')

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setStatus('loading')
    setErrorMessage('')

    const result = await sendMagicLink(email)

    if (result.error) {
      setStatus('error')
      setErrorMessage(result.error)
    } else {
      setStatus('sent')
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-gray-50 px-4">
      <div className="w-full max-w-sm space-y-6">
        <div className="text-center">
          <h1 className="text-2xl font-bold tracking-tight text-gray-900">CampersNova CRM</h1>
          <p className="mt-1 text-sm text-gray-500">Acceso solo para el equipo interno</p>
        </div>

        <div className="rounded-xl border border-gray-200 bg-white px-8 py-8 shadow-sm">
          {status === 'sent' ? (
            <div className="text-center text-sm text-gray-600">
              <div className="mb-3 text-3xl">📬</div>
              <p className="font-medium text-gray-900">Revisa tu correo</p>
              <p className="mt-1 text-gray-500">
                Hemos enviado un enlace de acceso a{' '}
                <span className="font-medium text-gray-700">{email}</span>.
              </p>
              <button
                onClick={() => {
                  setStatus('idle')
                  setEmail('')
                }}
                className="mt-4 text-xs text-blue-600 hover:underline"
              >
                Usar otro email
              </button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label htmlFor="email" className="block text-sm font-medium text-gray-700">
                  Email
                </label>
                <input
                  id="email"
                  type="email"
                  required
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="tu@campersnova.com"
                  disabled={status === 'loading'}
                  className="mt-1.5 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm shadow-sm placeholder:text-gray-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 disabled:bg-gray-50 disabled:text-gray-400"
                />
              </div>

              {status === 'error' && errorMessage && (
                <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">
                  {errorMessage}
                </p>
              )}

              <button
                type="submit"
                disabled={status === 'loading'}
                className="w-full rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-medium text-white shadow-sm hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500/50 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {status === 'loading' ? 'Enviando…' : 'Enviar enlace de acceso'}
              </button>
            </form>
          )}
        </div>
      </div>
    </main>
  )
}
