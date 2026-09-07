# INTAKE-1 — Separar solicitudes web del inventario operativo

| Campo               | Valor                                 |
| ------------------- | ------------------------------------- |
| **Estado**          | IMPLEMENTED                           |
| **Owner**           | Product / Engineering                 |
| **Ticket**          | INTAKE-1                              |
| **Rama / PR**       | `codex/intake-1-web-admission` / #178 |
| **Categorías**      | C0, C1, C2, C3, C4, C5                |
| **Riesgo**          | Alto                                  |
| **Ruta SDD**        | Reforzada                             |
| **Última revisión** | 2026-09-07                            |

## Problema

Las solicitudes creadas por visitantes en `/vender` se convierten hoy en las mismas entidades que
las altas internas y aparecen directamente en las vistas operativas. La tasación preliminar,
además, hace que una parte deje de cumplir el filtro antiguo de `Leads web`, por lo que termina
mezclada con el trabajo ya aceptado por el equipo.

## Resultado esperado

Evitar que las solicitudes creadas por visitantes en `/vender` se mezclen inmediatamente con los
vendedores y vehículos ya admitidos por el equipo. La señal de éxito es que una solicitud web nueva
aparezca en una bandeja de admisión y no en el inventario ni en la bandeja operativa hasta que un
ADMIN o AGENTE la admita.

## B. Baseline verificado

- **VERIFICADO EN CÓDIGO:** `/vender` crea directamente `SellerLead` + `Vehicle` con `canal=PRO`
  (`app/vender/empezar/actions.ts:143-170`).
- **VERIFICADO EN CÓDIGO:** el alta interna crea las mismas entidades con `canal=CN`
  (`app/(backoffice)/vendedores/actions.ts:35-61`).
- **VERIFICADO EN CÓDIGO:** `/vehiculos` no filtra canal ni admisión
  (`app/(backoffice)/vehiculos/page.tsx:47-86,110-127`).
- **VERIFICADO EN CÓDIGO:** la vista `leads-web` exige además no tener tasación, aunque `/vender`
  intenta guardar una tasación preliminar (`vendedores/page.tsx:80-86` y
  `vender/empezar/actions.ts:193-201`).
- **DECISIÓN DOCUMENTADA:** `Vehicle` está conflado como activo, inventario y publicación; no se
  crea una entidad `Listing` sin su driver (`docs/architecture/architecture-decisions.md`, AD-011).
- **VERIFICADO EN ENTORNO:** no se ha consultado ni modificado staging o producción para preparar
  esta implementación local.

## C. Alcance

- Estado canónico de admisión en `SellerLead`.
- Nuevas solicitudes web pendientes; altas internas admitidas.
- Acción server-side para admitir o rechazar con actor, fecha y Activity.
- Bandejas de vendedores e inventario separadas por admisión.
- Etiqueta y controles en la ficha del vendedor.
- Migración aditiva y clasificación conservadora del histórico.
- Tests de reglas, queries, autorización y persistencia.

## D. Exclusiones

- No crear `Listing`, `Party`, `Deal` ni una segunda tabla de vehículos.
- No borrar solicitudes rechazadas ni fotografías.
- No cambiar tasación, matching, ofertas, entrada, publicación, venta o notificaciones.
- No ejecutar migraciones remotas, push, PR, merge o deployment en esta autorización.
- La redefinición estricta de «stock físico» por `entryValidatedAt` queda para otro cambio.

## E. Decisiones de negocio

| Decisión                               | Alternativas                                              | Resolución y motivo                                                                              |
| -------------------------------------- | --------------------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| Fuente y admisión son hechos distintos | Reutilizar `canal`; inferir desde estados; campo propio   | Campo propio: evita convertir un origen inmutable o un estado corregible en gate.                |
| Solicitudes web nuevas                 | Admitidas automáticamente; pendientes                     | `PENDIENTE`, para que no contaminen la operación.                                                |
| Altas internas                         | Pendientes; admitidas                                     | `ADMITIDO`, porque ya expresan una decisión humana.                                              |
| Actores                                | Solo ADMIN; ADMIN+AGENTE                                  | ADMIN+AGENTE, roles responsables del módulo comercial.                                           |
| Rechazo                                | Borrado; cambiar estado comercial; clasificación separada | `RECHAZADO` sin borrar ni forzar el estado comercial; conserva datos y separa responsabilidades. |
| Corrección                             | Terminal; reversible                                      | Una solicitud rechazada puede admitirse después; el CAS evita Activities duplicadas.             |

