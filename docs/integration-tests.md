# Tests de integración (PostgreSQL real)

> **Nota (histórico + infraestructura).** Este documento describe la **infraestructura** de tests de
> integración (PR0, Fase 0) — que sigue vigente y en uso. La referencia a «PR2/PR3/PR4 añadirán…» es
> **histórica**: esos tests de concurrencia/atomicidad/rollback ya existen y han crecido mucho
> (creación/transición/cancelación de entregas, contract migration, cliente antiguo, etc.). Las
> **garantías vigentes** del programa de entregas están en
> [`quality/delivery-test-matrix.md`](quality/delivery-test-matrix.md); la estrategia general en
> [`governance/testing-strategy.md`](governance/testing-strategy.md).

Infraestructura introducida en **PR0** (Fase 0). Permite ejecutar tests contra una base de
datos **PostgreSQL real y efímera** (no mocks), con las **migraciones reales** del proyecto
aplicadas.

> ⚠️ **Nunca** ejecutes estos tests contra staging ni producción. Un guard obligatorio
> rechaza cualquier URL que apunte a las bases de datos gestionadas del proyecto.

## Requisitos locales

- Node ≥ 20, pnpm.
- Un PostgreSQL 17 **local y desechable** (p. ej. vía Docker):
  `docker run --rm -e POSTGRES_PASSWORD=postgres -e POSTGRES_DB=campernova_test -p 5432:5432 postgres:17`

## Variables de entorno

| Variable                          | Obligatoria               | Descripción                                                                                                 |
| --------------------------------- | ------------------------- | ----------------------------------------------------------------------------------------------------------- |
| `TEST_DATABASE_URL`               | Sí                        | URL de la base de datos de test **efímera**. **Nunca** reutilizar `DATABASE_URL` del entorno de desarrollo. |
| `NODE_ENV=test`                   | Sí                        | Señal explícita de entorno de test.                                                                         |
| `ALLOW_INTEGRATION_DB_RESET=true` | Sí (para migrar/escribir) | Confirma que se permiten operaciones destructivas sobre la base de test.                                    |
| `CHECK_RLS_DATABASE_URL`          | Para `check:rls`          | URL contra la que ejecutar la invariante RLS (normalmente = `TEST_DATABASE_URL`).                           |

El guard (`tests/integration/guard.ts`) **rechaza** cualquier URL que contenga las refs
prohibidas de staging/producción o un host de Supabase gestionado, o si `NODE_ENV` no es
`test`. Nunca imprime la URL ni credenciales.

## Cómo ejecutar (local)

```bash
export NODE_ENV=test
export ALLOW_INTEGRATION_DB_RESET=true
export TEST_DATABASE_URL='postgresql://postgres:postgres@localhost:5432/campernova_test?schema=public'
export CHECK_RLS_DATABASE_URL="$TEST_DATABASE_URL"

pnpm test:integration:prepare   # 1) guard + `prisma migrate deploy` (migraciones reales)
pnpm check:rls                   # 2) invariante RLS (0 tablas de public sin RLS)
pnpm test:integration            # 3) tests de integración con Prisma real

# Todo en uno:
pnpm test:integration:ci
```

Los tests unitarios (`pnpm test`) **no** incluyen `tests/integration/**` y no se ven
afectados.

## Cómo limpiar / reiniciar la base

La base es **efímera**: basta destruir el contenedor (`docker rm -f …`) y volver a crearlo.
Cada test aísla sus datos con identificadores únicos y limpia lo que escribe, de modo que
la suite es repetible sin dejar residuos.

## Qué cubre PR0

- `guard.test.ts` — el guard rechaza staging/producción (strings controlados; sin DB).
- `schema.test.ts` — conectividad Prisma real · migraciones aplicadas · acceso a tabla real ·
  escritura + limpieza + repetibilidad.
- `rls-invariant.test.ts` — ninguna tabla de `public` sin RLS tras migrar.

## Cómo añadir futuros tests (PR2/PR3/PR4)

Usa los helpers de `tests/integration/db.ts`:

- `createGuardedTestPrisma()` — cliente Prisma validado por el guard.
- `uniqueSuffix()` — sufijo único para aislar datos.
- `withRollbackTransaction(prisma, fn)` — ejecuta `fn` en una transacción que siempre
  revierte (útil para probar efectos sin residuos).

Ubica los nuevos tests en `tests/integration/*.test.ts`. Se ejecutan en serie (comparten la
base). No añadas todavía tests de ofertas/entregas/captaciones: eso es PR2/PR3/PR4.

## CI

El job `integration` (`.github/workflows/ci.yml`) levanta `postgres:17`, aplica las
migraciones, ejecuta `check:rls` y `pnpm test:integration`, y **falla** si el servicio no
arranca, una migración falla, una tabla queda sin RLS o un test de integración falla. No usa
secretos ni se conecta a entornos remotos. El job `quality` (typecheck/lint/tests unitarios)
permanece independiente.
