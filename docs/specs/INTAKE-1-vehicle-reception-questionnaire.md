# INTAKE-1 — Disponer de un cuestionario de recepción único por vehículo

| Campo               | Valor                                                                                                                           |
| ------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| **Estado**          | IMPLEMENTED                                                                                                                     |
| **Owner**           | Product · Engineering · Operations                                                                                              |
| **Ticket**          | [GitHub #172](https://github.com/growthaiconsultant-lab/campernova-crm/issues/172)                                              |
| **Rama / PR**       | `codex/intake-1-vehicle-reception-questionnaire` / [PR #173](https://github.com/growthaiconsultant-lab/campernova-crm/pull/173) |
| **Categorías**      | C0 · C1 · C2 · C3 · C4 · C5 · C6                                                                                                |
| **Riesgo**          | Alto, por PII, permisos compartidos, schema, migración y concurrencia entre roles                                               |
| **Ruta SDD**        | Reforzada                                                                                                                       |
| **Última revisión** | 2026-08-07                                                                                                                      |

## Problema y evidencia (A. Objetivo)

El cuestionario de recepción/tasación se rellena hoy en papel. Sus datos no quedan estructurados,
no pueden completarse de manera segura entre Comercial y Taller y no existe un estado verificable
de borrador/revisión por vehículo.

El objetivo es incorporar al CRM un único cuestionario vivo por vehículo, con guardado progresivo,
responsabilidad por sección, control de conflictos y una fuente de verdad explícita para cada dato.
El formulario digital reproduce el contenido útil de las cuatro hojas aportadas, añade un campo
abierto de extras y excluye las decisiones que el propietario ha diferido o descartado.

La señal de éxito será que un ADMIN/AGENTE y un TALLER puedan completar sus secciones del mismo
vehículo sin exponerse datos no autorizados ni sobrescribir cambios concurrentes; que el estado final
sea trazable; y que la ficha, el matching, la tasación y la inspección técnica existentes conserven
sus invariantes.

## Resultado esperado

- Existe exactamente un cuestionario de recepción por `Vehicle`.
- ADMIN y AGENTE pueden leer y editar todas las secciones; TALLER sólo la identidad mínima y las
  secciones técnicas.
- El formulario admite borradores parciales. Cada sección se revisa explícitamente y el cuestionario
  queda completado sólo cuando Comercial y Técnica están revisadas en sus revisiones vigentes.
- Un cambio posterior invalida únicamente la revisión de su sección y devuelve el conjunto a
  borrador hasta una nueva revisión.
- Dos usuarios no pueden sobrescribir silenciosamente la misma sección: un CAS por revisión devuelve
  un conflicto recuperable y obliga a recargar.
- Los campos ya canónicos se escriben en `SellerLead` o `Vehicle`; sólo los hechos nuevos viven en la
  nueva relación de recepción.
- La UI de Taller no carga ni serializa nombre, teléfono, email, motivo de venta o precio mínimo.
- La inspección de entrada continúa siendo el checklist técnico que determina sus gates; el nuevo
  cuestionario no lo sustituye ni lo completa automáticamente.

## B. Baseline verificado

| Etiqueta               | Hecho                                                                                                                                                                | Evidencia                                                                                                    |
| ---------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| `VERIFICADO EN CÓDIGO` | La ficha de vendedor exige ADMIN/AGENTE y carga el agregado `SellerLead` con su vehículo.                                                                            | `app/(backoffice)/vendedores/[id]/page.tsx:5`, `app/(backoffice)/vendedores/[id]/page.tsx:99-104`.           |
| `VERIFICADO EN CÓDIGO` | La ficha ya tiene pestañas de resumen, preparación, publicación, compradores, actividad y economía, pero no recepción.                                               | `app/(backoffice)/vendedores/[id]/page.tsx:415-430`.                                                         |
| `VERIFICADO EN CÓDIGO` | Taller tiene una ficha propia por orden y su lectura admite ADMIN, AGENTE y TALLER; la edición actual de órdenes es ADMIN/TALLER.                                    | `lib/auth.ts:61-69`, `app/(backoffice)/taller/[id]/page.tsx:52`, `app/(backoffice)/taller/[id]/page.tsx:91`. |
| `VERIFICADO EN CÓDIGO` | La ficha de Taller selecciona actualmente nombre e ID del vendedor, pero enlaza a una ficha que TALLER no puede abrir. INTAKE-1 no debe ampliar esa ficha comercial. | `app/(backoffice)/taller/[id]/page.tsx:64`, `app/(backoffice)/vendedores/[id]/page.tsx:99`.                  |
| `VERIFICADO EN CÓDIGO` | `SellerLead` ya es fuente de nombre, email, teléfono y precio mínimo.                                                                                                | `prisma/schema.prisma:612-629`.                                                                              |
| `VERIFICADO EN CÓDIGO` | `Vehicle` ya es fuente de marca, modelo, año, km, plazas, tipo, categoría, distribución, plazas de dormir, baño, calefacción, equipamiento e ITV.                    | `prisma/schema.prisma:664-703`.                                                                              |
| `VERIFICADO EN CÓDIGO` | `Vehicle.purchasePrice` es el coste de adquisición interno que alimenta margen y gates legales; no representa el importe histórico del papel.                        | `prisma/schema.prisma:696`, `lib/margin/calculate.ts:5-15`, `lib/vehicle-legal/requirements.ts:9`.           |
| `VERIFICADO EN CÓDIGO` | El conteo de llaves existente representa custodia física y exige contexto de recepción; no equivale necesariamente a las llaves declaradas por el vendedor.          | `prisma/schema.prisma:725-730`, `lib/entry/validate.ts:183-232`.                                             |
| `VERIFICADO EN CÓDIGO` | La inspección de entrada crea una orden propia y un checklist técnico de 21 ítems.                                                                                   | `lib/entry/validate.ts:58-84`, `lib/entry/validate.ts:209-246`.                                              |
| `VERIFICADO EN CÓDIGO` | Editar hoy los datos generales del vehículo recalcula tasación preliminar y matching, incluso cuando no todos los campos cambian.                                    | `app/(backoffice)/vendedores/[id]/actions.ts:302-319`.                                                       |
| `DECISIÓN DEL OWNER`   | El cuestionario lo completan Comercial y Taller, es único por vehículo, no incluye importe ni fecha de compra y deja la firma para fase 2.                           | Respuestas de Joel del 2026-08-07 y GitHub #172.                                                             |

No se ha consultado ni modificado ningún dato de producción para redactar esta spec. El baseline de
datos remotos y el volumen de vehículos/cuestionarios son `DESCONOCIDO` y deberán verificarse con un
preflight agregado, de solo lectura y autorizado antes de desplegar la migración.

## C. Alcance

- Modelo persistente uno-a-uno de recepción asociado a `Vehicle`.
- Campos estructurados de las cuatro hojas, salvo las exclusiones de D.
- Composición transaccional con los campos canónicos existentes de `SellerLead` y `Vehicle`.
- Guardado progresivo, revisión por sección, estado global y auditoría de autor/fecha.
- Acceso desde una pestaña `Cuestionario` en la ficha comercial y desde la orden
  `INSPECCION_ENTRADA` de Taller mediante una ruta técnica dedicada.
- Permisos y `select` server-side distintos por rol.
- Validación Zod, CAS por sección, transacciones y manejo explícito de conflictos.
- Migración aditiva, pruebas PostgreSQL reales, migration replay, rollout y rollback lógico.

## D. Fuera de alcance

- Firma manuscrita o digital, generación de PDF, envío al cliente o aceptación legal: fase 2.
- Importe de compra y fecha de compra de la hoja original. No se muestran, almacenan ni mapean a
  `Vehicle.purchasePrice`.
- Fotos, adjuntos, documentos privados o nuevos buckets de Storage.
- Sustituir, rellenar o aprobar automáticamente `WorkOrderChecklist`.
- Convertir el cuestionario en gate de captación, entrada oficial, tasación, publicación o venta en
  esta primera versión.
- Autocompletar con IA/OCR, importar formularios históricos o realizar backfill.
- Cambiar matching, fórmula de tasación, margen, KPIs, catálogo público o estados comerciales.
- Borrado del cuestionario. Se corrige editando y volviendo a revisar.
- Cambiar permisos generales de `/vendedores`, `/vehiculos` o `/taller`.
- Commit, push, PR, migración local/remota, deploy o cambio de producción mientras esta spec siga
  `DRAFT` y no exista autorización posterior explícita.

## E. Decisiones

| Decisión        | Alternativas                                                                | Resolución y motivo                                                                                                                                                                    |
| --------------- | --------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Unidad          | Uno por vendedor; uno por orden; uno por vehículo                           | Uno por vehículo con `vehicleId UNIQUE`. El mismo vehículo no debe acumular copias divergentes.                                                                                        |
| Persistencia    | JSON monolítico; columnas en `Vehicle`; tabla dedicada                      | Tabla dedicada para hechos nuevos, más escritura de campos ya canónicos en sus tablas actuales. Evita un JSON sin constraints y evita inflar `Vehicle` con datos propios de recepción. |
| Superficie      | Abrir ficha comercial a TALLER; duplicar formularios; componente compartido | Componente compartido con dos entradas: pestaña comercial y ruta técnica. Taller nunca recibe el agregado comercial completo.                                                          |
| Permisos        | Ambos editan todo; permisos sólo visuales; permisos por sección             | ADMIN/AGENTE editan ambas secciones; TALLER sólo Técnica. El servidor valida payload y selecciona datos por rol.                                                                       |
| Estado          | Un `completed` manual; porcentaje; revisión por sección                     | Revisiones Comercial/Técnica versionadas. `completedAt` sólo existe cuando ambas revisiones coinciden con sus versiones actuales.                                                      |
| Concurrencia    | Última escritura gana; bloqueo pesimista largo; CAS                         | CAS por sección dentro de una transacción corta y lock de la raíz `Vehicle`. Secciones distintas pueden avanzar sin sobrescribirse.                                                    |
| Campos vacíos   | Obligarlos todos; confundir vacío con “no”; borrador                        | Todos son progresivos. Revisar una sección confirma que los vacíos fueron considerados “no consta/no comprobado”; nunca se convierten en `false`.                                      |
| Datos repetidos | Copiar marca/contacto al cuestionario                                       | No duplicar. El formulario compone el agregado y escribe la fuente canónica existente.                                                                                                 |
| Llaves          | Escribir `Vehicle.keysCount`; dato declarado separado                       | `declaredKeysCount` separado. La custodia real conserva su flujo, actor, fecha y ubicación.                                                                                            |
| Inspección      | Reusar el checklist; marcarlo desde el cuestionario                         | Mantenerlo separado. Declaración/recepción y resultado técnico probado son hechos distintos.                                                                                           |
| Instrumentación | Evento por campo; sólo errores; ninguna señal                               | Sin PostHog en v1. Sentry/logs sólo para fallos inesperados y conflictos agregados, sin valores del formulario ni PII.                                                                 |

### Decisión taxonómica recomendada

La opción del papel “Furgón base sin camperizar” no cabe de forma correcta en `VehicleType`
(`CAMPER | AUTOCARAVANA`) ni en las categorías actuales (`prisma/schema.prisma:28-41`). La
implementación debe añadir a `Vehicle` un `camperizationState` nullable con valores
`CAMPERIZADO | SIN_CAMPERIZAR`, sin inventar que un furgón sin transformar ya es una camper. Para
esa opción se permiten `type` y `category` nulos. Las opciones Camper/Capuchina/Perfilada/Integral
siguen escribiendo la taxonomía canónica actual y `CAMPERIZADO`.

Esta columna no altera matching ni publicación en INTAKE-1. Un uso futuro en esos consumidores
requerirá otro ticket. La decisión evita tanto una clasificación falsa como una nueva `VehicleType`
con blast radius público innecesario.

## F. Flujo funcional

### Comercial (ADMIN/AGENTE)

1. Abre la ficha de vendedor y entra en `Cuestionario`.
2. Ve datos de Cliente/Operación y Técnica, precargados desde sus fuentes canónicas.
3. Guarda cada bloque sin necesidad de completar el resto.
4. Revisa Comercial; la UI muestra cuántos campos permanecen sin respuesta y pide confirmación.
5. Puede completar o corregir también Técnica.

### Taller

1. Desde una orden `INSPECCION_ENTRADA`, abre `/vehiculos/:vehicleId/recepcion`.
2. El servidor devuelve sólo identidad mínima del vehículo y sección Técnica; no consulta ni
   serializa PII/condiciones comerciales.
3. Guarda por bloques y revisa Técnica.
4. Si Comercial ya estaba revisada en su revisión vigente, la segunda revisión fija `completedAt`;
   en caso contrario se mantiene en borrador sin revelar qué datos comerciales faltan.

### Corrección y conflictos

- Guardar una sección revisada incrementa su revisión, limpia su marca de revisión y limpia
  `completedAt/completedById`.
- Si `expectedRevision` no coincide, no se escribe nada y se devuelve “El cuestionario ha cambiado;
  recarga antes de guardar”.
- Revisar una sección usa la misma garantía CAS. Un doble clic sobre la revisión ya aplicada es
  idempotente y no crea una segunda transición.
- Un error técnico revierte toda la transacción; nunca queda el cuestionario actualizado sin sus
  campos canónicos asociados, ni al revés.

## G. Estados e invariantes

Estados derivados:

- `BORRADOR`: falta al menos una revisión válida.
- `COMPLETADO`: `commercialReviewedRevision == commercialRevision` y
  `technicalReviewedRevision == technicalRevision`, con `completedAt/completedById` no nulos.

Invariantes:

1. `vehicleId` es único y la relación se elimina en cascada sólo si se elimina el vehículo.
2. No hay estado global duplicado: `completedAt` es la materialización auditable de las dos
   revisiones; la lectura comprueba también sus versiones.
3. Una acción sólo acepta claves de su sección; campos desconocidos se rechazan con Zod `.strict()`.
4. Un TALLER nunca puede leer o mutar campos comerciales aunque fabrique un payload manual.
5. `null` significa “sin dato/no comprobado”; `false` significa una respuesta negativa explícita.
6. No se persisten placeholders, cadenas vacías ni números sentinela; se normalizan a `null`.
7. Las unidades son explícitas en nombre y UI: CV, km, litros, Ah y W.
8. `declaredKeysCount` no modifica custodia; `purchasePrice` no se toca.
9. La recepción no altera estados, tasaciones oficiales, matching, publicación ni checklist.
10. Las notas libres nunca se envían a logs, Sentry o PostHog.

## H. Matriz de permisos

| Actor               | Leer Comercial      | Editar/revisar Comercial | Leer Técnica             | Editar/revisar Técnica | Ver estado global         |
| ------------------- | ------------------- | ------------------------ | ------------------------ | ---------------------- | ------------------------- |
| ADMIN               | Sí                  | Sí                       | Sí                       | Sí                     | Sí                        |
| AGENTE              | Sí                  | Sí                       | Sí                       | Sí                     | Sí                        |
| TALLER              | No                  | No                       | Sí, con identidad mínima | Sí                     | Sí, sin detalle comercial |
| ENTREGAS            | No                  | No                       | No                       | No                     | No                        |
| MARKETING           | No                  | No                       | No                       | No                     | No                        |
| Sin sesión/inactivo | Redirección a login | No                       | Redirección a login      | No                     | No                        |

Enforcement previsto:

- `requireCanViewVehicleReception`: ADMIN, AGENTE, TALLER.
- `requireCanEditReceptionCommercial`: ADMIN, AGENTE.
- `requireCanEditReceptionTechnical`: ADMIN, AGENTE, TALLER.
- Loaders separados y `select` explícitos; no cargar todo y ocultarlo en JSX.
- Server Actions vuelven a autenticar y autorizar antes de leer, crear o actualizar.
- Tests negativos para rol, sesión, entidad inexistente y payload cross-section.

## I. Modelo de datos y migración

### Fuente canónica de campos existentes

| Campo del cuestionario                                    | Fuente canónica                                                | Nota                                                                                                 |
| --------------------------------------------------------- | -------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| Nombre y apellidos, teléfono, email                       | `SellerLead.name/phone/email`                                  | Sólo Comercial.                                                                                      |
| Marca y modelo                                            | `Vehicle.brand/model`                                          | Editable por Comercial y Técnica.                                                                    |
| Año de matriculación, kilometraje, plazas de viaje/dormir | `Vehicle.year/km/seats/sleepingPlaces`                         | Se conserva la semántica vigente de `year`.                                                          |
| Tipo y distribución                                       | `Vehicle.type/category/bedLayout` + nuevo `camperizationState` | Control compuesto, sin duplicar.                                                                     |
| ITV vigente hasta                                         | `Vehicle.itvValidUntil`                                        | Fecha legal canónica.                                                                                |
| Precio mínimo                                             | `SellerLead.minPrice`                                          | Nunca visible a TALLER.                                                                              |
| Baño/ducha/cocina/calefacción/solar resumidos             | No se reescriben automáticamente en `equipment`                | Los detalles de recepción son más ricos y nullable; una sincronización futura requiere regla propia. |
| Llaves disponibles declaradas                             | Nueva recepción                                                | Distinto de `Vehicle.keysCount`, que es custodia real.                                               |

### Nueva relación uno-a-uno

`VehicleReceptionQuestionnaire` contendrá, como mínimo:

- identidad: `id`, `vehicleId @unique`;
- revisión: `commercialRevision`, `technicalRevision`, revisiones revisadas, actores/fechas de ambas
  revisiones, `completedAt`, `completedById`, `createdAt`, `updatedAt`;
- hechos nuevos enumerados en J;
- relaciones opcionales a `User` con `onDelete: SetNull` para conservar la recepción si se desactiva
  o elimina un usuario.

La migración será nueva y aditiva: tabla, enums reutilizables, FKs, unique e índices necesarios, más
`Vehicle.camperizationState`. No se edita ninguna migración desplegada. No hay `UPDATE`, backfill,
`DROP`, cambio de nullability ni escritura sobre filas existentes. Los registros se crean de forma
perezosa bajo lock al primer guardado/revisión.

No se usa `db push`. Se deberá actualizar el catálogo verificado por CI cuando corresponda y ejecutar
replay completo, parity, checksums e idempotencia antes de cualquier entorno remoto.

## J. Inventario funcional de campos

Los límites exactos se centralizan en Zod y se reflejan en `min/max` de UI. Las notas se recortan,
las cadenas vacías pasan a `null` y los números aceptan `0` sólo cuando tiene sentido físico.

| Sección                    | Campos/controles                                                                                                                                                                                                                 | Persistencia                                                                                                                       | Editor                                           |
| -------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------ |
| Cliente y recepción        | Nombre; teléfono; email; fecha de recepción/tasación                                                                                                                                                                             | `SellerLead`; `receptionDate @db.Date`                                                                                             | Comercial                                        |
| Vehículo general           | Marca; modelo/versión; año; tipo compuesto; distribución; motor; potencia CV; cambio; tracción; combustible; km; plazas de viaje; plazas de dormir; ITV                                                                          | Campos canónicos indicados en I; nuevos `modelVersion`, `engine`, `powerCv`, `transmission`, `drivetrain`, `fuelType` en recepción | Comercial y Técnica                              |
| Operación/historial        | Propietarios anteriores; historial de mantenimiento sí/no; motivo de venta; precio mínimo; última revisión                                                                                                                       | `previousOwners`, `maintenanceHistoryAvailable`, `saleReason`, `SellerLead.minPrice`, `lastServiceDate`                            | Comercial, salvo última revisión también Técnica |
| Estado                     | Daños exteriores; daños interiores                                                                                                                                                                                               | `externalDamageNotes`, `internalDamageNotes`                                                                                       | Comercial y Técnica                              |
| Exterior/accesos           | Nº claraboyas; nº ventanas; toldo; portabicicletas; escalón manual/eléctrico/no tiene; ducha exterior                                                                                                                            | Integers nullable, booleans nullable y enum `accessStepType`                                                                       | Comercial y Técnica                              |
| Interior                   | Cama elevable eléctrica/manual/no tiene; literas; tomas exteriores 220V/agua; asientos giratorios; mesa fija/plegable/extraíble; LED; oscurecedores Remis/aislante 9 capas/no tiene; multimedia/TV                               | Enums, booleanos nullable y arrays enum                                                                                            | Comercial y Técnica                              |
| Cocina y agua              | Nevera compresor/absorción trivalente/no tiene; cocina gas/eléctrica; fregadero; baño completo; WC químico/cassette extraíble; aguas limpias/grises en litros; calentador gas/eléctrico/diésel; calefacción gas/eléctrica/diésel | Enums, arrays enum, booleanos nullable, litros integer nullable                                                                    | Comercial y Técnica                              |
| Energía                    | Batería auxiliar Gel/AGM/Litio/no tiene; capacidad Ah; sistema 12V/220V/ambos; placa solar; potencia W; potencia regulador W; convertidor/inversor; conexión exterior 220V; tomas USB/12V/220V                                   | Enums, arrays enum, booleanos nullable, Ah/W integer nullable                                                                      | Comercial y Técnica                              |
| Climatización              | Aire acondicionado cabina; vivienda 12V/230V/no tiene; ventiladores/extractores                                                                                                                                                  | Booleanos nullable y enum                                                                                                          | Comercial y Técnica                              |
| Documentación y accesorios | Homologación camperización; libro de mantenimiento; llaves declaradas 0–10; mesa exterior; sillas; avance; cuñas; otros                                                                                                          | Booleanos nullable, integer y array enum; `accessoriesOther`                                                                       | Comercial y Técnica                              |
| Texto libre                | Extras; observaciones adicionales                                                                                                                                                                                                | `extrasNotes`, `additionalObservations` separados, máximo previsto 4.000 caracteres cada uno                                       | Comercial y Técnica                              |

Reglas dependientes verificadas al revisar Técnica, no al guardar borrador:

- `solarPowerW`/`solarRegulatorPowerW` sólo si la placa solar es `true`;
- capacidad de batería sólo si existe batería auxiliar;
- “otros accesorios” requiere texto y el texto requiere la opción `OTROS`;
- cantidades no negativas y dentro de límites de dominio documentados;
- arrays sin duplicados y enums cerrados;
- fechas plausibles, sin convertir una fecha local en el día anterior por timezone.

## K. Writers y readers

| Componente                       | Cambio previsto                                                  | Garantía                                                                                                                             |
| -------------------------------- | ---------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| Loader Comercial                 | Lee `SellerLead`, `Vehicle` y recepción con `select` explícito   | Fuente compuesta completa sólo para ADMIN/AGENTE.                                                                                    |
| Loader Técnica                   | Lee identidad mínima de `Vehicle` y campos técnicos de recepción | No selecciona PII ni dinero.                                                                                                         |
| `saveReceptionCommercialSection` | Patch estricto de Comercial bajo lock/CAS                        | Transacción atómica entre `SellerLead` y recepción.                                                                                  |
| `saveReceptionTechnicalSection`  | Patch estricto por bloque bajo lock/CAS                          | Transacción atómica entre `Vehicle` y recepción; sólo recalcula consumidores si cambió un campo canónico que realmente los alimenta. |
| `reviewReceptionSection`         | Marca la revisión vigente e intenta completar                    | Idempotente; no acepta revisar otra sección por rol.                                                                                 |
| Ficha vendedor                   | Añade pestaña y badge Borrador/Completo                          | No cambia las otras pestañas ni sus queries salvo el `select` mínimo.                                                                |
| Ficha Taller                     | Añade enlace en `INSPECCION_ENTRADA`                             | No abre `/vendedores/:id` ni modifica la orden/checklist.                                                                            |
| Matching/tasación                | Sin cambio de fórmulas                                           | No ejecutar recalculado por editar campos exclusivos de recepción.                                                                   |
| Catálogo público                 | Sin reader nuevo                                                 | Los nuevos campos no se serializan públicamente.                                                                                     |

La implementación debe inventariar con `rg` cualquier writer adicional de los campos canónicos
incluidos y mantener compatibilidad. No se sustituye `updateVehicle` por un formulario gigante: las
nuevas acciones comparten funciones puras de normalización/mapeo y escriben únicamente su patch.

## L. Concurrencia e idempotencia

1. Todas las mutaciones bloquean primero la raíz `Vehicle` con el orden global existente.
2. La creación perezosa ocurre dentro del lock; la constraint `UNIQUE(vehicle_id)` es la última
   garantía ante carreras.
3. Cada save incluye `expectedCommercialRevision` o `expectedTechnicalRevision`.
4. El `UPDATE ... WHERE revision = expected` incrementa sólo la revisión de esa sección. Cero filas
   afectadas es un conflicto de dominio, no un error técnico.
5. Los patches nunca contienen campos de la otra sección. Dos saves simultáneos de secciones
   distintas se serializan pero no se pisan; dos saves de la misma sección producen un ganador.
6. Revisar la misma versión dos veces devuelve éxito sin cambiar actor/fecha ni duplicar efectos.
7. Se requieren tests de carrera con PostgreSQL real; mocks no prueban estas garantías.

## M. Seguridad, privacidad y amenazas

| Amenaza                                        | Mitigación                                                                                      |
| ---------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| TALLER llama manualmente a la acción Comercial | Guard server-side antes de parsear/escribir; test negativo.                                     |
| La página Técnica oculta PII sólo con CSS      | Loader independiente con `select`; test de shape serializado.                                   |
| Mass assignment                                | Schemas `.strict()` por sección y construcción explícita del `data`.                            |
| ID de otro vehículo                            | Autorización por rol + existencia de vehículo; no confiar en IDs del cliente.                   |
| Sobrescritura concurrente                      | CAS y transacción; error recuperable.                                                           |
| PII/notas en telemetría                        | No registrar payloads ni errores Zod completos; sólo operación, rol, entorno y código estable.  |
| Exposición pública                             | Ningún reader de catálogo/ads incluye la relación nueva; test de serialización pública.         |
| Confusión con custodia/precio                  | Campos y acciones separados; tests que comprueban que `keysCount` y `purchasePrice` no cambian. |

No se requiere `service_role`, Storage, RLS nuevo del navegador ni secretos adicionales. Toda lectura
y escritura usa el servidor y Prisma tras autenticación.

## N. UX, accesibilidad y errores

- Formulario dividido en acordeones/bloques pequeños, con barra de progreso y estado por sección.
- Guardado explícito por bloque; indicador `Guardando / Guardado / Hay cambios sin guardar`.
- No autosave silencioso en v1: reduce carreras, llamadas y falsas expectativas.
- Controles `Sí / No / Sin responder` para booleanos nullable; nunca checkbox binario que convierta
  ausencia en `false`.
- Multi-select sólo donde el papel permite varias opciones; radio/select para opciones excluyentes.
- Labels con unidad y ayuda; errores asociados mediante `aria-describedby`; teclado y foco al primer
  error.
- Confirmación antes de revisar una sección con vacíos; los vacíos siguen siendo válidos.
- Conflicto: conservar los valores locales visibles, bloquear reenvío y ofrecer recargar. No fusionar
  texto automáticamente.
- Loading, error, ausencia de vehículo y permisos denegados tienen estados explícitos.
- Mobile usable para Taller, con objetivos táctiles y sin tablas horizontales.

## O. Tests y verificación prevista

### Unitarios

- Normalización de vacío/null, límites, fechas locales, enums, arrays y dependencias.
- Mapping papel → campos canónicos/nuevos, incluida la opción sin camperizar.
- Derivación `BORRADOR/COMPLETADO` y revocación de revisión al editar.
- Matriz de permisos y rechazo de claves cross-section.
- Regresión: precio/fecha de compra ausentes y `Vehicle.purchasePrice` intacto.
- Regresión: `declaredKeysCount` no modifica `Vehicle.keysCount`.

### Integración PostgreSQL real

- FK y unicidad uno-a-uno; cascade de vehículo y `SetNull` de actores.
- Creación perezosa concurrente sin duplicado.
- Dos saves de la misma sección: uno gana y el otro recibe conflicto.
- Dos saves de secciones distintas: ambos cambios persisten sin pérdida.
- Save compuesto revierte por completo ante fallo de una tabla.
- Revisión idempotente, invalidación al editar y completado sólo con ambas revisiones vigentes.
- ADMIN/AGENTE permitidos, TALLER técnico permitido, TALLER comercial/otros roles/sin sesión
  denegados.

### Harness y UI

- `pnpm prisma validate`, `pnpm prisma generate`, `pnpm check:sdd`, `pnpm typecheck`, `pnpm lint`,
  `pnpm test`, `pnpm check:migration-history`, preparación/integración PostgreSQL y `pnpm build`.
- Job `migration-replay`: base vacía, catálogo, parity, RLS e idempotencia.
- Tests de componente/E2E para borrador, recarga, revisión, conflicto y matriz de visibilidad.
- Smoke en Preview/staging sólo tras verificar que no apunta a producción; smoke por rol tras deploy
  autorizado.

Un comando omitido se registrará como no ejecutado, nunca como verde.

## Rollout (P)

1. Implementación en rama corta tras aprobar esta spec.
2. Migración aditiva preparada y validada en PostgreSQL efímero; CI completa.
3. Preflight agregado de sólo lectura: identidad inequívoca del entorno, historial sano y conteo de
   vehículos; no se leen notas ni PII.
4. Aplicar migración en staging autorizado y verificar tabla/constraints sin crear cuestionarios.
5. Desplegar código en staging; smoke ADMIN/AGENTE/TALLER y casos negativos.
6. Aplicar migración en producción con autorización separada, backup/project ref confirmado y
   `prisma migrate deploy`.
7. Sólo después, desplegar el código dependiente. El guard remoto debe confirmar checksum/historial.
8. Smoke sin alterar expedientes sensibles y observación de 24 horas.

No se requiere feature flag porque la ruta no existe antes del deploy de código y el schema es
compatible hacia atrás. Si staging/Preview no está aislado de producción, se detienen las pruebas
mutables y se limita la validación a local/CI hasta resolver el entorno.

## Q. Rollback y stop conditions

- **Rollback de código:** revertir el deployment; el código anterior ignora tabla/columna nuevas.
- **Rollback de schema:** dejar la expansión aditiva sin uso. No ejecutar `DROP` en la incidencia;
  una contracción futura tendría ticket, análisis de datos y migración separados.
- **Datos:** no hay backfill. Los borradores creados permanecen; no se borran automáticamente.
- **Detener si:** falla una prueba negativa de permisos; TALLER recibe PII/dinero; aparece un write en
  checklist/precio de compra/custodia; CAS pierde cambios; migration replay/parity falla; el entorno
  remoto no se identifica; hay migraciones pendientes/fallidas/checksum distinto; el diff incluye
  fotos adjuntas, el documento local no versionado, secretos o archivos ajenos.

## R. Observabilidad y validación post-despliegue

- Sentry: excepciones inesperadas de loaders/actions y fallos técnicos de DB, con operación, rol,
  código estable y entorno; nunca valores de campos, nombre, email, teléfono, precio o notas.
- Conflictos CAS son errores de dominio esperados: métrica/log agregado si el volumen lo justifica,
  no issue de Sentry por cada conflicto.
- PostHog: no se añade en v1. No existe una pregunta de producto aprobada que compense el riesgo de
  instrumentar un formulario interno con PII.
- Señales de éxito: cero accesos indebidos; cero errores nuevos asociados a la ruta; guardados y
  revisiones correctos en smoke; ausencia de duplicados por `vehicleId`.
- Ventana propuesta: validación inmediata por rol y revisión de Sentry/logs a las 24 horas. El número
  de formularios completados se consulta de forma agregada en DB; no se deriva de Activity/PostHog.

## S. Documentación

- Esta spec es la fuente de intención.
- Si el schema se implementa, actualizar las relaciones/modelo afectado y las aserciones de catálogo
  de CI sólo donde la migración cambie invariantes.
- No actualizar `AGENTS.md` con backlog o estado volátil.
- Ticket, PR y spec deben enlazarse y cambiar de estado sólo con evidencia real.
- La fase 2 de firma requiere un ticket/spec propios por implicar identidad, consentimiento,
  documentos y potencial Storage privado.

## Criterios de aceptación (T)

- [x] Un vehículo tiene como máximo un cuestionario y los vehículos existentes no requieren backfill.
- [x] Comercial y Taller editan el mismo cuestionario desde superficies autorizadas.
- [x] TALLER no recibe ni puede mutar PII, motivo de venta o precio mínimo.
- [x] Los campos del papel están disponibles salvo importe/fecha de compra y firma; existen `Extras`
      y `Observaciones adicionales` separados.
- [x] Los campos canónicos no se duplican y los nuevos tienen tipo/unidad/nullabilidad explícitos.
- [x] El formulario guarda borradores y revisa cada sección sin convertir vacíos en respuestas
      negativas.
- [x] Una edición posterior invalida sólo la revisión afectada.
- [x] CAS evita pérdida silenciosa y las carreras se prueban en PostgreSQL real.
- [x] `Vehicle.purchasePrice`, custodia de llaves, checklist, estados, tasación, matching y catálogo
      no cambian como efecto colateral.
- [x] Migración aditiva, replay, parity, typecheck, lint, unitarios, integración y build quedan verdes.
- [ ] Rollout respeta migración antes de código, staging antes de producción y autorizaciones
      independientes.
- [x] No se añaden secretos, dependencias, Storage, PostHog ni PII en observabilidad.

## U. Revisión adversarial

| Hallazgo adversarial                                           | Materialidad | Mitigación incorporada                                                       |
| -------------------------------------------------------------- | ------------ | ---------------------------------------------------------------------------- |
| Reusar la ficha de vendedor expone PII a TALLER                | Alta         | Ruta/loader técnico separado; ficha comercial mantiene `requireAgente`.      |
| Un JSON gigante no ofrece constraints ni ownership por sección | Alta         | Columnas tipadas y schemas estrictos en relación uno-a-uno.                  |
| Duplicar marca/contacto genera drift                           | Alta         | Composición transaccional contra fuentes canónicas existentes.               |
| El precio del papel puede contaminar margen                    | Crítica      | Campo excluido; test explícito de `purchasePrice` intacto.                   |
| Las llaves declaradas pueden fingir custodia real              | Alta         | `declaredKeysCount` separado de actor/fecha/ubicación de custodia.           |
| Última escritura gana borra trabajo del otro equipo            | Alta         | Revisión por sección + CAS + tests PostgreSQL reales.                        |
| Checklist y cuestionario parecen equivalentes                  | Alta         | Entidades, copy, acciones y gates separados; cero sincronización automática. |
| Checkbox sin marcar se interpreta como “No”                    | Media        | Booleano nullable y control triestado.                                       |
| Todos los campos obligatorios bloquean el trabajo real         | Media        | Borrador progresivo y revisión consciente de vacíos.                         |
| `Furgón sin camperizar` se clasifica falsamente como camper    | Media        | `camperizationState` canónico y type/category nulos en ese caso.             |
| Editar un detalle dispara matching/tasación innecesariamente   | Media        | Recalcular sólo si cambia un input canónico consumidor.                      |
| Telemetría captura notas/PII                                   | Alta         | Sin PostHog y payloads excluidos de logs/Sentry.                             |
| Rollback intenta borrar schema/datos en una incidencia         | Alta         | Rollback de código; expansión queda inerte hasta contracción separada.       |
| Borrar un revisor choca con el historial completado            | Alta         | FKs `SET NULL`; se conserva la fecha y el actor puede quedar nulo.           |

## Matriz de completitud

| Área                      | Revisada | Evidencia | Riesgo pendiente                            |
| ------------------------- | -------- | --------- | ------------------------------------------- |
| Dominio/estados           | Sí       | F, G      | Validar copy final con usuarios.            |
| Inventario de campos      | Sí       | I, J      | Validación con usuarios pendiente.          |
| Permisos/PII              | Sí       | H, M      | Smoke autenticado por rol pendiente.        |
| Concurrencia/idempotencia | Sí       | L         | Ejecución de pruebas PostgreSQL pendiente.  |
| Datos/legacy/migración    | Sí       | I, P      | Preflight remoto pendiente y no autorizado. |
| Readers/writers           | Sí       | K         | Smoke integrado pendiente.                  |
| UX/accesibilidad          | Sí       | N         | Validación visual/móvil pendiente.          |
| Efectos externos/Storage  | Sí       | D, M      | No aplican en v1.                           |
| Observabilidad/KPIs       | Sí       | R         | Ventana post-deploy pendiente.              |
| Rollout/rollback          | Sí       | P, Q      | Requiere autorizaciones separadas.          |
| Documentación             | Sí       | S         | Actualizar sólo tras evidencia.             |

## Estado de autorización

`IMPLEMENTED IN PR #173 — NOT DEPLOYED — PRODUCTION OPERATIONS NOT AUTHORIZED`

Joel aprobó la implementación local y posteriormente el commit, push y PR el 2026-08-07. No existe
autorización para merge, migraciones en Supabase remoto, smoke sobre una base no aislada ni deploy a
producción.

## Verificación de esta fase

| Criterio           | Evidencia                                                                                | Resultado                              |
| ------------------ | ---------------------------------------------------------------------------------------- | -------------------------------------- |
| Baseline Git       | `HEAD == origin/main == 3f037db811b7dd6b0e2ee8fd96005b0a74deeb30` tras `git fetch`       | PASS                                   |
| Trazabilidad       | GitHub #172 y rama local dedicada                                                        | PASS                                   |
| Gobierno reforzado | SDD, calidad de planificación, proceso, seguridad, testing y migraciones leídos          | PASS                                   |
| Spec               | `node scripts/check-sdd.mjs` y comprobación whitespace con `git diff --no-index --check` | PASS                                   |
| Implementación     | Schema Prisma, migración aditiva, dominio, acciones, loaders por rol y UI compartida     | PASS local                             |
| Unitarios          | `node node_modules/vitest/vitest.mjs run`: 115 archivos / 1.469 tests                    | PASS                                   |
| Calidad estática   | Prisma validate, typecheck, lint, SDD y migration history (13 migraciones)               | PASS                                   |
| Build              | `next build`: compilación, tipos y 60 rutas; incluye `/vehiculos/[id]/recepcion`         | PASS; pooler no accesible en prerender |
| PostgreSQL real    | CI #31195165306: preparación, RLS, integración y remote-migration guard                  | PASS                                   |
| Migration replay   | CI #31195165306: PostgreSQL 17, 13 migraciones, parity, catálogo e idempotencia          | PASS                                   |
| Supabase local     | CI #31195165306: buckets, policies y pruebas reales de Storage en Docker local           | PASS                                   |
| Remoto             | Rama, PR borrador y Preview Vercel automáticos                                           | PASS; sin merge ni producción          |

## Cierre

- **Commit:** `e21b23e` (`feat(recepcion): añade cuestionario compartido por vehículo`).
- **PR:** [#173](https://github.com/growthaiconsultant-lab/campernova-crm/pull/173), borrador.
- **CI:** [run 31195165306](https://github.com/growthaiconsultant-lab/campernova-crm/actions/runs/31195165306), todos los jobs PASS.
- **Deployment:** Preview Vercel automático construido; no probado contra datos. Producción sin
  cambios.
- **Validación:** Prisma, historial de migraciones, SDD, TypeScript, lint, 1.469 unitarios y build
  local PASS. La integración PostgreSQL no se ejecutó porque el entorno carece de
  `TEST_DATABASE_URL`, Docker y servicio PostgreSQL local; no se usó producción como sustituto.
- **Avisos del build:** el prerender del catálogo no pudo alcanzar el pooler Supabase desde el
  sandbox, pero sus fallos controlados no abortaron el build. Persiste además el aviso deprecado de
  configuración Sentry ya existente.
- **Evidencia CI adicional:** replay/parity, RLS, idempotencia, carreras PostgreSQL y Supabase
  Storage local PASS. El único aviso es la transición de acciones de GitHub desde Node 20 a Node 24;
  no bloquea este cambio funcional.
- **Deuda restante:** confirmar aislamiento del Preview antes de cualquier smoke mutable, revisión
  visual por roles, preflight remoto de sólo lectura, migración, rollout y observación. Cada
  operación remota requiere autorización separada.
