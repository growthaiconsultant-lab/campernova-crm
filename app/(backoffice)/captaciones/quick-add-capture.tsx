'use client'

import { useRef, useState } from 'react'
import Link from 'next/link'
import { Plus } from 'lucide-react'
import { createCapture } from './actions'
import { PORTAL_OPTIONS } from '@/lib/captacion'

type Duplicate = { kind: 'capture'; id: string } | { kind: 'seller'; id: string; name: string }

export function QuickAddCapture({ onOpenCapture }: { onOpenCapture: (id: string) => void }) {
  const [pending, setPending] = useState(false)
  const submitting = useRef(false)
  const [url, setUrl] = useState('')
  const [phone, setPhone] = useState('')
  const [portal, setPortal] = useState('WALLAPOP')
  const [price, setPrice] = useState('')
  const [title, setTitle] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [dup, setDup] = useState<Duplicate | null>(null)

  function reset() {
    setUrl('')
    setPhone('')
    setPrice('')
    setTitle('')
    setDup(null)
  }

  async function submit(allowDuplicate: boolean) {
    if (submitting.current) return
    submitting.current = true
    setPending(true)
    setError(null)
    try {
      const res = await createCapture(
        {
          listingUrl: url,
          phone,
          portal,
          title: title || null,
          askingPrice: price ? parseFloat(price) : null,
        },
        allowDuplicate
      )
      if (res.duplicate) {
        setDup(res.duplicate)
      } else if (res.error) {
        setError(res.error)
      } else if (res.id) {
        reset()
        onOpenCapture(res.id)
      }
    } catch {
      setError('No se pudo confirmar el alta. Comprueba el listado antes de volver a intentarlo.')
    } finally {
      submitting.current = false
      setPending(false)
    }
  }

  const inputCls =
    'w-full min-w-0 rounded-lg border border-line bg-background px-3 py-2 text-[13px] outline-none focus:ring-2 focus:ring-ring'

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault()
        if (!pending) submit(false)
      }}
      className="space-y-3"
    >
      <fieldset disabled={pending} className="grid gap-3 sm:grid-cols-2">
        <label className="grid gap-1 text-sm sm:col-span-2">
          Enlace del anuncio
          <input
            type="text"
            inputMode="url"
            value={url}
            onChange={(e) => {
              setUrl(e.target.value)
              setDup(null)
            }}
            placeholder="Pegar enlace del portal"
            className={inputCls}
          />
        </label>
        <label className="grid gap-1 text-sm">
          Portal
          <select value={portal} onChange={(e) => setPortal(e.target.value)} className={inputCls}>
            {PORTAL_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </label>
        <label className="grid gap-1 text-sm">
          Teléfono
          <input
            type="tel"
            value={phone}
            onChange={(e) => {
              setPhone(e.target.value)
              setDup(null)
            }}
            className={inputCls}
          />
        </label>
        <label className="grid gap-1 text-sm">
          Modelo
          <input value={title} onChange={(e) => setTitle(e.target.value)} className={inputCls} />
        </label>
        <label className="grid gap-1 text-sm">
          Precio anunciado (€)
          <input
            type="number"
            min="0"
            step="0.01"
            value={price}
            onChange={(e) => setPrice(e.target.value)}
            className={inputCls}
          />
        </label>
        <button
          type="submit"
          className="inline-flex items-center justify-center gap-2 rounded-md bg-brand px-4 py-2 text-sm font-semibold text-white sm:col-span-2"
        >
          <Plus size={15} />
          {pending ? 'Guardando…' : 'Guardar captación'}
        </button>
      </fieldset>
      {error && <p className="mt-2 text-[12px] text-red-600">{error}</p>}

      {dup && (
        <div className="mt-2 rounded-lg border border-amber-300 bg-amber-50 p-3 text-[13px]">
          <p className="font-medium text-amber-800">Ya existe algo con este teléfono</p>
          <p className="mt-1 text-amber-700">
            {dup.kind === 'capture' ? (
              <>
                Hay otra captación abierta con este teléfono.{' '}
                <button
                  type="button"
                  className="font-semibold underline"
                  onClick={() => onOpenCapture(dup.id)}
                >
                  Ver captación
                </button>
              </>
            ) : (
              <>
                Ya es un vendedor en el sistema:{' '}
                <Link
                  href={`/vendedores/${dup.id}`}
                  className="font-semibold underline underline-offset-2"
                >
                  {dup.name}
                </Link>
                .
              </>
            )}
          </p>
          <button
            type="button"
            onClick={() => submit(true)}
            disabled={pending}
            className="mt-2 rounded-lg border border-amber-300 px-3 py-1.5 text-[12px] font-medium text-amber-800 hover:bg-amber-100 disabled:opacity-50"
          >
            Captar de todas formas
          </button>
        </div>
      )}
    </form>
  )
}
