'use client'

import { useState, useTransition } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Plus } from 'lucide-react'
import { createCapture } from './actions'
import { PORTAL_OPTIONS } from '@/lib/captacion'

type Duplicate = { kind: 'capture'; id: string } | { kind: 'seller'; id: string; name: string }

export function QuickAddCapture() {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
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

  function submit(allowDuplicate: boolean) {
    setError(null)
    startTransition(async () => {
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
      } else {
        reset()
        router.refresh()
      }
    })
  }

  const inputCls =
    'rounded-lg border border-[#e6e9ee] bg-white px-3 py-2 text-[13px] outline-none focus:ring-2 focus:ring-ring'

  return (
    <div className="rounded-xl border border-[#e6e9ee] bg-white p-3">
      <div className="flex flex-wrap items-center gap-2">
        <input
          value={url}
          onChange={(e) => {
            setUrl(e.target.value)
            setDup(null)
          }}
          placeholder="Pega el link del anuncio (Wallapop, Coches.net…)"
          className={`${inputCls} min-w-[220px] flex-1`}
        />
        <input
          value={phone}
          onChange={(e) => {
            setPhone(e.target.value)
            setDup(null)
          }}
          placeholder="Teléfono"
          className={`${inputCls} w-[130px]`}
        />
        <select value={portal} onChange={(e) => setPortal(e.target.value)} className={inputCls}>
          {PORTAL_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Modelo (opcional)"
          className={`${inputCls} w-[150px]`}
        />
        <input
          value={price}
          onChange={(e) => setPrice(e.target.value)}
          type="number"
          placeholder="Precio €"
          className={`${inputCls} w-[100px]`}
        />
        <button
          type="button"
          onClick={() => submit(false)}
          disabled={pending}
          className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-[13px] font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-50"
        >
          <Plus className="h-4 w-4" />
          Captar
        </button>
      </div>

      {error && <p className="mt-2 text-[12px] text-red-600">{error}</p>}

      {dup && (
        <div className="mt-2 rounded-lg border border-amber-300 bg-amber-50 p-3 text-[13px]">
          <p className="font-medium text-amber-800">Ya existe algo con este teléfono</p>
          <p className="mt-1 text-amber-700">
            {dup.kind === 'capture' ? (
              <>Hay otra captación viva con este teléfono. Revisa si es el mismo vehículo.</>
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
    </div>
  )
}
