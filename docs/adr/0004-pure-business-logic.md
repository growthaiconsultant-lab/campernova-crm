# ADR 0004 — Lógica de negocio pura en `lib/` con dependencias inyectables

**Estado**: Aceptado

## Contexto

La lógica crítica (tasación, matching, postventa, expediente legal, márgenes) debe ser testeable sin DB ni red, y reutilizable desde Server Actions, Route Handlers y jobs.

## Decisión

Cada dominio vive en `lib/<dominio>/` como **funciones puras** con dependencias inyectables (`*Deps`). Un adaptador `prisma-deps.ts` provee la implementación real con Prisma; los tests inyectan mocks. La UI (Server Actions/páginas) orquesta, no contiene reglas de negocio.

## Consecuencias

- Tests unitarios rápidos y deterministas (Vitest, sin DB) — patrón establecido en `lib/valuation`, `lib/matching`, `lib/postventa`, `lib/vehicle-legal`.
- Frontera RSC→Client: los `Decimal` de Prisma se serializan a `number` antes de cruzar a Client Components.
- Cambiar de ORM o de fuente de datos afecta solo a los `*-deps`, no a la lógica.
