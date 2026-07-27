# Plan Maestro de Finalización del CRM interno de Campers Nova

> **Naturaleza:** documento canónico de **planificación**. No declara implementado, desplegado ni
> validado nada que no lo esté (ver etiquetas de estado). Aprobado por el dueño el 2026-07-26 con
> cinco correcciones vinculantes ya incorporadas. Este documento **no** sustituye al Project Brief
> (`CLAUDE.md`), que está **materialmente desactualizado** (ver §12) y se consolidará más adelante.

## Estado verificado (2026-07-26, read-only)

| Elemento                                                     | Estado                                                                                                                                                              | Evidencia                                   |
| ------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------- |
| `main` HEAD                                                  | `cc4114d` — _docs(release): record CRM delivery 2026-07-26_                                                                                                         | `git log origin/main -1`                    |
| PR #134 (error boundary)                                     | **FUSIONADO + DESPLEGADO + VALIDADO** → `62074ad`                                                                                                                   | `gh pr view 134`, release doc               |
| PR #135 (release doc)                                        | **FUSIONADO** → `cc4114d`                                                                                                                                           | `gh pr view 135`                            |
| PR #133 (A1)                                                 | **DRAFT · abierto · mergeable · CI 4/4 verde** — no fusionado, no desplegado, migración no aplicada en remoto                                                       | `gh pr view 133`, run 30205435943           |
| Migraciones en `main`                                        | **6**                                                                                                                                                               | `git ls-tree origin/main:prisma/migrations` |
| Migraciones en rama A1 (`feat/vehicle-entry-foundations-a1`) | **7** — añade `20260726000000_add_vehicle_entry_foundations`                                                                                                        | `git ls-tree` de la rama                    |
| Producción (Vercel)                                          | Último confirmado `cc4114d` READY (release doc §3.3); re-verificación por Vercel MCP el 2026-07-26 quedó **rate-limited** → re-check al ejecutar                    | release doc                                 |
| Sentry (prod, 24 h)                                          | 2 issues no resueltas, **0 usuarios**: hydration error en `/vendedores/[id]?tab=compradores` (6 ev.); `window.webkit.messageHandlers` en `/` (1 ev., cosmético iOS) | Sentry `search_issues`                      |

> **Aviso sobre migraciones:** mientras A1 no esté fusionado, `main` tiene **6** migraciones y la rama
> A1 tiene **7**. No debe afirmarse genéricamente que "el repositorio tiene 7".

## Proceso canónico del vehículo

`lead vendedor → vehículo candidato → contacto/cualificación → decisión de continuar → contrato de
gestión firmado → llegada física → entrada oficial validada → orden de inspección → inspección →
tasación oficial → preparación de ficha → aprobación comercial → publicación → reserva → venta →
entrega`. Definiciones: **candidato** = Vehicle con SellerLead sin entrada oficial activa (no cuenta
como inventario/stock); **entrada oficial activa** = `entryValidatedAt!=null AND entryAnnulledAt==null`;
**stock en preparación** = entrada activa + status NUEVO/TASADO; **stock disponible** = PUBLICADO;
**reservado** = RESERVADO; **venta canónica** = `status=VENDIDO AND soldAt!=null`.

## Bloques

Estados por bloque: **IMPLEMENTADO / DESPLEGADO / VALIDADO / PLANIFICADO / PENDIENTE**.

### A1 — Fundamentos de esquema de entrada oficial · **MIGRADO (staging + producción) + FUSIONADO (#133 → `7871fb0`) + DESPLEGADO · validación autenticada pendiente**

> Ver `docs/releases/2026-07-26-a1-production.md`. Aditivo, sin backfill; cliente nuevo compatible (sin
> `P2022`); comportamiento cero (la entrada oficial funcional es A2).

