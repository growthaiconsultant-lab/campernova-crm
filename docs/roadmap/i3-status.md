# Estado del programa I3 — coordinación de escritores de estado

> **Fuente de verdad del ESTADO del programa I3** (vigente en `main`, `687eae1`). El contrato
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

| Fase      | Objeto                                                                                                    |           Fusionada            | Migrada (staging/prod) | Desplegada |                       Validada                       | Limitaciones                                                                                    |
| --------- | --------------------------------------------------------------------------------------------------------- | :----------------------------: | :--------------------: | :--------: | :--------------------------------------------------: | ----------------------------------------------------------------------------------------------- |
| **I3A**   | `updateVehicle`: retira transiciones manuales RESERVADO/VENDIDO/DESCARTADO; CAS                           |               ✓                |  n/a (sin migración)   |     ✓      |                          CI                          | —                                                                                               |
| **I3B**   | `updateVehicle` adopta root locks + retira DESCARTADO manual                                              |               ✓                |          n/a           |     ✓      |                          CI                          | descarte final coordinado → I3D                                                                 |
| **I3C1A** | Enlace `Delivery→Offer` (nullable, expand) + `createDelivery` coordinada                                  |               ✓                |       ✓ (expand)       |     ✓      |                          CI                          | —                                                                                               |
| **I3C1B** | `offer_id NOT NULL` (contract)                                                                            |               ✓                |   ✓ (staging + prod)   |     ✓      |                 CI + postflight prod                 | —                                                                                               |
| **I3C2**  | Transiciones `PROGRAMADA→EN_CURSO` + cancelación coordinadas                                              |               ✓                |  n/a (sin migración)   |     ✓      | CI técnico; **flujo autenticado en prod: pendiente** | guardas terminales checklist/firma → I3C3                                                       |
| **I3C3**  | Compleción coordinada (Delivery→COMPLETADA, Vehicle→VENDIDO, `soldAt`, Match/Buyer, Warranty, follow-ups) | preparado en PR (sin fusionar) |  n/a (sin migración)   |     —      |                          —                           | checklist/firma validados bajo lock; guarda terminal de edición de checklist; **no reversible** |
| **I3D**   | Descarte coordinado (`DESCARTADO` bloqueando ofertas/entregas activas)                                    |               —                |           —            |     —      |                          —                           | **no iniciado**                                                                                 |
| **I3E**   | Tasación coordinada                                                                                       |               —                |           —            |     —      |                          —                           | **no iniciado**                                                                                 |

## Estado vigente (resumen)

- **I3A, I3B, I3C1A, I3C1B, I3C2: cerrados** (fusionados y desplegados).
- **I3C3: preparado en rama/PR, sin fusionar, sin desplegar, sin validar.** Coordina la compleción
  `EN_CURSO→COMPLETADA` bajo root locks; sin migración.
- **I3D, I3E: pendientes** (no iniciados).
- **Guarda de edición de checklist en estados terminales: incluida en I3C3** (bloquea editar el
  checklist de una entrega COMPLETADA/CANCELADA). La firma ya era obligatoria pre-compleción; I3C3
  además revalida checklist y firma **bajo el lock**, cerrando el TOCTOU salvo una ventana teórica de
  sub-transacción sobre datos de auditoría (documentada en el ciclo de vida).
- **Validación autenticada del flujo de entrega en producción: pendiente** (`AUTHENTICATED DELIVERY
FLOW VALIDATION PENDING`).
- **Callers productivos de `withLockedRoots`: 6** (createOffer, updateOfferStatus, updateVehicle,
  createDelivery, transición/cancelación de Delivery, **compleción de Delivery**) — verificar contra
  código al cambiar.

## PR #117 (relación documental, sin auditar su código)

- `feat(crm): add lead archiving actions` — **OPEN** e intacto.
- **No** forma parte implícita del siguiente trabajo ni de I3C3.
- **No** es una dependencia del `LEAD_ARCHIVED` que ya usan I2/I3 en producción: la columna
  `archivedAt` y su enforcement en el protocolo de locks **ya son productivos**; #117 añade las
  **acciones** de archivar/reactivar.
- Requiere una **auditoría independiente** antes de decidir su destino. **No** se recomienda merge
  aquí y **no** se ha auditado su código.

## Pendientes (con propietario/fase)

| Pendiente                                | Estado           | Fase candidata     | Decisión necesaria      |
| ---------------------------------------- | ---------------- | ------------------ | ----------------------- |
| Compleción coordinada (locks + carreras) | preparado en PR  | I3C3               | auditoría de PR + merge |
| Guarda terminal de edición de checklist  | incluida en I3C3 | I3C3               | —                       |
| Descarte coordinado                      | pendiente        | I3D                | —                       |
| Tasación coordinada                      | pendiente        | I3E                | —                       |
| Validación autenticada en prod           | deuda            | transversal        | plan de validación      |
| UI loading «Iniciar entrega»             | pulido           | opcional           | —                       |
| Tests concurrentes frontera-específicos  | gap              | opcional           | —                       |
| Destino de PR #117                       | abierto          | auditoría separada | —                       |
