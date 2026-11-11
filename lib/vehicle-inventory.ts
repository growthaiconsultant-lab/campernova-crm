import { Prisma, type PrismaClient } from '@prisma/client'
import { ACTIVE_DELIVERY_STATUSES, ACTIVE_OFFER_STATUSES } from './lead-archiving/domain'
import { listMissingRequirements } from './vehicle-legal/validate'
import { publicationBlockingWorkOrders } from './vehicle-legal/prisma-deps'
import {
  PUBLICACION_REQUIERE_FOTOS_CATEGORIZADAS,
  countPhotosByCategory,
} from './vehicle-legal/config'
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
  if (c.status === 'DESCARTADO') {
    conditions.push(Prisma.sql`(v.status = 'DESCARTADO' OR s.status = 'DESCARTADO')`)
  } else if (c.status) conditions.push(Prisma.sql`v.status = ${c.status}::"VehicleStatus"`)
  if (c.origin) conditions.push(Prisma.sql`s.canal = ${c.origin}::"LeadCanal"`)
  if (c.yearMin) conditions.push(Prisma.sql`v.year >= ${Number(c.yearMin)}`)
  if (c.yearMax) conditions.push(Prisma.sql`v.year <= ${Number(c.yearMax)}`)
  if (c.kmMax) conditions.push(Prisma.sql`v.km <= ${Number(c.kmMax)}`)
  if (c.priceState === 'missing') conditions.push(Prisma.sql`v.sale_price IS NULL`)
  if (c.priceState === 'priced') conditions.push(Prisma.sql`v.sale_price IS NOT NULL`)
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
              sellerLead: {
                select: { id: true, name: true, archivedAt: true, canal: true, status: true },
              },
              photos: { take: 1, orderBy: [{ order: 'asc' }, { id: 'asc' }] },
              documents: { select: { category: true }, distinct: ['vehicleId', 'category'] },
              deliveries: {
                where: { status: { in: ACTIVE_DELIVERY_STATUSES } },
                select: { id: true },
                take: 1,
              },
              offers: {
                where: { status: { in: ACTIVE_OFFER_STATUSES } },
                select: {
                  id: true,
                  amount: true,
                  status: true,
                  buyerLead: { select: { name: true, archivedAt: true } },
                },
                orderBy: [{ createdAt: 'desc' }, { id: 'asc' }],
              },
              _count: {
                select: {
                  photos: true,
                  workOrders: { where: { status: { in: publicationBlockingWorkOrders } } },
                  matches: { where: eligibleBuyerCounterpartMatchWhere },
                },
              },
            },
          })
        : []
      const photoCounts = new Map<string, ReturnType<typeof countPhotosByCategory>>()
      if (PUBLICACION_REQUIERE_FOTOS_CATEGORIZADAS && ids.length) {
        const groups = await tx.vehiclePhoto.groupBy({
          by: ['vehicleId', 'category'],
          where: { vehicleId: { in: ids.map((v) => v.id) } },
          _count: true,
        })
        for (const group of groups) {
          if (!group.category) continue
          const counts = photoCounts.get(group.vehicleId) ?? countPhotosByCategory([])
          counts[group.category] = group._count
          photoCounts.set(group.vehicleId, counts)
        }
      }
      const byId = new Map(rows.map((row) => [row.id, row]))
      return {
        vehicles: ids.map(({ id }) => {
          const v = byId.get(id)!
          const preparing = v.status === 'NUEVO' || v.status === 'TASADO'
          const publicationPending = preparing
            ? listMissingRequirements(
                {
                  ...v,
                  photoCount: v._count.photos,
                  photosByCategory: photoCounts.get(id),
                  workOrdersBlockingCount: v._count.workOrders,
                },
                'PUBLICADO',
                v.documents.map((d) => ({ category: d.category, exists: true }))
              ).filter((item) => item.severity === 'error')
            : []
          return {
            ...v,
            publicationPending,
            readyToPublish: preparing && publicationPending.length === 0,
          }
        }),
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
