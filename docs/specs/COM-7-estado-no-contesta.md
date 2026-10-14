# COM-7 — Marcar compradores que no contestan

| Campo               | Valor                                                                       |
| ------------------- | --------------------------------------------------------------------------- |
| **Estado**          | IMPLEMENTED                                                                 |
| **Owner**           | Engineering                                                                 |
| **Ticket**          | Petición «hay que añadir la opción de no contesta en el estado», 2026-10-14 |
| **Rama / PR**       | codex/compradores-estado-rapido; continuación COM-5/COM-6; sin PR           |
| **Categorías**      | C0, C1, C2, C3, C4, C9                                                      |
| **Riesgo**          | Alto por expansión de enum persistido                                       |
| **Ruta SDD**        | Reforzada                                                                   |
| **Última revisión** | 2026-10-14                                                                  |

## Problema y evidencia

main/origin/main sincronizados en 2f141ec; se preservan los cambios locales COM-5/COM-6.
BuyerLeadStatus tiene seis valores y no permite identificar un intento de contacto
sin respuesta. Los estados se validan en ficha/acción rápida y se filtran mediante
catálogos de UI y listas de activos en pipeline/KPIs. La petición autoriza añadir
el estado; no autoriza aplicar una migración remota ni publicar código.

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

Automatizaciones de contacto, backfill, nuevo estado de vendedores, migraciones
remotas, commit/PR/deploy y datos de producción. No hay PostgreSQL efímero configurado.

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

- [x] Seleccionar y corregir No contesta desde ficha/lista, con traza y campos conservados (unitarios/UI simulada; DB real pendiente).
- [x] Filtrar No contesta y mantenerlo en pipeline/compradores activos (UI, catálogo compartido y query inspeccionada).
- [x] Mantener elegibilidad matching; no elevar funnel a Contactado (unitarios).
- [x] Migración aditiva generada/verificada offline; cliente y checks coherentes.
- [ ] Replay PostgreSQL, parity, RLS, idempotencia y persistencia real comprobados.

## Verificación

| Evidencia                              | Resultado                                                                                                                                                                                                                                     |
| -------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Unitarios/acciones/queries             | `pnpm test`: 138 archivos / 1.798 tests superados; transición, edición de ficha, matching y funnel incluidos                                                                                                                                  |
| UI con servidor simulado               | Harnesses COM-5/COM-6: cabecera y lista, siete opciones, NO_CONTESTA en escritorio/móvil, corrección a Contactado y filtro status=NO_CONTESTA superados; capturas inspeccionadas                                                              |
| Schema/cliente/diff SQL/historial      | prisma validate/generate superados. migrate diff offline entre baseline y schema nuevo genera exclusivamente ALTER TYPE ADD VALUE NO_CONTESTA; SQL preparado en 20261014160000_add_buyer_no_contesta_status; check:migration-history superado |
| PostgreSQL real/replay/parity/RLS      | Test integración buyer-status abortado por guard antes de conexión: TEST_DATABASE_URL ausente. Replay, parity, RLS, persistencia y segundo deploy quedan pendientes; no se ejecutó DDL local/remoto                                           |
| Tipos/lint/tests/compilación/check:sdd | Superados. Compilación Next en modo compile con DB local ficticia y Sentry sin token; sin generación de páginas ni guard remoto. Avisos existentes de Sentry/Prisma                                                                           |

## Rollout, rollback y stop conditions

- **Rollout:** sólo preparación local. Con autorización posterior: PostgreSQL efímero,
  replay completo/segundo deploy/parity/RLS; staging migración y smoke; producción
  migración, guard de checksums, cliente actualizado y smoke ficha/lista/filtros.
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

La PR #199 supera CI en el commit 4e9aff3: quality, integración PostgreSQL,
migration-replay con parity/RLS/idempotencia, Supabase local y Preview Vercel.
Vercel no exporta las variables sensibles al operador local; se añade un comando
explícito `scripts/deploy-buyer-status-migration.ts` que reutiliza sus credenciales
dentro del build. Predeterminado sólo lectura, identidad comprobada, sólo una
migración pendiente permitida, schema antes/después y errores sanitizados. Sus
guards puros tienen tests. Despliegues de operador con `--skip-domain` mantienen
el panel publicado hasta la verificación y promoción del código final.

- **Commit/PR/CI/deployment/migración remota:** pendientes de ejecución, autorizados.
- **Validación:** implementación local verificada con unitarios, UI simulada, tipos,
  lint, generación/validación Prisma, historial y compilación. No equivale a validación
  PostgreSQL, CI ni despliegue. Se preservan los cambios locales de COM-5/COM-6.
- **Deuda:** ejecución real de integración/replay y flujo autenticado antes de publicar.
