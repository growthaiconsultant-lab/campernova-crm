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
comprador toma `{BuyerLead}`: ambos son subconjuntos que respetan el mismo orden. **No existe ciclo
posible**, así que la ausencia de deadlock es una propiedad del diseño, no una casualidad.

El orden vive en un **único módulo** (`lib/locking/roots.ts`). Repartirlo entre llamantes
reintroduciría exactamente el riesgo que elimina.

### Aislamiento

`READ COMMITTED` (el de por defecto). La exclusión la dan los row locks explícitos. **No** se usa
`Serializable`: por lo explicado arriba no aportaría garantía mientras los escritores no participen,
y añadiría `P2034` y reintentos a toda la superficie.

### Protocolo

1. normalizar raíces (deduplicar + ordenar);
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

`LOCK_TIMEOUT` (55P03), `DEADLOCK` (40P01), `ROOT_NOT_FOUND` (la fila raíz no existe) e
`INFRA_ERROR` (fallo no reconocido **de la fase de bloqueo**). Los mensajes no contienen SQL, host,
usuario, credenciales, códigos de PostgreSQL, detalles de Prisma ni trazas; el error original se
conserva en `cause` solo para observabilidad interna.

Los errores que lance la operación de negocio **se propagan intactos**: envolverlos ocultaría
conflictos de dominio legítimos como `OfferConflictError`.

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
