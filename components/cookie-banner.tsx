'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { X } from 'lucide-react'
import { CONSENT_KEY, CONSENT_EVENT } from '@/lib/consent'

type ConsentValue = 'all' | 'essential'

export function CookieBanner() {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    const sync = () => {
      if (window.CNConsent) {
        setVisible(window.CNConsent.get() === null)
        return
      }
      try {
        setVisible(!localStorage.getItem(CONSENT_KEY))
      } catch {
        setVisible(true)
      }
    }
    sync()
    window.addEventListener('cn:consent-ui', sync)
    return () => window.removeEventListener('cn:consent-ui', sync)
  }, [])

  const accept = (value: ConsentValue) => {
    if (window.CNConsent) {
      window.CNConsent.set(value)
      setVisible(false)
      return
    }
    try {
      localStorage.setItem(CONSENT_KEY, value)
      window.dispatchEvent(new CustomEvent(CONSENT_EVENT, { detail: value }))
    } catch {
      // ignorar
    }
    setVisible(false)
  }

  if (!visible) return null

  return (
    <div
      role="dialog"
      aria-label="Aviso de cookies"
      className="fixed bottom-0 left-0 right-0 z-50 p-4 md:p-6"
    >
      <div className="container mx-auto max-w-4xl">
        <div className="flex flex-col items-start gap-4 rounded-xl border border-[#1a1a1a] bg-[#0a0a0a] p-5 text-white shadow-2xl sm:flex-row sm:items-center">
          <div className="flex-1 text-sm leading-relaxed text-white/85">
            <p>
              Usamos cookies propias <strong className="text-white">técnicas</strong> (necesarias
              para el funcionamiento del sitio) y <strong className="text-white">analíticas</strong>{' '}
              (PostHog y Google Analytics, para mejorar el servicio) y{' '}
              <strong className="text-white">publicitarias</strong> (Meta, para medir nuestros
              anuncios). Puedes aceptar todas o solo las esenciales.{' '}
              <Link
                href="/cookies"
                className="text-[#b59e7d] underline underline-offset-2 hover:text-[#b59e7d]/80"
              >
                Más información
              </Link>
              .
            </p>
          </div>
          <div className="flex flex-shrink-0 items-center gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={() => accept('essential')}
              className="h-8 border-white/30 bg-transparent text-xs text-white hover:bg-white/10"
            >
              Solo esenciales
            </Button>
            <Button
              size="sm"
              onClick={() => accept('all')}
              className="h-8 bg-[#b59e7d] text-xs font-medium text-white hover:bg-[#b59e7d]/90"
            >
              Aceptar todas
            </Button>
            <button
              onClick={() => accept('essential')}
              aria-label="Cerrar"
              className="ml-1 text-white/50 transition-colors hover:text-white"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
