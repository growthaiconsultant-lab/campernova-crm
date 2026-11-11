# COM-25 — Consultar la venta y registrar anuncios en portales

| Campo      | Valor                            |
| ---------- | -------------------------------- |
| **Estado** | IMPLEMENTED                      |
| Owner      | Equipo CRM                       |
| Ruta       | Reforzada por persistencia nueva |
| Rama       | codex/venta-portales-vendedor    |

## Problema

El apartado distribuye ofertas, coincidencias y anuncios entre varias vistas. Los textos generados carecen de evidencia de publicación externa.

## Resultado esperado

La portada de Venta presenta la operación actual, los canales y los compradores con señales comerciales. Una publicación en Wallapop o Coches.net se confirma manualmente con enlace y fecha de calendario. La web refleja el estado que utiliza el catálogo.

## Criterios de aceptación

- Mostrar reserva con precio, señal y vencimiento, ofertas abiertas y acceso al historial y sus acciones. Conservación de registros y permisos previos.
- Agrupar por comprador las visitas, ofertas y reservas. Las sugerencias y los vehículos propuestos sin respuesta se consultan aparte.
- Un registro por vehículo y canal, independiente de la generación de textos. Edición y retirada con control de concurrencia. Validar URL del portal, fecha real y titularidad; sólo ADMIN/AGENTE sobre la ficha admitida y activa.
- Mantener operativos los accesos de anuncios, asociación manual, tasación y economía.

## Plan y riesgos

Tabla aditiva con clave compuesta, FK y RLS sin políticas públicas. La aplicación usa el mismo bloqueo de vehículo y vendedor que las operaciones comerciales para serializar los cambios. La revisión evita sobrescribir datos obsoletos. La acción registra la confirmación de una publicación externa, sin contactar con el portal. La consulta conserva las ofertas de la operación aunque ya no haya un match elegible.

## Verificación

Se aplicaron las 25 migraciones en PostgreSQL 17 efímero. El esquema coincide con Prisma, las 36 tablas tienen RLS y la segunda aplicación no encontró migraciones pendientes. Pasaron 2008 pruebas unitarias, 37 de integración sobre portales y ofertas, y seis de navegador en Chrome y WebKit móvil. Se verificaron ediciones simultáneas, reintentos, rechazo de un vendedor incorrecto o archivado y conservación del comprador, el importe, la señal y la fecha de reserva.

## Rollout y recuperación

La migración debe preceder al despliegue en cada entorno; comprobar backup, identidad y preflight antes de ejecutar en remoto. Ante discrepancias detener el rollout. El frontend anterior puede seguir trabajando con la tabla aditiva presente.