Esquema aditivo, comportamiento cero (confirmado: solo referencias compile-compat). Campos de
entrada/anulación/llaves en `Vehicle`, enums `EntryAnnulmentReason` y `DocumentRequirementDisposition`,
tabla `VehicleDocumentRequirementDisposition`, `VehicleDocumentCategory += CONTRATO_GESTION`,
`WorkOrderKind += INSPECCION_ENTRADA`, RLS. PR #133 (Draft). **Rollout pendiente** — ver
`docs/runbooks/a1-entry-foundations-rollout.md`. Regla de orden **vinculante**: **BD nueva ANTES que
cliente nuevo** (el cliente antiguo tolera columnas nullable extra; el nuevo NO tolera que falten →
`P2022`).

### M1 — Elegibilidad de matching (interim) · **FUSIONADO + DESPLEGADO + VALIDADO (inmediata) · sin migración** (PR #139)

Política compartida: vehículo elegible = `status IN (TASADO,PUBLICADO) AND SellerLead.archivedAt==null`;
comprador elegible = `archivedAt==null AND status no terminal`. A2 añadirá `entrada activa`. Reutilizada
en generación, recálculo (ambos sentidos), notificaciones, reads (ficha vendedor/comprador, widget
"compradores esperando"), conteos/KPIs, `_count.matches`. **No** se limpian datos históricos (quedan
ocultos por la política de lectura; limpieza futura = DATA-1, con autorización).

### PERM-1 — Guards de rol server-side · **FUSIONADO + DESPLEGADO · validación inmediata (rutas 307, 0 runtime errors); smoke por rol en vivo NO ejercitado · sin migración** (PR #136)

Matriz vinculante: **ADMIN** completo; **AGENTE** comercial completo; **TALLER** solo vía Taller (sin
`purchasePrice`/margen/económico comercial/analytics completos); **ENTREGAS** solo vía Entregas (sin
margen/valoración interna/analytics completos); **MARKETING** sin acceso completo a `/vehiculos` — sin
`purchasePrice`/margen/documentos privados/PII completa; mientras no exista vista específica, el listado
comercial completo queda **denegado**. Guards server-side en `/vehiculos`, ficha vendedor, compradores,
ofertas, calendario, analytics/crm + acciones + URLs directas. Tests positivos y negativos por rol.
Sin RLS remota.

### HARD-1 — Estabilidad · **FUSIONADO + DESPLEGADO + VALIDADO (inmediata) · sin migración** (PR #137)

Corregir de raíz el hydration error de `/vendedores/[id]?tab=compradores` (no solo ocultarlo con el
error boundary). Boundaries específicos solo donde sean pequeños y necesarios.

### A2 — Entrada oficial + matching endurecido · **MIGRADO (staging + producción) + FUSIONADO (#140 → `2f33e58`) + DESPLEGADO · validación autenticada UI en staging completa; smoke autenticado prod + observación 24 h pendientes**

> Ver `docs/releases/2026-07-27-a2-production.md`. Expediente mínimo de entrada propio
> (`isReadyForOfficialEntry` = matrícula O VIN; NO TASADO). Validado e2e por UI autenticada en staging;
> subida documental + clasificación en bloque como prerrequisitos controlados.

Transacción de validación de entrada (precondiciones: contrato de gestión firmado, presencia física,
expediente mínimo, comercial responsable, ubicación, llaves custodiadas, checklist documental
clasificado) que valida, registra actor/fecha, crea **una** orden `INSPECCION_ENTRADA` visible a Taller,
Activity, sin duplicados, y **revierte la entrada si falla la orden**. Anulación por Dirección (terminal,
motivo/actor/fecha, notas con `OTRO`). Checklist documental derivado (vigente→RECIBIDO; disposición;
sin ambos→SIN_CLASIFICAR); `CONTRATO_GESTION` real (no satisfacible por disposición). Matching añade
`entrada activa`. Corrige de paso la escalada de privilegios de `createWorkOrder` si aplica. Bajo
`withLockedRoots` + relectura + CAS + idempotencia. Depende de A1 en prod + M1.

### A3 — Valoración preliminar vs tasación oficial · **PLANIFICADO**

