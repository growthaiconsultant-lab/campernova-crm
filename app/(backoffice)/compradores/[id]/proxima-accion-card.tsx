'use client'

import { Phone, MessageCircle } from 'lucide-react'
import { logWhatsApp } from '@/app/(backoffice)/whatsapp-actions'
import { buildWhatsAppUrl, buyerWhatsAppMessage } from '@/lib/whatsapp'

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
}

export function ProximaAccionCard({ phone, leadId, leadName, status }: Props) {
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
      style={{ background: 'linear-gradient(135deg, #0a0a0a 0%, #2a221c 100%)' }}
    >
      {/* Glow blob */}
      <div
        className="pointer-events-none absolute right-[-40px] top-[-40px] h-[140px] w-[140px] rounded-full opacity-40"
        style={{ background: '#294e4c', filter: 'blur(40px)' }}
      />
      <p
        className="relative font-mono text-[10px] uppercase tracking-[0.12em]"
        style={{ color: '#b59e7d' }}
      >
        Próxima acción
      </p>
      <p className="relative mt-2 text-[15px] font-semibold leading-snug text-white">
        {NEXT_ACTION_TEXT[status] ?? 'Revisar el lead'}
      </p>
      {phone && (
        <div className="relative mt-4 flex gap-2">
          <button
            type="button"
            onClick={handleWhatsApp}
            className="flex flex-1 items-center justify-center gap-1.5 rounded-lg py-2 text-[12.5px] font-medium text-[#0a0a0a] transition-opacity hover:opacity-90"
            style={{ background: '#b59e7d' }}
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
