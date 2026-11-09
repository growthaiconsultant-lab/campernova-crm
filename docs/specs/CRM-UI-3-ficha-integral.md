# CRM-UI-3 — Ficha de comprador organizada por tareas

| Campo           | Valor                                                  |
| --------------- | ------------------------------------------------------ |
| **Estado**      | IMPLEMENTED                                            |
| Owner           | Equipo CRM                                             |
| Ticket          | Diseño integral aprobado por el propietario en el chat |
| Rama / PR       | codex/ficha-comprador-integral                         |
| Categorías      | UI y navegación                                        |
| Riesgo          | Medio                                                  |
| Ruta SDD        | Estándar                                               |
| Última revisión | 2026-11-09                                             |

## Problema y evidencia

La ficha distribuye el seguimiento entre tres pestañas y repite información de compra y postventa en una columna común a todas. El equipo tiene dificultades para localizar tareas.

## Resultado esperado

Cuatro destinos habituales y Postventa cuando corresponda. El equipo puede registrar la llamada y su próximo paso en Seguimiento, editar la búsqueda y pasar del stock a una oferta.

## Reglas e invariantes

Conservar contacto, estado, temperatura, responsable, procedencia y atribución, historial y chat, paginación de notas y agenda, acción destacada histórica, autoguardado, catálogo, solicitud original, vehículo a cambio, selección manual, sugerencias, ofertas, documentos y ventas con o sin garantía. Mantener los enlaces guardados. Usar las mismas acciones autorizadas de servidor.

## Fuera de alcance

Migraciones, cambios en registros existentes, permisos, reglas comerciales o servicios externos.

## Decisiones y plan técnico

Agrupar por tarea en la página existente. Conservar la navegación por URL y el contenido histórico. La selección desde stock usa la asociación manual existente. Postventa se presenta con una venta completada, cierre comercial, garantía o al acceder por enlace antiguo. Comprobar navegación y formularios con datos ficticios.

## Criterios de aceptación

- Una llamada, agenda, notas y conversación accesibles desde Seguimiento.
- Preferencias, requisitos, búsqueda bajo pedido y vehículo a cambio accesibles desde Qué busca.
- Intereses, sugerencias, stock y ofertas accesibles desde Vehículos y ofertas.
- Documentos ligados al comprador y todas las entregas e incidencias consultables.
- Fichas vacías, cerradas, archivadas y enlaces antiguos utilizables en móvil y escritorio.

## Verificación

Verificado en local el 9 de noviembre con compradores ficticios.

- 1963 pruebas unitarias y de presentación correctas. Doce cubren la página reorganizada y sus enlaces antiguos.
- 32 pruebas de interfaz correctas en Chromium de escritorio y WebKit móvil, incluidos el registro de llamada, el autoguardado, el reintento de asociación y la solicitud bajo pedido.
- 59 pruebas de integración correctas en PostgreSQL 17 efímero con las migraciones reales. Cubren seguimiento, asociación manual, ofertas y reservas.
- Las cinco vistas renderizadas se recorrieron a 1280, 390 y 320 px. Se abrió el contacto y el editor de preferencias y se verificó la ausencia de desbordamiento horizontal.
- Validación de TypeScript y lint correctos. CI y publicación pendientes.

## Rollout, rollback y stop conditions

Entrega local para revisión. Revertir la interfaz si se pierde acceso a una operación o se altera un registro al navegar. La reversión no necesita restaurar datos.
