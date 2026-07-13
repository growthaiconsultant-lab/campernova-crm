# Baseline del historial de migraciones (squash)

> **Nota de vigencia (2026-07-13).** Este documento describe **cómo se generó la baseline**
> (`000000000000_squashed_migrations`, commit `00be57b`). Los conteos de catálogo que aparecen más
> abajo (30/412/48/255/60/101) y el paso «se aplicó **solo** la baseline» corresponden al estado
> **con la baseline como única migración**. Desde entonces se añadió la migración aditiva
> `20260712000000_add_versioned_document_model` (PR5B1), por lo que el historial vigente son
> **2 migraciones** y el catálogo vigente es **31/431/49/258/65/111**. La fuente de verdad del
> **estado actual** de migraciones es [`governance/database-migrations.md`](governance/database-migrations.md);
> el job de CI `migration-replay` valida los conteos vigentes.

## Motivo

El historial de 26 migraciones **no era reproducible desde una base de datos vacía**: dos
carpetas compartían prefijo de timestamp y `prisma migrate deploy` (que ordena por nombre de
carpeta) intentaba aplicar `20260502000000_add_gdpr_consent_to_seller_leads` **antes** que
`20260502000000_init_schema`.

### Error original

```
Applying migration `20260502000000_add_gdpr_consent_to_seller_leads`
Error: P3018 · Database error code: 42P01
ERROR: relation "seller_leads" does not exist
```

La migración que se ejecutaba **antes** de `init_schema` era
`20260502000000_add_gdpr_consent_to_seller_leads` (un `ALTER TABLE seller_leads …` sobre una
tabla que aún no existía). Staging y producción nunca vivieron este orden (se poblaron por
otras vías), por lo que el defecto solo se manifestaba en una reconstrucción desde cero (CI /
entornos nuevos).

## Solución: una única baseline

Se sustituyó el historial activo por una única migración baseline reproducible:

- **Nueva baseline:** `prisma/migrations/000000000000_squashed_migrations/migration.sql`
- **`prisma/migrations/migration_lock.toml`** restituido (`provider = "postgresql"`).

### Historial anterior conservado

Las 26 migraciones anteriores se **retiraron del directorio activo** pero **permanecen en el
historial de Git** en el commit **`5ce93d6`**. **No deben restaurarse dentro de
`prisma/migrations/`** (reintroducirían el defecto). No se mantienen dos historiales
simultáneos.

Migraciones retiradas del directorio activo (26):

```
20260502000000_add_gdpr_consent_to_seller_leads   20260707100000_add_lost_reason
20260502000000_init_schema                        20260707200000_add_lead_temperature
20260502160859_add_last_match_email_at_to_users   20260707300000_add_trade_in
20260503_add_buyer_chat_session                   20260707400000_add_calendar_events
20260504000000_add_vehicle_ads                    20260707500000_add_llamada_event_type
20260511000000_add_delivery_warranty_postventa    20260707600000_add_workorder_kind
20260511000000_add_roles_taller_entregas_marketing 20260708000000_add_vehicle_captures
20260511100000_add_vehicle_legal_docs             20260708100000_add_structured_deal_fields
20260512000000_add_user_notify_on_new_lead        20260709000000_add_offers
20260512100000_add_costs_and_workshop             20260710000000_add_trust_passport
20260603000000_enable_rls_deny_all_public         20260711000000_add_kpi_events
20260617000000_add_workorder_scheduling           20260712000000_enable_rls_new_public_tables
20260618000000_add_rv_taxonomy
20260707000000_add_next_action
```

## Cómo se generó la baseline

1. **Estructura** (Prisma 6.19.3, offline, sin conexión a ninguna base):

   ```
   pnpm prisma migrate diff --from-empty --to-schema-datamodel prisma/schema.prisma --script \
     > prisma/migrations/000000000000_squashed_migrations/migration.sql
   ```

   Representa **exactamente** `prisma/schema.prisma` (sin cambios de datamodel). Los enums se
   crean con todos sus valores en un único `CREATE TYPE`, eliminando las colisiones y los
   `ALTER TYPE ADD VALUE` históricos.

