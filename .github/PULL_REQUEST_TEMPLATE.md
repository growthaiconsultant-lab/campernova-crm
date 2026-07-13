<!--
Plantilla de PR. Rellena lo que aplique; marca N/A en lo que no.
Proceso completo: docs/governance/engineering-change-process.md
Testing: docs/governance/testing-strategy.md · Flujo git/commits: CONTRIBUTING.md
No marques casillas de validación post-despliegue antes del despliegue real.
-->

## Objetivo

<!-- Qué problema real resuelve este PR. -->

## Contexto y comportamiento actual

<!-- Evidencia, flujo afectado y comportamiento actual. Ticket CAM-XXX / enlace al plan si aplica. -->

## Solución implementada

<!-- Qué cambia y por qué es la solución mínima. -->

## Fuera de alcance

<!-- Qué NO incluye este PR. -->

## Clasificación del cambio

- Categorías (C0–C9):
- Nivel de riesgo (Bajo / Medio / Alto / Crítico):
- Bounded context:
- Driver arquitectónico (si introduce una entidad diferida):

## Impacto

- Modelos:
- Flujos:
- Autorización:
- Concurrencia:
- Datos existentes:
- KPIs:
- Storage:
- Efectos externos:

## Schema y migraciones

- [ ] No modifica el schema de Prisma.
- [ ] Incluye una migración nueva.
- [ ] La migración es aditiva.
- [ ] Requiere backfill.
- [ ] Requiere periodo de observación.
- [ ] Requiere PR de contracción posterior.
- [ ] Catálogo y documentación actualizados.
- [ ] N/A justificado:

## Seguridad y autorización

- [ ] Se han revisado casos permitidos y denegados.
- [ ] No se introducen secretos ni PII.
- [ ] No se expone código server-only al cliente.
- [ ] No se amplían privilegios sin justificación.
- [ ] Se ha revisado qué datos pueden llegar a logs, Sentry o PostHog.
- [ ] N/A.

## Concurrencia e idempotencia

- [ ] No aplica.
- [ ] Se ha definido la invariante.
- [ ] Se utiliza transacción, CAS o constraint cuando corresponde.
- [ ] Se han probado operaciones simultáneas.
- [ ] Los reintentos son seguros.

## Tests

- [ ] Unitarios.
- [ ] Integración PostgreSQL.
- [ ] Migration replay.
- [ ] Supabase local.
- [ ] Build.
- [ ] Casos negativos de autorización.
- [ ] Concurrencia.
- [ ] Regresión del bug.
- [ ] N/A justificado:

Comandos ejecutados y resultados:

    <!-- p. ej. pnpm typecheck / pnpm lint / pnpm test -> 721 passed -->

## Observabilidad y analítica

- [ ] No aplica.
- [ ] Se ha revisado la captura de errores y contexto en Sentry.
- [ ] Se han añadido o actualizado eventos de PostHog.
- [ ] Se ha verificado que no se envía PII, secretos ni información sensible.
- [ ] Se ha definido la métrica o señal de éxito.
- [ ] Se ha definido la métrica o señal de fallo.
- [ ] Se ha definido la validación post-despliegue.
- [ ] Se utiliza feature flag.
- [ ] El feature flag tiene owner, default seguro y criterio de retirada.

Detalles (si aplica):

- Errores o trazas:
- Eventos:
- Propiedades:
- Feature flag:
- Métrica de éxito:
- Métrica de fallo:
- Ventana de observación:

## Documentación

- [ ] No requiere actualización.
- [ ] ADR actualizada.
- [ ] Arquitectura actualizada.
- [ ] Gobierno actualizado.
- [ ] Runbook actualizado.
- [ ] Riesgos actualizados.
- [ ] Tracking/observabilidad documentados.

## Rollback y recuperación

<!-- Cómo se revierte o mitiga el cambio. -->

## Despliegue y operaciones

- [ ] No requiere operación manual.
- [ ] Requiere configuración por entorno.
- [ ] Requiere staging.
- [ ] Requiere producción supervisada.
- [ ] Requiere backfill.
- [ ] Requiere periodo de observación.
- [ ] Requiere revisión de Sentry/PostHog después del despliegue.

## Checklist final

- [ ] Alcance acotado; el diff corresponde a la descripción.
- [ ] Diff revisado; sin secretos ni PII; sin archivos no justificados.
- [ ] Tests verdes; observabilidad proporcional al riesgo.
- [ ] Documentación actualizada si aplica.
- [ ] CI completa en verde (no merge con checks pendientes).
- [ ] Sin abstracción prematura (no entidades diferidas sin driver).
- [ ] No mezcla el rollout documental de Fase 0 con una migración de Fase 1.
- [ ] Validación post-merge prevista; validación post-despliegue prevista si aplica.
- [ ] Commits siguen Conventional Commits (ver `CONTRIBUTING.md`).
