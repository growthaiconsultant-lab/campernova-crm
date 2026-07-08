'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { ShieldCheck, ShieldAlert, Check, AlertTriangle, X, Clock, BadgeCheck } from 'lucide-react'
import { grantTrustSeal, revokeTrustSeal } from '@/app/(backoffice)/vendedores/[id]/trust-actions'
import { CHECK_STATE_COLORS, type CheckState, type TrustSection } from '@/lib/trust-passport'

type Props = {
  vehicleId: string
  sections: TrustSection[]
  score: number
  level: 'VERIFICADO' | 'PARCIAL' | 'INCOMPLETO'
  eligibleForSeal: boolean
  blockers: string[]
  sealedAt: string | null
  sealedByName: string | null
}

const STATE_ICON: Record<CheckState, typeof Check> = {
  ok: Check,
  warn: AlertTriangle,
  fail: X,
  pending: Clock,
}

export function TrustPassportPanel(p: Props) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  function grant() {
    setError(null)
    startTransition(async () => {
      const res = await grantTrustSeal(p.vehicleId)
      if (res.error) setError(res.error)
      else router.refresh()
    })
  }
  function revoke() {
    setError(null)
    startTransition(async () => {
      const res = await revokeTrustSeal(p.vehicleId)
      if (res.error) setError(res.error)
      else router.refresh()
    })
  }

  const levelColor =
    p.level === 'VERIFICADO' ? '#1f8a5b' : p.level === 'PARCIAL' ? '#d97706' : '#94a3b8'

  return (
    <div className="overflow-hidden rounded-xl border border-border bg-card">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-6 py-4">
        <h2 className="flex items-center gap-2 text-[14px] font-semibold text-foreground">
          <ShieldCheck className="h-4 w-4 text-muted-foreground" />
          Trust Passport
        </h2>
        <div className="flex items-center gap-2">
          <span
            className="rounded-full px-2.5 py-0.5 text-[11px] font-semibold"
            style={{ background: `${levelColor}1a`, color: levelColor }}
          >
            {p.level} · {p.score}/100
          </span>
        </div>
      </div>

      <div className="space-y-5 p-6">
        {/* Sello */}
        {p.sealedAt ? (
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-emerald-200 bg-emerald-50 p-4 dark:border-emerald-900/40 dark:bg-emerald-950/30">
            <div className="flex items-center gap-2 text-emerald-800 dark:text-emerald-300">
              <BadgeCheck className="h-5 w-5" />
              <div>
                <p className="text-[13px] font-semibold">Verificado por CampersNova</p>
                <p className="text-[11px] text-emerald-700/80 dark:text-emerald-400/70">
                  {new Date(p.sealedAt).toLocaleDateString('es-ES', {
                    day: 'numeric',
                    month: 'long',
                    year: 'numeric',
                    timeZone: 'Europe/Madrid',
                  })}
                  {p.sealedByName ? ` · ${p.sealedByName}` : ''}
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={revoke}
              disabled={pending}
              className="rounded-lg border border-border px-3 py-1.5 text-[12px] font-medium text-muted-foreground hover:bg-muted disabled:opacity-50"
            >
              Revocar
            </button>
          </div>
        ) : p.eligibleForSeal ? (
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-emerald-200 bg-emerald-50/60 p-4">
            <p className="text-[13px] text-emerald-800">
              Cumple todos los requisitos. Puedes emitir el sello de confianza.
            </p>
            <button
              type="button"
              onClick={grant}
              disabled={pending}
              className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-4 py-2 text-[13px] font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
            >
              <BadgeCheck className="h-4 w-4" />
              {pending ? 'Emitiendo…' : 'Emitir sello'}
            </button>
          </div>
        ) : (
          <div className="rounded-lg border border-amber-200 bg-amber-50 p-4">
            <div className="mb-2 flex items-center gap-2 text-[13px] font-semibold text-amber-800">
              <ShieldAlert className="h-4 w-4" />
              Aún no se puede emitir el sello
            </div>
            <ul className="space-y-1">
              {p.blockers.map((b) => (
                <li key={b} className="flex items-start gap-1.5 text-[12px] text-amber-700">
                  <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-amber-500" />
                  {b}
                </li>
              ))}
            </ul>
          </div>
        )}

        {error && <p className="text-[12px] text-red-600">{error}</p>}

        {/* Secciones */}
        {p.sections.map((section) => (
          <div key={section.key}>
            <p className="mb-2 font-mono text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
              {section.title}
            </p>
            <div className="space-y-1.5">
              {section.checks.map((c) => {
                const Icon = STATE_ICON[c.state]
                const color = CHECK_STATE_COLORS[c.state]
                return (
                  <div key={c.label} className="flex items-center gap-2 text-[13px]">
                    <span
                      className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full"
                      style={{ background: `${color}1a`, color }}
                    >
                      <Icon className="h-2.5 w-2.5" />
                    </span>
                    <span className="text-foreground">{c.label}</span>
                    {c.detail && (
                      <span className="text-[11px] text-muted-foreground">· {c.detail}</span>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
