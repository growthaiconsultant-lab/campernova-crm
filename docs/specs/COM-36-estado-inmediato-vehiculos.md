# COM-36 — Cabecera y filtro rápido de estado en Vehículos

| Campo      | Valor                            |
| ---------- | -------------------------------- |
| **Estado** | IMPLEMENTED                      |
| Owner      | Equipo CRM                       |
| Ruta       | Estándar                         |
| Rama       | codex/estado-inmediato-vehiculos |

## Problema

Vehículos usa una barra superior distinta a Vendedores y el estado seleccionado no actualiza el inventario hasta confirmar.

## Resultado esperado

Reutilizar la cabecera compacta verde con búsqueda y creación. La selección de estado actualiza el listado inmediatamente y el resto del formulario admite combinar criterios antes de aplicarlos.

## Criterios de aceptación

- Seleccionar un estado o todos los estados actualiza la URL, los resultados y los filtros activos, vuelve a la primera página y conserva la ordenación y los criterios aplicados.
- Los criterios pendientes se mantienen editables al cambiar el estado. Aplicar filtros los valida y combina con el estado actual.
- El historial del navegador restaura los criterios aplicados.

## Verificación

Pasaron 8 pruebas de interfaz en Chrome y WebKit móvil y 8 de integración en PostgreSQL aislado. Se verificaron el estado inmediato, la conservación de los criterios aplicados y pendientes, la ordenación, la primera página y la navegación hacia atrás.

## Rollout y recuperación

Cambio local sin migración. La publicación en el CRM se tramita por separado.
