# COM-3 — Mantener visible la compra y el comprador final en ambas fichas

| Campo               | Valor                                                         |
| ------------------- | ------------------------------------------------------------- |
| **Estado**          | IMPLEMENTED                                                   |
| **Owner**           | Engineering / Joel                                            |
| **Ticket**          | COM-3 — petición directa «si es lo más profesional, adelante» |
| **Rama / PR**       | codex/completed-sale-links / pendiente                        |
| **Categorías**      | C0, C1, C3                                                    |
| **Riesgo**          | Medio; lectura interna de relaciones de venta, sin escrituras |
| **Ruta SDD**        | Reforzada por relaciones comerciales y datos de contacto      |
| **Última revisión** | 2026-10-07                                                    |

## Problema y evidencia

VERIFICADO EN CÓDIGO en main e332501: compradores/[id]/page.tsx muestra la última entrega de cualquier estado/tipo como Operación. vendedores/[id]/page.tsx obtiene closedMatch desde visibleMatches, que excluye vehículos VENDIDO y compradores CERRADO. Por eso el comprador final desaparece al cerrar. Delivery ya vincula vehículo y comprador; Vehicle vincula vendedor. Los dos writers de compleción registran la venta en transacción; no es necesario escribir ninguna relación nueva.

VERIFICADO EN ENTORNO: e332501 desplegado en campersnova.com en el cambio COM-2, PR #188. Ninguna consulta remota de datos ni migración prevista en este cambio.

DECISIÓN DOCUMENTADA: el usuario aprueba la propuesta de mostrar Vehículo comprado y Comprador final desde entregas VENTA/COMPLETADA. Fuente canónica: Delivery tipada, no texto de Activity ni matching. Las reglas actuales de venta/garantía permanecen.

## Resultado esperado

Al abrir una ficha, el equipo ve el vehículo comprado o el comprador final, matrícula, fecha de compleción y enlaces a la contraparte y a la entrega. Sigue visible aunque las fichas estén cerradas o archivadas. Una entrega pendiente, cancelada o de otro tipo nunca se presenta como compra.

## Reglas e invariantes

- Sólo Delivery.kind=VENTA y status=COMPLETADA, con comprador identificado.
- No depender de matching, oferta ni garantía para leer la venta; cubrir entregas manuales sin oferta.
- Conservar ventas históricas aunque falte fecha/matrícula; mostrar ausencia explícita, sin inventar datos.
- Query dentro de la relación del comprador o vehículo consultado; nunca unir por nombre/teléfono.
- Auth requireAgente antes de consultar; mismos roles ADMIN/AGENTE y rutas internas.
- No mutaciones, estados nuevos, backfill, cambios de dinero, garantía, permisos o matching.

## Fuera de alcance

Asociar manualmente ventas históricas, registrar una venta, editar/cancelar entregas, múltiples vehículos por vendedor, precio histórico y ampliación de roles. Ventas antiguas sin entrega canónica no se reconstruyen.

## Decisiones

Bloque visible en el lateral común a todas las pestañas, con estado vacío. Comprador puede listar todas sus compras registradas; vendedor consulta ventas de su vehículo. Orden por fecha de compleción descendente (null al final), creación e ID para estabilidad. Sin precio final: el salePrice mutable del vehículo no constituye un importe histórico de la transacción.

## Plan técnico

1. Selección Prisma compartida de ventas completadas en lib/completed-sales.ts.
2. Componente de resumen reutilizado por ambas fichas; reemplazar Operación y closedMatch, conservar matching comercial.
3. Mover auth antes de las lecturas de ambas páginas. Consultas anidadas sin N+1; índices actuales buyerLeadId/vehicleId.
4. Integración PostgreSQL real: venta manual sin match/oferta, comprador cerrado, vehículo vendido, entidades archivadas, tipos/estados excluidos, aislamiento entre fichas y campos incompletos. Tests de render para enlaces y estado vacío.
5. Typecheck/lint/SDD, revisión visual con datos sintéticos, CI/Preview y smoke interno sólo lectura al publicar.

