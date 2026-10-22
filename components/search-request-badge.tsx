import { isSearchRequestLead } from '@/lib/search-request/presentation'

export function SearchRequestBadge({
  leadId,
  className = '',
}: {
  leadId: string
  className?: string
}) {
  if (!isSearchRequestLead(leadId)) return null
  return (
    <span
      className={`inline-flex max-w-full items-center rounded-full border border-cyan-200 bg-cyan-50 px-2.5 py-1 text-[11px] font-semibold leading-tight text-cyan-900 ${className}`}
    >
      Solicitud bajo pedido
    </span>
  )
}
