# COM-39 — Organizar el día de Comercial y Administración

| Campo      | Valor                         |
| ---------- | ----------------------------- |
| **Estado** | IMPLEMENTED                   |
| Owner      | Equipo CRM                    |
| Rama       | codex/inicio-comercial-equipo |
| Ruta       | Estándar, vista de lectura    |

## Problema

Las tareas de vendedores se cuentan pero faltan en la lista. Las reservas del inicio comercial no se limitan al responsable. El saludo personal también se utiliza para datos del equipo.

## Resultado esperado

El inicio reúne «Por hacer» y «Agenda de hoy». Administración entra en «El día del equipo» y puede alternar a «Mi trabajo» o consultar un comercial. Un agente siempre consulta su propio trabajo.

## Criterios de aceptación

- Aplicar el ámbito de sesión en ambos bloques. Usar el responsable de cada tarea o cita y el comercial actual del comprador para las reservas. Mantener lo pendiente sin asignar visible en el equipo.
- Mostrar recordatorios de comprador y vendedor, captaciones, acciones de calendario y reservas que requieren atención. Los compromisos del día incluyen hora y acceso al registro. Los límites del día siguen Europe/Madrid.
- Mantener los datos originales y los inicios de Taller, Entregas y Marketing. Verificar ámbitos, navegación, estados vacíos y registros anteriores con datos de prueba.

## Verificación local

Pasaron las 2.031 pruebas unitarias, incluidas las de cambio de día y horario de verano en Madrid. En PostgreSQL local se verificaron las dos listas con dos agentes y administración, la reserva por responsable del comprador, la asignación de entregas y taller, los casos sin asignar y los parámetros de URL de otro agente. En Chrome de escritorio y WebKit móvil se comprobaron los selectores de ámbito, los enlaces, la ampliación de pendientes y los estados vacíos. Los controles de tipos y lint pasaron.

## Rollout y recuperación

Publicación autorizada en el CRM del equipo. Tras el despliegue, comprobar ambas vistas en el dominio de producción. El cambio utiliza consultas de lectura con los permisos existentes. La recuperación consiste en revertir la interfaz.
