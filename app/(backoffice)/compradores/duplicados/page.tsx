import Link from 'next/link'
import { requireAdmin } from '@/lib/auth'
import { db } from '@/lib/db'
import { leadDuplicateGroups } from '@/lib/lead-duplicates'

export const dynamic = 'force-dynamic'

export default async function LeadDuplicatesPage() {
  await requireAdmin()
  const select = {
    id: true,
    name: true,
    phone: true,
    email: true,
    agentId: true,
    status: true,
    archivedAt: true,
    agent: { select: { name: true } },
  } as const
  const [buyers, sellers] = await Promise.all([
    db.buyerLead.findMany({ select, orderBy: [{ createdAt: 'asc' }, { id: 'asc' }] }),
    db.sellerLead.findMany({ select, orderBy: [{ createdAt: 'asc' }, { id: 'asc' }] }),
  ])
  const sections = [
    { label: 'Compradores', path: 'compradores', rows: buyers },
    { label: 'Vendedores', path: 'vendedores', rows: sellers },
  ]
  return (
    <div className="space-y-6 p-5">
      <h1 className="text-2xl font-bold">Contactos repetidos entre responsables</h1>
      <p>
        Coincidencias por teléfono normalizado o correo. Revisad las fichas y acordad un único
        responsable antes de volver a llamar. Un contacto compartido puede corresponder a varias
        personas.
      </p>
      {sections.map(({ label, path, rows }) => {
        const groups = leadDuplicateGroups<(typeof rows)[number]>(rows)
        return (
          <section key={path} className="space-y-3">
            <h2 className="text-lg font-semibold">
              {label}: {rows.length} fichas revisadas · {groups.length} grupos de coincidencias
            </h2>
            {!groups.length && <p>Sin coincidencias entre responsables distintos.</p>}
            {groups.map((group, i) => (
              <div key={i} className="rounded-lg border p-4">
                <h3 className="font-semibold">
                  Coincidencia por {group.criterion === 'phone' ? 'teléfono' : 'correo'} ·{' '}
                  {group.leads.length} fichas
                </h3>
                <ul className="mt-2 space-y-2">
                  {group.leads.map((lead) => (
                    <li key={lead.id}>
                      <Link href={`/${path}/${lead.id}`} className="underline">
                        {lead.name}
                      </Link>
                      {' · '}
                      {lead.agent?.name ?? 'Sin responsable'}
                      {' · '}
                      {lead.status}
                      {lead.archivedAt ? ' · Archivado' : ''}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </section>
        )
      })}
    </div>
  )
}
