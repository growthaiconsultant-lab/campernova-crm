import type { Prisma } from '@prisma/client'

/** Common plate layouts, without changing persisted data or introducing LIKE wildcards. */
export function vehiclePlateSearchConditions(query: string): Prisma.VehicleWhereInput[] {
  const literal = query.trim().toUpperCase()
  if (!literal) return []
  const variants = new Set([literal])
  if (literal.length <= 20 && /^[A-Z0-9\s-]+$/.test(literal)) {
    const compact = literal.replace(/[\s-]/g, '')
    const blocks = compact.match(/[A-Z]+|[0-9]+/g) ?? []
    const first = blocks[0]
    if (first && compact.length >= 2 && blocks.length <= 4) {
      let layouts = [first]
      for (const block of blocks.slice(1)) {
        layouts = layouts.flatMap((prefix) =>
          ['', ' ', '-'].map((separator) => prefix + separator + block)
        )
      }
      for (const layout of layouts) variants.add(layout)
    }
  }
  return Array.from(variants, (variant) => ({
    plate: { contains: variant.replace(/[\\%_]/g, '\\$&'), mode: 'insensitive' },
  }))
}
