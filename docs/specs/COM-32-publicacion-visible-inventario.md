# COM-32 — Publicar desde una tarjeta con pendientes

| Campo      | Valor                                 |
| ---------- | ------------------------------------- |
| **Estado** | IMPLEMENTED                           |
| Owner      | Equipo CRM                            |
| Ruta       | Reforzada por publicación de anuncios |
| Rama       | codex/publicacion-visible-inventario  |

## Problema

Un vehículo nuevo o tasado pierde el botón de publicación cuando el expediente está incompleto. El equipo tiene que abrir la ficha para encontrar la opción excepcional.

## Resultado esperado

Los agentes y administración pueden revisar la publicación desde la tarjeta. Cuando falta el precio de venta se anticipa el texto público «Precio a consultar». Administración puede guardar el precio por separado. El equipo puede consultar los pendientes y confirmar expresamente la publicación excepcional.

## Criterios de aceptación

- En las tarjetas de vehículos nuevos y tasados con vendedor activo se puede iniciar la publicación aunque haya pendientes.
- La tarjeta permite consultar la lista de pendientes y avisa de cómo se verá un anuncio sin precio.
- Guardar el precio y publicar son acciones independientes. La edición mantiene el permiso de administración.
- La confirmación excepcional comprueba si han aparecido nuevos pendientes desde la revisión.

## Verificación

En local pasaron 12 pruebas de interfaz del inventario en Chrome y WebKit móvil y 13 pruebas de integración sobre PostgreSQL aislado. Se comprobó que la publicación con un precio recién retirado exige revisar los pendientes y que la ficha pública muestra «Precio a consultar» después de confirmar.

## Rollout y recuperación

Se puede revertir la interfaz sin migración. La publicación real del CRM se tramita por separado.
