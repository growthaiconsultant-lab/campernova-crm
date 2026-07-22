# ADR 0009 — Coordinación de locks de filas raíz

| Campo        | Valor                                                                                                   |
| ------------ | ------------------------------------------------------------------------------------------------------- |
| **Estado**   | ACEPTADA — implementada como infraestructura **inerte** en PR I1                                        |
| **Fecha**    | 2026-07-20                                                                                              |
| **Contexto** | Integridad del archivado de leads frente a escritores concurrentes                                      |
| **Código**   | `lib/locking/`                                                                                          |
| **Relación** | Habilita I2 (ofertas/reservas), I3 (entregas/vehículo/tasación), I4 (calendario) y B2 final (archivado) |

---

## Problema

Archivar un lead debe ser imposible mientras mantenga operativa abierta: vehículo en
comercialización, oferta activa, reserva con señal, entrega activa o compromiso externo futuro.

El backend de archivado (PR #117, sin fusionar) intentó garantizarlo ejecutando sus lecturas y su
escritura en una transacción `Serializable`. **No es suficiente.** PostgreSQL solo detecta
anomalías de serialización entre transacciones que **también** son serializables: los _predicate
locks_ que toma una transacción serializable no generan conflicto si quien escribe corre en otro
nivel de aislamiento. Todos los escritores del CRM —ofertas, entregas, calendario, próxima acción,
estado de vehículo, tasación— corren en `READ COMMITTED`, que es el valor por defecto y el único
que usan hoy.

Hay además una razón mecánica más concreta, independiente del aislamiento: un `UPDATE` que no toca
columnas clave toma `FOR NO KEY UPDATE`, y un `INSERT` con clave foránea toma `FOR KEY SHARE` sobre
la fila referenciada. **Esos dos modos no entran en conflicto entre sí.** Por eso el `UPDATE` de
archivado y el `INSERT` de una oferta no se bloquean mutuamente en ningún caso, y solo un
`FOR UPDATE` explícito los serializa.

## Decisión

Coordinar mediante **bloqueo pesimista de filas raíz**, con un orden global único.

### Raíces

`Vehicle`, `SellerLead` y `BuyerLead`. Toda la operativa del vendedor cuelga de `Vehicle`
(relación 1:1 con `SellerLead`), y toda la del comprador cuelga directamente de `BuyerLead`.

### Orden global

```
1. Vehicle   2. SellerLead   3. BuyerLead      · dentro del mismo tipo, id ascendente
```

Justificado por los flujos reales: las operaciones que tocan dos raíces (crear oferta, aceptar
reserva, crear o completar entrega) implican siempre un vehículo y un comprador, y ninguna necesita
el comprador antes que el vehículo. Archivar un vendedor toma `{Vehicle, SellerLead}` y archivar un
comprador toma `{BuyerLead}`: ambos son subconjuntos que respetan el mismo orden.

```
ROOT ORDERING PREVENTS ROOT-LEVEL INVERSION, NOT ALL POSSIBLE DATABASE DEADLOCKS
```

El alcance de esa garantía es **estrictamente** este:

- evita la inversión **entre raíces adquiridas a través de este helper**;
- **no** controla los locks de entidades hijas (`offers`, `deliveries`, `calendar_events`,
  `matches`, `activities`) que una operación tome después, ni los que un flujo adquiera **antes** de
  invocarlo;
- **no** protege a los módulos que no adopten el protocolo — hoy, todos;
- **no** garantiza todavía el invariante del archivado;
- el orden total deberá **volver a auditarse en I2, I3 y I4**, cuando esas entidades hijas entren en
  la misma transacción.

El orden vive en un **único módulo** (`lib/locking/roots.ts`). Repartirlo entre llamantes
reintroduciría exactamente el riesgo que elimina.

El comparador es lexicográfico **por unidades de código**, no `localeCompare`: este último depende de
ICU y del locale del proceso, de modo que dos instancias podrían ordenar distinto las mismas raíces
—y órdenes distintos son precisamente la condición que produce deadlocks—. Los identificadores
actuales son ASCII (`cuid`), pero la infraestructura no debe depender de esa coincidencia.

### Validación de las raíces

```
INVALID ROOTS FAIL CLOSED
EMPTY ROOT SET IS EXPLICIT; INVALID ROOTS ARE REJECTED
```

Una raíz inválida —tipo fuera del conjunto cerrado, `id` que no es cadena, vacío o solo espacios,
`null`, `undefined`— **aborta la llamada con `INVALID_LOCK_ROOT` antes de abrir la transacción**, sin
emitir SQL y sin ejecutar la operación. Descartarla dejaría al llamante creyendo que pidió N locks
con solo N-1 adquiridos, que es la forma más silenciosa de debilitar un invariante. Es un riesgo
concreto, no teórico: `Vehicle.sellerLeadId` es nullable, así que un caller podría construir
`{ type: 'sellerLead', id: sellerLeadId ?? '' }` sin darse cuenta.

Un **duplicado válido** sí se colapsa en una sola adquisición, sin error: deduplicar no pierde
exclusión. Una lista **vacía** es una decisión explícita y legítima del llamante (un caso sin raíz
operativa); lo que nunca ocurre es que una lista **no** vacía degenere en vacía.

La validación es de **runtime**, no solo de TypeScript: el contrato del tipo se puede eludir desde
datos deserializados, campos nullable, resultados parciales y casts en server actions futuras.

### Aislamiento

`READ COMMITTED` (el de por defecto). La exclusión la dan los row locks explícitos. **No** se usa
`Serializable`: por lo explicado arriba no aportaría garantía mientras los escritores no participen,
y añadiría `P2034` y reintentos a toda la superficie.

### Protocolo

1. **validar** raíces (fail-closed), deduplicar y ordenar — **antes** de abrir nada;
2. abrir transacción interactiva;
3. `SET LOCAL lock_timeout` y `SET LOCAL statement_timeout`;
4. `SELECT id … FOR UPDATE` por raíz, en orden;
5. ejecutar la operación con el cliente transaccional;
6. cerrar.

Sin raíces (`roots: []`) no se emite SQL de bloqueo, pero la operación sigue dentro de transacción:
así un caso sin raíz operativa —por ejemplo un evento de calendario sin vínculos— conserva la
atomicidad sin ser un caso especial.

### Timeouts

`lock_timeout` **3 s**, `statement_timeout` **10 s**, ambos con `SET LOCAL` para que se reviertan al
cerrar la transacción y no contaminen la conexión ni la configuración del servidor. El techo de la
transacción en Prisma (15 s) los supera a propósito, para que sea PostgreSQL quien aborte primero y
el fallo pueda traducirse a un código de dominio.

### Errores

| Código                | Origen                                                                                                               |
| --------------------- | -------------------------------------------------------------------------------------------------------------------- |
| `INVALID_LOCK_ROOT`   | raíz inválida; se lanza **antes** de abrir la transacción                                                            |
| `LOCK_TIMEOUT`        | SQLSTATE `55P03`                                                                                                     |
| `DEADLOCK`            | SQLSTATE `40P01`                                                                                                     |
| `TRANSACTION_TIMEOUT` | `P2028` — techo de la transacción en Prisma, **distinto** de `statement_timeout`, que llega como error de PostgreSQL |
| `ROOT_NOT_FOUND`      | la fila raíz no existe                                                                                               |
| `INFRA_ERROR`         | fallo desconocido de la maquinaria propia del helper (timeouts locales, adquisición)                                 |

**Frontera de traducción.** Los fallos de concurrencia reconocidos se traducen **ocurran donde
ocurran**: preparación, operación de negocio, commit o rollback. El envoltorio rodea la llamada
completa a `$transaction`, no solo el callback, porque el commit sucede fuera de él. Cualquier otro
error se propaga **intacto** — `OfferConflictError`, `DeliveryConflictError`, errores de validación y
cualquier fallo ajeno a la concurrencia llegan a su llamante sin disfrazarse. `INFRA_ERROR` **no** se
usa para errores de negocio arbitrarios.

**Detección de SQLSTATE.** Primero el código estructurado (`meta.code` de Prisma o `code` del driver)
en el error y en su cadena de `cause`, recorrida con profundidad acotada y detección de ciclos. El
respaldo por texto se aplica **solo** si el eslabón es un error de Prisma: que un mensaje comercial
contenga «40P01» no puede convertirlo en un deadlock.

**Serialización.** Los mensajes no contienen SQL, host, usuario, credenciales, códigos de PostgreSQL,
detalles de Prisma ni trazas. `code` es enumerable para que el llamante discrimine; **`cause` no lo
es**, así que no aparece en `JSON.stringify` ni viaja por accidente en una respuesta. Los llamantes
deben devolver únicamente `{ code, message }` y enviar `cause` solo a observabilidad interna.

### Efectos externos

```
NO EXTERNAL EFFECTS INSIDE LOCKED TRANSACTION
```

El helper no importa email, caché de Next, eventos de KPI, matching, UI ni módulos de negocio, y no
acepta callbacks para ellos. Los llamantes ejecutan sus efectos **después** del retorno correcto.
Mantenerlos dentro alargaría la retención de los locks tanto como tarde un servicio externo — un
timeout de Resend congelaría la creación de ofertas.

## Alternativas descartadas

- **`Serializable` en todos los escritores**: exige que cada flujo lea una clave común para que SSI
  vea el ciclo, y propaga `P2034` y reintentos a ofertas, entregas y calendario. Máximo coste,
  garantía frágil.
- **Solo validar `archivedAt` en los escritores**: evita la mayoría de casos reales y corrige un
  defecto que hoy existe (nada impide crear una oferta sobre un lead archivado), pero mantiene la
  carrera lectura→escritura. Se conservará como **defensa en profundidad**, no como garantía.
- **Predicados en el `WHERE` del propio archivado**: cierra `nextActionType` de forma atómica (misma
  fila) y estrecha la ventana del resto a la duración de un `UPDATE`, pero no la elimina para tablas
  externas.
- **Triggers**: moverían regla de negocio fuera del código revisable, invisible en tests y en Sentry.
- **Advisory locks**: equivalentes, pero con clave _hasheada_ (colisiones posibles) y sin nombre útil
  en `pg_locks`. Las tres raíces son filas reales, así que `FOR UPDATE` es superior.

## Seguridad del SQL

Prisma no expone row locks, así que el helper usa `$queryRaw` parametrizado. La tabla procede
**exclusivamente** de un mapping cerrado indexado por un tipo literal (`ROOT_TABLES`); nunca de una
cadena del llamante. El identificador viaja **siempre** como parámetro. No se usa `$queryRawUnsafe`,
ni concatenación de SQL, ni `LOCK TABLE`, ni locks de tabla completa. Los valores de `SET LOCAL` se
interpolan porque PostgreSQL no admite parámetros en `SET`, pero son enteros validados por el propio
helper y jamás proceden de entrada del cliente.

## Estado y limitaciones

**I1 es infraestructura inerte.** Ningún flujo de negocio lo invoca; no cambia el comportamiento de
ofertas, reservas, entregas, calendario, próxima acción, estado de vehículo, tasación ni archivado;
no toca el schema, ni migraciones, ni datos. Mientras nadie lo llame no emite SQL en producción.

```
I1 DOES NOT ENFORCE THE ARCHIVING INVARIANT BY ITSELF
```

El invariante `archivedAt != null AND dependencia activa` **sigue siendo alcanzable** hasta que los
escritores adopten el protocolo. Este ADR describe el mecanismo; la garantía llega cuando I2, I3, I4
y B2 final lo usen. No debe leerse como que el sistema ya está protegido.

## Punto de integración pendiente

La emisión de `INFRA_ERROR` y `DEADLOCK` a Sentry queda marcada en `lib/locking/errors.ts` y se
añadirá cuando el repositorio tenga un patrón claro de reporte para helpers de dominio; hoy no
existe y no se inventa aquí.

---

## Actualización de adopción (vigente en `main`, `687eae1`)

> La sección «Estado y limitaciones» describe el momento en que I1 era **infraestructura inerte**.
> Eso **ya no es cierto**: I2 (ofertas) e I3 (entregas/vehículo) adoptaron el protocolo. Esta sección
> refleja el estado real; la parte histórica se conserva como registro de la decisión original.

### Callers productivos (verificado en código)

Exactamente **5** puntos de llamada productivos de `withLockedRoots` (`grep` sobre `app/`+`lib/`, sin
tests, en `687eae1`):

1. `createOffer` — `app/(backoffice)/ofertas/actions.ts` (I2B).
2. `updateOfferStatus` — `app/(backoffice)/ofertas/actions.ts` (I2C).
3. `updateVehicle` — `app/(backoffice)/vendedores/[id]/actions.ts` (I3B).
4. `createDelivery` — `app/(backoffice)/entregas/actions.ts` → `createDeliveryTx` (I3C1A).
5. **Transición/cancelación coordinada de Delivery** — `app/(backoffice)/entregas/actions.ts` →
   `runCoordinatedDeliveryTransition` → `transitionDeliveryTx` (I3C2), compartida por
   `updateDeliveryStatus` (EN_CURSO) y `cancelDelivery`.

> El número **debe verificarse contra el código**, no copiarse: cualquier fase futura que añada o
> retire un caller debe actualizar esta lista.

### Patrón completo que siguen los callers

1. **lectura preliminar** solo para resolver los ids de las raíces (no decide negocio);
2. adquisición de **row locks** en el orden global (`Vehicle → SellerLead → BuyerLead`);
3. **relectura** dentro del `TransactionClient`;
4. **validación fail-closed** (raíz cambiada → `*_ROOT_CHANGED`; lead archivado cuando la operación lo
   exija → `LEAD_ARCHIVED`);
5. **CAS** sobre el estado esperado;
6. escritura atómica (entidad + `Activity`) en la misma transacción;
7. **efectos post-commit** (revalidate, KPIs, notificaciones) **fuera** de la transacción.

### Por qué los locks NO sustituyen al CAS

El row lock serializa a los callers **que adoptan el protocolo**; el CAS protege además frente a:
clientes obsoletos, doble submit, writers futuros, y **fronteras aún no coordinadas** (p. ej.
`completeDeliveryTx`, que todavía no usa `withLockedRoots`). El CAS es la segunda barrera que hace que
la carrera cancelación↔compleción sea segura hoy.

### Conflictos y errores

`ROOT_NOT_FOUND` (raíz inexistente, fail-closed), `*_ROOT_CHANGED` (la raíz cambió bajo el lock),
`LEAD_ARCHIVED` (según la operación), `LOCK_TIMEOUT`/`DEADLOCK` (traducidos a mensaje seguro), y la
**clasificación posterior a un CAS de 0 filas** (`ALREADY_*`/`STATUS_CHANGED`), determinista.

### Carreras demostradas (garantías, no detalles frágiles)

- dos cancelaciones concurrentes → exactamente una gana; una sola `Activity`;
- **cancelación gana** frente a compleción → la compleción falla su CAS y **revierte** por completo;
- **compleción gana** frente a cancelación → la cancelación observa `DELIVERY_ALREADY_COMPLETED` sin
  escribir nada; **contención de lock observada** con `waitUntilBlocked`/`pg_stat_activity`;
- creación concurrente de Delivery → el índice único parcial garantiza **una sola activa** por
  vehículo.

Detalle y cobertura en [`docs/quality/delivery-test-matrix.md`](../quality/delivery-test-matrix.md).

### Pendiente

`completeDeliveryTx` (`EN_CURSO → COMPLETADA` + Vehicle→VENDIDO + Warranty + follow-ups) **todavía no
adopta** este protocolo: pertenece a **I3C3**. Hasta entonces, la seguridad de la carrera con la
cancelación descansa en el CAS + el row-lock de PostgreSQL (ver DOC-1 §6).
