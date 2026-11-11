# COM-31 — Operar un vehículo desde el inventario y consultar su disponibilidad pública

| Campo      | Valor                                                    |
| ---------- | -------------------------------------------------------- |
| **Estado** | IMPLEMENTED                                              |
| Owner      | Equipo CRM                                               |
| Ruta       | Reforzada por disponibilidad pública, reserva y descarte |
| Rama       | codex/operaciones-tarjeta-vehiculo                       |

## Problema

El equipo necesita trabajar desde la tarjeta y los compradores pierden el enlace al anuncio cuando el vehículo pasa de publicado a reservado o vendido.

## Resultado esperado

La tarjeta ofrece la acción pertinente según vehículo, expediente y operación. Una oferta aceptada reserva el vehículo. Completar la entrega registra la venta. El enlace público previamente publicado muestra su disponibilidad y dirige a alternativas en el catálogo cuando el vehículo está reservado o vendido.

## Criterios de aceptación

- Reutilizar los flujos de publicación y retirada, los requisitos del expediente y la aceptación de ofertas. Ofrecer acceso a Venta para preparar una oferta cuando falta.
- Descartar exclusivamente el vehículo con confirmación y motivo opcional. Comprobar estado, titular, ofertas y entregas activas bajo los bloqueos de las operaciones comerciales; registrar el cambio de estado en la actividad.
- Mostrar únicamente disponibles en los listados de disponibilidad. En los enlaces a fichas reservadas o vendidas exigir evidencia de publicación previa. El catálogo general muestra los reservados con publicación previa en un apartado propio. Retirada y descarte dejan el anuncio fuera de la web. Restringir la información del comprador y de la operación al CRM.
- Invalidar el inventario y el catálogo tras los cambios de disponibilidad. La venta se completa desde Entregas.

## Verificación

Verificación local con base de datos de prueba. Pasaron las 105 pruebas de integración de inventario, publicación, ofertas y entregas, y las 12 pruebas de interfaz de inventario y venta en Chrome y WebKit móvil. Se comprobó el ciclo desde publicación hasta entrega, la cancelación de la reserva, el acceso a anuncios antiguos y la concurrencia entre ofertas y descarte.

## Rollout y recuperación

Implementación local en la estructura existente, con publicación del CRM en un paso separado. La versión anterior puede leer los mismos registros. Detener el despliegue si un anuncio interno aparece en la web o si se admite descartar una operación activa.
