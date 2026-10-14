# COM-5 — Cambiar el estado del comprador desde ficha y listado

| Campo               | Valor                                                   |
| ------------------- | ------------------------------------------------------- |
| **Estado**          | IMPLEMENTED                                             |
| **Owner**           | Engineering                                             |
| **Ticket**          | COM-5; petición del usuario del 2026-10-14 en este chat |
| **Rama / PR**       | codex/compradores-estado-rapido; PR pendiente           |
| **Categorías**      | C0, C1, C2, C3, C6                                      |
| **Riesgo**          | Medio                                                   |
| **Ruta SDD**        | Reforzada por la escritura concurrente de estado        |
| **Última revisión** | 2026-10-14                                              |

## Problema y evidencia

Baseline: main/origin/main sincronizados en `2f141ec`, checkout inicialmente limpio.
`BuyerLead.status` ya admite NUEVO, CONTACTADO, CUALIFICADO, EN_NEGOCIACION, CERRADO y
PERDIDO. El formulario de edición permite cambiarlos, pero la cabecera muestra un
StatusPill de lectura y el listado texto estático. El usuario necesita marcar los
contactados sin abrir el formulario y distinguirlos rápidamente.

Hecho verificado: la clasificación es corregible (`lib/state-machine.ts`) y CERRADO
requiere una entrega VENTA COMPLETADA en la acción de edición. El matching excluye
CERRADO/PERDIDO y los archivados. Writers existentes: edición, marcar perdido y
coordinación de entregas; readers: ficha, listado/filtros, pipeline y matching.
No se dispone de una base PostgreSQL de pruebas configurada (`TEST_DATABASE_URL`
ausente). La UI se comprueba con componentes reales y boundary de servidor simulado,
sin utilizar una sesión del CRM ni datos remotos.

## Resultado esperado

Selector de estado con colores en la cabecera de cada comprador, en la columna
Estado del listado y en tarjetas móviles. Cambiarlo guarda sólo el estado, deja
traza en actividades y refresca la vista conservando filtros y paginación.

## Reglas e invariantes

- Reutilizar catálogo, etiquetas, colores y transiciones actuales; no crear estados.
- ADMIN/AGENTE mediante requireAgente antes de acceder a datos.
- Validar ID, estado actual esperado y destino con Zod en servidor.
- Mantener el requisito de entrega VENTA COMPLETADA para CERRADO.
- Guardar estado y CAMBIO_ESTADO en una transacción con comparación del estado
  esperado. Un conflicto devuelve error y refresca; no pisa otra clasificación.
- Repetir el destino actual no duplica actividades ni recalcula matching.
- Conservar contacto, responsable, preferencias, temperatura y motivos de pérdida.
- Recalcular matching con el servicio existente tras un cambio efectivo e invalidar
  ficha, listado y pipeline. Sus notificaciones y manejo de errores siguen existentes.
- No inferir el contacto desde notas, mensajes, llamadas o aperturas de WhatsApp.

## Fuera de alcance

Migraciones, nuevos permisos, backfill de notas históricas, cambios a otros writers,
automatización de contacto, métricas nuevas, commit, PR y producción.

## Decisiones

| Decisión        | Alternativas                                    | Resolución y motivo                                              |
| --------------- | ----------------------------------------------- | ---------------------------------------------------------------- |
| Fuente canónica | Booleano contactado separado / estado existente | Estado existente, autorizado por la petición y el dominio actual |
| Escritura       | Reenviar ficha completa / acción específica     | Acción de estado para conservar los demás datos                  |
| Conflicto       | Última escritura gana / comparación             | CAS con estado esperado y Activity atómica                       |
| Listado móvil   | Selector dentro de enlace / acciones fuera      | Acciones fuera del enlace para conservar semántica y navegación  |

## Plan técnico

1. Acción dedicada con validación, guard actual, transacción/CAS y auditoría.
2. Selector reutilizable accesible con guardado, error y refresco, integrado en las
   dos páginas. Slot de acciones móvil opcional en ActionableTable.
3. Unitarios de autorización, validación, cierre, no-op y conflicto; integración
   PostgreSQL para persistencia, rollback y carrera; comprobación UI proporcional.
4. Typecheck, lint, check:sdd, revisión del diff y registro de resultados reales.

### Impacto

- **Código y consumidores:** compradores, selector y slot móvil opcional de tabla.
- **Datos/migraciones:** estado/Activity existentes; sin schema ni backfill.
- **Permisos/seguridad:** mismos roles y boundary servidor; sin PII en nuevos logs.
- **Concurrencia/idempotencia:** updateMany condicionado por ID y estado esperado;
  Activity dentro de la misma transacción, sólo si count=1. No coordina writers existentes.
