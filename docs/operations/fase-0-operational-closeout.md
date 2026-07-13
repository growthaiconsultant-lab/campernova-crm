# Cierre operativo de Fase 0

| Campo                            | Valor                                                                                                                                                                                                       |
| -------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Título**                       | Checklist de cierre operativo de Fase 0 (PENDING → PASS)                                                                                                                                                    |
| **Estado**                       | ACTIVE                                                                                                                                                                                                      |
| **Owner**                        | Operations / Engineering                                                                                                                                                                                    |
| **Última revisión**              | 2026-07-13                                                                                                                                                                                                  |
| **Fuente de verdad relacionada** | Runbook de detalle: [`../runbooks/document-storage-rollout.md`](../runbooks/document-storage-rollout.md). Estado técnico: [`../architecture/fase-0-final-state.md`](../architecture/fase-0-final-state.md). |
| **Alcance**                      | Pasos operativos para pasar el cierre operativo de Fase 0 de `PENDING` a `PASS`.                                                                                                                            |
| **Fuera de alcance**             | Ejecución automática. **Este documento no ejecuta nada**: es una lista de verificación para una operación supervisada y autorizada aparte.                                                                  |

> **Cierre técnico: `PASS`. Cierre operativo: `PENDING`.** El código y la CI están listos; faltan los
> pasos de rollout supervisado. Ninguno de estos pasos se ha ejecutado. El detalle de cada comando y
> sus guardas está en el runbook; este documento es la **puerta ejecutiva** con casillas.

---

## Prerrequisitos

- [ ] `SUPABASE_SERVICE_ROLE_KEY` configurada por entorno (staging y producción) en Vercel — **gate
      #1** (ver [`../governance/security-and-secrets.md`](../governance/security-and-secrets.md)).
- [ ] Owners asignados (Operaciones + Engineering de guardia).
- [ ] Backup/PITR reciente de la base de datos verificado.
- [ ] Capacidad de restauración probada (restore readiness).
- [ ] Ventana de mantenimiento acordada.
- [ ] _Freeze_ de cambios de documentos durante la ventana (sin subidas/reemplazos/borrados).
- [ ] Acceso a los conectores/entornos necesarios confirmado (con `project_ref` correcto).
- [ ] Runbook revisado por los ejecutores: [`../runbooks/document-storage-rollout.md`](../runbooks/document-storage-rollout.md).

## Staging

> El esquema Prisma (`prisma migrate deploy`) debe aplicarse **antes** que el backfill (el backfill
> requiere la tabla `document_versions`). No confundir con la migración de Storage
> (`supabase/migrations`), que es un sistema aparte.

- [ ] Migración de esquema Prisma aplicada y verificada en staging (`migrate status` up to date).
- [ ] Migración de Storage (`supabase/migrations`) aplicada en staging por el pipeline controlado.
- [ ] Auditoría DB read-only (`documents:audit --env staging`).
- [ ] Auditoría de Storage read-only (`documents:audit-storage --env staging`).
- [ ] Revisión de **BLOQUEADOS** (`WRONG_BUCKET`/`EXTERNAL_URL`/`INVALID_REFERENCE`/
      `ALREADY_VERSIONED_INCONSISTENT`): analizar antes de continuar.
- [ ] Plan de backfill generado (`documents:plan-backfill --env staging`); `planHash` anotado.
- [ ] `apply --dry-run` revisado (sin escritura).
- [ ] Reconciliación de buckets aplicada manualmente; **deny-all** confirmado en `vehicle-documents`.
- [ ] Canary de backfill (`--apply --max-records`), luego lote completo con checkpoints/resume.
- [ ] `verify-backfill` verde.
- [ ] Validación funcional (subir nuevo, abrir migrado legacy, permisos anon/authenticated denegados).
- [ ] Periodo de observación en staging.
- [ ] **Decisión go/no-go** registrada (basada en exit codes de verify + reconciliación).

## Producción

- [ ] Evidencia de staging verde adjunta.
- [ ] Cero incidencias críticas/altas en la validación de staging.
- [ ] Backup/PITR inmediato antes de tocar producción.
- [ ] Migración de esquema Prisma aplicada (**antes** del backfill).
- [ ] Reconciliación de Storage aplicada; deny-all confirmado.
- [ ] Canary de backfill + `verify`.
- [ ] Backfill por lotes con checkpoints.
- [ ] Monitorización (errores/latencia/consistencia) durante el proceso.
- [ ] Checkpoint final conservado (artefactos redactados, no en Git).
- [ ] Criterios de aborto definidos y comunicados (umbral de conflictos/errores, inconsistencias,
      incidencias de lectura en la app).
- [ ] Operador de rollback disponible (`documents:rollback-backfill`, exacto-o-bloqueado).

## Post-rollout

- [ ] Auditoría de huérfanos (`documents:audit-storage`) — reportar, **no** borrar automáticamente.
- [ ] Periodo de observación (p. ej. 2–4 semanas) con monitorización de lecturas legacy.
- [ ] Retirada del bucket legacy `lead-documents` (tras observación + auditoría limpia).
- [ ] Retirada de la columna `url` legacy — **PR separado**.
- [ ] Retirada de la lectura de fallback legacy — con la retirada de `url`.
- [ ] Limpieza del tooling si procede.
- [ ] **Cierre operativo de Fase 0 = `PASS`** registrado.

---

## Rollback (resumen)

- **Cuándo detener:** conflictos/errores por encima del umbral, inconsistencias de integridad,
  incidencias de lectura en la app.
- **Cómo revertir DB:** `documents:rollback-backfill` — sólo revierte versiones 1 creadas por el
  plan y no evolucionadas; restaura el `url` legacy **exacto** (`VALID_PATH`) o **bloquea**
  (`VALID_LEGACY_SIGNED_URL`, token no preservado); idempotente; **no toca Storage**.
- **Objetos:** los objetos históricos se conservan siempre.
- Detalle completo en el [runbook](../runbooks/document-storage-rollout.md#rollback).

> **Requiere autorización independiente.** Este documento no autoriza ni ejecuta el rollout; sólo lo
> estructura.