## F. Flujo funcional

1. `/vender` persiste lead/vehículo/fotos/tasación como hoy, con admisión `PENDIENTE`.
2. `Solicitudes web` muestra las pendientes, incluidas las que tienen tasación preliminar.
3. ADMIN o AGENTE abre la ficha y elige `Admitir en CRM` o `Rechazar solicitud`.
4. Admitir registra actor/fecha/Activity y hace visible el registro en `Vendedores` e `Inventario`.
5. Rechazar registra actor/fecha/Activity y lo conserva fuera de las bandejas operativas.
6. Si dos actores deciden a la vez, solo el primer CAS cambia el estado; el segundo recibe el estado
   ya vigente sin duplicar Activity.

## G. Estados e invariantes

- `PENDIENTE -> ADMITIDO | RECHAZADO`; `RECHAZADO -> ADMITIDO` permite corregir errores.
- `ADMITIDO` no vuelve a pendiente/rechazado en INTAKE-1 para no expulsar operativa ya iniciada.
- `canal` conserva el origen y nunca cambia al admitir.
- La admisión no modifica `SellerLead.status` ni `Vehicle.status`.
- Ningún `SellerLead` se duplica y ningún `Vehicle` se mueve o copia.

## H. Permisos

| Actor                         | Ver bandeja | Admitir/rechazar | Enforcement                      |
| ----------------------------- | ----------- | ---------------- | -------------------------------- |
| ADMIN                         | Sí          | Sí               | `requireAgente` server-side      |
| AGENTE                        | Sí          | Sí               | `requireAgente` server-side      |
| TALLER / ENTREGAS / MARKETING | No          | No               | guard antes de la query/mutación |
| Sin sesión                    | No          | No               | redirección de `requireAuth`     |

Los IDs recibidos se validan en servidor y la mutación limita `canal=PRO`; una alta interna no se
puede reclasificar por esta acción.

## I. Modelo de datos y migraciones

- Enum `SellerIntakeStatus`: `PENDIENTE`, `ADMITIDO`, `RECHAZADO`.
- `SellerLead.intakeStatus` no nullable, default `ADMITIDO` para compatibilidad con el cliente viejo.
- `intakeReviewedAt` e `intakeReviewedById` nullable; FK a `User` con `ON DELETE SET NULL`.
- Índice `(intakeStatus, createdAt)` para bandejas y conteos.
- Migración aditiva: enum, columnas, FK e índice. DML determinista en la misma migración:
  `CN -> ADMITIDO`; `PRO + DESCARTADO -> RECHAZADO`; `PRO` sin asignar, lead/vehículo `NUEVO` y sin
  entrada activa -> `PENDIENTE`; el resto `ADMITIDO`.
- El cliente anterior ignora las columnas y sigue escribiendo `ADMITIDO` por default; el nuevo
  cliente requiere la migración antes de desplegar.

## J. Writers y readers

| Componente                          | Actual                                     | Cambio                                                | Riesgo                     | Validación                                  |
| ----------------------------------- | ------------------------------------------ | ----------------------------------------------------- | -------------------------- | ------------------------------------------- |
| `/vender` action                    | `PRO` directo al conjunto común            | escribe `PENDIENTE`                                   | olvidar writer             | unit test de create data                    |
| Altas internas, capturas y trade-in | escriben `CN`                              | default/expreso `ADMITIDO`                            | vía alternativa pendiente  | búsqueda de writers + tests existentes      |
| Acción de admisión                  | no existe                                  | CAS + Activity en transacción                         | doble Activity             | unit/integración concurrente                |
| `/vendedores`                       | todos por defecto; `leads-web` incompleto  | default admitidos; web=pending; rechazadas explícitas | ocultar histórico          | tests de builder/query                      |
| `/vehiculos`                        | todos                                      | solo admitidos                                        | conteo divergente          | test de query                               |
| Ficha vendedor                      | etiqueta de canal                          | banner y acción según admisión                        | control solo UI            | test positivo/negativo action               |
| Mi día y calendario                 | incluyen la próxima acción web automática  | solo admitidos en el trabajo operativo                | reaparición indirecta      | unitarios + diff                            |
| Selectores de Taller/Calendario     | pueden listar vehículos del conjunto común | solo vehículos admitidos                              | bypass operativo           | typecheck + diff                            |
| Búsqueda global                     | encuentra todo                             | conserva resultados y añade etiqueta diferida         | pérdida de encontrabilidad | regresión existente; sin cambio en INTAKE-1 |
| KPIs históricos/analíticos          | varios readers de todos los leads          | sin redefinir métricas en este PR                     | métricas mezcladas         | deuda explícita y reconciliación posterior  |
| Matching/tasación/email/storage     | se ejecutan al captar                      | sin cambio                                            | efectos accidentales       | tests existentes y diff                     |

