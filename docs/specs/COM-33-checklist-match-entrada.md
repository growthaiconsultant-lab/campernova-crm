# COM-33 — Checklist de entrada para el match

| Campo      | Valor                         |
| ---------- | ----------------------------- |
| **Estado** | IMPLEMENTED                   |
| Owner      | Equipo CRM                    |
| Ruta       | Estándar                      |
| Rama       | codex/checklist-match-entrada |

## Problema

Las características están dentro de varios desplegables y algunas casillas muestran igual una ausencia confirmada y un dato desconocido.

## Resultado esperado

Trabajar con el mismo vehículo desde la tarjeta y la pestaña Vehículo y documentos, conservar los valores anteriores y guardar la revisión en varias visitas.

## Criterios de aceptación

- Acceso directo desde el inventario al checklist en la ficha del vendedor.
- Revisar conducción, descanso, baño y cocina, autonomía y equipamiento. Recuperar las respuestas guardadas y los datos heredados.
- Permitir entradas incompletas y diferenciar equipo ausente de equipo pendiente al reabrir y al cruzar con compradores.
- Mantener permisos, control de versión y condiciones de entrada y publicación existentes.

## Verificación

Verificación local en Chrome y WebKit móvil. Se probó guardar una respuesta negativa, reabrir, volver a dejarla pendiente y conservar el equipamiento anterior. Con PostgreSQL aislado se comprobó que un guardado parcial conserva la entrada, el precio y el estado del vehículo, y que se rechaza una edición desactualizada. Las pruebas del match distinguen ducha pendiente, ausente, integrada y separada.

## Rollout y recuperación

Cambio local sin migraciones. La publicación y su verificación en producción corresponden a un paso posterior.
