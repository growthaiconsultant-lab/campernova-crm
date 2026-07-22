# Matriz de tests y validación — programa de entregas (I3)

> **Estado:** vigente en `main` (`687eae1`). Describe **garantías**, no conteos históricos (los
> números de tests cambian; las garantías son el contrato). Los conteos vivos los reporta CI.
> **Relacionados:** [dominio](../domain/delivery-lifecycle.md) · [locking](../adr/0009-root-lock-coordination.md) ·
> [migraciones](../governance/database-migrations.md) · [estado I3](../roadmap/i3-status.md).

## 1. Capas de prueba

- **Unitarios** (Vitest, lógica pura / mocks): máquinas de estado, clasificación de conflictos,
  evaluadores puros. Ejecutan en `pnpm test`.
- **Integración PostgreSQL 17** (base efímera, `pnpm test:integration`, solo CI): transacciones, CAS,
  constraints, concurrencia real, `prisma migrate deploy` real.
- **migration-replay / catalog / drift** (CI): replay desde base vacía, conteos de catálogo,
  ausencia de drift, idempotencia.
- **Cliente Prisma histórico** (CI): genera el cliente de un commit desplegado y lo ejerce contra el
  schema actual (compatibilidad de rollout).
- **UI**: sin tests automáticos (backoffice auth-gated); validación visual del dueño.
- **Producción**: health-check de rutas públicas; el flujo autenticado **no** se ejercita
  automáticamente (ver §3).

## 2. Matriz de garantías

| Garantía                                                                 | Unit | PG17 | CI  |      Prod      | Fichero(s)                                         |
| ------------------------------------------------------------------------ | :--: | :--: | :-: | :------------: | -------------------------------------------------- |
| Offer/Vehicle/Buyer coherentes al crear                                  |  ✓   |  ✓   |  ✓  |       —        | `delivery-creation.test.ts`                        |
| ≤ 1 Delivery activa por Vehicle (índice parcial)                         |  —   |  ✓   |  ✓  |       —        | `delivery-creation.test.ts`                        |
| `createDelivery` exige Offer CONVERTIDA + Vehicle RESERVADO              |  ✓   |  ✓   |  —  |       —        | `delivery-creation.test.ts`                        |
| Compatibilidad cliente desplegado ↔ schema (expand/contract)             |  —   |  ✓   |  ✓  |       —        | `old-client-compat.test.ts`                        |
| `offer_id` pasa a `NOT NULL` (contract) sin tocar datos                  |  —   |  ✓   |  ✓  | ✓ (postflight) | `contract-migration.test.ts`                       |
| **Failure mode real**: contract con NULL → falla, P3009, sin DDL parcial |  —   |  ✓   |  ✓  |       —        | `contract-migration-deploy.test.ts`                |
| Transición PROGRAMADA→EN_CURSO (CAS, `startedAt`, Activity)              |  ✓   |  ✓   |  ✓  |       —        | `delivery-transition.test.ts`                      |
| Cancelación (motivo atómico, no libera Vehicle, no toca Offer)           |  ✓   |  ✓   |  ✓  |       —        | `delivery-transition.test.ts`                      |
| Archived: bloquea iniciar, **no** cancelar; no reactiva leads            |  ✓   |  ✓   |  ✓  |       —        | `delivery-transition.test.ts`                      |
| Clasificación determinista tras CAS 0 filas                              |  ✓   |  ✓   |  ✓  |       —        | `delivery-transitions.test.ts`                     |
| Dos cancelaciones concurrentes → una gana, una Activity                  |  —   |  ✓   |  ✓  |       —        | `delivery-transition.test.ts`                      |
| **Cancelación gana** vs compleción → compleción revierte                 |  —   |  ✓   |  ✓  |       —        | `delivery-transition.test.ts`                      |
| **Compleción gana** vs cancelación (contención observada)                |  —   |  ✓   |  ✓  |       —        | `delivery-transition.test.ts` (`waitUntilBlocked`) |
| Rollback de Activity revierte la transición                              |  ✓   |  ✓   |  ✓  |       —        | `delivery-transition*.test.ts`                     |
| Preflight read-only (datos + estructura)                                 |  ✓   |  ✓   |  ✓  |       ✓        | `delivery-offer-preflight.test.ts`                 |

> **Contención observada:** la carrera «compleción gana» usa `waitUntilBlocked` (`pg_stat_activity`,
> `wait_event_type='Lock'`) para asegurar que la cancelación **bloquea realmente** en el lock del
> vehículo antes de liberar la compleción — no una secuencia artificial.

## 3. Validación en producción (honesta)

- Rutas **públicas** responden **200** (`/`, `/comprar`, `/vender`, `/comprar/vehiculos`).
- Rutas **protegidas** responden **307**→login (`/entregas`, `/dashboard`) — la **redirección no
  valida** el flujo autenticado.
- **No** se creó ninguna Delivery real; **iniciar/cancelar no se probaron manualmente** en
  producción.
- Observación **inmediata**, no prolongada; Sentry/Vercel no siempre accesibles desde el entorno de
  auditoría.

Deuda explícita:

```
AUTHENTICATED DELIVERY FLOW VALIDATION PENDING
```

## 4. Gaps conocidos (no bloqueantes)

Tests de concurrencia **frontera-específicos** que hoy no existen (cubiertos indirectamente por el
protocolo compartido `withLockedRoots`, probado en otras fronteras): cancelación↔transición,
cancelación↔`createDelivery` concurrente, transición↔`updateVehicle`. UI: el botón «Iniciar entrega»
no tiene estado de carga cliente (el doble submit es seguro por CAS). Guardas terminales de
checklist/firma (I3C3). Ninguno se presenta como bloqueo de producción.
