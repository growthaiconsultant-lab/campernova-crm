# COM-38 — Priorizar el trabajo del listado de Ofertas

| Campo      | Valor                              |
| ---------- | ---------------------------------- |
| **Estado** | IMPLEMENTED                        |
| Owner      | Equipo CRM                         |
| Ruta       | Estándar, presentación             |
| Rama       | codex/ofertas-pendientes-historial |

## Problema

Las reservas aparecen tanto en ofertas activas como en reservas. El acceso genérico abre la ficha del comprador y obliga a buscar la operación.

## Resultado esperado

Un listado por prioridad que permita pasar del siguiente paso a la oferta concreta.

## Criterios de aceptación

- Abrir Pendientes por defecto. Mostrar cada operación en un único grupo. Mantener todos los estados terminales en Historial.
- Priorizar las reservas vencidas y las de hoy por fecha local de Madrid. Conservar reservas sin plazo, ofertas aceptadas sin señal y registros históricos con señal o plazo.
- Destacar la acción según el estado y enlazar directamente a la operación en la ficha. Conservar céntimos, fechas, acceso por agente e indicadores comerciales.

## Verificación

Pasaron diez recorridos en Chrome de escritorio y WebKit móvil sobre el listado y la ficha. Incluyen las dos vistas, el enlace exacto de cada fila, los estados vacíos y el cambio de día en Madrid. En PostgreSQL local pasaron 41 pruebas del listado, creación, reservas y transiciones. Se compararon los registros antes y después de consultar ambas vistas, incluidos céntimos, señales de cero, plazos y estados de operaciones cerradas.

## Rollout y recuperación

La publicación en el CRM del equipo está autorizada. Tras el despliegue, comprobar ambas vistas en producción. La consulta es de lectura. La recuperación consiste en revertir la interfaz y no requiere migraciones.
