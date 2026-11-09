# CRM-UI-1 — Seguimiento desde la lista de compradores

| Campo    | Valor                                              |
| -------- | -------------------------------------------------- |
| Estado   | IMPLEMENTED                                        |
| Petición | Rediseñar el listado con 21st.dev para CampersNova |
| Rama     | codex/rediseno-listado-compradores                 |
| Ruta     | Estándar · interfaz y navegación local             |
| Fecha    | 2026-11-09                                         |

## Problema y alcance

La lista reparte el seguimiento en ocho columnas y dedica gran parte de la cabecera a filtros secundarios. En pantallas estrechas resulta difícil relacionar al comprador con su siguiente acción. El cambio afecta a la presentación del listado autenticado.

## Decisiones e implementación

Adaptar la jerarquía de [Leads Data Table](https://21st.dev/@isaiahbjork/components/leads-data-table) a los componentes existentes. Agrupar los controles de seguimiento, compactar filtros y ofrecer un panel de consulta y edición con acceso a la ficha completa. Usar las acciones de COM-6 y las vistas de COM-12. La consulta, las autorizaciones y la escritura de datos siguen sus contratos existentes.

## Criterios de aceptación y verificación

- La vista rápida se abre en escritorio y móvil, admite teclado y devuelve el foco al cerrar.
- El listado permite editar estado, temperatura, origen, responsable y próxima acción.
- La búsqueda, vistas y paginación conservan su contexto. La vista Mis leads mantiene sus reglas de asignación.
- Se distinguen los resultados vacíos y los fallos de carga.
- Comprobar tipos, pruebas de compradores y navegación con datos ficticios en un navegador.

## Entrega

Revisión local del diff. El despliegue requiere autorización aparte. Se revierte el cambio de interfaz si impide consultar o editar un comprador.

## Evidencia local

TypeScript y ESLint sobre la interfaz pasan. Vitest completó 1.951 pruebas. En Chrome, con datos ficticios y anchos de 1440 y 390 px, se comprobó la edición de estado, el diálogo de próxima acción, el cierre con Escape y recuperación del foco, la conservación de filtros y el estado vacío. La prueba de navegador simula la persistencia. La rama está pendiente de revisión y publicación.
