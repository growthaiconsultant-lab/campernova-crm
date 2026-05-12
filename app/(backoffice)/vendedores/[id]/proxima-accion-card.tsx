'use client'

import { Phone, MessageCircle } from 'lucide-react'
import { logWhatsApp } from '@/app/(backoffice)/whatsapp-actions'
import { buildWhatsAppUrl, sellerWhatsAppMessage } from '@/lib/whatsapp'

type NextAction = {
  title: string
  description: string
  urgency: 'urgente' | 'alta' | 'normal'
}

type Props = {
  phone: string | null
  leadId: string
  leadName: string
  vehicleInfo?: { type: string; brand: string; model: string }
  nextAction: NextAction
}

export function ProximaAccionCard({ phone, leadId, leadName, vehicleInfo, nextAction }: Props) {
  function handleWhatsApp() {
    if (!phone) return
    logWhatsApp({ leadId, leadType: 'seller', phone }).catch(console.error)
    window.open(
      buildWhatsAppUrl(phone, sellerWhatsAppMessage(leadName, vehicleInfo)),
      '_blank',
      'noopener,noreferrer'
    )
  }

  return (
    <div
      className="relative overflow-hidden rounded-[14px] p-5"
      style={{ background: 'linear-gradient(135deg, #0a0a0a 0%, #2a221c 100%)' }}
    >
      {/* Glow blob */}
      <div
        className="pointer-events-none absolute right-[-40px] top-[-40px] h-[140px] w-[140px] rounded-full opacity-40"
        style={{ background: 'var(--sidebar-primary)', filter: 'blur(40px)' }}
      />
      <div className="relative">
        <div className="mb-3 flex items-center gap-2">
          <p
            className="font-mono text-[10px] uppercase tracking-[0.12em]"
            style={{ color: '#b59e7d' }}
          >
            Próxima acción
          </p>
          <span
            className={`rounded px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide ${
              nextAction.urgency === 'urgente'
                ? 'bg-red-500/20 text-red-300'
                : nextAction.urgency === 'alta'
                  ? 'bg-amber-500/20 text-amber-300'
                  : 'bg-blue-500/20 text-blue-300'
            }`}
          >
            {nextAction.urgency}
          </span>
        </div>
        <p className="text-sm font-semibold text-white">{nextAction.title}</p>
        <p className="mt-1 text-xs leading-relaxed text-white/60">{nextAction.description}</p>
        <div className="mt-4 flex gap-2">
          {phone && (
            <a
              href={`tel:${phone}`}
              className="flex flex-1 items-center justify-center gap-1.5 rounded-lg py-2 text-xs font-semibold text-black"
              style={{ background: '#b59e7d' }}
            >
              <Phone className="h-3.5 w-3.5" />
              Llamar
            </a>
          )}
          {phone && (
            <button
              type="button"
              onClick={handleWhatsApp}
              className="flex flex-1 items-center justify-center gap-1.5 rounded-lg py-2 text-xs font-semibold text-white"
              style={{
                background: 'rgba(255,255,255,0.08)',
                border: '1px solid rgba(255,255,255,0.15)',
              }}
            >
              <MessageCircle className="h-3.5 w-3.5" />
              WhatsApp
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
