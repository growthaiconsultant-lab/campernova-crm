# CRM-UI-2 — Registrar una llamada y acordar el siguiente paso

| Campo    | Valor                                                                  |
| -------- | ---------------------------------------------------------------------- |
| Estado   | IMPLEMENTED                                                            |
| Petición | Aplicar a la ficha el rediseño de seguimiento solicitado por el equipo |
| Rama     | codex/ficha-seguimiento-llamada                                        |
| Riesgo   | Medio. Ruta reforzada por concurrencia y notas comerciales             |
| Fecha    | 2026-11-09                                                             |

## Alcance y decisiones

Abrir la ficha con el nombre, la necesidad de compra, el último contacto y el próximo paso. Mostrar los indicadores y la edición extensa bajo demanda. Las pestañas y las acciones históricas permanecen accesibles. Una llamada genera una actividad LLAMADA. El siguiente paso opcional crea un CalendarEvent del comercial con su fecha convertida desde el horario local, siguiendo COM-10. La acción destacada histórica es independiente de los eventos. No marcar citas previas completadas por inferencia.

## Plan y aceptación

- Validar permisos de agente, contenido y acción en servidor. Guardar actividad y evento en una transacción con bloqueo de la fila del comprador. Rechazar una ficha fusionada y la programación sobre fichas archivadas.
- Identificar un envío con una clave de reintento. Verificar doble envío, recuperación tras error, concurrencia y rollback en PostgreSQL efímero. Probar formulario con teclado y móvil.
- Sin migraciones, correos, nuevas dependencias de producción ni registro del contenido en logs. Validar tipos y pruebas. La entrega local permite revisar antes de publicar. Para revertir, restaurar el formulario anterior: los datos quedan legibles en Actividad y Calendario.

## Verificación y entrega

Pasaron TypeScript, ESLint, las 1.951 pruebas unitarias y las 30 pruebas de navegador del conjunto de seguimiento en Chrome y WebKit móvil. Las seis pruebas de integración de seguimiento pasaron en PostgreSQL 17 local con migraciones reales, incluidos el reintento simultáneo y el rollback si falla la cita. El usuario autorizó expresamente publicar esta ficha. Verificar tras el despliegue abriendo el formulario de producción sin escribir datos de prueba en el CRM.
