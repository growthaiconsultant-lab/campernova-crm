<!-- ───────────────────────────────────────────────────────────────────────── -->
<!--  CABECERA DE ESTADO (añadida en el PR de documentación y gobierno de Fase 0) -->
<!-- ───────────────────────────────────────────────────────────────────────── -->

> **Estado: HISTÓRICO.** No es fuente de verdad del estado actual.
>
> - **Documento:** plan de reparación del historial de migraciones (propuesta previa a ejecución).
> - **Fecha original:** 2026-07-10 · **Commit base:** `main @ 5ce93d6` + PR0 `23c983c`.
> - **Propósito original:** decidir cómo reparar el historial no reproducible (colisión de
>   timestamps) → recomendación de squash a baseline.
> - **Por qué es histórico:** la recomendación (**Alternativa B — squash/baseline**) se **ejecutó**
>   (`00be57b`). La baseline real es `000000000000_squashed_migrations` (el plan proponía `0_init`).
>   Los conteos de esquema citados (30/412/48/255/60/101) son los de la **baseline sola**; tras la
>   migración aditiva PR5B1 el catálogo vigente es **31/431/49/258/65/111**.
> - **Sustituido por (estado actual):**
>   - Baseline (cómo se generó) → [`../migration-history-baseline.md`](../migration-history-baseline.md)
>   - Gobierno de migraciones → [`../governance/database-migrations.md`](../governance/database-migrations.md)
>   - Estado de Fase 0 → [`../architecture/fase-0-final-state.md`](../architecture/fase-0-final-state.md)
> - **Conservado por trazabilidad:** documenta la causa raíz exacta (orden lexicográfico
>   `add_gdpr` < `init_schema`) y la comparación de alternativas.
> - **Advertencia:** las consultas fueron **read-only** contra staging/producción; **no**
>   re-ejecutar sin autorización y sin confirmar el `project_ref`. Los comandos `prisma migrate
resolve --applied` sólo deben ejecutarse bajo el procedimiento autorizado (ver la advertencia
>   de despliegue en el documento de baseline).

---

# Plan de reparación del historial de migraciones Prisma

> **Naturaleza:** documento de **análisis y plan**. No se ha modificado ningún fichero existente, no se han creado/renombrado/ejecutado migraciones, no se ha tocado `_prisma_migrations`, no se ha ejecutado `migrate resolve/deploy/db push/reset`, y no se ha hecho commit/push/merge. Las consultas a staging y producción fueron **exclusivamente de lectura** (`SELECT`), con el `project_ref` confirmado antes de cada una. **No implementar nada hasta aprobación explícita.**

