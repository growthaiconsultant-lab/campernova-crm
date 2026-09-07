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
- [x] El histórico se clasifica sin pérdida y el preflight detecta excepciones operativas.
- [x] No cambian tasación, matching, ofertas, ventas, emails, Storage ni catálogo público.

## U. Estado de autorización

`IMPLEMENTED — STAGING VALIDATED; PRODUCTION PREFLIGHT PASS; PRODUCTION NOT AUTHORIZED`

La autorización posterior permitió el rollout únicamente de staging. El preflight confirmó que las
migraciones previas estaban presentes, que INTAKE-1 era la única migración local pendiente y que no
había migraciones fallidas ni candidatos históricos con señales operativas. La migración se aplicó
mediante `prisma migrate deploy` al proyecto staging `iatuhydsfwoeprpbklod`; el guard posterior
confirmó las 13 migraciones locales coherentes con el historial remoto. `DATABASE_URL` y `DIRECT_URL`
se rotaron exclusivamente en Vercel Preview y el deployment `4iyrqdkWRetQdfm5ApiZWiNjoe2S` quedó
`Ready` para el commit `c4118f0` en la rama de la PR. El smoke público, la redirección de una ruta
protegida a `/login` y el acceso autenticado como QA AGENTE son correctos. La sesión confirmó 0
solicitudes web, 3 vendedores internos admitidos y 3 vehículos en inventario. El enlace emitido por
este commit todavía apuntó a localhost; el código de un solo uso se canjeó manualmente en el
callback del mismo Preview para completar el smoke.

AUTH-1 (#175) se sincronizó con `main`, repitió CI y Preview, se fusionó como `8ef0faa` y quedó
desplegada en producción con CI `34142488970` verde. El smoke confirmó `/login`, la barrera de una
ruta protegida y el envío de un magic link real con el nuevo comportamiento.

El primer preflight read-only de producción detuvo correctamente el rollout de INTAKE-1: encontró
una solicitud candidata a pendiente con una oferta `EXPIRADA`, sin reserva ni entrega. No se aplicó
ninguna migración en producción. Como la primera migración ya estaba desplegada en staging y no
podía editarse, se añadió la migración correctiva
`20260907184500_preserve_operational_web_intakes`, que restaura de forma idempotente a `ADMITIDO`
las solicitudes con estado, responsable, entrada, oferta o entrega.

La corrección superó replay, integración y un segundo ciclo completo de staging: el preflight
detectó únicamente esa migración pendiente, `prisma migrate deploy` la aplicó y el postflight
confirmó 14 migraciones locales coherentes con 43 registros remotos, 3 vendedores `ADMITIDO` y cero
pendientes con señales operativas. El Preview del commit `10d5e9d` quedó `Ready` y el smoke
autenticado como QA AGENTE confirmó dashboard, bandeja web vacía, 3 vendedores admitidos y 3
vehículos en inventario.

El preflight fresco de producción del 2026-09-07 sigue siendo exclusivamente de lectura: 112
vendedores (64 `PRO`, 48 `CN`), 0 para `RECHAZADO`, 62 candidatos iniciales a `PENDIENTE`, 1
restaurado por la corrección y 61 pendientes finales; por tanto, quedan 0 pendientes con señales
operativas. Las 12 migraciones locales anteriores están aplicadas y sus checksums son coherentes;
faltan exactamente las dos migraciones INTAKE-1, sin registros remotos inconclusos ni revertidos.
Producción permanece sin cambios y requiere autorización separada.

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

| Área                      | Revisada | Evidencia                   | Riesgo pendiente                      |
| ------------------------- | -------- | --------------------------- | ------------------------------------- |
| Dominio/estados           | Sí       | F–G                         | ninguno material                      |
| Permisos                  | Sí       | H + tests + smoke AGENTE    | smoke ADMIN no ejecutado              |
| Concurrencia/idempotencia | Sí       | K + unitarios + integración | sin pendiente en staging para mutar   |
| Datos/legacy/migración    | Sí       | I, O, P + staging + prod RO | producción no autorizada              |
| Compatibilidad            | Sí       | I + Preview + AUTH-1 prod   | ninguno material antes del rollout    |
| Readers/efectos           | Sí       | J–L                         | KPIs generales diferidos              |
| Caché/superficie pública  | Sí       | L + smoke Preview           | ninguno en staging                    |
| Observabilidad            | Sí       | Q                           | observación posterior al rollout      |
| Rollout/rollback          | Sí       | O–P + staging + prod RO     | migración de producción no autorizada |
| Documentación             | Sí       | R                           | cierre final tras producción          |

## Cierre

- **Commits:** implementación `3915391`; corrección conservadora de datos `10d5e9d`; actualizaciones
  documentales en el historial de la PR.
- **PR:** #178 abierta contra `main`, fusionable y sin retraso respecto a la base en el preflight
  de producción.
- **CI:** verde en run `34143975653`: quality, integration, migration-replay y supabase-storage;
  Vercel Preview Comments también finalizó correctamente.
- **Staging:** preflight con 3 vendedores `CN`, 0 `PRO`, 0 candidatos a `PENDIENTE`, 0 candidatos de
  riesgo y 0 migraciones fallidas. `20260907150000_add_seller_intake_admission` se aplicó con
  `prisma migrate deploy`; el postflight confirmó 3 `ADMITIDO`, 0 `PENDIENTE`, 0 `RECHAZADO`, índice
  y columna presentes, migración finalizada y 0 pendientes con señales operativas.
- **Staging correctivo:** `20260907184500_preserve_operational_web_intakes` se aplicó mediante
  `prisma migrate deploy`; el postflight confirmó 14 migraciones locales coherentes con 43 registros
  remotos, 3 `ADMITIDO` y 0 pendientes con señales operativas.
- **Deployment:** Vercel Preview `J797bgJX5jHCcUv3jmVQ8nPNUu3h` `Ready`, commit `10d5e9d`, rama
  `codex/intake-1-web-admission`, usando exclusivamente staging. El smoke QA AGENTE confirmó
  dashboard, bandeja web vacía, 3 vendedores admitidos y 3 vehículos; una ruta protegida sin sesión
  redirigió a `/login`. AUTH-1 (#175) ya está fusionada y desplegada en producción como `8ef0faa`.
- **Preflight producción actualizado:** 112 vendedores; 64 `PRO`; 48 `CN`; 0 para `RECHAZADO`; 62
  candidatos iniciales a `PENDIENTE`; 1 protegido por la migración correctiva; 61 pendientes finales
  y 0 pendientes finales con señales operativas. Hay 12 migraciones locales aplicadas y coherentes;
  faltan exactamente las dos de INTAKE-1, sin migraciones inconclusas o revertidas.
- **Validación local:** Prisma validate/generate, SDD, formato, TypeScript, lint, 1.484 tests y
  build verdes. El build completó aunque el catálogo estático no pudo leer la base remota
  configurada; ese reader degradó de forma controlada.
- **Validación CI actual:** replay completo de 14 migraciones, catálogo del schema, integración
  PostgreSQL (incluida la regresión del backfill y la carrera de admisión) y Supabase Storage verdes.
- **No ejecutado:** migraciones, merge, deploy o smoke de producción; smoke ADMIN y mutación de
  admisión remota. INTAKE-1 no está fusionada ni desplegada en producción.
- **Deuda restante:** revisión de KPIs y definición futura de stock físico.