2. **SQL personalizado reincorporado (RLS):** al final del fichero se añadió manualmente el
   bloque que activa Row Level Security en **todas las tablas ordinarias del esquema `public`**
   (incluida `_prisma_migrations`, que ya existe cuando corre la migración), replicando el
   efecto acumulado de las migraciones históricas de RLS
   (`20260603000000_enable_rls_deny_all_public` + `20260712000000_enable_rls_new_public_tables`):

   ```sql
   DO $$
   DECLARE r RECORD;
   BEGIN
     FOR r IN SELECT tablename FROM pg_tables WHERE schemaname = 'public' LOOP
       EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY;', r.tablename);
     END LOOP;
   END $$;
   ```

   No crea políticas · no usa `FORCE ROW LEVEL SECURITY` · no cambia grants/roles/ownership ·
   solo tablas ordinarias de `public`. Deja `relrowsecurity=true` y `relforcerowsecurity=false`.

## Cómo se validó (baseline sola, en el momento de crearla)

> Los pasos y conteos de esta sección describen la validación **cuando la baseline era la única
> migración** (estado histórico). El job `migration-replay` **actual** aplica **2** migraciones
> (baseline + `20260712000000_add_versioned_document_model`) y valida el catálogo **vigente**
> (31/431/49/258/65/111). La descripción vigente del job está en
> [`governance/ci-quality-gates.md`](governance/ci-quality-gates.md) y el catálogo vigente en
> [`governance/database-migrations.md`](governance/database-migrations.md).

- **Local:** `pnpm typecheck`, `pnpm lint`, `pnpm test`, `pnpm check:migration-history`.
- **CI (job `migration-replay`, PostgreSQL 17 real y efímero) — así se validó la baseline sola:**
  1. `pnpm check:migration-history` (invariante del historial).
  2. `prisma migrate deploy` sobre base vacía aplicaba solo la baseline (entonces era la única).
  3. Confirmaba que se aplicó exactamente `000000000000_squashed_migrations`.
  4. `prisma migrate status` (up to date).
  5. `pnpm check:rls` (0 tablas de `public` sin RLS).
  6. `prisma migrate diff --from-url <db> --to-schema-datamodel prisma/schema.prisma --exit-code`
     (paridad estructural; RLS no cuenta como diff porque Prisma no lo modela).
  7. Verificaciones de catálogo **de la baseline sola**: **30** tablas, **412** columnas, **48**
     enums, **255** valores, **60** FKs, **101** índices, **0** tablas sin RLS, **0** con FORCE RLS,
     **0** políticas. _(Tras PR5B1 el job valida 31/431/49/258/65/111.)_
  8. Segundo `prisma migrate deploy` idempotente (sin cambios).

## Cómo crear futuras migraciones

- Usar siempre `pnpm prisma migrate dev --name <slug>` (genera un timestamp único de 14 dígitos).
- **Nunca** editar una migración ya aplicada.
- **Nunca** reutilizar un timestamp existente ni crear dos carpetas con el mismo prefijo.
- `pnpm check:migration-history` falla si hay colisiones de prefijo, nombres inválidos, falta la
  baseline o falta `migration.sql`.
- El job `migration-replay` garantiza que el historial sigue siendo reconstruible desde cero.

## ⚠️ Advertencia de despliegue remoto (estado actual)

> **Contexto (2026-07-13).** La baseline **ya está fusionada en `main`** (commit `00be57b`; HEAD
> `1b0f6fb` desciende de él). La intención original de esta advertencia era **no** fusionar la
> baseline antes de marcarla como aplicada en los entornos remotos; el orden real difirió y el
> paso remoto quedó como tarea de rollout. Lo que sigue vigente es el **procedimiento** del paso
> remoto, no un bloqueo de merge.

**Marcar la baseline como aplicada en los entornos remotos** mediante
`prisma migrate resolve --applied 000000000000_squashed_migrations` en staging y producción es un
paso **pendiente del rollout operativo**, que debe seguir el procedimiento autorizado y verificado
por separado (ver [`operations/fase-0-operational-closeout.md`](operations/fase-0-operational-closeout.md)
y [`governance/database-migrations.md`](governance/database-migrations.md)).

El `resolve` **solo inserta un registro de metadatos** en `_prisma_migrations` (no ejecuta DDL, no
toca datos), y requiere su propia autorización, backup previo y `project_ref` confirmado. Hasta
ejecutarlo, ningún entorno remoto ha sido modificado por la baseline (esquema y datos intactos).
