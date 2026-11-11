# COM-27 — Preparar y confirmar los anuncios de un vehículo

| Campo      | Valor                               |
| ---------- | ----------------------------------- |
| **Estado** | IMPLEMENTED                         |
| Owner      | Equipo CRM                          |
| Ruta       | Estándar                            |
| Rama       | codex/publicacion-anuncios-vendedor |

## Problema

La ficha presenta el registro de publicaciones y las herramientas de texto en bloques distintos. El agente debe buscar dos veces el mismo portal para completar un anuncio.

## Resultado esperado

Una fila por canal reúne el estado, el texto y la acción disponible. Las fotos se descargan desde un único bloque común.

## Criterios de aceptación

- Mostrar el catálogo de CampersNova, Wallapop y Coches.net con el contador de publicaciones confirmadas. Un anuncio retirado o un texto preparado queda fuera del contador.
- Preparar, editar, copiar y generar textos desde la fila de su portal. El registro del enlace y la fecha es independiente del borrador. Mantener las reglas de autoría al editar y proteger los cambios concurrentes.
- Reutilizar el ZIP de fotos, las notas comunes, el registro de anuncios, el historial guardado y la retirada del catálogo. Conservar el resumen de Venta y los accesos existentes.

## Verificación

Pasaron 2.014 pruebas unitarias, incluidas las 25 de la ruta del vendedor. En PostgreSQL 17 local se verificaron las escrituras simultáneas, los reintentos, la autoría y la independencia de borradores y publicaciones. Los dos flujos de navegador pasaron en Chrome y WebKit móvil en dos ejecuciones consecutivas. Compilación optimizada, tipos y lint correctos. El escenario de ejemplo emplea datos ficticios.

## Rollout y recuperación

Validación local previa a la publicación del CRM. Se reutilizan las tablas actuales de textos y publicaciones. Se puede revertir la interfaz conservando los borradores. Detener el despliegue si guardar texto cambia el estado de publicación.
