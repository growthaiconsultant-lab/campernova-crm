# COM-30 — Localizar los vehículos de vendedores descartados

| Campo      | Valor                        |
| ---------- | ---------------------------- |
| **Estado** | IMPLEMENTED                  |
| Owner      | Equipo CRM                   |
| Ruta       | Estándar                     |
| Rama       | codex/descartados-inventario |

## Problema

El inventario filtraba únicamente el estado del vehículo. En producción se encontraron cinco vendedores admitidos descartados cuyos vehículos figuraban como nuevos, y el filtro de descartados del inventario devolvía cero resultados.

## Resultado esperado

Encontrar desde Vehículos tanto los vehículos descartados como los vehículos asociados a un vendedor descartado. La tarjeta identifica el descarte del contacto junto al estado operativo del vehículo.

## Criterios de aceptación

- El filtro existente y los enlaces guardados incluyen ambos orígenes de descarte. Cada vehículo aparece una vez y debe cumplir todos los demás filtros aplicados.
- Los demás estados consultan el estado operativo del vehículo. Se mantiene el ámbito de vendedores admitidos, incluidos los expedientes históricos que ya se podían consultar.
- Al corregir el estado de un vendedor, el listado refleja el cambio. Las operaciones, reservas, entregas y publicaciones siguen sus transiciones de dominio existentes.

## Verificación

Pasaron 2.017 pruebas unitarias y ocho de integración del inventario en PostgreSQL local. Se ejecutaron las acciones de descarte y reapertura, la coincidencia por ambos orígenes sin duplicados, la exclusión de solicitudes pendientes y el filtro simultáneo por precio. Se verificó en la tarjeta la etiqueta «Vendedor descartado» junto al estado operativo.

## Rollout y recuperación

Cambio de consulta y presentación. Publicación independiente de la verificación local. La reversión consiste en restaurar la versión anterior del filtro.
