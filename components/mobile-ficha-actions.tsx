'use client'

import { Phone, MessageCircle } from 'lucide-react'
import { MobileActionBar } from '@/components/redesign'
import { logWhatsApp } from '@/app/(backoffice)/whatsapp-actions'
import { buildWhatsAppUrl } from '@/lib/whatsapp'

/**
 * Barra de acción fija inferior de las fichas en móvil (mockups MC2/MVEN2):
 * Llamar + WhatsApp siempre a mano, hit targets ≥44px. Solo <lg. El WhatsApp
 * registra WHATSAPP_INICIADO igual que el botón del rail.
 */
export function MobileFichaActions({
  phone,
  message,
  leadId,
  leadType,
}: {
  phone: string
  message: string
  leadId: string
  leadType: 'seller' | 'buyer'
}) {
  function handleWhatsApp() {
    logWhatsApp({ leadId, leadType, phone }).catch(console.error)
    window.open(buildWhatsAppUrl(phone, message), '_blank', 'noopener,noreferrer')
  }

  return (
    <MobileActionBar>
      <a
        href={`tel:${phone}`}
        className="flex min-h-[44px] flex-1 items-center justify-center gap-2 rounded-[10px] border border-line bg-card font-hanken text-[13px] font-semibold text-ink transition-colors hover:bg-canvas"
      >
        <Phone size={15} strokeWidth={2} />
        Llamar
      </a>
      <button
        type="button"
        onClick={handleWhatsApp}
        className="flex min-h-[44px] flex-1 items-center justify-center gap-2 rounded-[10px] bg-brand font-hanken text-[13px] font-semibold text-white transition-colors hover:bg-brand2"
      >
        <MessageCircle size={15} strokeWidth={2} />
        WhatsApp
      </button>
    </MobileActionBar>
  )
}
