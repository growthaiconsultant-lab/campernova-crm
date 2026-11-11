# COM-26 — Comparar la oferta con el mínimo del vendedor

| Campo      | Valor                                  |
| ---------- | -------------------------------------- |
| **Estado** | IMPLEMENTED                            |
| Owner      | Equipo CRM                             |
| Ruta       | Reforzada por presentación de importes |
| Rama       | codex/tasacion-economia-vendedor       |

## Problema

La oferta, el mínimo del vendedor y el precio anunciado se consultaban en apartados distintos durante la llamada.

## Resultado esperado

En Venta, reunir la operación vigente, el mínimo indicado por el vendedor y el precio del vehículo. Cuando una propuesta queda corta, mostrar la diferencia exacta y un texto que ayude a consultarla con el vendedor. La maqueta se aprobó con el ejemplo de 63.500 € frente a 65.000 €.

## Criterios de aceptación

- Reutilizar la agrupación de ofertas del CRM, dar prioridad a la reserva y enlazar la operación seleccionada. Las operaciones cerradas quedan en el historial.
- Comparar en céntimos con el mínimo de la ficha del vendedor. Un mínimo ausente, la tasación y el precio deseado tienen significados distintos. Una reserva u oferta ya aceptada conserva su estado y su tratamiento.
- Mostrar la tasación oficial después de la comparación. Conservar tasación manual/automática, valoración preliminar, historial e intentos. Mostrar el requisito pendiente si la tasación está bloqueada.
- Mantener el resumen de margen, costes, edición de precios y ubicación bajo el permiso de administración. Preservar el acceso directo a precios.
- Verificar los límites de la comparación y ambas vistas desde la ficha. La consulta al vendedor es un texto de apoyo y carece de efectos externos.

## Verificación

Pasaron 2.013 pruebas unitarias, incluidas las 24 de la ruta del vendedor, la comprobación de tipos y el lint. En Chrome local, a 375 y 1.280 píxeles, se abrieron la consulta y el rango de tasación para ambos perfiles. El desglose de costes sólo apareció en administración. Se usaron registros ficticios y el HTML de la ruta real.

## Rollout y recuperación

Cambio de presentación sobre datos existentes. Validación local y publicación del CRM en pasos separados. Ante una cifra errónea o exposición de información interna, detener la publicación. La versión previa de la ficha puede restablecerse sin intervención en la base de datos.