- **Integraciones/efectos externos:** matching existente; sin nuevos proveedores.
- **Observabilidad/KPIs:** Activity humana existente y error visible; sin nuevos eventos.

## Criterios de aceptación

- [x] Cambiar NUEVO a CONTACTADO desde cabecera y lista, escritorio y móvil (UI con boundary simulado).
- [x] Selector visible con colores, teclado, guardado y error, sin abrir ficha al usarlo.
- [ ] Sólo cambia status/updatedAt, con una Activity y refresco de consumidores.
- [x] Estados inválidos, falta de autorización y CERRADO sin entrega no escriben (unitarios).
- [ ] Doble envío no duplica Activity; conflicto no pisa estado; rollback atómico.
- [x] Filtros por estado existentes conservados en código y navegación a ficha comprobada en navegador.

## Verificación

| Criterio                      | Evidencia prevista                                                                                  | Resultado                                                                                                                                                                   |
| ----------------------------- | --------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Boundary, auditoría y gates   | Vitest unitario                                                                                     | 48 tests específicos de estado/edición/dominio superados                                                                                                                    |
| Persistencia/rollback/carrera | `pnpm test:integration -- tests/integration/buyer-status.test.ts`                                   | Bloqueado por guard: TEST_DATABASE_URL ausente; ninguna conexión remota                                                                                                     |
| UI y navegación               | `node .artifacts/com-5-ui/check.mjs`                                                                | Chrome headless, componentes reales y backend simulado: ficha, listado escritorio/móvil, teclado, loading, error, conflicto y navegación superados; capturas inspeccionadas |
| Regresiones y tipos           | `pnpm typecheck`, `pnpm lint`, `pnpm test`, `pnpm check:sdd`                                        | Superados; 136 archivos / 1.747 tests unitarios                                                                                                                             |
| Formato y diff                | Prettier de archivos afectados; `git diff --check`                                                  | Superados                                                                                                                                                                   |
| Compilación Next              | `pnpm exec next build --experimental-build-mode compile` con DB local ficticia y token Sentry vacío | Superada; sin generación de páginas ni guard remoto del script build. Advertencias existentes de Sentry y caché webpack                                                     |

## Rollout, rollback y stop conditions

- **Rollout:** implementación local autorizada por esta petición; publicación requiere
  alcance posterior. Sin migraciones ni mutaciones remotas de datos durante pruebas.
- **Rollback/mitigación:** revertir este cambio de código; los estados guardados
  continúan siendo compatibles y corregibles con el formulario existente.
- **Detener si:** discrepancia con estados/roles existentes, cierre sin entrega,
  borrado de campos o ejecución de pruebas contra remoto.
- **Validación post-despliegue:** con autorización, cambiar un lead de prueba desde
  ficha y lista en escritorio/móvil; confirmar filtro, Activity y pipeline.

## Revisión adversarial

| Riesgo intentado                          | Mitigación o riesgo pendiente                                 |
| ----------------------------------------- | ------------------------------------------------------------- |
| Cliente falsifica estado o acceso         | Zod + requireAgente en servidor                               |
| Cambiar estado borra preferencias         | Mutación exclusiva de status                                  |
| Dos clasificaciones desde estado obsoleto | CAS y conflicto visible                                       |
| Activity falla después de escribir        | Transacción revierte ambos efectos                            |
| Enlace intercepta selector                | Celda sobre overlay; slot móvil fuera de Link                 |
| Carrera con writers existentes            | CAS protege esta acción; coordinación global fuera de alcance |

## Cierre

Publicación autorizada explícitamente por el usuario el 2026-10-14: commit, push,
PR, merge, despliegue y migración de NO_CONTESTA tras superar las comprobaciones.
Este permiso sustituye la exclusión inicial de operaciones remotas; ejecución pendiente.

- **Commit/PR/CI/Deployment:** pendientes de ejecución, ya autorizados.
- **Validación:** implementación local comprobada con unitarios, tipos, lint,
  compilación y UI aislada. IMPLEMENTED no implica persistencia real validada ni deployment.
- **Deuda restante:** ejecutar los cuatro tests de integración contra PostgreSQL
  efímero y el flujo autenticado del CRM antes de publicación. El harness UI y sus
  capturas permanecen como artefactos locales ignorados en `.artifacts/com-5-ui/`.
