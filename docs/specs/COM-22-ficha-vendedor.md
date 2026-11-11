# COM-22 — Ver cómo va la venta y registrar el siguiente paso

| Campo      | Valor                            |
| ---------- | -------------------------------- |
| **Estado** | IMPLEMENTED                      |
| Owner      | Equipo CRM                       |
| Rama       | codex/ficha-vendedor-seguimiento |

## Problema

Estado del contacto, vehículo, puntuaciones y sugerencia de seguimiento compiten por la atención en la primera pantalla del vendedor.

## Resultado esperado

El vendedor y su responsable encabezan la ficha. Seguimiento abre con el próximo compromiso, las ofertas, la publicación y el historial. Vehículo y documentos y Venta dan acceso a los apartados operativos existentes con sus permisos.

## Criterios de aceptación

- Separar contacto, situación del vehículo, precio anunciado y precio deseado. Mantener accesos históricos y datos existentes.
- Reconocer las citas de calendario y el recordatorio de la ficha. Si falta un compromiso, mostrar Programar.
- Registrar la llamada con un resultado y, opcionalmente, fecha y título de seguimiento. Crear la actividad y la cita del vendedor en una transacción, con responsable y reintento idempotente.
- En solicitudes pendientes o rechazadas, centrar la lectura en la decisión de admisión y en la actividad. Conservar restricciones por rol y archivado.

## Plan y validación

Reutilizar las vistas de vehículo, publicación, compradores, tasación y economía. El guard de comercial y el bloqueo de vendedor protegen la llamada. Comprobar fechas, reintentos, asignación, navegación, accesos antiguos y formularios en escritorio y móvil. La ficha lee los precios y las ofertas de su fuente original.

## Verificación local

Pasaron 1994 pruebas unitarias y nueve de integración de seguimiento con PostgreSQL efímero. Se comprobó que un doble envío guarda una sola llamada y una sola cita visible en el calendario del responsable, que un recordatorio modificado permanece intacto y que las solicitudes sin admitir no admiten seguimiento comercial. Dos pruebas de navegador en Chrome y WebKit móvil cubren el reintento desde el formulario. Se verificaron tipos, lint y accesos directos anteriores.

## Rollout y recuperación

Entrega local para revisión. Revertir la interfaz y la acción en caso de duplicados o vínculos incorrectos. Las llamadas y las citas usan los modelos existentes, accesibles desde la actividad y el calendario.
