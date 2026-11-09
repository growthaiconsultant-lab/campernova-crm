# COM-15 — Una agenda y un historial en Seguimiento

| Campo      | Valor                                         |
| ---------- | --------------------------------------------- |
| **Estado** | IMPLEMENTED                                   |
| Owner      | Equipo CRM                                    |
| Ticket     | COM-15, propuesta aprobada en la conversación |
| Rama       | codex/agenda-seguimiento-comprador            |
| Ruta SDD   | Estándar, riesgo medio                        |

## Problema

Seguimiento puede mostrar la misma cita en la cabecera y en la lista de acciones. El recordatorio de la ficha también tiene una tarjeta independiente.

## Resultado esperado

En Seguimiento, la primera pendiente aparece una sola vez en la agenda. El equipo puede registrar una llamada, programar otra acción, desplegar las demás y consultar el historial a continuación. Las otras pestañas conservan el resumen y el registro de llamadas.

## Plan e invariantes

Combinar en la presentación los eventos pendientes y el recordatorio editable de la ficha. Ordenar por fecha, con las acciones vencidas primero y el recordatorio sin fecha al final. A igualdad de hora, mostrar antes los eventos del calendario. Cada origen mantiene su editor. Conservar el recuento, la paginación, los contactos históricos, notas, chat, enlaces y restricciones de archivo. Los formularios invocan las acciones existentes.

## Criterios de aceptación

- Una sola entrada por registro en Seguimiento, incluidas las acciones con fecha idéntica y los recordatorios sin fecha.
- Navegación entre páginas con la primera pendiente estable y los detalles accesibles.
- Llamadas, programación, historial y notas utilizables en móvil y escritorio.

## Verificación

El 9 de noviembre de 2026 pasaron 1978 pruebas unitarias y de presentación y 34 pruebas de interfaz en Chromium y WebKit móvil con datos ficticios. Se verificaron fechas coincidentes entre páginas, recordatorios sin fecha, fichas archivadas y registro de llamadas con reintento. La ficha renderizada se revisó a 320, 390 y 1280 px. TypeScript, lint y la comprobación SDD pasaron.

## Rollout y recuperación

Para revertir, recuperar la presentación anterior. El cambio es local, sin migración de registros. Publicación sujeta a autorización.
