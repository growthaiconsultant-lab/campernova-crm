# COM-23 — Ver qué falta para publicar el vehículo del vendedor

| Campo      | Valor                              |
| ---------- | ---------------------------------- |
| **Estado** | IMPLEMENTED                        |
| Owner      | Equipo CRM                         |
| Rama       | codex/vehiculo-documentos-vendedor |

## Problema

El equipo tiene que abrir el expediente legal para averiguar qué impide publicar. El porcentaje de documentación no refleja todas las condiciones de publicación.

## Resultado esperado

Abrir Vehículo y documentos con los pendientes de publicación y un acceso directo para resolver cada uno. Debajo aparecen los documentos recibidos, las comprobaciones y la galería. Los avisos de ITV siguen visibles aunque el expediente esté listo.

## Criterios de aceptación

- Calcular pendientes con las reglas de publicación del CRM. Distinguir errores y avisos y respetar el estado del vehículo y los permisos de edición.
- Usar la categoría documental correcta y la galería existente. Mantener los archivos, fotos, orden, acceso privado y operaciones disponibles.
- Conservar la entrada, los documentos del vendedor y del vehículo, el pasaporte, el taller y la publicación normal y excepcional.

## Verificación

Pasaron 1999 pruebas unitarias y 22 de integración con PostgreSQL local sobre documentos privados, versiones y retirada de publicación. Dos pruebas de navegador con archivos de ejemplo en Chrome y WebKit móvil comprobaron la selección del permiso en su categoría, la incorporación de una foto, la conservación del material anterior y el paso a «Listo para publicar» con un aviso de ITV. Las pruebas de la ficha cubren también el taller pendiente, la ITV vencida, los vendedores archivados y los vehículos ya publicados.

## Rollout y recuperación

Entrega local para revisión. Revertir los cambios de presentación si algún pendiente o archivo pierde su acceso. El cambio no exige migración.