**Fecha:** 2026-07-10 · **Rama de trabajo:** `chore/pr0-integration-test-infrastructure` (PR #99) · **Commit base auditado:** `main @ 5ce93d6` + PR0 `23c983c`.
**Prisma instalado:** `prisma` / `@prisma/client` **6.19.3** (verificado en `package.json`).
**Leyenda de tipos:** `[HECHO]` verificado con evidencia · `[INFERENCIA]` deducido de hechos · `[HIPÓTESIS]` no confirmable con lo disponible · `[RECOMENDACIÓN]` · `[NO VERIFICABLE]`.

---

## 1. Resumen ejecutivo

El job `integration` de PR0 falla al reconstruir una base **vacía** porque el historial de migraciones **no es reproducible en orden lexicográfico**: dos carpetas comparten prefijo de timestamp y una de ellas (`add_gdpr_consent_to_seller_leads`) depende de una tabla creada por su gemela (`init_schema`), pero ordena **antes** que ella. `prisma migrate deploy` aplica por orden de nombre de carpeta, así que en una base nueva intenta `ALTER TABLE seller_leads` antes de crearla → `42P01 relation "seller_leads" does not exist` → `P3018`.

Staging y producción **nunca** ejecutaron esa secuencia rota: se poblaron por otras vías (prod incrementalmente desde mayo en orden cronológico correcto; staging el 2026-06-17 vía `db push` + `resolve`), por lo que el defecto solo se manifiesta en un `migrate deploy` **desde cero** (CI o cualquier entorno nuevo).

**Recomendación principal `[RECOMENDACIÓN]`:** **squash a una única migración baseline** (flujo oficial de Prisma de _squashing/baselining_), conservando manualmente el único SQL personalizado (la activación de RLS), y marcándola como aplicada en staging y producción con `prisma migrate resolve --applied` (comando oficial que **inserta un registro de metadatos, no ejecuta DDL ni toca datos**). Es la vía oficialmente soportada, sin pérdida de datos, sin downtime, con una sola historia canónica y reproducible desde vacío.

**Descartada** como solución principal: **renombrar** las carpetas colisionantes (Alternativa A), porque cualquier renombrado desincroniza `_prisma_migrations` (que registra los nombres antiguos) en staging y producción y **exige reconciliar esa tabla interna**, algo que Prisma **no soporta oficialmente** para renombrados.

---

## 2. Causa raíz confirmada

`[HECHO]` `prisma migrate deploy` aplica las migraciones en **orden lexicográfico del nombre de carpeta** (no por fecha de creación ni por dependencias).

`[HECHO]` Contenido de las migraciones del par roto (leído de los `.sql`):

- `20260502000000_add_gdpr_consent_to_seller_leads/migration.sql`:
  ```sql
  ALTER TABLE "seller_leads" ADD COLUMN "gdpr_consent_at" TIMESTAMP(3), ADD COLUMN "gdpr_consent_ip" TEXT;
  ```
  → **depende** de que exista `seller_leads`.
- `20260502000000_init_schema/migration.sql`: `CREATE SCHEMA` + `CREATE TYPE` (enums) + `CREATE TABLE "seller_leads" ...` → **crea** `seller_leads`.

`[HECHO]` Orden lexicográfico: `"...000000_add_gdpr..."` < `"...000000_init_schema"` (porque `a` < `i`). Por tanto, en una base vacía, `add_gdpr` se aplica **primero** y falla.

`[HECHO]` Error reproducido en CI (job `integration`, run 29081356720):

```
Applying migration `20260502000000_add_gdpr_consent_to_seller_leads`
Error: P3018 · Database error code: 42P01 · ERROR: relation "seller_leads" does not exist
```

`[HECHO]` PR0 es correcto: su infraestructura **detectó** el defecto (que es el hallazgo `DATOS-05` de la auditoría). El fallo no está en PR0.

---

## 3. Inventario completo de migraciones

`[HECHO]` 26 carpetas en `prisma/migrations/`. Columnas: **Dep.** = objetos de los que depende; **Aplica en vacío aquí** = si se pudiera ejecutar en ese punto del orden **lexicográfico** sobre una base construida hasta la fila anterior.

| #   | Carpeta (orden lexicográfico)                        | Objeto que crea/altera                                                                          | Dep.                                      | ¿Aplica en vacío en este orden? |
| --- | ---------------------------------------------------- | ----------------------------------------------------------------------------------------------- | ----------------------------------------- | ------------------------------- |
| 1   | `20260502000000_add_gdpr_consent_to_seller_leads`    | ALTER `seller_leads` (+2 col)                                                                   | `seller_leads`                            | ❌ **NO** (tabla aún no existe) |
| 2   | `20260502000000_init_schema`                         | CREATE schema/enums/tablas base                                                                 | —                                         | ✅ (pero llega tarde)           |
| 3   | `20260502160859_add_last_match_email_at_to_users`    | ALTER `users`                                                                                   | `users`                                   | ✅                              |
| 4   | `20260503_add_buyer_chat_session`                    | CREATE `buyer_chat_sessions` (+enum)                                                            | `buyer_leads`                             | ✅                              |
| 5   | `20260504000000_add_vehicle_ads`                     | CREATE `vehicle_ads` (+enum)                                                                    | `vehicles`                                | ✅                              |
| 6   | `20260511000000_add_delivery_warranty_postventa`     | CREATE enums Delivery/Ticket/Followup + ALTER `ActivityType` + tablas                           | `ActivityType`, `vehicles`, `buyer_leads` | ✅                              |
| 7   | `20260511000000_add_roles_taller_entregas_marketing` | ALTER `UserRole` ADD VALUE ×3                                                                   | `UserRole`                                | ✅                              |
| 8   | `20260511100000_add_vehicle_legal_docs`              | CREATE `vehicle_documents` (+enum)                                                              | `vehicles`                                | ✅                              |
| 9   | `20260512000000_add_user_notify_on_new_lead`         | ALTER `users`                                                                                   | `users`                                   | ✅                              |
| 10  | `20260512100000_add_costs_and_workshop`              | CREATE tablas taller/costes (+enums)                                                            | `vehicles`                                | ✅                              |
| 11  | `20260603000000_enable_rls_deny_all_public`          | **SQL personalizado**: `DO $$` → `ENABLE RLS` en todas las tablas de `public` existentes        | tablas previas                            | ✅                              |
| 12  | `20260617000000_add_workorder_scheduling`            | ALTER `work_orders` + índice                                                                    | `work_orders`                             | ✅                              |
| 13  | `20260618000000_add_rv_taxonomy`                     | ALTER `vehicles`/`buyer_leads` (+enums)                                                         | ambas                                     | ✅                              |
| 14  | `20260707000000_add_next_action`                     | ALTER leads (+enum)                                                                             | leads                                     | ✅                              |
| 15  | `20260707100000_add_lost_reason`                     | ALTER leads (+enum)                                                                             | leads                                     | ✅                              |
| 16  | `20260707200000_add_lead_temperature`                | ALTER `buyer_leads` (+enum)                                                                     | `buyer_leads`                             | ✅                              |
| 17  | `20260707300000_add_trade_in`                        | ALTER `buyer_leads` (+enum, FK a seller_leads)                                                  | ambas                                     | ✅                              |
| 18  | `20260707400000_add_calendar_events`                 | CREATE `calendar_events` (+enums)                                                               | leads/vehicles/matches                    | ✅                              |
| 19  | `20260707500000_add_llamada_event_type`              | ALTER `CalendarEventType` ADD VALUE                                                             | enum previo                               | ✅                              |
| 20  | `20260707600000_add_workorder_kind`                  | ALTER `work_orders` (+enum)                                                                     | `work_orders`                             | ✅                              |
| 21  | `20260708000000_add_vehicle_captures`                | CREATE `vehicle_captures` (+enums)                                                              | `seller_leads`,`users`                    | ✅                              |
| 22  | `20260708100000_add_structured_deal_fields`          | ALTER leads (+enums)                                                                            | leads                                     | ✅                              |
| 23  | `20260709000000_add_offers`                          | CREATE `offers` (+enum)                                                                         | vehicles/buyer_leads/matches              | ✅                              |
| 24  | `20260710000000_add_trust_passport`                  | ALTER `vehicles` (+ActivityType values)                                                         | `vehicles`                                | ✅                              |
| 25  | `20260711000000_add_kpi_events`                      | CREATE `kpi_events`                                                                             | `users`                                   | ✅                              |
| 26  | `20260712000000_enable_rls_new_public_tables`        | **SQL personalizado**: `ENABLE RLS` en offers/calendar_events/vehicle_captures/kpi_events (PR1) | esas 4 tablas                             | ✅                              |

**Irregularidades de nomenclatura detectadas** `[HECHO]`:

- **Colisión 1 (rompe dependencia):** filas #1 y #2 (`20260502000000`).
- **Colisión 2 (NO rompe dependencia):** filas #6 y #7 (`20260511000000`). Inspeccionadas: `add_delivery_warranty_postventa` altera el enum `ActivityType`; `add_roles...` altera el enum `UserRole`. Enums distintos, **sin dependencia mutua**, ambos creados por `init_schema` → su orden relativo es **irrelevante**. `[INFERENCIA]` No provoca fallo por sí misma, pero es un riesgo latente de indeterminismo.
- **Prefijo corto:** fila #4 `20260503_add_buyer_chat_session` usa `20260503` (8 dígitos) en vez de 14. Ordena bien hoy, pero es inconsistente y frágil.
- **`migration_lock.toml` AUSENTE** del repositorio `[HECHO]` (no está en `git ls-files`). Prisma normalmente lo versiona con el `provider`. Su ausencia no causa el fallo, pero conviene restituirlo.
- **SQL personalizado** (no representable en `schema.prisma`): solo filas #11 y #26 (activación de RLS).

---

## 4. Orden lexicográfico vs. orden real histórico

### 4.1. Orden lexicográfico actual (el que usa `migrate deploy`)

El de la tabla de §3 (fila 1 → 26). **Rompe** en la fila 1.

### 4.2. Orden real de aplicación en STAGING `[HECHO]` (de `_prisma_migrations.started_at`)

`add_gdpr`(intento fallido, `rolled_back_at` 13:30:12) → `add_gdpr`(re-registrada 13:30:13, `applied_steps_count=0`) → `init_schema`(13:30:15) → `add_last_match` → `buyer_chat` → `vehicle_ads` → `delivery_warranty` → `roles` → `legal_docs` → `notify` → `costs` → `rls_deny_all` → (a partir de `workorder_scheduling`, `applied_steps_count=1`).
`[INFERENCIA]` Staging se creó el **2026-06-17** por `db push` + `migrate resolve --applied` (firma: `applied_steps_count=0`, `started_at≈finished_at`), no ejecutando las migraciones en secuencia. De ahí que el orden roto nunca se manifestara.

### 4.3. Orden real de aplicación en PRODUCCIÓN `[HECHO]`

`init_schema`(2026-05-01 23:43) → `add_last_match`(05-02) → `add_gdpr`(05-02 19:02, **después de init** ✅) → `buyer_chat`(05-03) → `vehicle_ads`(05-04) → `notify`(05-11 16:14) → `costs`(05-11 17:26) → `delivery_warranty`(05-11 18:36) → `roles`(05-11 20:10) → `legal_docs`(05-11 20:35) → `rls_deny_all`(06-03) → (desde `workorder_scheduling`, `applied_steps_count=1`).
`[INFERENCIA]` Producción se pobló **incrementalmente** en orden cronológico real correcto (init antes que gdpr), por lo que tampoco vivió el orden lexicográfico roto. Nótese que los `20260512*` se aplicaron **antes** que los `20260511000000*` en tiempo real — irrelevante por ser independientes.

**Conclusión §4** `[INFERENCIA]`: ni staging ni producción ejecutaron nunca el orden lexicográfico; el defecto es **exclusivo de una reconstrucción desde vacío**.

---

## 5. Tabla de colisiones y dependencias rotas

| Colisión (mismo prefijo) | Migraciones                                                               | ¿Rompe dependencia? | Evidencia                                                                    |
| ------------------------ | ------------------------------------------------------------------------- | ------------------- | ---------------------------------------------------------------------------- |
| `20260502000000`         | `add_gdpr_consent_to_seller_leads` + `init_schema`                        | ✅ **SÍ**           | gdpr = `ALTER seller_leads`; init = `CREATE seller_leads`; gdpr ordena antes |
| `20260511000000`         | `add_delivery_warranty_postventa` + `add_roles_taller_entregas_marketing` | ❌ **NO**           | enums distintos (`ActivityType` vs `UserRole`), sin dependencia mutua        |

**Dependencias rotas por orden:** exactamente **una** (`add_gdpr` → `init_schema`). El resto del historial aplica correctamente en orden lexicográfico una vez `init_schema` va primero. `[INFERENCIA]` (soportado por la tabla de §3, todas ✅ salvo la fila 1).

---

## 6. Comparación de checksums e historiales

### 6.1. Checksums

`[HECHO]` Los `checksum` (prefijo de 12 chars) de las **26** migraciones son **idénticos entre staging y producción** (p. ej. `init_schema`=`a1a90201348d`, `add_gdpr`=`731a45f6516f`, `enable_rls_new_public_tables`=`8c619fd04394`, … en ambos).
`[INFERENCIA]` Los ficheros locales **coinciden** con los registrados: `pnpm prisma migrate status` contra staging y contra prod (ejecutado en pasos previos de esta sesión) **no** reportó ninguna migración modificada; solo señalaba (antes de PR1) la única pendiente `20260712000000`. Prisma valida checksums en `migrate status`/`deploy`; la ausencia de avisos implica coincidencia fichero-vs-registro.

### 6.2. Historial local vs staging vs producción

| Aspecto                                          | Resultado                                                                                                                                                |
| ------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Mismos 26 nombres en local, staging y prod       | ✅ `[HECHO]`                                                                                                                                             |
| Mismos checksums en staging y prod               | ✅ `[HECHO]`                                                                                                                                             |
| Todas las locales aplicadas en ambos entornos    | ✅ `[HECHO]` (26/26 con `finished_at`, `rolled_back_at=null`, salvo el intento fallido inicial de `add_gdpr` en staging, ya superado por su re-registro) |
| Migraciones aplicadas ausentes del repo          | ❌ ninguna `[HECHO]`                                                                                                                                     |
| Migraciones locales sin aplicar                  | ❌ ninguna `[HECHO]`                                                                                                                                     |
| Orden real de aplicación idéntico entre entornos | ❌ **difiere** `[HECHO]` (ver §4) — irrelevante por independencia                                                                                        |
| Registros con `applied_steps_count=0`            | Todos los ≤ `20260603` en ambos `[HECHO]` → firma de `db push`/`resolve`                                                                                 |

### 6.3. Paridad de esquema `public` (staging vs producción) `[HECHO]`

| Métrica         | Staging | Producción |
| --------------- | ------- | ---------- |
| Tablas          | 30      | 30         |
| Columnas        | 412     | 412        |
| Tipos enum      | 48      | 48         |
| Valores de enum | 255     | 255        |
| Claves foráneas | 60      | 60         |
| Índices         | 101     | 101        |
| Tablas sin RLS  | 0       | 0          |

**Conclusión §6** `[INFERENCIA]`: staging y producción tienen **el mismo esquema `public` y el mismo conjunto de migraciones con idénticos checksums**. Es un escenario **ideal para squash/baseline** (una sola verdad, sin drift entre entornos). La única divergencia conocida (auditoría) está en `storage.objects` (políticas: prod 8, staging 0) y límites de bucket — **fuera del esquema `public` y fuera de este arreglo** (es materia de SEG-02/PR5).

---

## 7. Inventario de SQL personalizado (lo que una baseline automática perdería)

`[HECHO]` Único SQL no representable en `schema.prisma`: **activación de RLS**.

| Elemento                                                                                           | Migración origen                                           | ¿En staging?          | ¿En prod?             | ¿En `schema.prisma`?      | Cómo conservarlo en la baseline                                                                                                       | Validación                                                            |
| -------------------------------------------------------------------------------------------------- | ---------------------------------------------------------- | --------------------- | --------------------- | ------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------- |
| `ENABLE ROW LEVEL SECURITY` en las tablas de `public` (efecto acumulado de #11 deny-all + #26 PR1) | `20260603…` + `20260712…`                                  | ✅ (0 tablas sin RLS) | ✅ (0 tablas sin RLS) | ❌ (Prisma no modela RLS) | **Append manual** al final de la baseline: `ALTER TABLE public.<t> ENABLE ROW LEVEL SECURITY;` para **todas** las tablas de `public`  | `pnpm check:rls` = exit 0 sobre una base construida desde la baseline |
| Políticas de `storage.objects`                                                                     | ninguna (creadas por panel en prod; ausentes en staging)   | ❌ (0)                | ✅ (8)                | ❌                        | **NO** entra en esta baseline (es `storage`, no `public`) → materia de PR5/SEG-02                                                     | —                                                                     |
| Extensión `vector` en `public`                                                                     | ninguna (habilitada por panel; **no** usada por el schema) | (habilitada)          | (habilitada)          | ❌                        | Opcional `CREATE EXTENSION IF NOT EXISTS vector` en la baseline para paridad total; **no** es necesaria para CI (sin columnas vector) | `list_extensions`                                                     |

`[RECOMENDACIÓN]` No asumir que `prisma migrate diff --from-empty --to-schema-datamodel` reproduce RLS: **no lo hace**. Por eso la baseline debe **añadir manualmente** el bloque RLS y **validarse** con `check:rls` + un diff contra una copia de prod.

---

## 8. Comparación de alternativas

| Criterio                         | A · Renombrar colisionantes           | **B · Squash + baseline (recom.)**                      | C · Baseline nuevo + historia antigua viva | D · Bootstrap solo-CI  |
| -------------------------------- | ------------------------------------- | ------------------------------------------------------- | ------------------------------------------ | ---------------------- |
| Seguridad para producción        | Media-baja                            | **Alta**                                                | Baja                                       | Media                  |
| Riesgo de pérdida de datos       | Ninguno\*                             | **Ninguno**                                             | Ninguno                                    | Ninguno                |
| Riesgo de drift                  | **Alto** (nombres desincronizados)    | **Bajo** (una sola historia)                            | **Alto** (dos historias)                   | Alto (CI ≠ prod)       |
| Compatibilidad con Prisma        | Requiere hackear `_prisma_migrations` | **Nativa**                                              | Conflictiva                                | Nativa pero divergente |
| Soporte oficial                  | ❌ (renombrar aplicadas no soportado) | ✅ (_squashing/baselining_)                             | ❌                                         | Parcial                |
| Reproducible desde vacío         | ✅ (tras reconciliar)                 | ✅                                                      | ✅ solo la baseline                        | ✅ pero irreal         |
| Conserva SQL personalizado (RLS) | ✅ (no se toca)                       | ✅ (append manual)                                      | ✅                                         | Depende                |
| Facilidad de rollback            | Media                                 | **Alta** (revertir rama + no resolver)                  | Baja                                       | Alta                   |
| Complejidad                      | Media                                 | Media                                                   | Alta                                       | Baja                   |
| Mantenibilidad futura            | Baja (siguen irregularidades)         | **Alta** (historia limpia)                              | Muy baja                                   | Baja                   |
| Impacto en desarrollo            | Bajo                                  | Bajo                                                    | Alto                                       | Bajo                   |
| Impacto en CI                    | Arreglado                             | **Arreglado**                                           | Arreglado (falsamente)                     | Enmascarado            |
| ¿Modificar `_prisma_migrations`? | **SÍ** (nombres, manual/no soportado) | Sí, vía `resolve --applied` (**oficial**, solo inserta) | Sí                                         | Sí                     |
| ¿Tocar migraciones aplicadas?    | **SÍ** (renombra)                     | Archiva historia; no re-ejecuta nada en prod            | Mezcla                                     | Reordena/omite         |
| Riesgo de errores futuros        | Alto                                  | **Bajo**                                                | Alto                                       | Alto                   |

\* A no pierde datos, pero su reconciliación de `_prisma_migrations` es frágil y no soportada oficialmente.

### Por qué B y no A

`[INFERENCIA]` Cualquier renombrado (A) cambia el nombre de carpeta, que es la **clave** en `_prisma_migrations`. En staging y prod esa tabla registra los **nombres antiguos**; tras renombrar, `migrate deploy`/`status` verían las nuevas carpetas como **pendientes** (e intentarían re-ejecutar DDL ya aplicado → error) y las antiguas como **"aplicadas pero ausentes del directorio"** (drift). Prisma **no ofrece** un comando para renombrar una migración aplicada; reconciliarlo exige `UPDATE` manual de `_prisma_migrations` (prohibido y no soportado). En cambio, B usa `migrate resolve --applied` — el mecanismo **oficial** de baselining, que solo **inserta un registro** (sin DDL, sin datos).

### Alternativa E considerada

`prisma migrate diff` + `resolve` combinados **son** el flujo B. No hay una quinta vía oficial mejor para "reproducible desde vacío + entornos existentes intactos".

---

## 9. Recomendación

- **Principal `[RECOMENDACIÓN]`: Alternativa B — squash a una baseline única** (flujo oficial _Squashing migrations_ / _Baselining_ de Prisma), con append manual del RLS y `migrate resolve --applied` en staging y prod.
- **Contingencia `[RECOMENDACIÓN]`:** si el equipo no autoriza modificar la historia, **no** mergear PR0 y **mantener el job `integration` como señal de bloqueo documentada** hasta poder ejecutar B. (Un renombrado — A — **no** es contingencia recomendable por su reconciliación no soportada.) Como variante de contingencia técnica, A quedaría **solo** si se acepta el riesgo de reconciliar `_prisma_migrations` en ambos entornos con un procedimiento probado antes en una copia aislada.

Ventaja añadida de B: la baseline generada desde `schema.prisma` colapsa los `ALTER TYPE ... ADD VALUE` (roles, llamada, activity types) en `CREATE TYPE ... AS ENUM(...)`, eliminando de raíz tanto las colisiones como las irregularidades de nomenclatura.

---

## 10. Plan de implementación por fases (NO ejecutar aún)

> Todos los comandos son **propuestos**. No ejecutar hasta aprobación. Nombres de baseline sugeridos: carpeta `0_init` (ordena primero por empezar con `0`).

### Fase A — Preparación

- `[RECOMENDACIÓN]` Crear rama dedicada desde `main`: `chore/migrations-squash-baseline` (independiente de PR0).
- Congelar temporalmente la creación de nuevas migraciones (coordinación de equipo).
- **Backup / PITR** de producción (plan Pro → PITR disponible) y de staging antes de tocar `_prisma_migrations`.
- **Exportar** el estado actual de `_prisma_migrations` de staging y prod (los `SELECT` de este documento) como evidencia previa.
- Registrar los checksums actuales (ya capturados en §6).
- Confirmar `schema.prisma` == prod (evidencia de §6; opcional: `migrate diff` contra copia de prod en Fase D).

### Fase B — Construcción de la baseline (local, en la rama)

1. Archivar las 26 carpetas actuales fuera de `prisma/migrations/` (p. ej. a `prisma/_migrations_archive_pre_baseline/` **o** un tag git `pre-baseline`), preservando trazabilidad.
2. Crear `prisma/migrations/0_init/migration.sql` con:
   ```
   pnpm prisma migrate diff --from-empty --to-schema-datamodel prisma/schema.prisma --script > prisma/migrations/0_init/migration.sql
   ```
3. **Append manual** del SQL personalizado (RLS) al final de `0_init/migration.sql`: `ALTER TABLE public.<tabla> ENABLE ROW LEVEL SECURITY;` para **todas** las tablas de `public` (equivalente al efecto de #11 + #26). Opcional: `CREATE EXTENSION IF NOT EXISTS vector;` para paridad.
4. Restituir `prisma/migrations/migration_lock.toml` con `provider = "postgresql"`.
5. Validaciones estáticas: `pnpm typecheck`, `pnpm lint`, `pnpm prisma validate`, `pnpm test`.

### Fase C — Prueba destructible en PostgreSQL 17 efímero (CI o local con Docker)

Reutilizar la infraestructura de **PR0** (`TEST_DATABASE_URL` + guard + `test:integration:prepare`). Debe demostrarse, sobre una base **vacía**:

- `prisma migrate deploy` aplica **solo** `0_init` sin error;
- Prisma conecta; `pnpm check:rls` = exit 0 (0 tablas de `public` sin RLS);
- `pnpm test:integration` verde (conectividad, migraciones aplicadas, tablas núcleo, aislamiento, invariante RLS);
- `pnpm prisma migrate status` = "up to date" (0 pendientes);
- una **segunda** ejecución de `migrate deploy` es idempotente (0 aplicadas).
- Comparar recuentos de esquema (tablas/columnas/enums/FK/índices) contra §6.3 → deben coincidir (30/412/48/255/60/101, 0 sin RLS).

### Fase D — Validación contra copia aislada de producción (sin tocar prod)

- `[RECOMENDACIÓN]` Restaurar un **PITR/branch/backup** de producción en un proyecto **aislado y desechable** (nunca el prod real).
- Ejecutar: `prisma migrate diff --from-url <copia_prod_aislada> --to-url <base_construida_desde_0_init>` → **debe ser vacío** (sin diferencias). Esto prueba que la baseline reproduce exactamente el esquema de prod (incl. RLS si se compara ese aspecto).
- Si el diff **no** es vacío: **abortar**, ajustar la baseline (probablemente falta algún objeto manual) y repetir. **No continuar a Fase E/F** hasta diff vacío.

### Fase E — Staging

- Confirmar `project_ref = iatuhydsfwoeprpbklod`.
- **Consultas previas:** re-`SELECT` de `_prisma_migrations` (evidencia).
- Comandos propuestos (tras merge de la rama de baseline a `main`, o desde la rama, con la env de staging):
  ```
  # marca la baseline como ya aplicada SIN ejecutar DDL (no toca datos ni esquema)
  pnpm prisma migrate resolve --applied 0_init
  # (opcional, oficial) limpiar de _prisma_migrations las 26 filas antiguas queda a criterio:
  #   Prisma tolera filas antiguas cuyos ficheros ya no existen si la baseline está resuelta;
  #   documentar la decisión. NO hacer UPDATE manual de nombres.
  ```
- **Verificación posterior:** `pnpm prisma migrate status` = up to date; `pnpm check:rls` = 0; recuentos de esquema sin cambios (30/412/48/255/60/101).
- **Criterio para NO continuar:** si `migrate status` reporta drift o pendientes inesperadas, detener y revisar antes de tocar producción.
- **Rollback staging:** restaurar el backup previo o re-`resolve` según el estado registrado.

### Fase F — Producción

- Confirmar `project_ref = bbmglaatlyilxutzomxd` (≠ staging).
- **Requisitos previos:** Fases C, D y E superadas; backup/PITR reciente.
- **Ventana de mantenimiento:** **no necesaria** `[INFERENCIA]` — `migrate resolve --applied` solo inserta un registro de metadatos; no ejecuta DDL, no bloquea escrituras, no toca datos. (Aun así, ejecutar en ventana de bajo tráfico por prudencia.)
- Comandos: idénticos a Fase E contra prod.
- **Verificación:** `migrate status` up to date; `check:rls`=0; recuentos de esquema idénticos a antes; advisor de seguridad sin regresiones.
- **Monitorización:** Sentry + logs tras el siguiente deploy de la app (que no debería verse afectado).
- **Rollback producción:** el cambio es solo de metadatos (`_prisma_migrations`); rollback = restaurar el estado previo de esa tabla desde el backup/evidencia, o re-`resolve`. No hay cambio de datos/esquema que revertir.
- **Evidencia a conservar:** `_prisma_migrations` antes/después, salida de `migrate status`, `check:rls`, recuentos de esquema.

### Fase G — Recuperación de PR0

1. Mergear **primero** la rama de baseline a `main` (su propio PR).
2. Actualizar la rama de PR0: `git rebase main` (o merge de `main`) en `chore/pr0-integration-test-infrastructure`.
3. Re-lanzar la CI del PR #99.
4. Comprobar que **`quality` e `integration` quedan verdes** (ahora la base vacía se construye desde `0_init`).
5. **No mezclar** la reparación de migraciones dentro de PR0 (son PRs separados).
6. Mergear PR0 **solo** cuando su job `integration` pase realmente.

---

## 11. Comandos propuestos (resumen, NO ejecutados)

```
# Fase B (local)
pnpm prisma migrate diff --from-empty --to-schema-datamodel prisma/schema.prisma --script > prisma/migrations/0_init/migration.sql
# + append manual de ALTER TABLE ... ENABLE ROW LEVEL SECURITY (todas las tablas public)
# + crear prisma/migrations/migration_lock.toml (provider = postgresql)
pnpm prisma validate && pnpm typecheck && pnpm lint && pnpm test

# Fase C (base efímera)
pnpm test:integration:prepare && pnpm check:rls && pnpm test:integration
pnpm prisma migrate status   # esperado: up to date

# Fase D (copia aislada de prod, NO prod real)
pnpm prisma migrate diff --from-url "<copia_prod_aislada>" --to-url "<base_desde_0_init>"   # esperado: vacío

# Fases E/F (staging luego prod; env apuntando a cada uno; confirmar ref antes)
pnpm prisma migrate resolve --applied 0_init
pnpm prisma migrate status
pnpm check:rls
```

---

## 12. Estrategia de staging

Ver Fase E. Clave: `resolve --applied 0_init` (metadatos), verificación con `migrate status` + `check:rls` + recuentos de esquema, y criterio de parada ante cualquier drift. Reversible vía backup.

## 13. Estrategia de producción

Ver Fase F. Sin downtime necesario, sin cambio de datos/esquema (solo metadatos). Solo tras C/D/E verdes y backup. Reversible.

## 14. Rollback

- **Fases B/C (local/efímero):** revertir la rama; ningún efecto en entornos reales.
- **Fase E (staging):** restaurar backup de staging o el estado previo de `_prisma_migrations`.
- **Fase F (prod):** restaurar el estado previo de `_prisma_migrations` desde el backup/evidencia; no hay DDL/datos que revertir.
- **PR0:** si algo falla, mantener PR #99 sin merge.

## 15. Validaciones (criterios de éxito)

Base vacía construible desde `0_init`; `check:rls`=0; `test:integration` verde; `migrate status` up to date; `migrate deploy` idempotente; recuentos de esquema 30/412/48/255/60/101 con 0 tablas sin RLS; diff contra copia de prod vacío; staging y prod sin cambios de datos/esquema tras `resolve`.

## 16. Prevención de recurrencia `[RECOMENDACIÓN]`

Añadir al CI (pequeños, deterministas):

1. **Detector de prefijos de timestamp duplicados**: script que falla si dos carpetas de `prisma/migrations/` comparten los 14 dígitos iniciales.
2. **Detector de nomenclatura**: exigir el patrón `^\d{14}_`.
3. **Reproducibilidad desde vacío**: **ya cubierto por el job `integration` de PR0** (aplica todas las migraciones sobre Postgres 17 limpio). Mantenerlo como gate.
4. **Drift de checksum**: `prisma migrate status` en el job de integración (falla si hay migración modificada).
5. **Restituir y versionar** `migration_lock.toml`.
6. **Documentar** el flujo de creación: usar siempre `prisma migrate dev --name ...` (timestamp único) y nunca editar migraciones aplicadas.

## 17. Relación con PR0 y PR #99

- PR #99 permanece **abierto, sin merge**, con `integration` en rojo (documenta el bloqueo). `[HECHO]`
- La reparación de migraciones va en una **PR separada** que se mergea **antes**; después PR0 se rebasa, su CI pasa a verde y entonces se mergea. (Fase G.)

## 18. Riesgos residuales

- `[HIPÓTESIS]` Que exista en prod algún objeto de `public` no representado en `schema.prisma` ni en el RLS conocido (p. ej. un índice/constraint manual). **Mitigación:** el diff de Fase D contra una copia de prod lo detectaría antes de tocar prod.
- `[RIESGO]` Olvidar `resolve --applied` en uno de los dos entornos → ese entorno intentaría ejecutar `0_init` y fallaría (objetos existentes). **Mitigación:** checklist + verificación con `migrate status` en ambos.
- `[RIESGO]` La extensión `vector` y las políticas de `storage.objects` **no** se replican en bases nuevas desde esta baseline (quedan fuera del esquema `public`). **Aceptable** y documentado: son materia de otros PRs (SEG-02/PR5); no afectan a CI ni a la app actual.
- `[HECHO]` La divergencia staging↔prod en storage no se corrige aquí (fuera de alcance).

## 19. Decisiones que requieren tu aprobación

1. Adoptar **B (squash/baseline)** como solución (vs. contingencia).
2. Autorizar, en la fase de implementación, `prisma migrate resolve --applied` sobre **staging y producción** (inserta metadatos; no toca datos).
3. Autorizar un **backup/PITR** y una **copia aislada de producción** para la validación de Fase D.
4. Confirmar el **orden de PRs**: baseline primero, luego PR0.
5. Decidir si incluir `CREATE EXTENSION vector` en la baseline (paridad total) o dejarlo fuera (no necesario para CI).
6. Decidir el destino del archivo de las 26 migraciones antiguas (carpeta archivada vs. tag git).

---

_Fin del plan. No se ha modificado ningún fichero existente, ni el esquema, ni las migraciones, ni `_prisma_migrations`; no se ha ejecutado ninguna migración; no se ha hecho commit/push/merge; staging y producción solo se consultaron en modo lectura. Esperando aprobación explícita para implementar._
