# PERM-2 — Reducir fricción comercial sin rebajar seguridad

| Campo               | Valor                                                                                                         |
| ------------------- | ------------------------------------------------------------------------------------------------------------- |
| **Estado**          | IMPLEMENTED                                                                                                   |
| **Owner**           | Engineering                                                                                                   |
| **Ticket**          | [GitHub #166](https://github.com/growthaiconsultant-lab/campernova-crm/issues/166)                            |
| **Rama / PR**       | `codex/perm-2a-low-risk-walls` / [PR #167](https://github.com/growthaiconsultant-lab/campernova-crm/pull/167) |
| **Categorías**      | C0, C1, C2, C3                                                                                                |
| **Riesgo**          | Medio                                                                                                         |
| **Ruta SDD**        | Estándar                                                                                                      |
| **Última revisión** | 2026-08-05                                                                                                    |

## Problema y evidencia

La Oleada 1 hizo corregibles los estados de leads, matches y calendario, pero dos decisiones
operativas de bajo riesgo todavía impiden completar acciones cotidianas:

- `discardSellerLead` y `markBuyerLeadLost` rechazan la acción si el operador no selecciona un
  `LostReason`, aunque los campos `lostReason` de Prisma son anulables y los KPIs ya ignoran filas
  sin motivo.
- `resolveCommitment` rechaza crear eventos `LLAMADA` y `OTRO` sin clasificarlos como compromiso
  externo o tarea interna, aunque `CalendarEvent.commitment` admite el valor
  `INDETERMINADO`, la ficha permite reclasificarlo después y el schema ya tiene ese valor por defecto.

La fricción afecta a ADMIN y AGENTE cuando necesitan registrar primero el hecho y completar la
clasificación más tarde. Ninguna de estas dos clasificaciones protege dinero, reservas, entregas,
permisos o integridad referencial.

## Resultado esperado

- Un vendedor puede pasar a `DESCARTADO` y un comprador a `PERDIDO` sin seleccionar un motivo.
- Un motivo no vacío sigue validándose; un valor manipulado o desconocido se rechaza.
- La Activity conserva actor, transición, detalle opcional y expresa `Motivo: sin especificar`
  cuando corresponda.
- Una `LLAMADA` o evento `OTRO` puede crearse sin elegir naturaleza y se guarda como
  `INDETERMINADO`.
- La ficha del evento mantiene la acción existente para reclasificar posteriormente.
- Citas y limpiezas conservan su clasificación forzada; combinaciones explícitas incompatibles
  siguen rechazándose.

## Reglas e invariantes

- No cambia la autorización: las acciones continúan detrás de `requireAgente()`.
- No se eliminan transacciones, Activities, locks, CAS, constraints ni validaciones de seguridad.
- `lostReason == null` significa exclusivamente «sin clasificar»; no se inventa una categoría.
- Si llega un motivo no vacío, debe pertenecer a `LostReason`.
- `CITA` siempre se persiste como `EXTERNO` y `LIMPIEZA` como `INTERNO`.
- `LLAMADA` y `OTRO` sólo usan `INDETERMINADO` cuando no se suministra clasificación; un valor
  suministrado debe seguir siendo `EXTERNO` o `INTERNO`.
- Los campos de texto mantienen sus límites actuales y no se almacenan payloads sensibles nuevos.

## Fuera de alcance

- Ofertas, reservas, entregas, venta, garantías, importes, stock y transiciones de vehículo.
- Publicación normal o forzada y requisitos legales del vehículo.
- Bloqueos para archivar leads con stock, ofertas, reservas o entregas activas.
- Cambios de roles, RLS, schema o migraciones.
- Despliegue y validación en producción dentro de este cambio.

## Decisiones

| Decisión                           | Alternativas                                | Resolución y motivo                                                                                   |
| ---------------------------------- | ------------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| Motivo de pérdida/descarte         | Obligatorio / categoría ficticia / anulable | Anulable. El schema y los readers ya toleran `null`; no falsea analítica con una categoría inventada. |
| Motivo inválido no vacío           | Ignorar / guardar texto / rechazar          | Rechazar. Mantiene la integridad semántica del enum.                                                  |
| Naturaleza ausente en llamada/otro | Bloquear / asumir interno / `INDETERMINADO` | `INDETERMINADO`. Evita inventar si hubo compromiso con cliente y ya existe reclasificación posterior. |
| Alcance                            | Abrir también venta/entrega / separar       | Separar. Dinero y estados canónicos requieren una ruta reforzada y una decisión específica.           |

## Plan técnico

1. Hacer opcional el motivo en las dos actions comerciales y construir la Activity con fallback
   explícito, conservando la validación de motivos presentes.
2. Adaptar los dos diálogos para que la selección sea opcional y explicar que puede clasificarse
   después.
3. Resolver `LLAMADA`/`OTRO` sin elección como `INDETERMINADO`, retirar el bloqueo duplicado de la UI
   y mantener los controles de incompatibilidad.
4. Actualizar tests de dominio, actions y componentes afectados; ejecutar harness SDD, pruebas
   dirigidas y batería del repositorio.
5. Revisar diff, secretos, el documento local no versionado y consumidores de KPIs/calendario antes
   de preparar el PR.

### Impacto

- **Código y consumidores:** actions de vendedor/comprador, dominio/formulario de calendario y sus
  tests. Los readers ya renderizan ausencia de motivo de forma condicional y `INDETERMINADO` en la
  ficha del evento.
- **Datos/migraciones:** ninguna. Se usan nulabilidad y enum existentes.
- **Permisos/seguridad:** sin cambios; enforcement server-side intacto.
- **Concurrencia/idempotencia:** sin cambios en transacciones ni locks; este cambio no añade writers.
- **Integraciones/efectos externos:** no se añaden emails, webhooks ni invalidaciones nuevas.
- **Observabilidad/KPIs:** la agrupación de motivos seguirá excluyendo `null`; aumentará la población
  sin clasificar. La Activity permite auditar cada acción aunque falte la clasificación.

## Criterios de aceptación

- [x] Vendedor y comprador pueden cerrarse comercialmente sin motivo y se persiste `null`.
- [x] Un motivo válido se conserva y uno inválido no vacío no escribe nada.
- [x] La Activity distingue correctamente motivo conocido y sin especificar.
- [x] `LLAMADA` y `OTRO` sin naturaleza se crean como `INDETERMINADO`.
- [x] Las clasificaciones explícitas válidas funcionan y las incompatibles se rechazan.
- [x] `CITA`/`LIMPIEZA`, autorización, transacciones y barandillas fuera de alcance no cambian.
- [x] `pnpm check:sdd`, pruebas dirigidas, `pnpm typecheck`, `pnpm lint`, `pnpm test` y `pnpm build`
      terminan con resultado conocido.

## Verificación

| Criterio                 | Evidencia prevista                                        | Resultado                           |
| ------------------------ | --------------------------------------------------------- | ----------------------------------- |
| Motivo opcional          | Tests de actions vendedor/comprador                       | OK; incluido en 119 tests dirigidos |
| Motivo inválido          | Casos negativos sin escrituras                            | OK                                  |
| Compromiso indeterminado | `lib/calendar/commitment.test.ts` y actions de calendario | OK                                  |
| UI sin bloqueo           | Inspección de componentes, Prettier y typecheck           | OK                                  |
| Regresión global         | lint, suite Vitest y build                                | OK: 108 archivos / 1.409 tests      |

## Rollout, rollback y stop conditions

- **Rollout:** rama corta → PR → CI. Producción requiere autorización separada tras revisar el PR.
- **Rollback/mitigación:** revertir el commit restaura la obligatoriedad; los `null` y
  `INDETERMINADO` creados mientras estuvo activo siguen siendo legibles por el código anterior y por
  el schema actual.
- **Detener si:** aparece un reader que asume `lostReason` no nulo, un KPI falla con `null`, se altera
  una barandilla de oferta/entrega/venta o el cambio exige migración.
- **Validación post-despliegue:** smoke autenticado de los cuatro flujos y revisión de errores en
  Sentry; fuera del alcance autorizado de esta implementación local.

## Revisión adversarial

| Riesgo intentado                                            | Mitigación o riesgo pendiente                                                                                      |
| ----------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| Enviar un motivo inventado para evitar el enum              | Sólo la ausencia es permisiva; cualquier valor no vacío se valida y se rechaza.                                    |
| Confundir `null` con una causa real en KPIs                 | No se inventa categoría; el KPI actual lo excluye y queda deuda visible de clasificación.                          |
| Asumir que una llamada era interna y archivar indebidamente | Se persiste `INDETERMINADO`, no `INTERNO`; además la Oleada 1 ya no usa eventos futuros como bloqueo de archivado. |
| Eliminar trazabilidad al quitar el campo obligatorio        | La Activity continúa siendo atómica y registra actor, transición y fallback explícito.                             |
| Ampliar accidentalmente a venta o stock                     | Archivos y criterios excluyen ofertas, entregas, vehículo y publicación.                                           |

## Cierre

- **Commit:** `3279f29d74947722e3882bbf3239c2087700015e` (implementación).
- **PR:** [#167](https://github.com/growthaiconsultant-lab/campernova-crm/pull/167), abierta y
  fusionable; contiene exclusivamente los 14 archivos previstos.
- **CI:** `quality`, `integration`, `migration-replay` y `supabase-storage` en PASS; Vercel Preview
  Comments en PASS.
- **Deployment:** no autorizado en este cambio.
- **Validación:** `check:sdd`, 119 tests dirigidos, 1.409 tests globales, typecheck, lint, formato,
  `git diff --check` y build Next.js completados. El build local no alcanzó el pooler de Supabase
  durante la generación estática, aplicó el fallback existente del catálogo y terminó con código 0;
  no se considera una validación de datos remotos.
- **Deuda restante:** clasificación posterior de motivos y diseño reforzado de la Oleada 2 para
  stock, ofertas, entregas y venta.