### Impacto y plan transversal (A–U)

- **Actores/permisos:** equipo ADMIN/AGENTE, requireAgente existente; ninguna superficie pública. Error de auth aborta antes de queries.
- **Datos/migraciones/histórico:** selección de relaciones existentes; sin schema, DML ni backfill. Nombres/matrícula sólo UI interna, sin logs ni analítica. Datos incompletos muestran fallback.
- **Estados/concurrencia/idempotencia:** no writer modificado; lectura tras commit de la transacción de compleción. Cache/revalidate actuales de entregas ya invalidan ambas fichas; no nuevos efectos ni side effects.
- **Integraciones/Storage/contratos:** N/A, no se modifican.
- **KPIs/Sentry/PostHog/flags:** sin eventos nuevos ni tracking. Señal de éxito: bloque con enlaces correctos para venta cerrada; señal de fallo: ausencia/error o entrega no venta mostrada como compra.
- **Performance:** consultas anidadas y campos mínimos, índices FK existentes; sin carga de documentos/contacto completo. Lista completa por comprador, volumen actual limitado por garantía única vigente.
- **Responsabilidad/recuperación:** Engineering; si hay error, el error boundary existente permite recuperar. No convertir una ausencia histórica en asociación inferida.
- **Evidencia/handoff:** spec y PR; datos sintéticos en pruebas. Verificación remota no crea ni cambia contactos/ventas.

## Criterios de aceptación

- [x] Venta completada aparece en ambas fichas sin match ni oferta, aunque cerradas/archivadas.
- [x] Programada, en curso, cancelada y tipos distintos de VENTA excluidos; aislamiento por IDs.
- [x] Vehículo, matrícula, fecha y enlaces correctos; null históricos y estado vacío claros.
- [x] Matching comercial y demás pestañas preservados; auth antes de consultas.
- [x] PostgreSQL, render, typecheck, lint y revisión visual pasan.

## Verificación

PASS local: 1622 tests unitarios / 126 archivos (incluye 6 de render y 3 de guard/wiring de páginas), 2 tests PostgreSQL 17.11 con transacciones revertidas, tsc --noEmit, ESLint de archivos afectados, check-sdd (17 briefs) y diff --check. Chrome con componente real y estilos del CRM sobre datos ficticios: escritorio, móvil 390 px y estados vacíos. Compras sin matching/oferta, archivados/cerrados, aislamiento, ordenación y fechas/matrícula null cubiertos. No E2E autenticado ni escritura remota. CI/Preview y producción se registrarán en la PR.

## Rollout, rollback y stop conditions

- **Autorización:** implementación aprobada con «adelante», continuación del trabajo del CRM cuya publicación se ha autorizado en esta conversación; sin cambios remotos de datos.
- **Rollout:** rama corta, PR, todos los checks y Preview antes de squash, deployment main sin configuración/migración nueva.
- **Rollback:** revertir lectores/componente; ventas y garantías permanecen intactas.
- **Stop:** mezcla de ficha ajena, entregas no venta mostradas como compra, exposición pública/roles nuevos, query/test que alcanza remoto.
- **Validación:** smoke de fichas en producción sólo lectura. Si no hay ventas completadas accesibles, declarar limitada a estados vacíos y cobertura sintética/DB local; no fabricar venta de prueba.

## Revisión adversarial

Una venta manual puede no tener oferta/match: usar Delivery. Una fecha nula no elimina un hecho completado: fallback y nulls last. Archivar no elimina historial: sin filtros de elegibilidad. Una entrega nueva cancelada no tapa la compra previa: filtrar antes de ordenar. Identificadores FK y React escapan texto; no strings de Activity como fuente de verdad. No alterar permisos ni crear enlaces públicos.

## Cierre

Evidencia local completada; identificadores finales de PR, CI y deployment en la PR. Deuda explícita: registros históricos sin entrega completada no tienen asociación reconstruida.
