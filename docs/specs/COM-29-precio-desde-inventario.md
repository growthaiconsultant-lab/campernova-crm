# COM-29 — Completar precios de venta desde el inventario

| Campo      | Valor                                            |
| ---------- | ------------------------------------------------ |
| **Estado** | IMPLEMENTED                                      |
| Owner      | Equipo CRM                                       |
| Ruta       | Reforzada por escritura de precio y autorización |
| Rama       | codex/precio-desde-inventario                    |

## Problema

El equipo debe abrir cada ficha para identificar y completar los precios de venta pendientes. El rótulo Estado no distingue el estado del vehículo del estado de su vendedor.

## Resultado esperado

Filtrar por presencia de precio y asignar el primer importe desde la tarjeta como administrador. La consulta usa el precio de venta del vehículo. Las tarjetas siguen mostrando fotos, referencias y el enlace a la ficha.

## Criterios de aceptación

- Todos, con precio y sin precio combinan con los filtros de Vehículos. Un cero registrado cuenta como precio existente. Elegir sin precio vacía y desactiva el máximo.
- El filtro de estado se llama Estado del vehículo.
- Solo administración puede asignar un importe positivo de hasta dos decimales a un vehículo admitido sin precio. Guardar actualiza los resultados y deja una actividad del vendedor. Un reintento o dos editores simultáneos deben producir una sola asignación.
- Validar los dos perfiles, el guardado, la cancelación, los errores y el cambio del listado en móvil y escritorio.

## Verificación

Pasaron 2.017 pruebas unitarias y siete de integración del inventario en PostgreSQL local. Se comprobaron el permiso, el precio nulo frente a cero, los importes con céntimos, la exclusión de solicitudes pendientes, la conservación de las referencias y la actividad única tras dos escrituras simultáneas y un reintento. Pasaron cuatro pruebas de navegador en Chrome y WebKit móvil, además de tipos, lint y compilación optimizada.

## Rollout y recuperación

Cambios de interfaz y operación sobre el campo existente. Validación local antes de publicar. Si hay discrepancias en permisos o importes, detener el despliegue. Los precios introducidos siguen disponibles en la ficha al volver a la versión anterior.
