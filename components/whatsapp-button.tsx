'use client'

import { MessageCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { buildWhatsAppUrl } from '@/lib/whatsapp'
import { logWhatsApp } from '@/app/(backoffice)/whatsapp-actions'

type Props = {
  phone: string
  message: string
  leadId: string
  leadType: 'seller' | 'buyer'
}

export function WhatsAppButton({ phone, message, leadId, leadType }: Props) {
  function handleClick() {
    // Log fire-and-forget — no bloqueamos la apertura de WhatsApp
    logWhatsApp({ leadId, leadType, phone }).catch(console.error)
    window.open(buildWhatsAppUrl(phone, message), '_blank', 'noopener,noreferrer')
  }

  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      onClick={handleClick}
      className="gap-1.5 border-green-600 text-green-700 hover:bg-green-50 hover:text-green-800 dark:border-green-500 dark:text-green-400 dark:hover:bg-green-950"
    >
      <MessageCircle className="h-4 w-4" />
      WhatsApp
    </Button>
  )
}
