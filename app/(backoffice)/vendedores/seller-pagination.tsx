import Link from 'next/link'
import { sellerPageUrl, sellerPagination } from '@/lib/seller-pagination'

type Props = ReturnType<typeof sellerPagination> & {
  total: number
  params: Record<string, string | undefined>
  position: 'superior' | 'inferior'
}

export function SellerPagination({ page, totalPages, from, to, total, params, position }: Props) {
  const linkClass =
    'rounded-[9px] border border-line bg-card px-3 py-2 font-hanken text-[12.5px] font-semibold text-ink2 hover:bg-canvas focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand'

  return (
    <nav
      aria-label={`Paginación de vendedores ${position}`}
      className="my-4 flex flex-wrap items-center justify-between gap-3"
    >
      <p className="font-hanken text-[12.5px] text-ink2">
        {from}–{to} de {total} vendedores
      </p>
      {totalPages > 1 && (
        <div className="flex items-center gap-2">
          {page > 1 ? (
            <Link href={sellerPageUrl(params, page - 1)} className={linkClass}>
              Anterior
            </Link>
          ) : (
            <span aria-disabled="true" className="px-3 py-2 text-[12.5px] text-ink3">
              Anterior
            </span>
          )}
          <span aria-current="page" className="font-mono text-[12px] text-ink3">
            Página {page} de {totalPages}
          </span>
          {page < totalPages ? (
            <Link href={sellerPageUrl(params, page + 1)} className={linkClass}>
              Siguiente
            </Link>
          ) : (
            <span aria-disabled="true" className="px-3 py-2 text-[12.5px] text-ink3">
              Siguiente
            </span>
          )}
        </div>
      )}
    </nav>
  )
}
