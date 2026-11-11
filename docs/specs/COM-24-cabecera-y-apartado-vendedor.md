# COM-24 — Navegar entre Vendedores, el titular y su vehículo

| Campo      | Valor                             |
| ---------- | --------------------------------- |
| **Estado** | IMPLEMENTED                       |
| Owner      | Equipo CRM                        |
| Rama       | codex/cabecera-seccion-vendedores |

## Problema

La barra compacta sólo se activaba en las fichas de compradores. El listado de vendedores mantenía la cabecera antigua y los datos y documentos propios del vendedor quedaban dentro del expediente del vehículo.

## Resultado esperado

Una única cabecera de ficha, acceso a Vendedores con sus filtros, búsqueda global y alta. El listado identifica el estado del vehículo, el del contacto y su siguiente acción. Los vendedores admitidos disponen de la pestaña Vendedor, con contacto, edición y documentos vinculados al titular.

## Criterios de aceptación

Verificar el recorrido listado filtrado → ficha → listado, el acceso por enlace directo, la navegación en móvil, las acciones de contacto y gestión, y el acceso a la documentación de vendedor y vehículo en sus destinos originales. Mantener el circuito de admisión y los controles por rol.

## Verificación

Pasaron 2004 pruebas unitarias, seis de integración en PostgreSQL local y 16 pruebas de navegador en escritorio y móvil. Se comprobó el regreso a la vista y página filtradas, el acceso a los archivos del vendedor, los avisos de preparación y la coherencia de la próxima acción entre listado y ficha.

## Rollout y recuperación

Aplicación local para revisión. Reversión de la navegación y de la presentación. Los archivos y las acciones se consultan desde sus relaciones actuales.
