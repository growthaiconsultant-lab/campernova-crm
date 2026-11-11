# COM-35 — Galería en el listado de vendedores

| Campo      | Valor                            |
| ---------- | -------------------------------- |
| **Estado** | IMPLEMENTED                      |
| Owner      | Equipo CRM                       |
| Ruta       | Estándar                         |
| Rama       | codex/galeria-listado-vendedores |

## Problema

Para identificar visualmente el vehículo o gestionar sus fotos desde Vendedores hay que abrir primero la ficha.

## Resultado esperado

La primera foto aparece junto al nombre en escritorio y móvil. La miniatura abre la galería compartida del vehículo y el nombre abre la ficha del vendedor.

## Criterios de aceptación

- Leer sólo la portada y el número de fotos en el listado. Cargar las demás al abrir la galería.
- Ofrecer acceso para subir la primera foto de un vehículo y omitir el botón si el vendedor carece de vehículo.
- Refrescar la portada y el contador del listado al editar fotos.

## Verificación

En local se verificaron la tabla y la tarjeta móvil con portada, sin fotos y sin vehículo. En Chrome y WebKit móvil se probó que la miniatura abre la galería, el nombre conserva su enlace y el contador refleja los cambios.

## Rollout y recuperación

Cambio de interfaz sin migración. Publicación en un paso posterior.