## K. Concurrencia e idempotencia

La decisión usa `updateMany` condicionado por el estado origen dentro de `$transaction`; Activity se
crea solo si `count=1`. Un segundo submit obtiene resultado `SIN_CAMBIOS`. No se necesita lock de raíz
porque INTAKE-1 modifica columnas ortogonales y no promete coordinar con dinero, entrada o venta.

## L. Efectos secundarios e integraciones

- Se añade una Activity auditable sin PII en el texto.
- No se reejecuta tasación, matching, emails ni uploads al admitir/rechazar.
- `revalidatePath('/vendedores')`, `revalidatePath('/vehiculos')` y ficha tras commit.
- Los KPIs históricos siguen usando canal/estado; INTAKE-1 no cambia sus definiciones.

## M. UX y errores

- `Vendedores` abre en `En gestión` y contiene solo admitidos.
- `Solicitudes web` muestra todas las pendientes aunque estén tasadas.
- `Rechazadas web` permite localizar histórico y admitir una decisión corregida.
- La ficha muestra aviso ámbar para pendiente y neutro/rojo para rechazada, con acción clara.
- Doble clic deshabilitado en cliente y protegido por CAS en servidor.
- Entidad inexistente, canal interno o transición inválida devuelven error de dominio legible.

## N. Tests

- Unitarios: filtros de vistas y reglas de transición.
- Actions: autorizado, no encontrado, canal interno, doble ejecución y Activity única.
- Integración PostgreSQL: migración/replay y CAS concurrente cuando exista DB local disponible.
- Regresión: web tasada sigue apareciendo en `Solicitudes web`; pendiente no aparece en inventario.
- Typecheck, lint, Vitest, migration history, build y CI migration replay.

## Rollout

1. Validación local y CI.
2. Preflight read-only de conteos por canal/estado/señales en staging.
3. `prisma migrate deploy` solo en staging con autorización.
4. Deploy Preview, postflight y smoke ADMIN/AGENTE.
5. Preflight equivalente en producción y revisión del conjunto que quedará pendiente.
6. Migración de producción autorizada, deploy de `main`, smoke y observación 24 h.

## P. Rollback y stop conditions

- Código: revertir deployment; el default `ADMITIDO` mantiene compatibilidad del cliente anterior.
- Schema: permanece aditivo; no retirar columnas durante el rollback inmediato.
- Datos: corregir admisión mediante la acción, nunca borrar filas.
- Detener si el preflight clasifica como pendientes vehículos con entrada, oferta, reserva, entrega o
  estado distinto de `NUEVO`; si hay drift/migraciones fallidas; o falla un caso negativo de auth.

## Q. Observabilidad

- Fuente canónica: columnas de admisión y Activity, no PostHog.
- Postflight: conteos por canal+admisión; pendientes con señales operativas debe ser cero.
- Revisar Sentry por errores de la acción/query durante 24 h, sin email/teléfono/payload.
- No se añade evento PostHog: no hay una pregunta de analítica de producto necesaria para el gate.

## R. Documentación

- Esta spec es la fuente del cambio.
- Actualizar estado/commit/PR/deployment solo cuando cada paso ocurra.
- Si el concepto se consolida, actualizar el mapa de dominio tras el merge, no antes.

## S. Riesgos y deuda explícita

