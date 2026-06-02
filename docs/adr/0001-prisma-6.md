# ADR 0001 — Prisma 6 (no 7)

**Estado**: Aceptado

## Contexto

Prisma 7 eliminó `url`/`directUrl` del bloque `datasource` en `schema.prisma` y exige un nuevo patrón de adapters (`prisma.config.ts` + `@prisma/adapter-pg`) que no está validado con Next.js 14 + Vercel.

## Decisión

Usar `prisma@^6` y `@prisma/client@^6`. pnpm v10 bloquea build scripts por defecto, así que se listan en `pnpm.onlyBuiltDependencies` (`@prisma/client`, `@prisma/engines`, `prisma`).

## Consecuencias

- Patrón estable y documentado de migraciones (Prisma + Supabase MCP).
- `build` ejecuta `prisma generate && next build` para regenerar el cliente en cada deploy.
- Migrar a v7 cuando el patrón de adapters esté estabilizado con Next 14 (futuro ADR).
