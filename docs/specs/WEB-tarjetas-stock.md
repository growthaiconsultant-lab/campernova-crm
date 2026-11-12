# WEB — Tarjetas del stock público

| Campo        | Valor       |
| ------------ | ----------- |
| **Estado**   | IMPLEMENTED |
| **Ruta SDD** | Estándar    |

## Problema

En Inicio el nombre completo ocultaba el modelo y el acceso a la ficha era poco visible. El Catálogo empleaba otra tarjeta.

## Resultado esperado

Inicio y Catálogo comparten la tarjeta aprobada, con foto, tipo y base, modelo, características disponibles, precio al contado y cuota del CRM. El visitante puede abrir la ficha o preguntar por ese vehículo en WhatsApp.

## Criterios de aceptación

- Una columna en móvil y tres en escritorio. El título se adapta a nombres largos.
- Los vehículos de archivo y los reservados mantienen sus estados y destinos.
- Un precio o una cuota sin informar se pueden consultar sin mostrar importes inventados.
- La web omite longitudes registradas con un error evidente de unidad, como 599 metros.
- El diálogo de financiación conserva el vehículo, la entrada y el plazo opcionales.

## Rollout

Publicar la versión aprobada y comprobar ambas rejillas con el inventario publicado. Revertir la presentación si fallan los enlaces o difieren los importes.