`ValuationPurpose` (PRELIMINAR/OFICIAL); intentos append-only con outcomes (COMPLETADA/SIN_REFERENCIA/
FALLO_TECNICO) hoy descartados; preliminar no cambia estado/denormalizados/matching/publicación; oficial
exige entrada activa + inspección completada, escribe campos oficiales, habilita `NUEVO→TASADO`,
actor/fecha/Activity, lock+CAS, respeta archivado, no en VENDIDO/DESCARTADO. Manual: confianza
**declarada** (no hardcodear `ALTA` como hace hoy `overrideValuation`). Migración aditiva; resolver antes
`ValuationPurpose`/modelo de intentos/outcomes/relación con `Valuation`/`ReferencePrice` (nombres libres
hoy). Depende de A2.

### PUB-1 — Publicación y despublicación · **PLANIFICADO (definición completa vinculante)**

El gate de publicación debe incluir **de forma expresa**: entrada oficial activa; inspección completada;
tasación oficial; `salePrice`; **descripción pública obligatoria y validada**; matrícula o VIN;
`PhotoCategory` (EXTERIOR/INTERIOR/DETALLE/DOCUMENTAL) con **≥1 EXTERIOR y ≥1 INTERIOR**; aprobación
comercial; **`publishedAt` escrito solo si actualmente es null** (primera publicación) con actor +
Activity. **Despublicación** `PUBLICADO→TASADO` con motivo/actor/fecha/lock/CAS, bloqueada con ofertas
activas incompatibles, conserva `publishedAt`, permite **republicación auditable** (no archivar como
rollback). No inventar backfill de fotos antiguas. Documentos post-compra: advertencia, no bloquean
publicación salvo obligación legal explícita. Depende de A2/A3.

### B1A — Señales económicas · **PLANIFICADO (antes de aceptar dinero real)**

Estado intermedio antes de `ACEPTADA`; `ACEPTADA` = señal confirmada + reservado; expediente económico
1:1 con Offer; intentos 1:N insert-only; resolución al cerrar (FULL_REFUND/PARTIAL_REFUND/FULL_RETENTION)
con `devuelto+retenido=señal`; retención solo Dirección; Activity no es fuente de verdad. Devolución 48 h
laborables → concretar calendario laboral si resulta bloqueante. Bajo el protocolo de roots. Aditiva.

### DATA-1 — Clasificación de datos · **PLANIFICADO (solo planificación; ejecución con autorización)**

Clasificar vehículos/matches (real/prueba/dudoso) y depurar matches inelegibles persistidos: inventario
read-only + criterios + dry-run + lotes + reversibilidad. Leads reales de web nunca se reclasifican como
test; `CN` no significa prueba. No ejecutar sin autorización de datos.

## Gates de autorización

**Sin detenerse:** implementar local, tests/fixtures, correcciones mecánicas, replay local/CI, build,
commits, push, **Draft** PRs, documentación, reintentos de CI. **Requieren autorización explícita:**
merge · migración remota · staging con schema/datos · producción · deploy · backfill · cambios de datos ·
RLS/permisos remotos · secretos · rollback · destructivo · ampliación de alcance. **No iniciar** A2, A3,
PUB-1, B1A, DATA-1, I3D, I3E, telefonía, WhatsApp, marketplace, SaaS, multiempresa sin autorización.

## Definición objetiva de "CRM terminado"

Implementación del proceso canónico completo con señales económicas contabilizadas · seguridad
(guards de rol server-side + RLS + tests por rol) · consistencia (roots/lock/relectura/CAS/idempotencia;
matching sin fugas) · documentación consolidada (dominio, permisos, migraciones, runbooks, Brief) ·
operación desplegada sin migraciones pendientes, Sentry limpio · observación ≥24 h por bloque · adopción
(stock real publicado, equipo formado, datos de prueba clasificados). **No está terminado hoy.**

## Horizonte temporal

