# Estado del programa I3 — coordinación de escritores de estado

> **Fuente de verdad del ESTADO del programa I3** (vigente en `main`, `ae88e31`). El contrato
> funcional vive en [`../domain/delivery-lifecycle.md`](../domain/delivery-lifecycle.md); el protocolo
> de concurrencia en [`../adr/0009-root-lock-coordination.md`](../adr/0009-root-lock-coordination.md);
> la operación de migraciones en [`../governance/database-migrations.md`](../governance/database-migrations.md);
> las garantías de test en [`../quality/delivery-test-matrix.md`](../quality/delivery-test-matrix.md);
> la narrativa histórica de implementación en [`../Ofertas-Reservas-Plan.md`](../Ofertas-Reservas-Plan.md).

## Terminología (no confundir niveles)

**Preparado** (código en rama) ≠ **PR abierto** ≠ **fusionado** (squash en `main`) ≠ **migrado**
(migración aplicada en un entorno remoto) ≠ **desplegado** (código sirviendo) ≠ **validado**
(comportamiento comprobado; distinguir validación técnica en CI vs validación autenticada manual en
producción).

## Estado por fase

| Fase      | Objeto                                                                                                                                                |      Fusionada       | Migrada (staging/prod) | Desplegada |                                     Validada                                      | Limitaciones                                                                          |
| --------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- | :------------------: | :--------------------: | :--------: | :-------------------------------------------------------------------------------: | ------------------------------------------------------------------------------------- |
| **I3A**   | `updateVehicle`: retira transiciones manuales RESERVADO/VENDIDO/DESCARTADO; CAS                                                                       |          ✓           |  n/a (sin migración)   |     ✓      |                                        CI                                         | —                                                                                     |
| **I3B**   | `updateVehicle` adopta root locks + retira DESCARTADO manual                                                                                          |          ✓           |          n/a           |     ✓      |                                        CI                                         | descarte final coordinado → I3D                                                       |
| **I3C1A** | Enlace `Delivery→Offer` (nullable, expand) + `createDelivery` coordinada                                                                              |          ✓           |       ✓ (expand)       |     ✓      |                                        CI                                         | —                                                                                     |
| **I3C1B** | `offer_id NOT NULL` (contract)                                                                                                                        |          ✓           |   ✓ (staging + prod)   |     ✓      |                               CI + postflight prod                                | —                                                                                     |
| **I3C2**  | Transiciones `PROGRAMADA→EN_CURSO` + cancelación coordinadas                                                                                          |          ✓           |  n/a (sin migración)   |     ✓      |               CI técnico; **flujo autenticado en prod: pendiente**                | guardas terminales checklist/firma → I3C3                                             |
| **I3C3**  | Compleción coordinada (Delivery→COMPLETADA, Vehicle→VENDIDO, `soldAt`, Match/Buyer, Warranty, follow-ups) + edición de checklist y firma serializadas | ✓ (squash `ae88e31`) |  n/a (sin migración)   |     ✓      | CI + postflight prod; **flujo autenticado end-to-end: limitado por 0 Deliveries** | checklist/firma validados y **escritos** bajo lock; TOCTOU cerrado; **no reversible** |
| **I3D**   | Descarte coordinado (`DESCARTADO` bloqueando ofertas/entregas activas)                                                                                |          —           |           —            |     —      |                                         —                                         | **no iniciado**                                                                       |
| **I3E**   | Tasación coordinada                                                                                                                                   |          —           |           —            |     —      |                                         —                                         | **no iniciado**                                                                       |

## Estado vigente (resumen)

- **I3A, I3B, I3C1A, I3C1B, I3C2, I3C3: cerrados** (fusionados y desplegados).
- **I3C3: fusionado (squash `ae88e31`), desplegado (Vercel production) y validado técnicamente**
  (CI de `main` verde: unit + integración PostgreSQL 17 con carreras reales; postflight read-only de
  prod sin incoherencias; `offer_id NOT NULL` en prod; `/entregas` carga con sesión autenticada). Sin
  migración. Coordina `EN_CURSO→COMPLETADA` bajo root locks.
- **I3D, I3E: pendientes** (no iniciados). **I3 NO está completo** mientras I3D e I3E sigan pendientes.
- **Writers de precondición serializados con la compleción: incluido en I3C3.** La edición de
  checklist (`updateChecklistItemTx`) y la firma (`writeSignatureTx`) entran en el **mismo protocolo de
  root locks** que la compleción: relean la entrega bajo el lock y rechazan en estados terminales. El
  TOCTOU checklist/firma↔compleción queda **cerrado end-to-end** (sin ventana residual); ambas carreras
  están demostradas con PostgreSQL real (`waitUntilBlocked`).
- **Validación autenticada END-TO-END del flujo de entrega: LIMITADA POR 0 DELIVERIES.** Producción no
  tiene ninguna `Delivery`, así que el postflight se cumple de forma **vacía** y el flujo de
  completar/checklist/firma **no** se ha observado en vivo. **No** se crearon datos ficticios para
  validar. Deuda registrada abajo.
