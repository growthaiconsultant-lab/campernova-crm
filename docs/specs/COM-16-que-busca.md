# COM-16 — Qué vehículo busca el comprador

| Campo      | Valor                                             |
| ---------- | ------------------------------------------------- |
| **Estado** | IMPLEMENTED                                       |
| Owner      | Equipo CRM                                        |
| Ticket     | Propuesta «Qué busca» aprobada por el propietario |
| Rama       | codex/que-busca-comprador                         |
| Ruta SDD   | Estándar                                          |

## Problema

La ficha repite criterios y obliga a abrir editores para consultar características detalladas.

## Resultado esperado

El equipo puede leer tipo de vehículo, presupuesto máximo, plazas mínimas para viajar y plazas mínimas para dormir en una sola tarjeta. La búsqueda distingue requisitos, preferencias y datos por confirmar.

## Plan y decisiones

Usar los datos actuales de la ficha y del catálogo, respetando las prioridades de sus criterios. Conservar las condiciones de compra, el vehículo de parte de pago, la solicitud recibida y los editores. Una medida de aparcamiento registrada permite preguntar por la otra; el garaje del propio vehículo es una característica diferente.

## Criterios de aceptación

- Los valores desconocidos se ven como pendientes y no se interpretan como límites.
- Los datos detallados conservan su prioridad y los valores múltiples.
- Tras guardar una medida, el resumen refleja la medida y retira la pregunta correspondiente.
- Conservar autoguardado, acceso directo a edición, formulario original y navegación en móvil.

## Verificación

Pruebas locales con fichas parciales y completas, prioridades del catálogo, plazas distintas, edición de medidas y solicitud original. Revisión de los desplegables a 320, 390 y 1280 px con datos ficticios.

## Rollout y recuperación

Entrega local para revisión. La interfaz se puede revertir sin migraciones ni cambios en los registros del equipo.
