# Project Brief — Campers Nova CRM (estado técnico consolidado)

> **Documento distinto de `CLAUDE.md`.** `CLAUDE.md` es la guía de instrucciones/gobierno del repo (y
> conserva un log histórico por bloques); este Project Brief es la **fotografía técnica consolidada
> actual**. Fuentes complementarias: `docs/plans/crm-completion-master-plan.md` y los releases en
> `docs/releases/`.
>
> **Fecha de corte:** 2026-07-27.

## Estado del programa

|                                         |                                                                                              |
| --------------------------------------- | -------------------------------------------------------------------------------------------- |
| **`main`**                              | `6a8c61d`                                                                                    |
| **Migraciones**                         | **9**                                                                                        |
| **Deployment activo en Production**     | commit `6a8c61d`, `state=READY` (cliente con A1+A2+A3)                                       |
| **Tests**                               | ~1333 unitarios + integración PostgreSQL 17 (ver CI `quality`/`integration`; autoridad = CI) |
| **Producción** (`bbmglaatlyilxutzomxd`) | A1, A2 y A3 **migrados + desplegados**                                                       |
| **Staging** (`iatuhydsfwoeprpbklod`)    | A1, A2 y A3 migrados; datos sintéticos de e2e limpiados                                      |

## Bloques en producción

| Bloque            | Estado                                                                                          | Nota                                                                                                                                                                                                                                           |
| ----------------- | ----------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **HARD-1** (#137) | fusionado + desplegado + CI verde + smoke técnico                                               | validación autenticada en vivo + observación 24 h **pendientes**                                                                                                                                                                               |
| **PERM-1** (#136) | fusionado + desplegado + CI verde + smoke técnico                                               | sesiones reales por rol en vivo **pendientes** (cubierto por tests de auth)                                                                                                                                                                    |
| **M1** (#139)     | fusionado + desplegado + CI verde + smoke técnico                                               | verificación autenticada del cambio de matching **pendiente**; ~331 matches históricos ocultos por lectura (no borrados)                                                                                                                       |
| **A1** (#133)     | esquema de entrada oficial · **migrado (staging+prod) + fusionado + desplegado**                | comportamiento cero; validación autenticada backoffice pendiente                                                                                                                                                                               |
| **A2** (#140)     | entrada oficial + matching endurecido · **migrado (staging+prod) + fusionado + desplegado**     | **validación UI autenticada e2e en staging completa**; **smoke autenticado de producción y observación 24 h pendientes**                                                                                                                       |
| **A3** (#144)     | valoración preliminar vs tasación oficial · **migrado (staging+prod) + fusionado + desplegado** | **validación UI autenticada e2e en staging completa** (gates, oficial AGENTE/ADMIN, idempotencia vía Server Action, readers, `updateVehicle`); postflight prod sin backfill; **smoke autenticado de producción y observación 24 h pendientes** |

**A2 — redacción exacta del alcance validado:** _A2 panel and official-entry workflow authenticated
end-to-end validation complete; pre-existing document upload and bulk checklist prerequisites were
prepared through controlled staging setup._

## Roadmap

- **A3 — valoración preliminar vs tasación oficial**: **migrado (staging+prod) + fusionado (#144,
  `6a8c61d`) + desplegado** (deployment READY). Cierre del bypass hacia TASADO + idempotencia vinculada
  a la petición. Smoke autenticado de producción + observación 24 h **pendientes**. Detalle en
  `docs/releases/2026-07-28-a3-production.md`.
- **PUB-1** — publicación/despublicación: **pendiente**.
- **B1A** — señales económicas: **pendiente**.
- **DATA-1** — clasificación/limpieza de datos (incl. reconciliación de `Valuation` legacy y de los
  ~331 matches históricos): **pendiente**.
- **Fuera del alcance activo**: marketplace, SaaS para terceros, multiempresa/multi-tenancy.

## Pendientes operativos

- **Observación 24 h** (Sentry/Vercel) de A2 y **de A3** — **no** completada. Smoke técnico inmediato
  de A3 en prod: sin errores nuevos (Sentry limpio de A3).
- **Smoke autenticado read-only en producción** de A1/A2/A3 y de HARD-1/PERM-1/M1 — pendiente del dueño.
- **Secret keys temporales de staging (`a2_e2e_temporary`, `a3_e2e_temporary`, `a3_ui_final_temporary`):**
  usadas para las validaciones e2e; **revocadas** y `.env.staging.admin.local` vaciado → **no queda
  ningún acceso administrativo temporal a staging**.
- **Consolidación de `CLAUDE.md`**: su sección «Estado actual» es un log histórico por bloques; este
  Project Brief es la fotografía vigente. No se duplican cifras aquí en `CLAUDE.md`.
