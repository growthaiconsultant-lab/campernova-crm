# COM-18 — Comparar el stock y retomar el seguimiento de un comprador

| Campo      | Valor                                                        |
| ---------- | ------------------------------------------------------------ |
| **Estado** | IMPLEMENTED                                                  |
| Owner      | Equipo CRM                                                   |
| Ticket     | Rediseño de Vehículos de interés aprobado por el propietario |
| Rama       | codex/vehiculos-interes-comprador                            |
| Ruta SDD   | Estándar, interfaz de lectura y acciones existentes          |

## Problema

Las sugerencias, los intereses manuales y las comparaciones aparecían en listas distintas. El equipo necesita identificar los requisitos pendientes y localizar la operación asociada a un vehículo.

## Resultado esperado

La ficha resume la búsqueda, explica qué vehículos cumplen los requisitos y mantiene a mano los que el equipo ya trabaja. La propuesta aprobada distingue Encajan, Falta comprobar y Fuera de criterios.

## Reglas y alcance

Usar la evaluación canónica y el stock elegible. El uso residencial contextualiza la búsqueda. Las preferencias ordenan los resultados. El seguimiento reúne por vehículo los intereses manuales, las sugerencias trabajadas y las operaciones existentes. Las asociaciones históricas fuera del stock son de consulta. Mantener importes, señales, plazos, estados, permisos, acciones y enlaces internos. Cambio de presentación sin migraciones ni escrituras al consultar.

## Criterios de aceptación

1. Mostrar la búsqueda y permitir filtrar el stock, inspeccionar los motivos y añadir un interés.
2. Poder retomar un vehículo trabajado aunque deje de encajar o salga del stock. Navegar a cada oferta y reserva original, también si carece de asociación.
3. Probar los datos incompletos, los filtros, la navegación con teclado y los registros anteriores con datos de prueba.
4. Validar tipos, lint, pruebas de regresión y funcionamiento en escritorio y móvil.

## Verificación local

Superadas 1982 pruebas unitarias y 20 pruebas de navegador en Chrome y WebKit móvil. Se comprobó la navegación con teclado, la prioridad de preferencias, la explicación del exceso de presupuesto, el guardado y reintento, los estados sin criterios o sin stock y el enlace a una reserva con señal. La prueba de ficha cubre un interés manual, una visita que ya no encaja, dos ofertas sobre un mismo vehículo y una operación sin asociación. Tipos y lint correctos. Compilación de Next completada con copias locales de las fuentes y configuración de prueba.

## Rollout y recuperación

Publicación autorizada por el propietario. Integrar tras los controles del repositorio y verificar la versión activa en el CRM. Recuperación mediante reversión de la interfaz. Detener si cambia una regla comercial o se oculta una operación anterior.
