# Runbook — Migración documental versionada + Storage privado (PR5B3)

> Runbook operativo **específico** de la transición legacy → modelo documental versionado
> (PR5B1) sobre la infraestructura de Storage versionada (PR5B2). No es la documentación general
> de arquitectura. **PR5B3 sólo PREPARA la operación**: no ejecuta nada contra staging/producción,
> no hace backfill real, no migra ni borra objetos. La ejecución real requiere una autorización
> posterior independiente.

## Herramientas (todas read-only o dry-run por defecto)

| Comando                                                     | Qué hace                                      | Escribe                                     |
| ----------------------------------------------------------- | --------------------------------------------- | ------------------------------------------- |
| `pnpm documents:audit -- --env <env>`                       | Clasifica referencias legacy (A–H) y agrega   | **No** (read-only)                          |
| `pnpm documents:audit-storage -- --env <env>`               | Cruza objetos de Storage con referencias DB   | **No** (read-only)                          |
| `pnpm documents:plan-storage-reconciliation -- --env <env>` | Diff de buckets vs config esperada → acciones | **No** (genera plan)                        |
| `pnpm documents:plan-backfill -- --env <env>`               | Genera plan de backfill (migrables) con hash  | **No** (escribe artefacto local gitignored) |
| `pnpm documents:apply-backfill -- --plan <f> ...`           | Backfill legacy → versión 1                   | **Sólo con `--apply` + confirmaciones**     |
| `pnpm documents:verify-backfill -- --plan <f> --env <env>`  | Verifica invariantes post-backfill            | **No** (read-only)                          |
| `pnpm documents:rollback-backfill -- --plan <f> ...`        | Revierte v1 creadas por un plan               | **Sólo con `--apply` + confirmaciones**     |

**Guardas de entorno** (`lib/documents/migration-env-guard.ts`): `--env local` sólo acepta
`127.0.0.1`/`localhost`; `--env staging` exige `ALLOW_STAGING_DOCUMENT_{AUDIT|BACKFILL}=true` y una
URL de staging; `--env production` exige `ALLOW_PRODUCTION_DOCUMENT_{AUDIT|BACKFILL}=true`, una URL
de producción **y** `--ack I_UNDERSTAND_THIS_IS_PRODUCTION`. Ningún fallback silencioso a remoto.

Los artefactos (informes, planes, checkpoints) se escriben en `.artifacts/document-migration/`
(**gitignored**, permisos `600`). Nunca contienen tokens de firma ni PII; los planes contienen
IDs y object paths reales (necesarios para aplicar) y por eso no se commitean.

---

## Fase 0 — Preparación

- Congelar cambios de documentos (sin subidas/reemplazos/borrados durante la ventana).
- Fijar el commit exacto a desplegar (`git rev-parse HEAD`).
- Verificar **backups** de la base de datos (snapshot Supabase reciente).
- Verificar secretos presentes en el entorno destino: `DATABASE_URL`, `NEXT_PUBLIC_SUPABASE_URL`,
  `SUPABASE_SERVICE_ROLE_KEY`. **No** configurarlos desde estas herramientas.
- Verificar buckets/políticas esperados (`documents:plan-storage-reconciliation`, read-only).
- Confirmar capacidad de rollback (plan generado + `rollback-backfill` disponible).

## Fase 1 — Auditoría read-only de staging

1. `ALLOW_STAGING_DOCUMENT_AUDIT=true DATABASE_URL=<staging> pnpm documents:audit -- --env staging --output .artifacts/document-migration/audit-staging.json`
2. `ALLOW_STAGING_DOCUMENT_AUDIT=true pnpm documents:audit-storage -- --env staging` (endpoint de staging).
3. Revisar clasificaciones: resolver `WRONG_BUCKET`, `EXTERNAL_URL`, `INVALID_REFERENCE`,
   `ALREADY_VERSIONED_INCONSISTENT` (estas últimas son **errores de integridad**: parar y analizar).
4. No se escribe nada en esta fase.

## Fase 2 — Aplicar migraciones Supabase en staging (fuera de PR5B3)

- Comando que se usaría (NO ejecutar en PR5B3): `supabase db push` con el proyecto de staging
  enlazado explícitamente y con backup previo. Guardas: revisar `supabase migration list` antes;
  confirmar el project-ref; nunca contra producción por error.
- Alternativa preferida: aplicar `supabase/migrations` mediante el pipeline controlado del equipo.

## Fase 3 — Backfill en staging

1. `pnpm documents:plan-backfill -- --env staging` → genera `backfill-plan-staging-<hash>.json` +
   imprime `planHash`.
