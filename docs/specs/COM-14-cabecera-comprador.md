# COM-14 — Cabecera operativa del comprador

| Campo      | Valor                                                         |
| ---------- | ------------------------------------------------------------- |
| **Estado** | IMPLEMENTED                                                   |
| Owner      | Equipo CRM                                                    |
| Ticket     | Cabecera propuesta seleccionada y aprobada por el propietario |
| Rama       | codex/cabecera-comprador                                      |
| Ruta SDD   | Estándar, interfaz y navegación, riesgo medio                 |
| Revisión   | 2026-11-09                                                    |

## Problema y evidencia

El shell y la ficha superponen dos barras, repiten el nombre y dan acceso inmediato a marcar una pérdida. La llamada y su siguiente paso solo están en Seguimiento.

## Resultado esperado

En una ficha, una barra compacta agrupa vuelta a Compradores, menú móvil, búsqueda y creación. La identidad muestra el nombre, la necesidad, estado y responsable. Contactar reúne los canales disponibles. Gestionar conserva temperatura, origen y operaciones secundarias. La misma franja de próxima acción y registro aparece en todos los apartados.

## Reglas e invariantes

Usar las acciones actuales, guardas, validación, seguimiento por WhatsApp y permisos. Conservar la agenda paginada, el primer evento pendiente y el recordatorio antiguo. Distinguir falta de contacto, acción sin fecha, agenda vacía y ficha archivada. Preservar los enlaces de secciones y el acceso móvil.

## Plan técnico

Adaptar el shell solo en la ruta de detalle del comprador, reutilizar los disparadores de búsqueda y creación y subir el formulario existente sobre la navegación. Recordar los filtros de la última bandeja durante la navegación del CRM. Comprobar render por sección, paginación y flujos de navegador con datos ficticios.

## Criterios de aceptación

- Cabecera y llamada únicas en Seguimiento, Qué busca, Vehículos y ofertas, Documentos y Postventa.
- Contacto y gestión conservan las acciones anteriores y la confirmación de pérdida.
- La fecha del encabezado corresponde al primer evento pendiente incluso al paginar; si no hay evento se respeta el recordatorio histórico.
- El listado, el alta y el resto de módulos conservan la barra habitual.
- Formularios y diálogos utilizables en escritorio y móvil.

## Verificación

Validación local con datos ficticios el 9 de noviembre de 2026:

- 1969 pruebas unitarias y de presentación. Seis nuevas comprueban la llamada y la cita en los cinco apartados y el recordatorio sin fecha.
- 34 pruebas de interfaz en Chrome y WebKit móvil, incluidos filtros de vuelta al listado, búsqueda, alta, confirmación de pérdida y registro de llamada con reintento.
- Revisión de las cinco secciones renderizadas a 320, 390 y 1280 px, con apertura de Contactar y verificación de teléfono y WhatsApp. Sin desbordamiento horizontal en esas vistas.
- TypeScript, lint y control de especificaciones correctos. Pendientes publicación y verificación en el CRM del equipo.

## Rollout y recuperación

Entrega local según la propuesta aprobada. El despliegue sigue el flujo del CRM. Para revertir basta con recuperar la interfaz anterior. La publicación debe detenerse si falla una acción existente o aparece una regresión de navegación. No hay migraciones ni cambios en los registros del equipo.
