# Runbook — Rollout de A1 (fundamentos de entrada oficial)

> **Estado:** paquete de rollout **preparado**. La migración **no** está aplicada en ningún entorno
> remoto y el PR #133 **no** está fusionado ni desplegado. Este runbook solo describe el procedimiento
> y la evidencia a recopilar. **No ejecutar** ningún paso remoto sin autorización explícita por paso.

## 1. Qué se despliega

- **PR #133** `feat(vehicle): add official entry schema foundations` (rama `feat/vehicle-entry-foundations-a1`).
- **Migración** `20260726000000_add_vehicle_entry_foundations` — **aditiva, sin DML/backfill**:
  2 `CREATE TYPE`, 2 `ALTER TYPE ADD VALUE`, 11 `ADD COLUMN` (todas nullable), 1 `CREATE TABLE` +
  índice único, 5 FK (`SET NULL` en refs a `users`, `CASCADE` en ref a `vehicles`), 1 `ENABLE ROW
LEVEL SECURITY`.
- **Comportamiento cero:** ningún reader/writer de los campos nuevos. Las únicas referencias son
  compile-compat (`DOC_LABELS`, unión/label de `WorkOrderKind`, fixture de test).

## 2. Regla de orden (VINCULANTE): BD nueva ANTES que cliente nuevo

El cliente Prisma nuevo modela las 11 columnas nuevas y hace `SELECT` de todas las columnas escalares
por defecto en `Vehicle`. Si se despliega el **cliente nuevo contra una BD sin la migración**, **toda**
lectura de `Vehicle` (listados, KPIs, reads preliminares de entregas/ofertas) falla con **`P2022`**
(`column vehicles.entry_validated_at does not exist`) — caída amplia, no un fallo acotado.

**NO** usar el orden peligroso:

```
merge a main → Vercel despliega cliente nuevo → migrar producción
```

**Orden seguro (staging → prod, migración primero):**

### Staging

1. Confirmar proyecto/base de staging (ref `iatuhydsfwoeprpbklod`; secretos en `.env.staging`, gitignored).
   Verificar host antes de nada (staging, no prod).
2. **Preflight (read-only):** `prisma migrate status` y snapshot del catálogo (§4). No debe faltar
   ninguna migración anterior.
3. **Aplicar** la migración A1 con el entorno de staging:
   `set -a; . ./.env.staging; set +a; pnpm prisma migrate deploy`
4. **Verificar** historial + catálogo (§4) + RLS de la tabla nueva.
5. Probar la **rama A1** (cliente nuevo) contra staging: `pnpm build` + arranque + smoke read-only.
6. Observabilidad inmediata (sin errores `P2022`).
7. **Gate humano.**

### Producción

1. Confirmar deployment y commit activos (debe ser `cc4114d` = `main`) y que el **cliente antiguo**
   sigue sirviendo.
2. **Aplicar la migración aditiva A1 en producción con el cliente antiguo aún activo** (el cliente
   antiguo tolera columnas nullable extra):
   `pnpm prisma migrate deploy` _(con el `.env` de producción; verificar host `bbmglaatlyilxutzomxd`)_
3. **Verificar (postflight, §4):** existen las 11 columnas y la tabla nueva; RLS habilitada; los
   **conteos de negocio no cambian** (sin backfill); la app antigua sigue respondiendo 200.
4. **Gate humano.**
5. Convertir PR #133 en **Ready** → **fusionar** (squash) → esperar el deployment del **cliente nuevo**.
6. Smoke test autenticado read-only.
7. Postflight de producción read-only (sin PII): catálogo + rutas.
8. Observación 24 h (Sentry).

La **base nueva precede al cliente nuevo** en ambos entornos.

## 3. Comandos de verificación (read-only, preparados)

```bash
# Preflight: estado de migraciones (por entorno)
pnpm prisma migrate status

# Diff esperado del PR (7 archivos)
git diff --stat origin/main..feat/vehicle-entry-foundations-a1
```

## 4. Postflight — catálogo esperado tras A1 (aserciones de CI `migration-replay`)

```
tables             32
columns            460
enums              53
enum_values        282
foreign_keys       73
indexes            117
tables_without_rls  0
tables_forced_rls   0
policies            0
deliveries.offer_id is_nullable = NO
```

Migraciones esperadas tras aplicar A1: **7** (las 6 de `main` + `20260726000000_add_vehicle_entry_foundations`).

Comprobaciones puntuales (SQL read-only): existencia de columnas `vehicles.entry_validated_at`,
`vehicles.keys_received_at`, etc.; existencia de la tabla `vehicle_document_requirement_dispositions`;
`rowsecurity = true` para esa tabla; `SELECT count(*)` de negocio (vehículos/leads) **igual** antes y
después (prueba de "sin backfill").

## 5. Rollback / contención

- **A1 es aditivo y comportamiento-cero**, así que el riesgo de código es nulo: si tras aplicar la
  migración se detecta cualquier problema, el **cliente antiguo sigue siendo compatible** con la BD
  migrada → no es necesario revertir la migración; basta con **no** avanzar al merge/deploy del cliente
  nuevo.
- Si se hubiera invertido el orden (cliente nuevo antes que BD) y apareciera `P2022`: contención =
  **aplicar la migración inmediatamente** (recupera al cliente nuevo) o **redeploy del commit anterior**
  (`cc4114d`, cliente antiguo). La prevención correcta es respetar el orden §2.
- No se contempla `DROP` de columnas/tabla como rollback ordinario (destructivo); requeriría
  autorización de datos aparte.

## 6. Evidencia a recopilar

Staging: salida de `migrate status`, catálogo post-migración, RLS de la tabla, resultado del smoke con
cliente nuevo. Producción: commit activo previo, salida de `migrate deploy`, catálogo, prueba de conteos
sin cambio, 200 de la app antigua, deployment del cliente nuevo (id + `state=READY`), smoke autenticado,
Sentry 24 h.

## 7. Veredicto

`A1 ROLLOUT PACKAGE READY — REMOTE AUTHORIZATION REQUIRED` — el diff es aditivo y limpio, el CI está
4/4 verde, y el procedimiento seguro (BD-antes-que-cliente) está preparado. Faltan las **autorizaciones
remotas** de staging y de producción para ejecutar.
