# COM-42 — Programar las reparaciones aprobadas

| Campo      | Valor                                               |
| ---------- | --------------------------------------------------- |
| **Estado** | IMPLEMENTED                                         |
| Owner      | Equipo CRM                                          |
| Ruta       | Reforzada por persistencia, concurrencia y permisos |

## Problema

La respuesta del propietario se registra en la inspección. Coordinación necesita identificar las reparaciones pendientes de programar sin revisar ficha por ficha.

## Resultado esperado

La última versión aceptada de cada inspección aparece en Por hacer de la coordinación de taller configurada. Incluye partidas, responsable de la aceptación, versión e importe. Desde la tarea se asignan técnico, horas previstas y fechas. La orden de reparación alimenta la agenda y su planificación se consulta en la inspección, incluso si la inspección está cerrada.

## Criterios de aceptación

- Una sola tarea por inspección pendiente. Leer el enlace o repetir la aceptación no duplica trabajo. Las versiones pendientes o rechazadas no generan tareas. Una revisión sin aceptar no invalida la última aprobación.
- Se incluyen aceptaciones previas. Los datos de las partidas proceden de la versión aceptada. Las mejoras del comprador y la aprobación interna de costes siguen su propio circuito.
- Guardar crea una orden vinculada a la versión en una transacción bajo los bloqueos existentes. La segunda planificación simultánea no sobrescribe la primera. Una orden programada se puede reprogramar desde Taller. La inspección consulta sus datos vigentes.
- Taller de coordinación y Administración pueden programar. Una cuenta comercial no accede a las partidas desde el inicio. Administración puede atender la cola del equipo si queda vacante la coordinación.

## Verificación

En PostgreSQL local pasaron las 503 pruebas de integración. El recorrido comprueba doble aceptación, vista de coordinación, aislamiento de usuarios, dos reservas de orden concurrentes, agenda y reprogramación en la inspección. Pasaron 2054 pruebas unitarias y 10 pruebas de interfaz en Chrome y WebKit móvil. Se verificaron tipos, lint, compilación, aplicación sobre el esquema anterior, replay de las 29 migraciones desde cero y paridad del esquema con RLS.

## Rollout y recuperación

Implementación local. Columna opcional y única en los presupuestos. Para publicar, verificar copia y entorno, aplicar primero en staging y contrastar historial de presupuestos. El rollback de aplicación conserva las órdenes y enlaces ya creados.