| Riesgo/deuda                                | Impacto | Mitigación / owner                                               |
| ------------------------------------------- | ------- | ---------------------------------------------------------------- |
| Backfill interpreta históricos incompletos  | Alto    | preflight y stop conditions; Operations/Product                  |
| KPIs generales siguen incluyendo pendientes | Medio   | no cambiar definiciones silenciosamente; ticket posterior de KPI |
| `Vehicle` sigue conflado con inventario     | Medio   | INTAKE-1 filtra admisión; AD-011 permanece vigente               |
| Rechazo sin motivo estructurado             | Bajo    | Activity audita la decisión; motivo opcional diferido            |

## Criterios de aceptación

- [x] Una captura web nueva queda `PENDIENTE` y no aparece en Vendedores/Inventario por defecto.
- [x] Una alta interna queda `ADMITIDO` y aparece como hoy.
- [x] La bandeja web incluye pendientes con tasación preliminar.
- [x] ADMIN y AGENTE pueden admitir/rechazar; otros roles y sesión ausente no pueden.
- [x] Admitir hace visible el mismo lead/vehículo sin duplicarlo.
- [x] Reintentar una decisión no duplica Activity.
- [ ] El histórico se clasifica sin pérdida y el preflight detecta excepciones operativas.
- [x] No cambian tasación, matching, ofertas, ventas, emails, Storage ni catálogo público.

## U. Estado de autorización

`IMPLEMENTED LOCALLY — READY FOR INDEPENDENT REVIEW`

La instrucción «adelante» autoriza preparar la spec e implementación local en esta rama. Continúan
prohibidos commit, push, PR, migración remota, backfill remoto, merge y cambios en staging o
producción. El siguiente gate es la revisión del diff y la autorización explícita para commit/push y
staging.

## Revisión adversarial

| Hallazgo adversarial                                              | Materialidad | Corrección incorporada                          |
| ----------------------------------------------------------------- | ------------ | ----------------------------------------------- |
| Usar `SellerLead.status` como admisión permite bypass por edición | Alta         | estado canónico separado                        |
| Filtrar solo `canal=CN` ocultaría web ya aceptada                 | Alta         | `intakeStatus=ADMITIDO` común                   |
| `leads-web` excluye web tasada                                    | Alta         | elimina condición de tasación                   |
| Dos comerciales deciden a la vez                                  | Media        | CAS y Activity condicionada                     |
| Default `PENDIENTE` rompería writers antiguos                     | Alta         | default DB `ADMITIDO`; web lo escribe explícito |
| Backfill manda operativa activa a pendientes                      | Alta         | predicado conservador + preflight/stop          |
| Rechazar fuerza estado comercial y altera KPIs                    | Media        | admisión ortogonal, sin tocar estados           |

## Matriz de completitud

| Área                      | Revisada | Evidencia                  | Riesgo pendiente                   |
| ------------------------- | -------- | -------------------------- | ---------------------------------- |
| Dominio/estados           | Sí       | F–G                        | ninguno material                   |
| Permisos                  | Sí       | H + tests de Server Action | smoke remoto pendiente             |
| Concurrencia/idempotencia | Sí       | K + unitarios CAS          | integración PostgreSQL pendiente   |
| Datos/legacy/migración    | Sí       | I, O, P                    | preflight remoto pendiente         |
| Compatibilidad            | Sí       | I                          | orden DB→cliente obligatorio       |
| Readers/efectos           | Sí       | J–L                        | KPIs generales diferidos           |
| Caché/superficie pública  | Sí       | L                          | revalidación pendiente             |
| Observabilidad            | Sí       | Q                          | observación remota no autorizada   |
| Rollout/rollback          | Sí       | O–P                        | operaciones remotas no autorizadas |
| Documentación             | Sí       | R                          | cierre posterior                   |

## Cierre

- **Commit:** pendiente.
- **PR:** pendiente.
- **CI:** pendiente.
- **Deployment:** pendiente.
- **Validación local:** Prisma validate/generate, SDD, formato, TypeScript, lint, 1.461 tests y
  build verdes. El build completó aunque el catálogo estático no pudo leer la base remota
  configurada; ese reader degradó de forma controlada.
- **No ejecutado:** integración PostgreSQL, replay de migración, preflight ni smoke remoto por no
  disponer de `TEST_DATABASE_URL`, Docker/PostgreSQL local ni autorización remota para INTAKE-1.
- **Deuda restante:** revisión de KPIs y definición futura de stock físico.
