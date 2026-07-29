'use client'

import { Phone, MessageCircle } from 'lucide-react'
import { logWhatsApp } from '@/app/(backoffice)/whatsapp-actions'
import { buildWhatsAppUrl, buyerWhatsAppMessage } from '@/lib/whatsapp'
import { NextActionEditor } from '@/components/next-action-editor'
import type { NextActionType } from '@prisma/client'

const NEXT_ACTION_TEXT: Record<string, string> = {
  NUEVO: 'Contactar al comprador',
  CONTACTADO: 'Cualificar sus necesidades',
  CUALIFICADO: 'Presentar vehículos match',
  EN_NEGOCIACION: 'Cerrar la operación',
  CERRADO: 'Coordinar la entrega',
  PERDIDO: 'Revisar si reactivar',
}

type Props = {
  phone: string | null
  leadId: string
  leadName: string
  status: string
  nextActionType: NextActionType | null
  nextActionDueAt: string | null
}

export function ProximaAccionCard({
  phone,
  leadId,
  leadName,
  status,
  nextActionType,
  nextActionDueAt,
}: Props) {
  function handleWhatsApp() {
    if (!phone) return
    logWhatsApp({ leadId, leadType: 'buyer', phone }).catch(console.error)
    window.open(
      buildWhatsAppUrl(phone, buyerWhatsAppMessage(leadName)),
      '_blank',
      'noopener,noreferrer'
    )
  }

  return (
    <div
      className="relative overflow-hidden rounded-xl p-5"
      style={{ background: 'linear-gradient(135deg, #141922 0%, #1d222c 100%)' }}
    >
      {/* Glow blob */}
      <div
        className="pointer-events-none absolute right-[-40px] top-[-40px] h-[140px] w-[140px] rounded-full opacity-40"
        style={{ background: '#0e7d6b', filter: 'blur(40px)' }}
      />
      <p
        className="relative font-mono text-[10px] uppercase tracking-[0.12em]"
        style={{ color: '#0e7d6b' }}
      >
        Próxima acción
      </p>
      <NextActionEditor
        leadType="buyer"
        leadId={leadId}
        nextActionType={nextActionType}
        nextActionDueAt={nextActionDueAt}
        fallbackText={NEXT_ACTION_TEXT[status] ?? 'Revisar el lead'}
      />
      {phone && (
        <div className="relative mt-4 flex gap-2">
          <button
            type="button"
            onClick={handleWhatsApp}
            className="flex flex-1 items-center justify-center gap-1.5 rounded-lg py-2 text-[12.5px] font-medium text-[#141922] transition-opacity hover:opacity-90"
            style={{ background: '#0e7d6b' }}
          >
            <MessageCircle className="h-3.5 w-3.5" />
            WhatsApp
          </button>
          <a
            href={`tel:${phone}`}
            className="flex flex-1 items-center justify-center gap-1.5 rounded-lg py-2 text-[12.5px] font-medium text-white transition-opacity hover:opacity-80"
            style={{
              background: 'rgba(255,255,255,0.08)',
              border: '1px solid rgba(255,255,255,0.15)',
            }}
          >
            <Phone className="h-3.5 w-3.5" />
            Llamar
          </a>
        </div>
      )}
    </div>
  )
}
