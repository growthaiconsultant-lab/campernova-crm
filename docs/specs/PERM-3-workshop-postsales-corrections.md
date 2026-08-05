# PERM-3 — Corregir estados de Taller y Postventa sin duplicar costes

| Campo               | Valor                                                                                                                   |
| ------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| **Estado**          | APPROVED                                                                                                                |
| **Owner**           | Engineering                                                                                                             |
| **Ticket**          | [GitHub #168](https://github.com/growthaiconsultant-lab/campernova-crm/issues/168)                                      |
| **Rama / PR**       | `codex/perm-3-workshop-postsales-design` / [PR #169](https://github.com/growthaiconsultant-lab/campernova-crm/pull/169) |
| **Categorías**      | C0, C1, C2, C3, C4, C5, C6                                                                                              |
| **Riesgo**          | Alto                                                                                                                    |
| **Ruta SDD**        | Reforzada                                                                                                               |
| **Última revisión** | 2026-08-05                                                                                                              |

## Problema y evidencia — A. Objetivo

Taller y Postventa tienen máquinas de estados deliberadamente lineales, pero una equivocación
operativa deja registros terminales sin vía de corrección. Abrir transiciones sin más sería inseguro:

- completar una orden crea costes de mano de obra y piezas (`app/(backoffice)/taller/actions.ts:173-268`);
- cerrar un ticket crea un coste de Postventa (`app/(backoffice)/postventa/actions.ts:121-167` y
  `lib/postventa/impute-ticket-cost.ts:7-30`);
- el cierre de Postventa actualiza estado, Activity e imputación en operaciones separadas, por lo que
  un fallo intermedio puede dejar el ticket cerrado sin coste (`app/(backoffice)/postventa/actions.ts:146-165`);
- dos cierres concurrentes pueden superar el pre-read y duplicar efectos: Taller no usa CAS y
  `VehicleCost` sólo tiene un índice no único por `workOrderId` (`prisma/schema.prisma:1076-1094`);
- `VehicleCost` no identifica hoy el ticket de Postventa que lo originó
  (`prisma/schema.prisma:1076-1094`, `prisma/schema.prisma:1351-1377`);
- varias barreras de inmutabilidad terminal sólo están en la UI. El servidor permite modificar el
  checklist, piezas y coste estimado de órdenes cerradas (`app/(backoffice)/taller/actions.ts:275-295`,
  `app/(backoffice)/taller/actions.ts:347-383`, `app/(backoffice)/taller/actions.ts:444-464`) y permite
  editar `costReal` de un ticket cerrado (`app/(backoffice)/postventa/actions.ts:99-118`,
  `app/(backoffice)/postventa/actions.ts:173-188`).

El usuario afectado es el equipo operativo: ADMIN y TALLER en órdenes; ADMIN y ENTREGAS en tickets.
El objetivo es admitir correcciones explícitas y auditables sin convertir las máquinas de estados en
edición libre, sin rebajar permisos y sin alterar el margen más de una vez por intención.

## Resultado esperado

- Las correcciones hacia el estado inmediatamente anterior son posibles cuando no rompen una
  invariante, con motivo obligatorio y Activity atómica.
- Reabrir un estado terminal es una acción administrativa separada, no una transición ordinaria.
- Completar o cerrar es atómico, idempotente frente a doble clic/concurrencia y genera como máximo un
  coste por fuente y concepto.
- Los costes generados quedan enlazados a su orden o ticket; no pueden editarse ni borrarse por la vía
  manual de costes.
- Los timestamps se reconcilian con el estado actual; no quedan `resolvedAt`/`closedAt` o
  `completedAt` contradictorios.
- `INSPECCION_ENTRADA` conserva sus gates: una corrección no puede invalidar retroactivamente la
  entrada oficial ni la tasación oficial.
- Los roles de solo lectura dejan de ver controles que el servidor rechazará, manteniendo el guard
  server-side como barrera definitiva.
- La señal de éxito es: pruebas concurrentes en PostgreSQL con una sola transición/Activity/imputación,
  reconciliación de costes sin duplicados y smoke autenticado por rol después del despliegue.

## B. Baseline verificado

| Etiqueta                | Hecho                                                                                                                                                           | Evidencia                                                                                                                                                 |
| ----------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `VERIFICADO EN CÓDIGO`  | Taller permite sólo avance lineal y termina en `COMPLETADA` o `RECHAZADA`.                                                                                      | `app/(backoffice)/taller/actions.ts:43-54`; duplicado en UI en `app/(backoffice)/taller/[id]/work-order-actions-bar.tsx:8-15`.                            |
| `VERIFICADO EN CÓDIGO`  | Postventa permite `RESUELTO → EN_PROGRESO`, pero `CERRADO` y `ANULADO` son terminales.                                                                          | `app/(backoffice)/postventa/actions.ts:13-21`; UI duplicada en `app/(backoffice)/postventa/[id]/ticket-card.tsx:31-35`.                                   |
| `VERIFICADO EN CÓDIGO`  | Entrar en `EN_CURSO` exige aprobación CEO cuando corresponde.                                                                                                   | `app/(backoffice)/taller/actions.ts:196-203`.                                                                                                             |
| `VERIFICADO EN CÓDIGO`  | Completar Taller crea hasta dos `VehicleCost` dentro de la misma transacción, pero sin CAS ni unicidad.                                                         | `app/(backoffice)/taller/actions.ts:216-268`; `prisma/schema.prisma:1092-1093`.                                                                           |
| `VERIFICADO EN CÓDIGO`  | Cerrar Postventa imputa fuera de la actualización de estado y de la Activity.                                                                                   | `app/(backoffice)/postventa/actions.ts:141-167`; `lib/postventa/impute-ticket-cost.ts:22-30`.                                                             |
| `VERIFICADO EN CÓDIGO`  | Los costes alimentan margen potencial, margen mensual y ficha financiera.                                                                                       | `lib/dashboard/metrics.ts:81-103`, `lib/dashboard/metrics.ts:197-223`, `app/(backoffice)/vendedores/[id]/page.tsx:385-403`.                               |
| `VERIFICADO EN CÓDIGO`  | Las órdenes activas bloquean publicación y cuentan en capacidad/KPIs.                                                                                           | `lib/kpi/operaciones.ts:18-23`, `lib/kpi/operaciones.ts:71-96`; `lib/taller/prisma-deps.ts:7-35`.                                                         |
| `VERIFICADO EN CÓDIGO`  | `INSPECCION_ENTRADA COMPLETADA` es gate de tasación oficial; una inspección activa es única por vehículo.                                                       | `lib/valuation/official.ts:156-165`; `prisma/migrations/20260726120000_add_official_entry_activity_and_inspection_index/migration.sql:40-47`.             |
| `VERIFICADO EN CÓDIGO`  | Anular una entrada rechaza su inspección activa dentro del lock del vehículo.                                                                                   | `lib/entry/annul.ts:71-113`.                                                                                                                              |
| `VERIFICADO EN CÓDIGO`  | Taller editable: ADMIN/TALLER. Postventa editable: ADMIN/ENTREGAS.                                                                                              | `lib/auth.ts:60-69`, `lib/auth.ts:84-93`.                                                                                                                 |
| `VERIFICADO EN CÓDIGO`  | Las pruebas actuales cubren el flujo feliz, pero no doble ejecución, reapertura, timestamps ni inmutabilidad server-side completa.                              | `app/(backoffice)/taller/actions.test.ts:127-216`; `app/(backoffice)/postventa/actions.test.ts:90-130`; `lib/postventa/impute-ticket-cost.test.ts:18-59`. |
| `VERIFICADO EN ENTORNO` | Consulta agregada de solo lectura del 2026-08-05: 24 órdenes (19 `PENDIENTE`, 1 `EN_DIAGNOSTICO`, 4 `COMPLETADA`); 17 inspecciones, 5 reparaciones y 2 mejoras. | Prisma contra la base configurada localmente; no se extrajo PII ni identificadores.                                                                       |
| `VERIFICADO EN ENTORNO` | Las 4 completadas son reparaciones; 2 tienen insumos/costes, 3 filas de coste vinculadas, 0 grupos duplicados y 0 descuadres entre insumos e imputaciones.      | Misma consulta agregada de solo lectura del 2026-08-05.                                                                                                   |
| `VERIFICADO EN ENTORNO` | Hay 0 tickets y 0 costes `POSTVENTA`; no existe backfill histórico ambiguo hoy.                                                                                 | Misma consulta agregada de solo lectura del 2026-08-05.                                                                                                   |
| `VERIFICADO EN ENTORNO` | `main` y la rama parten de `3d554dba8b8ad36fb4d9927a3220353745c7740e`; ese commit fue verificado desplegado y Ready antes de iniciar PERM-3.                    | `git rev-parse main`; evidencia operativa de PERM-2 del 2026-08-05.                                                                                       |
| `DECISIÓN DOCUMENTADA`  | Dinero, migraciones y concurrencia obligan a ruta SDD reforzada.                                                                                                | `docs/governance/sdd-workflow.md:65-73`; `docs/governance/engineering-change-process.md:95-100`.                                                          |
| `DECISIÓN REQUERIDA`    | Falta fijar cuándo cambia el margen durante una reapertura terminal.                                                                                            | Sección E de este documento.                                                                                                                              |

No se ha modificado producción durante esta fase. Los agregados son una fotografía, no sustituyen el
preflight inmediatamente anterior a cualquier migración.

## C. Alcance

- Máquina de estados, timestamps y acciones de corrección de `WorkOrder` y `PostventaTicket`.
- Atomicidad, CAS, locks e idempotencia de completar/cerrar.
- Vinculación y unicidad de costes generados en `VehicleCost`.
- Barreras server-side de edición de hijos/datos en estados terminales.
- Restricción de edición manual de costes generados.
- UI de transición/corrección y visibilidad por permiso.
- Readers de margen, KPIs, capacidad, escalado, agenda y gates de entrada/tasación.
- Migración aditiva, preflight, replay, pruebas PostgreSQL, rollout y observación.

## D. Exclusiones

- Cambiar los roles vigentes o ampliar Taller/Postventa a AGENTE/MARKETING.
- Hacer transiciones arbitrarias entre cualquier par de estados.
- Reabrir una `INSPECCION_ENTRADA` terminal en esta versión.
- Anular entradas, tasaciones oficiales, ventas, entregas o garantías como efecto colateral.
- Convertir `VehicleCost` en un sistema contable general o integrar facturación externa.
- Borrar o reescribir Activities históricas.
- Deploy, migración o cambio de datos mientras la spec esté `DRAFT`.
- Instrumentación PostHog: no hay una pregunta de producto que la justifique.

## E. Decisiones de negocio

### Decisiones cerradas por evidencia

| Decisión               | Resolución                                                                          | Motivo                                                                                                                                                                        |
| ---------------------- | ----------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Tipo de acción         | Separar avance ordinario, corrección no terminal y reapertura terminal.             | Permite permisos, mensajes y efectos distintos; evita una matriz libre.                                                                                                       |
| Corrección no terminal | Sólo un paso hacia atrás, con motivo.                                               | Recupera errores operativos sin saltarse aprobación ni fases.                                                                                                                 |
| Reapertura terminal    | ADMIN, motivo obligatorio y confirmación.                                           | Afecta terminalidad, KPIs y potencialmente dinero.                                                                                                                            |
| Inspección de entrada  | No reabrir terminales en PERM-3.                                                    | `COMPLETADA` puede haber habilitado una tasación oficial y `RECHAZADA` puede proceder de anular la entrada. No existe relación que permita revertir ese gate de forma segura. |
| Coste generado         | Debe quedar identificado por su fuente y protegido frente a edición/borrado manual. | El margen debe reconciliarse desde una única fuente operativa.                                                                                                                |
| Reintento              | Mismo target ya aplicado devuelve éxito idempotente sin nueva Activity ni coste.    | Doble clic/retry no representa una nueva intención.                                                                                                                           |

### Decisión financiera aprobada por Joel

Cuando ADMIN reabre `WorkOrder COMPLETADA → EN_CURSO` o `PostventaTicket CERRADO → RESUELTO`, ¿qué
ocurre con el coste ya imputado durante el intervalo de reapertura?

| Opción                                           | Conducta                                                                                                                                                                                                     | Impacto                                                                                                                                                  |
| ------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **A — mantener hasta refinalizar (recomendada)** | El coste enlazado conserva el último importe finalizado. Al completar/cerrar de nuevo se reconcilia atómicamente —crear, actualizar o retirar la proyección— y la Activity registra importes anterior/nuevo. | El margen no oscila por una corrección operativa temporal; exige mostrar “pendiente de refinalización” y bloquear edición manual del coste.              |
| B — retirar al reabrir                           | La reapertura saca inmediatamente del margen el coste generado; la refinalización lo vuelve a crear.                                                                                                         | El margen cambia aunque el trabajo ya se haya realizado; requiere decidir cómo auditar la retirada y cómo tratar fallos entre reapertura y nuevo cierre. |
| C — no reabrir estados financieros               | `COMPLETADA` y `CERRADO` continúan terminales; PERM-3 sólo abre correcciones no terminales y `RECHAZADA`/`ANULADO`.                                                                                          | Es la opción más conservadora, pero no resuelve errores de cierre/completado.                                                                            |

Recomendación: **A**. `VehicleCost` es hoy una proyección operativa del coste del vehículo, no el libro
contable ni una factura. Mantener el último posting hasta refinalizar evita volatilidad; la fuente
enlazada, la reconciliación y la Activity conservan trazabilidad suficiente para este CRM. Una
reversión económica real debe ser una acción financiera explícita, no un efecto implícito de cambiar
una etiqueta.

**Resolución:** Joel aprobó la opción **A** el 2026-08-05. Durante una reapertura terminal se conserva
el último coste contabilizado. La siguiente finalización reconcilia la proyección de forma atómica y
registra el cambio en la Activity. Una reversión económica real sigue requiriendo una acción financiera
explícita; no nace implícitamente de cambiar el estado operativo.

## F. Flujo funcional

### Taller

1. ADMIN/TALLER usa el avance ordinario existente.
2. Si el estado anterior fue marcado por error, elige “Corregir estado”, escribe un motivo y retrocede
   exactamente un paso.
3. Si una reparación/mejora está `RECHAZADA` o `COMPLETADA`, sólo ADMIN ve “Reabrir”.
4. El servidor bloquea la raíz vehículo, relee orden/lead/insumos dentro de transacción, valida clase de
   orden, estado, aprobación y target, y aplica CAS.
5. En `COMPLETADA`, reconcilia los costes vinculados y crea la Activity en la misma transacción.
6. Si ya estaba en el target por un retry, devuelve éxito sin repetir efectos.
7. Si la orden cambió a otro estado, informa de conflicto y obliga a recargar.

### Postventa

1. ADMIN/ENTREGAS avanza `ABIERTO → EN_PROGRESO → RESUELTO → CERRADO` o anula cuando procede.
2. Puede corregir un paso no terminal con motivo; `RESUELTO → EN_PROGRESO` deja de conservar un
   `resolvedAt` obsoleto.
3. Sólo ADMIN puede reabrir `ANULADO → ABIERTO` o, si se aprueba A/B, `CERRADO → RESUELTO`.
4. El servidor bloquea vehículo y comprador, relee ticket/warranty y aplica estado, timestamps,
   Activity y posting de coste en una sola transacción.
5. La UI muestra errores de dominio esperados; fallos técnicos no se presentan como éxito parcial.

### Recuperación

- Conflicto de estado: no escribir; recargar la ficha.
- Timeout/deadlock: no escribir parcialmente; mensaje recuperable y reintento consciente.
- Constraint de coste: abortar toda la transición y elevar error técnico sin datos sensibles.
- Error de validación o permiso: no escribir y no reportarlo a Sentry como excepción inesperada.

## G. Estados e invariantes

### Transiciones propuestas

| Módulo    | Transición                       | Tipo       | Actor          | Condición adicional                                             |
| --------- | -------------------------------- | ---------- | -------------- | --------------------------------------------------------------- |
| Taller    | actuales hacia delante           | ordinaria  | ADMIN/TALLER   | Se conserva aprobación CEO para entrar en `EN_CURSO`.           |
| Taller    | `EN_DIAGNOSTICO → PENDIENTE`     | corrección | ADMIN/TALLER   | Motivo obligatorio.                                             |
| Taller    | `PRESUPUESTADA → EN_DIAGNOSTICO` | corrección | ADMIN/TALLER   | Motivo obligatorio.                                             |
| Taller    | `EN_CURSO → PRESUPUESTADA`       | corrección | ADMIN/TALLER   | Motivo obligatorio; limpia `startedAt`.                         |
| Taller    | `RECHAZADA → PENDIENTE`          | reapertura | ADMIN          | Sólo `REPARACION`/`MEJORA`; motivo obligatorio.                 |
| Taller    | `COMPLETADA → EN_CURSO`          | reapertura | ADMIN          | Sólo `REPARACION`/`MEJORA`; decisión A/B; limpia `completedAt`. |
| Postventa | actuales hacia delante           | ordinaria  | ADMIN/ENTREGAS | `CERRADO` reconcilia coste atómicamente.                        |
| Postventa | `EN_PROGRESO → ABIERTO`          | corrección | ADMIN/ENTREGAS | Motivo obligatorio.                                             |
| Postventa | `RESUELTO → EN_PROGRESO`         | corrección | ADMIN/ENTREGAS | Motivo obligatorio; limpia `resolvedAt`.                        |
| Postventa | `ANULADO → ABIERTO`              | reapertura | ADMIN          | Motivo obligatorio.                                             |
| Postventa | `CERRADO → RESUELTO`             | reapertura | ADMIN          | Decisión A/B; motivo obligatorio; limpia `closedAt`.            |

Invariantes:

- Como máximo un posting de Postventa por ticket.
- Como máximo un posting agregado por orden y categoría generada (`MANO_OBRA_TALLER`, `PIEZAS`).
- Estado, timestamps, Activity y postings de una transición crítica confirman o revierten juntos.
- Un retry del mismo target no crea una nueva Activity.
- `INSPECCION_ENTRADA COMPLETADA/RECHAZADA` permanece terminal.
- Ninguna corrección evita la aprobación CEO ni reactiva una entrada anulada.
- Sólo los estados no terminales admiten mutar checklist, horas, piezas, planificación o coste real.
- Los costes manuales (`workOrderId == null && postventaTicketId == null`) mantienen su flujo actual.

Normalización de timestamps:

- Taller `PENDIENTE|EN_DIAGNOSTICO|PRESUPUESTADA`: `startedAt=null`, `completedAt=null`.
- Taller `EN_CURSO`: `startedAt` se fija si falta; `completedAt=null`.
- Taller `COMPLETADA`: preserva `startedAt` y fija `completedAt`.
- Postventa `ABIERTO|EN_PROGRESO|ANULADO`: `resolvedAt=null`, `closedAt=null`.
- Postventa `RESUELTO`: fija/preserva `resolvedAt`, `closedAt=null`.
- Postventa `CERRADO`: preserva `resolvedAt` y fija `closedAt`.

## H. Permisos

| Acción                                     | ADMIN                | TALLER    | ENTREGAS     | AGENTE          | Enforcement                                        |
| ------------------------------------------ | -------------------- | --------- | ------------ | --------------- | -------------------------------------------------- |
| Avanzar/corregir orden no terminal         | Sí                   | Sí        | No           | No              | `requireCanEditTaller()` + dominio server-side.    |
| Reabrir orden terminal                     | Sí                   | No        | No           | No              | `requireAdmin()` en action separada.               |
| Avanzar/corregir ticket no terminal        | Sí                   | No        | Sí           | No              | `requireCanEditPostventa()` + dominio server-side. |
| Reabrir ticket terminal                    | Sí                   | No        | No           | No              | `requireAdmin()` en action separada.               |
| Ver módulos                                | según matriz vigente | Taller sí | Postventa sí | lectura vigente | Sin cambios a `lib/auth.ts:60-93`.                 |
| Editar/borrar posting generado manualmente | No                   | No        | No           | No              | Rechazo por vínculo de fuente, incluso para ADMIN. |

La UI recibe una capacidad explícita (`canEdit`, `canReopen`) y no muestra acciones a roles de lectura.
Esto corrige la discrepancia actual sin usar ocultación como sustituto del guard.

## I. Modelo de datos y migraciones

Cambio aditivo propuesto:

1. Añadir `VehicleCost.postventaTicketId String? @unique` y relación opcional con
   `PostventaTicket`; `onDelete: SetNull`, igual que la relación de orden.
2. Añadir unicidad compuesta `@@unique([workOrderId, category])`. PostgreSQL permite múltiples filas
   con `workOrderId=NULL`, por lo que los costes manuales no colisionan.
3. Mantener columnas nuevas nullable para compatibilidad con cliente anterior y datos legacy.
4. No añadir estados ni reescribir enums; la corrección usa los existentes.
5. No backfill de Postventa: el preflight verificado contiene 0 tickets y 0 costes de esa categoría.
6. Los 3 costes de taller ya vinculados son compatibles y no tienen duplicados. Repetir la consulta
   justo antes de migrar; detener si aparece un grupo duplicado.

La migración debe incluir SQL explícito, replay desde cero, `prisma validate/generate`, parity schema ↔
SQL y postflight de constraints. Si aparecen tickets o duplicados antes del rollout, se genera informe
agregado y se diseña reconciliación específica; no se infiere vínculo por texto/descripción.

Compatibilidad:

- cliente viejo + schema nuevo: funciona porque la columna es nullable y la unicidad sólo rechaza
  duplicados que ya son incorrectos;
- cliente nuevo + schema viejo: no funciona; DB debe desplegarse antes que el cliente;
- rollback de cliente: deja columnas/índices aditivos, que son tolerados por el cliente viejo.

## J. Writers y readers — inventario de impacto

| Componente                                             | Comportamiento actual                                                                | Cambio previsto                                                                                   | Riesgo                                         | Validación                                     |
| ------------------------------------------------------ | ------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------- | ---------------------------------------------- | ---------------------------------------------- |
| `app/(backoffice)/taller/actions.ts`                   | Matriz inline; completion crea costes; varios writers sin guard terminal.            | Actions delgadas sobre dominio transaccional; guards terminales; corrección/reapertura separadas. | Duplicado, bypass, estado parcial.             | Unit + integración PostgreSQL + auth negativa. |
| `app/(backoffice)/postventa/actions.ts`                | Estado, Activity y coste no atómicos; costes editables tras cierre.                  | Núcleo transaccional único; timestamps y guards.                                                  | Ticket cerrado sin coste o coste duplicado.    | Fallo inyectado + carrera real.                |
| `lib/postventa/impute-ticket-cost.ts`                  | `create` ciego sin vínculo.                                                          | Sustituir por reconciliación transaccional source-linked.                                         | Duplicidad/retry.                              | Idempotencia y cambio de importe.              |
| `prisma/schema.prisma` + migración                     | Índice no único de orden; sin vínculo de ticket.                                     | FK/unique aditivos.                                                                               | Migración falla por datos nuevos.              | Preflight, replay, postflight.                 |
| `lib/entry/annul.ts`                                   | Rechaza inspección activa bajo lock de vehículo.                                     | Conservar; compartir protocolo de lock.                                                           | Carrera con acción de Taller.                  | Test concurrente anulación/transición.         |
| `lib/valuation/official.ts`                            | Exige inspección completada.                                                         | Sin cambio; excluir reapertura de inspección.                                                     | Invalidación retroactiva.                      | Caso negativo específico.                      |
| `app/(backoffice)/taller/[id]/*`                       | Matriz duplicada y edición terminal bloqueada sólo visualmente.                      | Importar política compartida/capacidades; diálogo con motivo.                                     | UI diverge del servidor.                       | Component tests + smoke por rol.               |
| `app/(backoffice)/postventa/[id]/ticket-card.tsx`      | Matriz duplicada; AGENTE ve acciones que el server deniega.                          | Capacidad explícita; corrección/reapertura y errores.                                             | Confusión/403 funcional.                       | Component tests por rol.                       |
| `app/(backoffice)/vendedores/[id]/cost-actions.ts`     | ADMIN puede editar/borrar cualquier coste.                                           | Rechazar postings con fuente; manuales siguen editables.                                          | Romper reconciliación.                         | Tests positivos/negativos.                     |
| `components/vehicle-economics/vehicle-costs-table.tsx` | No distingue fuente.                                                                 | Marcar “Generado por Taller/Postventa” y ocultar borrado.                                         | Operador intenta corregir en lugar equivocado. | Render + accesibilidad.                        |
| `lib/kpi/operaciones.ts`, `lib/taller/prisma-deps.ts`  | Activos bloquean publicación/capacidad.                                              | Sin cambio semántico; verificar reapertura.                                                       | KPI/backlog cambia al reabrir.                 | Reconciliación before/after.                   |
| `lib/postventa/escalation.ts`                          | Todo salvo `CERRADO/ANULADO` puede escalar.                                          | Sin cambio; reabierto vuelve a cola.                                                              | Ticket desaparece/aparece incorrectamente.     | Unit tests.                                    |
| `lib/dashboard/metrics.ts`                             | Margen suma `VehicleCost`; coste medio Postventa suma `costReal` sin filtrar estado. | Alinear coste medio con posting canónico o política A/B.                                          | Doble fuente discrepa.                         | Tests de reconciliación.                       |
| Fichas vendedor/comprador y dashboard                  | Consumen coste/estado.                                                               | Revalidar rutas afectadas tras commit.                                                            | Datos visuales obsoletos.                      | Smoke autenticado.                             |
| Agenda/calendario                                      | Lee órdenes planificadas independientemente del estado.                              | Verificar presentación al reabrir; no cambiar fuente.                                             | Orden terminal reaparece mal.                  | Unit/visual.                                   |
| Activities                                             | Texto registra transición, sin razón estructurada.                                   | Activity atómica con actor, old/new, tipo de acción y motivo saneado.                             | Auditoría incompleta/PII.                      | Assert de contenido y límites.                 |

Búsquedas realizadas: writers Prisma de `workOrder`, `postventaTicket` y `vehicleCost`; lectores por
estados/categorías; SQL/migraciones de tablas e índices; componentes de acciones; tests y documentos de
entrada/tasación. No se encontraron crons, webhooks, emails, Storage ni superficies públicas que
escriban estos estados. Los emails de ticket sólo ocurren al abrirlo, no al cambiar su estado.

## K. Concurrencia e idempotencia

- Raíz de coordinación de Taller: `Vehicle` y, cuando existe, `SellerLead`, usando
  `withLockedRoots` y el orden global existente (`lib/locking/types.ts:10-17`,
  `lib/locking/roots.ts:25-39`).
- Raíz de Postventa: `Vehicle` y `BuyerLead`, resueltos desde Warranty antes del lock y releídos dentro.
- Todos los writers de hijos que afectan el posting participan en el mismo lock o usan una garantía
  equivalente dentro de la transacción; un pre-read aislado no cuenta como barrera.
- CAS `updateMany({ where: { id, status: expected } })` impide confirmar desde un estado obsoleto.
- Unique constraints son la segunda barrera persistente frente a writers/retries inesperados.
- Mismo target ya aplicado: éxito idempotente sin Activity/posting nuevo.
- Target diferente tras el lock: conflicto de dominio, sin escritura.
- La Activity y la reconciliación de costes viven dentro de la transacción; invalidaciones Next fuera.
- Tests PostgreSQL sincronizan dos writers concurrentes para demostrar una sola transición y posting.
- No se necesita idempotency key nueva: lock + reread + CAS + unique resuelven el reintento de una
  transición a un target determinista. Si en implementación aparece una vía asíncrona, esta decisión se
  reabre.

## L. Efectos secundarios e integraciones

- Margen: usa `VehicleCost`; se reconcilia una vez por fuente.
- Coste medio Postventa: dejar de contar `costReal` sin estado/vínculo y usar la misma fuente canónica
  definida por la decisión A/B.
- Taller: reabrir vuelve a contar la orden como activa, bloquea publicación y entra en backlog.
- Postventa: reabrir vuelve a entrar en escalado y contadores abiertos.
- Tasación oficial/entrada: sin reapertura terminal de inspecciones.
- Activity: una por intención confirmada; ninguna por retry idempotente.
- Caché: revalidar Taller/Postventa, ficha vendedor/comprador, dashboard y listados financieros tras
  commit. No hay caché pública ni sitemap afectado.
- Emails/webhooks/Storage/PostHog: no aplica; no se añaden efectos.

## M. UX y errores

- “Avanzar” conserva botones simples; “Corregir” y “Reabrir” usan diálogo con estado origen/destino,
  impacto y motivo obligatorio.
- La reapertura terminal muestra advertencia de margen según A/B y requiere confirmación ADMIN.
- El motivo tiene límite y se registra sin emails, teléfonos, DNI ni payloads completos.
- Roles de lectura no ven controles mutadores.
- Mientras se ejecuta, deshabilitar doble submit; el servidor sigue siendo idempotente.
- Éxito indica el nuevo estado. Conflicto pide recargar. Permiso denegado usa el patrón existente. Error
  técnico mantiene el registro sin cambios parciales y ofrece reintento.
- En opción A, una ficha reabierta muestra “Coste contabilizado pendiente de refinalización”.
- Teclado, foco, labels y contraste se verifican en los nuevos diálogos; móvil conserva acciones
  alcanzables sin depender de hover.

## N. Tests

1. Unitarios de matrices, roles, timestamps, terminalidad y motivos.
2. Unitarios de reconciliación: crear, no duplicar, actualizar, retirar/poner a cero según la política
   aprobada y no tocar costes manuales.
3. Actions: autorización positiva/negativa; IDs inexistentes; transición manipulada; inspección
   terminal; approval CEO; child writer terminal; posting generado no editable.
4. PostgreSQL real:
   - dos `COMPLETADA` simultáneas → una transición, una Activity y máximo dos postings únicos;
   - dos `CERRADO` simultáneos → una transición, una Activity y un posting;
   - edición de pieza/coste simultánea con cierre → orden serializado y total coherente;
   - anulación de entrada simultánea con transición de inspección → sin inspección activa inválida;
   - rollback completo al inyectar fallo entre estado, Activity y posting.
5. Migración: preflight, replay desde cero, drift/parity y constraints en base efímera.
6. Componentes: visibilidad por rol, diálogo/motivo, loading/error y coste source-linked sin borrar.
7. Regresión: `check:sdd`, formato, typecheck, lint, suite Vitest, integración, build y CI completa.
8. Smoke autenticado post-deploy con ADMIN/TALLER/ENTREGAS/AGENTE y reconciliación agregada de costes.

## Rollout — O. Orden de despliegue

1. Resolver la decisión A/B/C y pasar la spec a `APPROVED` en un cambio documental revisado.
2. Implementar en rama nueva o continuar esta rama sólo con autorización explícita; no mezclar otras
   permisividades.
3. Preflight de producción: estados, duplicados `(workOrderId, category)`, tickets/costes Postventa,
   descuadres de input/posting y migraciones aplicadas.
4. Ejecutar batería local y PostgreSQL real; abrir PR de implementación con CI completa.
5. Autorizar por separado la migración y el deploy.
6. Aplicar migración aditiva antes del cliente; postflight de columnas, FK, unique y conteos.
7. Desplegar cliente; smoke autenticado controlado sin alterar registros reales ajenos: usar fixtures o
   un caso autorizado.
8. Reconciliar agregados inmediatamente y observar 24 horas Sentry/Vercel más KPIs financieros.
9. Sólo entonces declarar `DEPLOYED`/`VALIDATED` y cerrar #168.

Owner técnico: Engineering. Owner del smoke operativo y validación de conducta: Joel o persona que
delegue explícitamente. Producción no se modifica por aprobar este documento.

## P. Rollback y stop conditions

- Rollback de cliente: revertir el commit; mantener schema aditivo/constraints, compatible con cliente
  anterior.
- No borrar automáticamente costes creados durante la ventana: cualquier reconciliación es explícita,
  agregada y autorizada.
- Una migración ya aplicada no se revierte destructivamente; se mitiga con cliente anterior y se
  prepara contract posterior sólo si fuese necesario.
- Detener antes de migrar si aparece cualquier grupo duplicado, ticket legacy con coste no enlazable,
  drift, replay fallido o divergencia schema/SQL.
- Detener deploy si falla auth negativa, carrera PostgreSQL, rollback atómico o cualquier check CI.
- Detener/rollback del cliente si se observa doble posting, estado terminal mutable por vía indirecta,
  error rate nuevo >1 % en estas acciones, discrepancia de margen distinta de cero o inspección
  terminal reabierta.
- Si el rollback deja una intención de usuario sin aplicar, se informa; nunca se fuerza un estado
  mediante SQL ad hoc sin plan específico.

## Q. Observabilidad

- Fuente de auditoría: Activity transaccional, no Sentry ni PostHog.
- Fuente financiera: `VehicleCost` source-linked; reconciliar contra insumos/ticket.
- Registrar errores técnicos inesperados con operación, módulo, estado esperado/real y código de
  conflicto; no incluir nombre, teléfono, email, DNI, motivo libre ni descripción del ticket.
- Validaciones y permisos esperados no se capturan como excepciones.
- Métricas de observación: intentos confirmados, conflictos CAS, timeouts/deadlocks, violaciones unique,
  duplicados por fuente, descuadres de posting y tasa de error de actions.
- Revisión inmediata tras deploy y a las 24 h; owner Engineering. PostHog no participa.

## R. Documentación

- Esta spec es la fuente de verdad del comportamiento previsto.
- El issue #168 conserva estado operativo.
- Si se implementa: actualizar catálogo/modelo de datos, documentación de migraciones, tests y release
  con commit/PR/deployment reales.
- No actualizar `PROJECT-BRIEF` ni marcar estado como implementado hasta merge y validación.
- El documento local no versionado `docs/Integraciones-Telefonia-WhatsApp-Plan.md` queda fuera del diff.

## S. Riesgos y deuda explícita

| Riesgo/deuda                         | Prob.                     | Impacto | Mitigación                                                      | Owner / cierre                                            |
| ------------------------------------ | ------------------------- | ------- | --------------------------------------------------------------- | --------------------------------------------------------- |
| Política financiera no aprobada      | Alta                      | Alto    | Decisión A/B/C antes de código.                                 | Joel / siguiente gate.                                    |
| Doble cierre/completion actual       | Baja                      | Alto    | Lock + CAS + unique + test PostgreSQL.                          | Engineering / implementación PERM-3.                      |
| Writer terminal sólo protegido en UI | Media                     | Alto    | Guard dentro del mismo protocolo transaccional.                 | Engineering / implementación PERM-3.                      |
| Inspección reabierta invalida gate   | Baja                      | Crítico | Excluir terminales `INSPECCION_ENTRADA`.                        | Engineering / permanente.                                 |
| Datos cambian antes de migrar        | Media                     | Alto    | Repetir preflight y detener ante divergencia.                   | Engineering / rollout.                                    |
| KPI Postventa usa fuente distinta    | Media cuando haya tickets | Medio   | Alinear a posting canónico y test de reconciliación.            | Engineering / implementación.                             |
| Activity contiene motivo libre       | Media                     | Medio   | Límite, aviso UX y exclusión de observabilidad externa.         | Engineering / implementación.                             |
| `VehicleCost` no es libro contable   | Cierta                    | Medio   | Declararlo; reversión económica real fuera de cambio de estado. | Negocio/Engineering / futura contabilidad si se necesita. |

## Criterios de aceptación — T. Resultados verificables

- [x] Joel ha aprobado la opción A y la spec está `APPROVED` antes de implementar.
- [ ] Sólo se permiten las transiciones de la tabla G y los permisos de H.
- [ ] Toda corrección/reapertura confirmada exige motivo y crea exactamente una Activity atómica.
- [ ] Retry/doble clic del mismo target devuelve éxito sin duplicar Activity ni coste.
- [ ] Dos writers concurrentes no producen estado parcial ni más de un posting por fuente/concepto.
- [ ] `INSPECCION_ENTRADA` terminal no puede reabrirse y sus gates permanecen intactos.
- [ ] Estado y timestamps quedan normalizados según G.
- [ ] Ningún child writer modifica una orden/ticket terminal desde el servidor.
- [ ] Un coste generado no puede editarse/borrarse por la action manual; uno manual sí.
- [ ] Margen, coste medio Postventa, backlog, bloqueos y escalado se reconcilian con la política aprobada.
- [ ] Migración replaya, no tiene drift y pasa preflight/postflight sin pérdida de datos.
- [ ] Tests unitarios, PostgreSQL concurrente, auth negativa, componentes, typecheck, lint, suite, build y
      CI terminan con resultado conocido y documentado.
- [ ] Smoke por rol y observación de 24 h no detectan duplicados, descuadres ni errores nuevos.

## Revisión adversarial

| Hallazgo adversarial                                                         | Materialidad | Corrección incorporada                                                           |
| ---------------------------------------------------------------------------- | ------------ | -------------------------------------------------------------------------------- |
| Dos operadores completan a la vez y crean cuatro costes.                     | Crítica      | Lock raíz + reread + CAS + unique + test PostgreSQL.                             |
| Postventa queda `CERRADO` si falla `VehicleCost.create`.                     | Crítica      | Estado, Activity y posting en una transacción.                                   |
| Reabrir inspección elimina retroactivamente el gate de tasación.             | Crítica      | Terminales de `INSPECCION_ENTRADA` excluidos.                                    |
| ADMIN borra el coste generado y rompe la reconciliación.                     | Alta         | Los postings source-linked no admiten edición/borrado manual.                    |
| UI bloquea edición, pero una llamada directa cambia coste/piezas terminales. | Alta         | Guards server-side en todos los writers y tests negativos.                       |
| `RESUELTO → EN_PROGRESO` conserva `resolvedAt`.                              | Media        | Tabla canónica de normalización de timestamps.                                   |
| Reabrir hace desaparecer el coste del margen sin decisión de negocio.        | Alta         | Decisión A/B/C explícita; estado `DRAFT`.                                        |
| Una inspección es rechazada por anular entrada mientras Taller la avanza.    | Alta         | Mismo lock de vehículo y carrera de integración.                                 |
| Datos hoy vacíos de Postventa cambian antes del deploy.                      | Alta         | Preflight obligatorio inmediatamente antes de migrar.                            |
| KPI de Postventa suma `costReal` de tickets no cerrados.                     | Media        | Alinear a fuente canónica en el alcance y reconciliar.                           |
| Motivo de corrección filtra PII a Sentry.                                    | Alta         | Activity interna limitada; observabilidad sólo con códigos/IDs técnicos seguros. |

## Matriz de completitud

| Área                       | Revisada | Evidencia                                                  | Riesgo pendiente                                           |
| -------------------------- | -------- | ---------------------------------------------------------- | ---------------------------------------------------------- |
| Dominio                    | Sí       | F–G, matrices y excepciones de inspección.                 | Política financiera A/B/C.                                 |
| Estados                    | Sí       | Baseline B y tabla G.                                      | Ninguno adicional.                                         |
| Permisos                   | Sí       | H y `lib/auth.ts:60-93`.                                   | Smoke real por rol tras deploy.                            |
| Concurrencia               | Sí       | K; locks/CAS/constraints.                                  | Demostración PostgreSQL pendiente de implementación.       |
| Idempotencia               | Sí       | K; same-target no-op.                                      | Pendiente test real.                                       |
| Datos                      | Sí       | I + preflight agregado.                                    | Repetir fotografía antes de migrar.                        |
| Legacy                     | Sí       | 0 tickets/costes Postventa y 0 duplicados verificados.     | Datos pueden cambiar.                                      |
| Migración                  | Sí       | I y O.                                                     | SQL no existe mientras la spec sea DRAFT.                  |
| Compatibilidad             | Sí       | I; orden DB → cliente.                                     | Validar cliente anterior en CI/preview.                    |
| Readers                    | Sí       | J; margen, KPIs, gates, agenda y escalado.                 | Alinear KPI Postventa.                                     |
| Efectos secundarios        | Sí       | L.                                                         | Política A/B.                                              |
| Caché/superficies públicas | Sí       | L; sólo invalidaciones backoffice, sin superficie pública. | Smoke tras deploy.                                         |
| Observabilidad             | Sí       | Q.                                                         | Instrumentación concreta se decide al implementar sin PII. |
| Rollout                    | Sí       | O.                                                         | Requiere autorizaciones separadas.                         |
| Rollback                   | Sí       | P.                                                         | Costes confirmados no se borran automáticamente.           |
| Documentación              | Sí       | R.                                                         | Actualizaciones posteriores sólo si se implementa.         |

## U. Estado de autorización

**IMPLEMENTATION READY FOR CI REVIEW**

- Permitido ahora: implementar la opción A en esta rama, generar la migración local, ejecutar pruebas,
  crear commits y actualizar el PR borrador.
- Prohibido ahora: aplicar la migración en Supabase, modificar datos de producción, fusionar el PR,
  desplegar staging/producción o declarar el cambio implementado/desplegado antes de su evidencia.
- Siguiente gate: revisión del diff completo + CI verde + autorización separada para migración, merge y
  despliegue.

## Verificación de esta fase

| Criterio            | Evidencia                                                                  | Resultado                                                            |
| ------------------- | -------------------------------------------------------------------------- | -------------------------------------------------------------------- |
| Baseline de código  | Schema, actions, readers, tests, migraciones y permisos citados por línea. | Completado.                                                          |
| Baseline de entorno | Consultas agregadas read-only sin PII.                                     | Completado el 2026-08-05.                                            |
| SDD reforzado       | Secciones A–U, adversarial y matriz.                                       | `check:sdd` y `git diff --check`: OK.                                |
| Implementación      | Núcleos transaccionales, guards, UX, schema/migración y tests.             | Local completa; CI PostgreSQL pendiente.                             |
| Validación local    | Typecheck, lint, Prisma validate, SDD, build y 1.431 tests unitarios.      | PASS el 2026-08-05.                                                  |
| PostgreSQL real     | Tests de concurrencia, reconciliación y rollback en base efímera.          | Escritos; ejecución local no disponible sin Docker, pendiente de CI. |

## Cierre

- **Commit:** implementación pendiente de commit.
- **PR:** #169 en borrador; pendiente de actualizar con la implementación.
- **CI:** pendiente.
- **Deployment:** no autorizado.
- **Validación:** local PASS; PostgreSQL efímero, migration replay y revisión independiente pendientes.
- **Deuda restante:** CI, revisión independiente y autorizaciones separadas de migración/merge/deploy.
