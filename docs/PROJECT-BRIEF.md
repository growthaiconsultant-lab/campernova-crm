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
| **`main`**                              | `8ba036e`                                                                                    |
| **Migraciones**                         | **8**                                                                                        |
| **Deployment activo en Production**     | commit `8ba036e`, `state=success` (cliente con A1+A2)                                        |
| **Tests**                               | ~1289 unitarios + integración PostgreSQL 17 (ver CI `quality`/`integration`; autoridad = CI) |
| **Producción** (`bbmglaatlyilxutzomxd`) | A1 y A2 **migrados + desplegados**                                                           |
| **Staging** (`iatuhydsfwoeprpbklod`)    | A1 y A2 migrados; datos sintéticos de e2e limpiados                                          |

## Bloques en producción

| Bloque            | Estado                                                                                      | Nota                                                                                                                     |
| ----------------- | ------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| **HARD-1** (#137) | fusionado + desplegado + CI verde + smoke técnico                                           | validación autenticada en vivo + observación 24 h **pendientes**                                                         |
| **PERM-1** (#136) | fusionado + desplegado + CI verde + smoke técnico                                           | sesiones reales por rol en vivo **pendientes** (cubierto por tests de auth)                                              |
| **M1** (#139)     | fusionado + desplegado + CI verde + smoke técnico                                           | verificación autenticada del cambio de matching **pendiente**; ~331 matches históricos ocultos por lectura (no borrados) |
| **A1** (#133)     | esquema de entrada oficial · **migrado (staging+prod) + fusionado + desplegado**            | comportamiento cero; validación autenticada backoffice pendiente                                                         |
| **A2** (#140)     | entrada oficial + matching endurecido · **migrado (staging+prod) + fusionado + desplegado** | **validación UI autenticada e2e en staging completa**; **smoke autenticado de producción y observación 24 h pendientes** |

**A2 — redacción exacta del alcance validado:** _A2 panel and official-entry workflow authenticated
end-to-end validation complete; pre-existing document upload and bulk checklist prerequisites were
prepared through controlled staging setup._

## Roadmap

- **A3 — valoración preliminar vs tasación oficial**: **activo** (Draft PR #144; especificación
  congelada + decisiones D1–D5 vinculantes; implementación en curso). Sin migración/merge remotos.
- **PUB-1** — publicación/despublicación: **pendiente**.
- **B1A** — señales económicas: **pendiente**.
- **DATA-1** — clasificación/limpieza de datos (incl. reconciliación de `Valuation` legacy y de los
  ~331 matches históricos): **pendiente**.
- **Fuera del alcance activo**: marketplace, SaaS para terceros, multiempresa/multi-tenancy.

## Pendientes operativos

- **Observación 24 h** (Sentry/Vercel) de A2 — **no** completada.
- **Smoke autenticado read-only en producción** de A1/A2 y de HARD-1/PERM-1/M1 — pendiente del dueño.
- **Acción manual del dueño:** _Revoke the staging Secret API key named `a2_e2e_temporary`_ (usada para
  la validación e2e de A2; no revocable por CLI/MCP disponibles; su archivo local quedó vaciado).
- **Consolidación de `CLAUDE.md`**: su sección «Estado actual» es un log histórico por bloques; este
  Project Brief es la fotografía vigente. No se duplican cifras aquí en `CLAUDE.md`.