- **Callers productivos de `withLockedRoots`: 8** (createOffer, updateOfferStatus, updateVehicle,
  createDelivery, transición/cancelación de Delivery, compleción de Delivery, **edición de checklist**,
  **firma**) — verificar contra código al cambiar.

## Estado canónico (post-deployment)

```
I3C1A: MERGED, MIGRATED (expand), DEPLOYED, VALIDATED
I3C1B: MERGED, MIGRATED (staging + prod), DEPLOYED, VALIDATED
I3C2:  MERGED, DEPLOYED, TECHNICALLY VALIDATED
I3C3:  MERGED (ae88e31), DEPLOYED, TECHNICALLY VALIDATED (no migration)
AUTHENTICATED I3C3 END-TO-END VALIDATION: LIMITED BY NO DELIVERY DATA
I3D:   NOT STARTED
I3E:   NOT STARTED
PR #117 (lead archiving, SEPARATE from I3): MERGED (fb501ef); DEPLOYED IN PRODUCTION via 4382774 (READY, no migration); prod serves 4382774; UI/mutating validation pending
```

## Deuda de validación (operativa, no automática)

```
VALIDATE AUTHENTICATED DELIVERY COMPLETION WITH THE FIRST SAFE REAL DELIVERY
```

- **No** crear datos ficticios en producción para cerrarla.
- **No** bloquea el resto del CRM.
- Cuando exista una operación real, comprobar en el backoffice: checklist, firma, acción
  «completar», y las guardas de estado terminal (COMPLETADA/CANCELADA no editan checklist/firma).
- Observar logs y datos después de la primera compleción real.
- Ejecutar con **autorización explícita**; es una comprobación manual, no una tarea automática.

### Deudas operativas de archivado (PR #117)

```
VERIFY AND DEPLOY ARCHIVING BACKEND SHA fb501ef TO PRODUCTION  ✅ CERRADA
```

- **Cerrada:** el backend de `fb501ef` está **desplegado en producción vía `4382774`** (`target=production`,
  READY, alias `campersnova.com`; `4382774` ⊇ `fb501ef`, diff docs-only; **sin migración**). El
  deployment específico de `fb501ef` fue un fallo transitorio puntual; el siguiente push de `main`
  desplegó con normalidad. Postflight read-only de prod **sin incoherencias** (0 leads archivados → vacuo).

```
VALIDATE ARCHIVE AND REACTIVATE WITH THE FIRST SAFE REAL LEAD  (abierta)
```

- Validación **mutante** con un lead real y seguro; requiere **autorización aparte**. Comprobar
  archivar/reactivar, motivo/notas, Activity, blockers, CalendarEvent, métricas y postflight; sin datos
  ficticios; sin bloquear el CRM. **No ejecutada.**

## PR #117 (archivado de leads — SEPARADO de I3)

- `feat(crm): add lead archiving actions` — **MERGED** (squash `fb501ef`), tras auditoría
  independiente y corrección (adopta `withLockedRoots`; **6/6 blockers serializados**; eventos de
  calendario futuros coordinados; **11 callers** productivos en `main`; sin migración).
- **No** forma parte de I3C3 ni de I3D/I3E.
- **No** es dependencia del `LEAD_ARCHIVED` que ya usan I2/I3 en producción: la columna `archivedAt` y
  su enforcement **ya eran productivos**; #117 añade las **acciones** de archivar/reactivar.
- **Desplegado en producción vía `4382774`** (`target=production`, READY, alias `campersnova.com`;
  `4382774` ⊇ `fb501ef`, diff docs-only; sin migración). El deployment específico de `fb501ef` fue un
  fallo transitorio puntual, resuelto por el siguiente push de `main`. Postflight read-only sin
  incoherencias (0 archivados → vacuo); health-check sano. Sin impacto de usuario (backend sin UX
  consumidora).
- **UX de visibilidad de archivados y validación MUTANTE en producción: pendientes** (esta última con
  autorización aparte y el primer lead real seguro).

## Pendientes (con propietario/fase)

| Pendiente                                          | Estado                          | Fase candidata | Decisión necesaria                |
| -------------------------------------------------- | ------------------------------- | -------------- | --------------------------------- |
| Compleción coordinada + checklist/firma (I3C3)     | fusionado y desplegado          | I3C3           | — (cerrado)                       |
| Validación autenticada end-to-end de una entrega   | deuda (limitada por 0 datos)    | transversal    | esperar 1ª Delivery real          |
| Descarte coordinado                                | pendiente                       | I3D            | —                                 |
| Tasación coordinada                                | pendiente                       | I3E            | —                                 |
| UI loading «Iniciar entrega»                       | pulido                          | opcional       | —                                 |
| Tests concurrentes frontera-específicos            | gap                             | opcional       | —                                 |
| Verificar/desplegar backend de archivado `fb501ef` | deployment no creado/verificado | operativo      | diagnóstico Vercel + autorización |
| Validar archivar/reactivar con 1er lead real       | deuda (no automática)           | operativo      | autorización explícita            |
