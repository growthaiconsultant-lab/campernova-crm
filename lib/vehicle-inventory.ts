import { Prisma, type PrismaClient } from '@prisma/client'
import { admittedSellerWhere, admittedVehicleWhere } from './seller-intake'
import { eligibleBuyerCounterpartMatchWhere } from './matching'
import {
  criteriaKeys,
  inventoryError,
  type InventoryCriteria,
  type InventoryOrder,
} from './vehicle-inventory-filters'

export const inventoryPageSize = 48

function filteredInventory(c: InventoryCriteria) {
  const conditions = [
    Prisma.sql`s.intake_status = ${admittedSellerWhere.intakeStatus}::"SellerIntakeStatus"`,
  ]
  if (c.type) conditions.push(Prisma.sql`v.type = ${c.type}::"VehicleType"`)
  if (c.status) conditions.push(Prisma.sql`v.status = ${c.status}::"VehicleStatus"`)
  if (c.origin) conditions.push(Prisma.sql`s.canal = ${c.origin}::"LeadCanal"`)
  if (c.yearMin) conditions.push(Prisma.sql`v.year >= ${Number(c.yearMin)}`)
  if (c.yearMax) conditions.push(Prisma.sql`v.year <= ${Number(c.yearMax)}`)
  if (c.kmMax) conditions.push(Prisma.sql`v.km <= ${Number(c.kmMax)}`)
  if (c.priceMax) conditions.push(Prisma.sql`v.sale_price <= ${c.priceMax}::numeric`)
  const tokens = c.brand
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean)
  // La matrícula compacta conserva búsquedas antiguas con espacios o guiones.
  const compactPlate = Prisma.sql`regexp_replace(lower(v.plate), '[[:space:]-]+', '', 'g')`
  const searchableText = Prisma.sql`
    regexp_replace(
      normalize(lower(concat_ws(' ', v.brand, v.model, v.plate, ${compactPlate})), NFD),
      ${'[\u0300-\u036f]'}, '', 'g'
    )`
  for (const token of Array.from(new Set(tokens))) {
    const compact = token.replace(/-/g, '')
    const word = Prisma.sql`strpos(${searchableText}, ${token}) > 0`
    conditions.push(
      compact && compact !== token
        ? Prisma.sql`(${word} OR strpos(${compactPlate}, ${compact}) > 0)`
        : word
    )
  }
  return Prisma.sql`
    FROM vehicles v
    JOIN seller_leads s ON s.id = v.seller_lead_id
    WHERE ${Prisma.join(conditions, ' AND ')}`
}

const sortColumns: Record<string, Prisma.Sql> = {
  createdAt: Prisma.sql`v.created_at`,
  salePrice: Prisma.sql`v.sale_price`,
  km: Prisma.sql`v.km`,
  year: Prisma.sql`v.year`,
}

export function readVehicleInventory(
  db: PrismaClient,
  criteria: InventoryCriteria,
  order: InventoryOrder,
  requestedPage: number
) {
  const error = inventoryError(criteria)
  return db.$transaction(
    async (tx) => {
      const inventoryTotal = await tx.vehicle.count({ where: admittedVehicleWhere })
      const filtered = criteriaKeys.some((key) => criteria[key] !== '')
      const from = filteredInventory(criteria)
      let total = inventoryTotal
      if (error) total = 0
      else if (filtered) {
        const [result] = await tx.$queryRaw<{ n: bigint }[]>`SELECT count(*) AS n ${from}`
        total = Number(result.n)
      }
      const pages = Math.ceil(total / inventoryPageSize)
      const page = Math.min(requestedPage, Math.max(1, pages))
      const [sort, dir] = order.split(':')
      const ids = total
        ? await tx.$queryRaw<{ id: string }[]>`
          SELECT v.id ${from}
          ORDER BY ${sortColumns[sort]} ${dir === 'asc' ? Prisma.sql`ASC` : Prisma.sql`DESC`} NULLS LAST, v.id ASC
          LIMIT ${inventoryPageSize} OFFSET ${(page - 1) * inventoryPageSize}`
        : []
      const rows = ids.length
        ? await tx.vehicle.findMany({
            where: { id: { in: ids.map((v) => v.id) } },
            include: {
              sellerLead: { select: { id: true, name: true, archivedAt: true, canal: true } },
              photos: { take: 1, orderBy: [{ order: 'asc' }, { id: 'asc' }] },
              _count: { select: { matches: { where: eligibleBuyerCounterpartMatchWhere } } },
            },
          })
        : []
      const byId = new Map(rows.map((row) => [row.id, row]))
      return {
        vehicles: ids.map(({ id }) => byId.get(id)!),
        total,
        inventoryTotal,
        page,
        pages,
        filtered,
        error,
      }
    },
    { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead }
  )
}
