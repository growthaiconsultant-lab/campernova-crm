# OPS-2 — Preparar lectores seguros para entregas manuales (OPS-1A)

| Campo               | Valor                                                           |
| ------------------- | --------------------------------------------------------------- |
| **Estado**          | APPROVED                                                        |
| **Owner**           | Engineering                                                     |
| **Ticket**          | OPS-2, incremento de compatibilidad de OPS-1; sin ticket remoto |
| **Rama / PR**       | codex/ops-1-taller-documentos-entregas; sin PR                  |
| **Categorías**      | C0, C1, C2, C3, C4, C6                                          |
| **Riesgo**          | Alto                                                            |
| **Ruta SDD**        | Reforzada                                                       |
| **Última revisión** | 2026-09-29                                                      |

## Problema y evidencia — A / B

> **Nota de evolución (2026-09-29):** la rama compartida avanzó después a la implementación local
> funcional de [OPS-1 §U](OPS-1-taller-documentos-entregas-manuales.md#cierre-y-estado-de-autorización--u),
> tras la excepción documental explícita. Las cifras y la afirmación «writers deshabilitados» de
> este documento describen sólo el incremento puente anterior, no el diff actual completo. No se
> ha publicado ninguno. El puente aquí descrito no cubre documentos ligados a comprador/vendedor
> y no es rollback suficiente tras activar esos escritores. No presentar toda la rama como OPS-2.

La solución funcional está en [OPS-1](OPS-1-taller-documentos-entregas-manuales.md). El usuario
autorizó continuar localmente tras conocer que faltaba implementar y resolver el gate documental.
Se separa este incremento **no documental** para avanzar sin eludir la congelación de esas tablas.

VERIFICADO EN CÓDIGO: `72dbc47` exige buyerLead/offer no nulos y completa cualquier entrega mediante
venta/garantía. Si se habilitan primero writers manuales, lectores antiguos fallan o aplican efectos
comerciales a una salida de taller. Las referencias exactas están en OPS-1 §B/J.

## Resultado esperado — C / D

Preparar y verificar una versión puente que pueda **leer** VENTA, DEVOLUCION_VENDEDOR y ENTREGA_TALLER,
incluyendo registros sin comprador/oferta. No activa la creación manual, no amplía permisos TALLER,
no elimina todavía requisitos del writer legacy y no modifica tablas ni políticas documentales.
El usuario todavía no dispone de la funcionalidad final al terminar este incremento.

## Reglas, decisiones y flujo — E / F / G

- Histórico con tipo VENTA por default; no modificar sus destinatarios/estado/importe/garantías.
- Oferta nullable. VENTA requiere comprador; DEVOLUCION_VENDEDOR requiere vendedor; ENTREGA_TALLER
  requiere exactamente un comprador o vendedor. Oferta sólo en VENTA. CHECK y FKs lo hacen cumplir.
- Un vendedor receptor se conserva por FK, no se deriva del propietario actual del vehículo.
- Los readers muestran tipo y destinatario. Las filas manuales están en modo lectura en este puente.
- Los writers legacy rechazan explícitamente la gestión manual con error de dominio, sin efectos.
- Garantía exige VENTA + comprador + completedAt incluso si se llama el helper directamente.
- Los gates de cierre de comprador/match sólo reconocen entregas VENTA; el match exige el mismo par.
- La creación de tipos nuevos será otro incremento, después de validar este puente. Nunca fabricar ofertas.

### H. Permisos

Sin ampliación de roles en OPS-2. Guards previos y privacidad permanecen; no confundir lectura
compatible con permiso nuevo. No se toca requireAgente ni sidebar. Las pruebas TALLER finales
pertenecen a la activación posterior de OPS-1.

## Plan técnico — I / J / K / L

**Datos:** `20260929120000_expand_typed_manual_deliveries` añade enum DeliveryKind (3 valores),
kind default VENTA y recipient_seller_lead_id nullable con FK/índice. Hace nullable offer_id y
buyer_lead_id. Añade CHECK tipo/receptor. Ninguna tabla nueva ni cambio RLS; no DML de clientes.

**Consumidores revisados:** listado/detalle/acciones de entregas, creación/transición/compleción y
checklist/firma, garantía, cron de postventa (lee Warranty: permanece con comprador obligatorio),
calendario, gates de match/comprador, KPIs operativos, archivo de leads. El escritor de creación
actual sigue exigiendo oferta y comprador; la activación futura ajustará sus queries y límites.
El guard antiguo de oferta NOT NULL conserva su propósito histórico, NO sirve como postflight OPS-2.

**Concurrencia:** conservar locks, CAS y parcial deliveries_active_vehicle_key. El puente no escribe
filas manuales ni genera efectos nuevos; no necesita una clave nueva de idempotencia. Esa clave sigue
siendo requisito del writer futuro en OPS-1. Las pruebas actuales de carreras no se retiran.

**Efectos:** no cambia venta, correos ni garantía para entregas legacy. Nuevos tipos no producen venta.
Lectores de agenda/listado identifican tipos; no derivar métricas de venta contando toda entrega.

### M. UX

Nombre del destinatario nullable sin excepción; etiqueta explícita por tipo. Modo lectura avisa que
la gestión manual todavía no está activada. No muestra botones que vayan a registrar una venta
involuntaria. Mantiene navegación al destinatario real, no a `/compradores/null`.

### N. Tests

- Unitarios: etiqueta/destinatario nullable, calendario, rechazo de compleción/transición legacy
  sobre tipos no venta, rechazo de garantía no comercial y regresión del flujo antiguo.
- PostgreSQL: tipos válidos, CHECK de destino, FK real, parcial activo entre tipos, oferta nula,
  ausencia de garantía/seguimientos. Casos escritos en `tests/integration/delivery-kind.test.ts`.
- Test físico de creación se actualiza al nuevo contrato nullable; se conservan las pruebas
  históricas SET NOT NULL aisladas en contract-migration\*. No editar migraciones antiguas.
- Replay, parity, RLS, segundo deploy y catálogo CI: +2 columnas, +1 enum/3 valores, +1 FK/índice.
- PostgreSQL 17.11 temporal local autorizado y verificado; no usar staging/producción ni simular
  estas garantías con mocks. Clientes anteriores en procesos aislados para liberar DLL en Windows.

## Rollout, rollback y stop conditions — O / P

Preparar local → tests reales/replay → autorización de publicación/CI → autorización de migración
staging → preflight → expand → desplegar puente → postflight/smoke → observación → repetir con
autorización independiente en producción. Hasta entonces ningún writer manual se activa.

El schema expandido admite al cliente anterior **mientras no existan filas manuales/nulas nuevas**.
Después de activarlas, sólo puede hacerse rollback al puente compatible, nunca al cliente viejo.
Retener este incremento como commit identificable antes de habilitar writers. No cambiar NOT NULL
de vuelta ni borrar datos para permitir un rollback. Detener por lectura fallida, drift, pérdida de
FK/CHECK/índice, efecto de venta no comercial o regresión de entregas legacy.

### Q / R / S. Observabilidad, documentación y riesgos

Errores de dominio seguros, sin PII ni URLs. No hay eventos nuevos. Verificar por entorno errores
de lectura, número de ventas/garantías y consistencia de filas tras despliegue; ventana 24h al activar.
Actualizar OPS-1 y lifecycle con estado **preparado**, no desplegado. El gate documental continúa
pendiente; este incremento no certifica backups, staging, Storage ni cierre operativo de Fase 0.
Owner Engineering. PostgreSQL/replay y compatibilidad del cliente anterior sobre datos legacy
verificados localmente. Siguen pendientes CI, Preview autenticado, revisión y autorización remota.

## Criterios de aceptación — T

- [x] Schema Prisma válido y cliente generado localmente.
- [x] Tipos TypeScript compatibles con destinatario/oferta nullable.
- [x] Tests unitarios del flujo antiguo y de discriminación sin efectos indebidos.
- [x] Integración PostgreSQL, replay/parity/catálogo y segundo deploy ejecutados localmente.
- [ ] Preview autenticado de lista/ficha/agenda y regresión legacy.
- [ ] Publicación y despliegue autorizados y trazables.

## Revisión adversarial

| Hallazgo                                       | Mitigación                                                                         |
| ---------------------------------------------- | ---------------------------------------------------------------------------------- |
| Nullable rompe lectura de ficha/email          | Guards/recipient explícito, typecheck; prueba de UI pendiente.                     |
| Taller completado cierra un match o garantía   | Filtro VENTA y par exacto; guard extra en helper de garantía.                      |
| Crear otra tabla documental para evitar freeze | Prohibido y no realizado.                                                          |
| Rollback al cliente viejo con filas manuales   | Secuencia puente primero; activación separada y rollback al puente.                |
| Ocultar fallos actualizando mocks              | Fixtures añaden campos reales; se conservan aserciones previas y añaden negativos. |

## Cierre — U. Autorización y evidencia

Permitido: implementación local de este incremento independiente, preparación de SQL y tests.
Prohibido: commit/push/PR, aplicar migraciones remotas, merge, desplegar o activar writers sin permiso.
La aprobación de preparación no es aprobación de publicación. Estado APPROVED se conserva hasta
completar la verificación exigida; no declarar IMPLEMENTED/VALIDATED sólo por tests unitarios.

- `pnpm prisma validate`, `pnpm prisma generate`, `pnpm typecheck`, `pnpm lint`: PASS local.
- `pnpm check:sdd`: 13 briefs PASS; `pnpm check:migration-history`: 15 migraciones PASS.
- `pnpm test`: 120 archivos / 1.522 tests PASS.
- `pnpm test:integration`: 34 archivos / 347 tests PASS, sin exclusiones en la ejecución final.
- `pnpm build`: PASS local con DB QA, variables Supabase ficticias locales y sin credenciales de
  servicios externos; guard remoto SKIP por Preview. Avisos Prisma 7/Sentry/Webpack no bloqueantes.
- Replay desde vacío: 15 migraciones aplicadas; segundo deploy sin pendientes; parity sin diferencias.
- RLS: 33 tablas PASS. Catálogo: 487 columnas, 58 enums/306 valores, 80 FKs, 128 índices,
  cero tablas sin RLS, cero FORCE RLS y cero policies públicas; coincide con las aserciones de CI.
- Clientes reales de `aa739cc` y `72dbc47`: conexión y CRUD legacy PASS sobre esquema expandido.
- Primera ejecución: fallos de entorno por psql fuera de PATH y DLL nativa cargada durante limpieza.
  Corrección: PATH sólo del proceso y cliente histórico aislado en proceso hijo; limpieza estricta,
  sin ignorar errores, sin omitir assertions. La repetición completa queda verde.
- CI, E2E, Supabase Storage, Preview, staging y producción: no ejecutados para OPS-2.
- Siguiente gate: revisión/publicación autorizada del puente y pruebas UI por entorno. La activación
  de entregas manuales y permisos TALLER continúa fuera de este incremento.

### Entorno QA temporal autorizado (2026-09-29)

PostgreSQL 17.11 para Windows, ZIP oficial enlazado por EDB (`fileid=1260569`), sólo datos sintéticos.
Huella SHA-256 calculada localmente (trazabilidad, no cotejada con un checksum publicado):
`B9424EE7BC60B52450FF910A3630225DF32E633F3CB29C1D126D9299D59AEA28`.
Sin servicio instalado, escucha únicamente en loopback `127.0.0.1:55439`, base `campernova_test`.
Autenticación trust exclusiva del clúster QA local; no contiene secretos ni datos remotos.
Variables de conexión sólo por proceso, guard anti-staging/producción activo. Se detiene al acabar;
binarios/clúster temporales quedan disponibles para repetir QA, sin modificar PATH global.

### Matriz de completitud

| Área                        | Revisada | Evidencia     | Pendiente                           |
| --------------------------- | -------- | ------------- | ----------------------------------- |
| Dominio / estados           | Sí       | E–G           | Activación fuera de este incremento |
| Permisos                    | Sí       | H             | No se amplían                       |
| Concurrencia / idempotencia | Sí       | K/U           | Regresión remota autorizada         |
| Datos / legacy / migración  | Sí       | I/N/U         | Preflight remoto                    |
| Compatibilidad / rollback   | Sí       | O/P/U         | Smoke UI tras rollout               |
| Readers                     | Sí       | J y typecheck | Smoke autenticado                   |
| Efectos / caché             | Sí       | L             | Regresión por entorno               |
| Observabilidad              | Sí       | Q             | Ventana futura                      |
| Rollout / documentación     | Sí       | O/R           | Autorizaciones posteriores          |

PLAN READY FOR INDEPENDENT REVIEW
