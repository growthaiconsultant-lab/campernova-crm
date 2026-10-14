# COM-7 — Marcar compradores que no contestan

| Campo               | Valor                                                                                   |
| ------------------- | --------------------------------------------------------------------------------------- |
| **Estado**          | DEPLOYED                                                                                |
| **Owner**           | Engineering                                                                             |
| **Ticket**          | Petición «hay que añadir la opción de no contesta en el estado», 2026-10-14             |
| **Rama / PR**       | [PR #199](https://github.com/growthaiconsultant-lab/campernova-crm/pull/199), fusionada |
| **Categorías**      | C0, C1, C2, C3, C4, C9                                                                  |
| **Riesgo**          | Alto por expansión de enum persistido                                                   |
| **Ruta SDD**        | Reforzada                                                                               |
| **Última revisión** | 2026-10-14                                                                              |

## Problema y evidencia

Baseline inicial: main/origin/main en 2f141ec, con COM-5/COM-6 preparados localmente.
BuyerLeadStatus tenía seis valores y no permitía identificar un intento de contacto
sin respuesta. Los estados se validan en ficha/acción rápida y se filtran mediante
catálogos de UI y listas de activos en pipeline/KPIs. La petición autoriza añadir
el estado; posteriormente se autorizó la migración y publicación (véase Cierre).

## Resultado esperado

«No contesta» (NO_CONTESTA) seleccionable desde ficha, formulario y listado móvil/
escritorio, y filtrable. Continúa como lead activo, elegible para matching, en etapa
Lead del funnel hasta contactar efectivamente. Puede corregirse hacia cualquier
estado existente respetando el guard de entrega completada para CERRADO.

## Reglas e invariantes

- Expandir BuyerLeadStatus con un valor, sin modificar filas existentes ni defaults.
- Mantener roles ADMIN/AGENTE y la auditoría CAMBIO_ESTADO actual.
- No cambiar temperatura, responsable ni próxima acción al elegir NO_CONTESTA.
- Incluir el estado en pipeline y todas las queries de compradores activos.
- No contarlo como contacto efectivo, cualificación o venta. Engagement igual a NUEVO.
- Usar catálogos compartidos para opciones/validación y estados activos.
- Mantener atribución, Activities, filtros de origen y estados de vendedores/vehículos.
- Regenerar Prisma, migración nueva y actualizar las aserciones de replay CI.

## Fuera de alcance

Automatizaciones de contacto, backfill, nuevo estado de vendedores y edición de
compradores de producción durante pruebas. La publicación y migración aditiva se autorizaron explícitamente;
los tests PostgreSQL usan exclusivamente entornos efímeros de CI.

## Decisiones

| Decisión     | Alternativas                            | Resolución y motivo                                                                     |
| ------------ | --------------------------------------- | --------------------------------------------------------------------------------------- |
| Persistencia | Texto en notas / enum                   | Enum existente, visible y filtrable                                                     |
| Semántica    | Perdido / Contactado / activo pendiente | Activo en etapa Lead: intentar contactar no implica respuesta                           |
| Rollout      | Código primero / DB primero             | Migración expandida primero, después cliente actualizado; no habilitar escrituras antes |

## Plan técnico

1. Migración aditiva offline y schema; generar cliente local sin conectar a DB.
2. Etiquetas/colores/transiciones, filtros, validador, siguiente acción sugerida y engagement.
3. Compartir estados activos en pipeline y KPIs; funnel Lead incluye NO_CONTESTA,
   funnel Contactado no lo incluye. Seed conserva NUEVO y no necesita cambios.
4. Unitarios de transición, boundary, stage-map, matching y queries; tests de persistencia
   y catálogo preparados para PostgreSQL; UI aislada; tipos/lint/test/compilación/checks.

### Impacto

- **Datos:** un valor enum añadido; tablas, columnas, índices, FKs y RLS sin cambios.
- **Permisos:** sin cambio.
- **Concurrencia:** COM-5 conserva CAS de status y Activity atómica; no writers nuevos.
- **Efectos:** recálculo matching/revalidación existentes en cambio de estado.
- **KPIs:** NO_CONTESTA permanece activo y en Lead; no eleva contactos efectivos.
- **Compatibilidad:** DB expandida con filas antiguas sigue compatible. Un cliente anterior
  no debe leer filas NO_CONTESTA; sólo permitir nuevos valores cuando todos los lectores
  estén actualizados. Guard de migraciones bloquea producción si falta la expansión.

## Criterios de aceptación

- [x] Seleccionar y corregir No contesta desde ficha/lista, con traza y campos conservados (unitarios, UI aislada e integración PostgreSQL de CI).
- [x] Filtrar No contesta y mantenerlo en pipeline/compradores activos (UI, catálogo compartido y query inspeccionada).
- [x] Mantener elegibilidad matching; no elevar funnel a Contactado (unitarios).
- [x] Migración aditiva generada/verificada offline; cliente y checks coherentes.
- [x] Replay PostgreSQL, parity, RLS, idempotencia y persistencia real comprobados (CI).

## Verificación local inicial

Los resultados iniciales se conservan como historial; la integración pendiente se
resolvió en CI y la migración se aplicó según la sección Cierre.

| Evidencia                              | Resultado                                                                                                                                                                                                                                     |
| -------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Unitarios/acciones/queries             | `pnpm test`: 138 archivos / 1.798 tests superados; transición, edición de ficha, matching y funnel incluidos                                                                                                                                  |
| UI con servidor simulado               | Harnesses COM-5/COM-6: cabecera y lista, siete opciones, NO_CONTESTA en escritorio/móvil, corrección a Contactado y filtro status=NO_CONTESTA superados; capturas inspeccionadas                                                              |
| Schema/cliente/diff SQL/historial      | prisma validate/generate superados. migrate diff offline entre baseline y schema nuevo genera exclusivamente ALTER TYPE ADD VALUE NO_CONTESTA; SQL preparado en 20261014160000_add_buyer_no_contesta_status; check:migration-history superado |
| PostgreSQL real/replay/parity/RLS      | Test integración buyer-status abortado por guard antes de conexión: TEST_DATABASE_URL ausente. Replay, parity, RLS, persistencia y segundo deploy quedan pendientes; no se ejecutó DDL local/remoto                                           |
| Tipos/lint/tests/compilación/check:sdd | Superados. Compilación Next en modo compile con DB local ficticia y Sentry sin token; sin generación de páginas ni guard remoto. Avisos existentes de Sentry/Prisma                                                                           |

## Rollout, rollback y stop conditions

- **Rollout:** checks PostgreSQL efímero verdes, migración en staging y producción
  con preflight, cliente actualizado y comprobación del listado/filtro autenticado;
  véase Cierre para evidencia y límites.
- **Rollback:** conservar enum expandido. Antes de volver a un cliente antiguo,
  comprobar que no hay filas NO_CONTESTA; si existen, detener rollback hasta plan
  explícito autorizado de reconciliación o conservar un cliente compatible. No borrar enum.
- **Detener si:** despliegue sin migración, lectores antiguos con filas nuevas,
  efectos en datos ajenos o intento de tests contra base remota.
- **Post-deploy:** lead de prueba autorizado, cambio y corrección desde ficha/lista,
  filtro, Activity y recuentos; observar errores de enum/guardado y discrepancias de KPIs.

## Revisión adversarial

| Riesgo                                     | Mitigación o límite                                       |
| ------------------------------------------ | --------------------------------------------------------- |
| Cliente enum desactualizado                | DB primero y regeneración; rollback sujeto a filas nuevas |
| Desaparece de pipeline/KPIs                | Catálogo compartido de estados activos                    |
| Cuenta como contacto conseguido            | Stage-map y funnel excluyen de Contactado                 |
| Cambio eleva venta o modifica preferencias | Misma acción exclusiva status y gate de entrega           |
| Replay CI desfasado                        | Conteo/lista de migraciones y enum_values actualizados    |

## Cierre

El usuario autorizó explícitamente el 2026-10-14 publicar todos los controles y
NO_CONTESTA, aplicar su migración en producción y subir/abrir/fusionar la PR tras
pasar las comprobaciones pendientes. Se mantiene el preflight de identidad e historial
antes de cualquier escritura remota. Esta autorización amplía el alcance local inicial.

La PR #199 supera CI en el commit final 278c372: quality, integración PostgreSQL,
migration-replay con parity/RLS/idempotencia, Supabase local y Preview Vercel.
Vercel no exporta las variables sensibles al operador local; se añade un comando
explícito `scripts/deploy-buyer-status-migration.ts` que reutiliza sus credenciales
dentro del build. Predeterminado sólo lectura, identidad comprobada, sólo una
migración pendiente permitida, schema antes/después y errores sanitizados. Sus
guards puros tienen tests. Despliegues de operador con `--skip-domain` mantienen
el panel publicado hasta la verificación y promoción del código final.

- **Entrega:** PR #199 fusionada el 2026-10-14, main
  `df5fc05a04c693ff75342757f8312fcdf78f2410`, mismo árbol de código que 278c372.
- **CI:** [run 38586793511](https://github.com/growthaiconsultant-lab/campernova-crm/actions/runs/38586793511)
  y [run de main 38589249944](https://github.com/growthaiconsultant-lab/campernova-crm/actions/runs/38589249944)
  superados. 1.810 unitarios, 430 tests de integración PostgreSQL, 19 Supabase;
  replay completo, parity, RLS y segundo deploy idempotente verdes.
- **Migración:** `20261014160000_add_buyer_no_contesta_status` aplicada y verificada
  en staging el 2026-10-14 a las 15:16 UTC (deployment `dpl_7CTpa1SYeaETZD2nqqAz5jioGkbi`)
  y producción a las 15:23 UTC (deployment `dpl_GPpjW4azZBjFULRoxokBfU7HPREZ`).
  Identidad e historial/checksums correctos; siete valores enum comprobados después
  y sin DML de compradores. Credenciales permanecieron dentro de Vercel.
- **Producción:** deployment `dpl_DwoGUVKUnuVns3U6v6QJCuLDkoRK` READY y asociado
  al commit de main por el check Vercel; <https://campersnova.com/compradores>.
- **Smoke autenticado:** No contesta aparece en los siete estados del selector de
  fila; filtro status=NO_CONTESTA devuelve resultado sin error. Controles de lista
  y diálogo de próxima acción comprobados, sin errores de consola.
- **Límite:** no se hicieron escrituras de compradores durante el smoke de producción.
  Persistencia comprobada en CI y móvil/ficha en UI aislada; sin ventana prolongada
  de observación. Estado DEPLOYED, no VALIDATED.
