# COM-21 — Ver el trabajo pendiente tras la entrega

| Campo      | Valor                         |
| ---------- | ----------------------------- |
| **Estado** | IMPLEMENTED                   |
| Owner      | Equipo CRM                    |
| Rama       | codex/postventa-comprador     |
| Ruta SDD   | Estándar, interfaz de lectura |

## Problema

La ficha abría con la venta y la garantía y filtraba las incidencias resueltas.

## Resultado esperado

La propuesta aprobada abre con las incidencias abiertas, en curso o pendientes de cierre y los envíos fallidos. El contador de la pestaña corresponde a esos pendientes. Cada incidencia muestra estado, prioridad, responsable y plazo según los datos disponibles.

## Criterios de aceptación

Los seguimientos automáticos pendientes (días 7 y 30) se muestran por orden de envío. Con la garantía registrada y ningún asunto por atender se indica «Todo al día». Entregas, vencimiento efectivo con ampliaciones, historial de incidencias cerradas o anuladas y correos enviados o respondidos están accesibles en la misma ficha. Se conserva el enlace al módulo de gestión.

## Plan y verificación

Reutilizar las relaciones de la garantía, consultar el detalle sólo al abrir Postventa y mantener los permisos actuales. Validar el contador y las clasificaciones, garantías históricas y ampliadas, fechas y navegación mediante datos de prueba. Las acciones, automatizaciones, transiciones, almacenamiento y registros existentes quedan fuera del cambio.

## Verificación local

Pasaron 1985 pruebas unitarias, seis de integración de entrega y postventa con PostgreSQL efímero y cuatro de navegador en Chrome y WebKit móvil. Se verificaron la clasificación, los contadores, los desplegables, las ampliaciones y la consulta del historial. Tipos y lint correctos.

## Rollout y recuperación

Implementación local para revisión. Reversión de la interfaz y de las lecturas si un asunto se omite o se contabiliza dos veces.
