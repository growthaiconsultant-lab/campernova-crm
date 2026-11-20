# COM-FOLLOWUP — Título y notas del seguimiento comercial

| Campo               | Valor                     |
| ------------------- | ------------------------- |
| **Estado**          | APPROVED                  |
| **Owner**           | CRM                       |
| **Ticket**          | COM-FOLLOWUP              |
| **Rama / PR**       | feat/buyer-followup-title |
| **Categorías**      | C0, C1, C2                |
| **Riesgo**          | Medio                     |
| **Ruta SDD**        | Reforzada                 |
| **Última revisión** | 2026-11-20                |

## Problema y evidencia

En la grabación de Pocket «Gestión de leads y notas» del 20 de noviembre, el equipo pidió distinguir
de un vistazo qué vehículo busca cada comprador y anotar el resultado de los contactos.

## Resultado y plan técnico

- Añadir un título opcional al comprador. Mostrarlo en negrita en el pipeline y el listado, con
  el nombre del comprador debajo. Las fichas existentes sin título muestran el nombre.
- Permitir editar el título desde el pipeline. La actualización afecta solo al título, usa el
  título anterior como condición de escritura y aplica el alcance del pipeline por comercial.
- Enlazar desde el pipeline y el listado al formulario y al historial de notas de la ficha existente.
- La sugerencia automática y los cambios al selector de próxima acción quedan para otra iteración.

## Impacto y revisión adversarial

La migración añade una columna nullable sin relleno. Los leads y notas existentes mantienen sus
valores. Se conserva la autorización de las rutas de lectura. La mutación rechaza títulos demasiado
largos, compradores fusionados, ediciones concurrentes y compradores fuera de la asignación del
comercial. No hay efectos externos ni nuevas integraciones.

## Criterios de aceptación y verificación

- [ ] Un título guardado aparece en ambas vistas y se puede quitar.
- [ ] El enlace de notas aterriza en el formulario y permite consultar el historial existente.
- [ ] El cambio se valida con tipos, lint, tests de la mutación y verificación local de la migración.

## Rollout y rollback

Aplicar primero la migración aditiva en el entorno autorizado y desplegar después. Si falla la
validación, revertir la aplicación y conservar la columna nullable. Detener el rollout si falla la
paridad de esquema, el acceso a la ficha o el guardado del título.

## Cierre

Implementación en rama local. Pasaron TypeScript, ESLint en los archivos modificados, validación
de Prisma, historial de migraciones y 2.063 tests de Vitest. Queda pendiente comprobar el flujo
en navegador y ejecutar la migración en PostgreSQL. Producción y PR pendientes.
