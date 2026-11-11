# COM-34 — Galería desde la cabecera y el inventario

| Campo      | Valor                              |
| ---------- | ---------------------------------- |
| **Estado** | IMPLEMENTED                        |
| Owner      | Equipo CRM                         |
| Ruta       | Estándar                           |
| Rama       | codex/galeria-vehiculos-inventario |

## Problema

La cabecera muestra iniciales, las tarjetas recortan fotos y el anuncio sólo enseña las primeras imágenes.

## Resultado esperado

Abrir las fotos desde la cabecera o la tarjeta, gestionar la portada y el orden del anuncio y reducir el espacio de información y acciones en el inventario.

## Criterios de aceptación

- Fotos completas con acceso a toda la galería y alta de la primera foto.
- Ordenar arrastrando o con controles accesibles, subir y confirmar la eliminación. Conservar categorías y permisos del CRM.
- Mostrar las fotos en orden en la web de vehículos publicados y actualizar las vistas tras editar. Conservar la decisión de publicación del vehículo.
- Mantener disponibles las acciones comerciales y los filtros.

## Verificación

En local pasaron 16 pruebas de interfaz en Chrome y WebKit móvil y 16 de integración en PostgreSQL aislado. Se comprobó la apertura, el arrastre, los controles de orden, la cancelación y confirmación del borrado, la subida y el acceso a todas las fotos en la web. Dos subidas concurrentes con una sola plaza libre conservaron la portada y respetaron el límite de 30 fotos, con almacenamiento de prueba simulado.

## Rollout y recuperación

Implementación local sin migración. Despliegue separado.