Estimación del core (A1→M1→PERM-1→A2→A3→PUB-1→B1A→DATA-1→docs/observación): **~3-4 semanas** de trabajo
efectivo, secuenciado por gates. **Ciclo actual (próximas horas):** A1 preparado para rollout; M1
implementado con CI verde; PERM-1 implementado/muy avanzado; HARD-1 corregido; este documento; A2
preparado para iniciar tras desplegar A1. **No** ejecutar A2/A3/PUB-1/B1A en paralelo (dominios
dependientes, con migraciones/concurrencia/dinero).

## Decisiones pendientes

- **Bloqueante por bloque (no del plan):** matriz de visibilidad de `/vehiculos` (PERM-1, ya fijada por
  el dueño); calendario laboral para devolución 48 h (B1A, solo si se implementa el temporizador).
- **Técnica razonable (default):** aprobación comercial implícita en `TASADO→PUBLICADO` v1; confianza
  manual declarada; outcomes de valoración COMPLETADA/SIN_REFERENCIA/FALLO_TECNICO.
- **Futura:** retirada de `url` legacy y del modelo `Document` plano; DATA-1; telefonía/WhatsApp (el
  archivo local `docs/Integraciones-Telefonia-WhatsApp-Plan.md` **no** autoriza integración).

## Documentación por milestone

A1→migraciones + runbook de rollout; M1→dominio matching + elegibilidad; PERM-1→matriz de permisos;
A2→runbook entrada + dominio; A3→runbook tasación; PUB-1→runbook publicación; B1A→runbook reservas/señales

- riesgos; todos→release/handoff. No documentar como implementado antes de merge (+migración/deploy/
  validación). Corregir la cifra obsoleta "8 callers" de `withLockedRoots` → **11**.

## §12 — Estado de la documentación de gobierno (dos documentos distintos)

Son **dos ficheros diferentes** y ambos pueden estar desactualizados; no deben tratarse como el mismo:

- **`CLAUDE.md`** (instrucciones del repo para el asistente): su **gobernanza sigue vigente**, pero el
  registro de estado de bloques (HEAD de `main`, nº de tests, nº/lista de migraciones, PRs recientes)
  está **materialmente desactualizado**.
- **Project Brief de Campers Nova** (documento de negocio, fecha ~15 de julio): también **claramente
  desactualizado** — `main` antiguo, cifras antiguas de tests y migraciones.

Ambos se actualizarán **tras** consolidar A1 y el siguiente bloque funcional (A2), para no reescribirlos
varias veces en pocas horas. Hasta entonces, este documento, `docs/releases/2026-07-26-crm-delivery.md`
y `docs/runbooks/a1-entry-foundations-rollout.md` son la fuente de estado más reciente.

## Actualización de integración — ciclo 2 (2026-07-26)

Integración controlada del primer ciclo, **sin migraciones ni cambios de datos**:

- **HARD-1 (#137)**, **PERM-1 (#136)** y **M1 (#139)** fusionados por squash a `main` y **desplegados a
  producción**. Validación **inmediata** (deployment READY, 0 runtime errors, rutas públicas 200 /
  privadas 307→login). HARD-1: observación de Sentry pendiente (no declarado resuelto). PERM-1: smoke
  por rol en vivo **no ejercitado** (sin sesiones de prueba por rol) — cubierto por 30 tests de auth.
  M1: bypass `status !== undefined` **demostrado seguro** (el único deps productivo `prismaMatchingDeps`
  siempre aporta `status`+`archivedAt`; los predicados exigen `status` en su tipo). Los ~331 matches
  históricos **no se borraron**: quedan ocultos por la política de lectura.
- **Docs (#138)** — este documento + runbook A1.
- **A1 (#133)**: sigue Draft; sincronización con el nuevo `main` + validación en **staging** pendientes;
  producción de A1 **no autorizada** (gate humano tras staging).
- **A2**: **no iniciado** en el momento de esta actualización.
- Deuda registrada: breadcrumbs de Taller/Entregas/Postventa → ficha de vendedor/comprador ahora 403 para
  esos roles (postura de seguridad correcta; sustituir por enlaces a vistas operativas permitidas).