2. Revisar `itemCount` / `blockedCount`. Anotar el `planHash`.
3. **Dry-run**: `pnpm documents:apply-backfill -- --plan <f> --plan-hash <hash> --env staging`
   (sin `--apply` → no escribe).
4. **Lote pequeño**: `... --apply --confirm APPLY_DOCUMENT_BACKFILL --batch-size 25 --max-records 25`
   (con `ALLOW_STAGING_DOCUMENT_BACKFILL=true`). Revisar el checkpoint.
5. `pnpm documents:verify-backfill -- --plan <f> --env staging`.
6. **Lote completo**: repetir `--apply` sin `--max-records` (reanuda por checkpoint con `--resume`).
7. Si algo falla: `pnpm documents:rollback-backfill -- --plan <f> --plan-hash <hash> --env staging --apply --confirm ROLLBACK_DOCUMENT_BACKFILL`.

## Fase 4 — Validación funcional en staging

- Subir un documento nuevo (crea versión 1 real).
- Abrir un documento legacy migrado (lectura → versión actual → signed URL 300 s).
- Reemplazo (si hay UI) / borrado con historial.
- Revisar permisos (anon/authenticated denegados), logs sin secretos, métricas.

## Fase 5 — Producción

- Ventana de mantenimiento / despliegue coordinado + **backup** inmediato antes.
- Auditoría read-only (`--env production`, con allow-var + `--ack`).
- Reconciliación de buckets (plan, revisión manual; aplicación manual controlada).
- Migración Supabase (pipeline controlado, backup, verificación).
- **Canary de backfill**: `--apply --max-records 20` + `verify` antes del resto.
- Backfill por lotes con checkpoints + monitorización (errores/latencia/consistencia).
- Validación final (verify + auditoría de huérfanos read-only).

## Fase 6 — Post-migración

- Comparar conteos (auditoría antes vs después: migrables → 0, structured ↑).
- Verificar referencias (verify-backfill sobre el plan).
- Detectar huérfanos (`audit-document-storage`) — **no borrar** automáticamente.
- **Mantener** el campo legacy `url` (su retirada es un PR separado, tras periodo de observación).
- Periodo de observación (p. ej. 2–4 semanas) con monitorización de lecturas legacy.

## Rollback

- **Cuándo detener**: conflictos/errores por encima del umbral, inconsistencias de integridad,
  incidencias de lectura en la app.
- **Cómo revertir DB**: `rollback-backfill` (sólo revierte v1 creadas por el plan y no evolucionadas;
  restaura `url` a su **valor legacy EXACTO**, anula puntero, borra la versión). Idempotente y seguro.
- **Reversibilidad exacta por clasificación**: las filas `VALID_PATH` son totalmente reversibles
  (su `url` legacy era el propio object path, sin token, y se restaura idéntica). Las filas
  `VALID_LEGACY_SIGNED_URL` **NO** se revierten automáticamente: su URL firmada original contiene un
  token que, por seguridad, no se conserva en el plan, así que el rollback las **bloquea** (`skipped`)
  en lugar de restaurar una referencia distinta. Su estado migrado es correcto y seguro; cualquier
  reversión de esas filas es una decisión manual.
- **Qué NO puede revertirse automáticamente**: documentos que ya recibieron una versión 2 real
  (evolucionaron) y las filas irreversibles (`VALID_LEGACY_SIGNED_URL`) — se omiten; decisión manual.
- **Objetos**: el rollback **no toca Storage**; los objetos históricos se conservan siempre.
- **Comunicación**: registrar el `planHash`, los checkpoints y los informes (todos redactados).
- **Evidencias**: conservar los artefactos de `.artifacts/document-migration/` (no en git).

---

### Invariantes de seguridad (garantizadas por el código)

- Auditoría y verificación: **read-only** (sólo `findMany` / `list` / `getBucket`).
- Backfill: **no toca Storage**; reutiliza el object path; idempotente (CAS sobre
  `currentVersionId=null, versionSequence=0`); metadata desconocida = `null` (no se inventa).
- Backfill/rollback: **dry-run por defecto**; escribir exige `--apply` + `--plan` + `--plan-hash`
  - `--confirm <TOKEN>` + guard de entorno (allow-var / `--ack` en producción).
- Reconciliación: genera **plan**, nunca aplica; **nunca** elimina `lead-documents`.
- Huérfanos: se **detectan y reportan**, nunca se borran automáticamente.
- El campo legacy `url` y el fallback de lectura legacy **se mantienen** en PR5B3.
