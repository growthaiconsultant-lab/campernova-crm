import type { Metadata } from 'next'
import type { ReactNode } from 'react'
import { pageMetadata } from '@/lib/seo'

// `app/comprar/page.tsx` es un Client Component (chat) y no puede exportar metadata.
// Este layout (Server Component) le da su propia meta + canonical. Las fichas
// `/comprar/[id]` sobreescriben con su `generateMetadata`.
export const metadata: Metadata = pageMetadata({
  title: 'Comprar camper o autocaravana seminueva',
  description:
    'Encuentra tu camper o autocaravana seminueva con garantía. Te ayudamos a elegir según tu uso, presupuesto y plazas. Stock real e instalaciones en Barcelona.',
  path: '/comprar',
})

export default function ComprarLayout({ children }: { children: ReactNode }) {
  return children
}
