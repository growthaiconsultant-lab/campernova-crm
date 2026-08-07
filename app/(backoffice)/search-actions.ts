'use server'

import { db } from '@/lib/db'
import { requireAuth } from '@/lib/auth'
import { personLabel, vehicleLabel } from '@/lib/display'

/**
 * Búsqueda global (⌘K): compradores, vendedores, vehículos y captaciones por
 * nombre/email/teléfono/marca/modelo/matrícula. Respeta el RBAC del sidebar:
 * leads, captaciones y vehículos solo ADMIN+AGENTE, porque todos los destinos
 * pertenecen al módulo comercial protegido por requireAgente.
 */
export type SearchHit = {
  id: string
  label: string
  sub: string
  href: string
}

export type SearchResults = {
  compradores: SearchHit[]
  vendedores: SearchHit[]
  vehiculos: SearchHit[]
  captaciones: SearchHit[]
}

const EMPTY: SearchResults = { compradores: [], vendedores: [], vehiculos: [], captaciones: [] }

export async function globalSearch(query: string): Promise<SearchResults> {
  const user = await requireAuth()
  const q = query.trim()
  if (q.length < 2) return EMPTY

  const canSearchCommercial = user.role === 'ADMIN' || user.role === 'AGENTE'

  const contains = { contains: q, mode: 'insensitive' as const }

  const [buyers, sellers, vehicles, captures] = await Promise.all([
    canSearchCommercial
      ? db.buyerLead.findMany({
          where: { OR: [{ name: contains }, { email: contains }, { phone: contains }] },
          select: { id: true, name: true, phone: true, status: true },
          orderBy: { updatedAt: 'desc' },
          take: 5,
        })
      : Promise.resolve([]),
    canSearchCommercial
      ? db.sellerLead.findMany({
          where: {
            OR: [
              { name: contains },
              { email: contains },
              { phone: contains },
              { vehicle: { brand: contains } },
              { vehicle: { model: contains } },
            ],
          },
          select: {
            id: true,
            name: true,
            vehicle: { select: { brand: true, model: true, year: true } },
          },
          orderBy: { updatedAt: 'desc' },
          take: 5,
        })
      : Promise.resolve([]),
    canSearchCommercial
      ? db.vehicle.findMany({
          where: { OR: [{ brand: contains }, { model: contains }, { plate: contains }] },
          select: {
            id: true,
            brand: true,
            model: true,
            year: true,
            plate: true,
            status: true,
            sellerLeadId: true,
          },
          orderBy: { updatedAt: 'desc' },
          take: 5,
        })
      : Promise.resolve([]),
    canSearchCommercial
      ? db.vehicleCapture.findMany({
          where: { OR: [{ title: contains }, { phone: contains }] },
          select: { id: true, title: true, phone: true, status: true, sellerLeadId: true },
          orderBy: { updatedAt: 'desc' },
          take: 3,
        })
      : Promise.resolve([]),
  ])

  return {
    compradores: buyers.map((b) => ({
      id: b.id,
      label: personLabel(b.name, { role: 'Comprador sin identificar', id: b.id }),
      sub: b.phone ?? '',
      href: `/compradores/${b.id}`,
    })),
    vendedores: sellers.map((s) => ({
      id: s.id,
      label: personLabel(s.name, { role: 'Vendedor sin identificar', id: s.id }),
      sub: s.vehicle ? vehicleLabel(s.vehicle) : 'Sin vehículo',
      href: `/vendedores/${s.id}`,
    })),
    vehiculos: vehicles.map((v) => ({
      id: v.id,
      label: vehicleLabel(v),
      sub: v.plate ?? v.status,
      href: `/vendedores/${v.sellerLeadId}`,
    })),
    captaciones: captures.map((c) => ({
      id: c.id,
      label: c.title ?? 'Captación sin título',
      sub: c.phone ?? '',
      href: c.sellerLeadId ? `/vendedores/${c.sellerLeadId}` : `/captaciones?focus=${c.id}`,
    })),
  }
}
