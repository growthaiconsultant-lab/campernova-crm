# COM-6 — Gestionar compradores sin salir del listado

| Campo               | Valor                                                                         |
| ------------------- | ----------------------------------------------------------------------------- |
| **Estado**          | IMPLEMENTED                                                                   |
| **Owner**           | Engineering                                                                   |
| **Ticket**          | Petición del usuario del 2026-10-14: editar opciones desde el listado adjunto |
| **Rama / PR**       | codex/compradores-estado-rapido; continuación de COM-5, sin PR                |
| **Categorías**      | C0, C1, C3, C6                                                                |
| **Riesgo**          | Medio                                                                         |
| **Ruta SDD**        | Reforzada por concurrencia                                                    |
| **Última revisión** | 2026-10-14                                                                    |

## Problema y evidencia

main/origin/main siguen en 2f141ec. COM-5 está preparado localmente en esta rama:
el estado ya es editable desde listado/ficha. La captura adjunta muestra el listado
anterior en el que todas las columnas son texto de lectura. Temperatura, responsable,
próxima acción todavía requieren abrir la ficha. El usuario confirmó expresamente
el alcance: estado, temperatura, responsable y próxima acción; posteriormente pidió
añadir también origen. Esta ampliación está autorizada para implementación local.

Reglas verificadas: requireAgente para ADMIN/AGENTE; PERM-4 permite asignar a cualquier
comercial activo o desasignar. Los campos y Activities ya existen. No hay PostgreSQL
de pruebas configurado ni validación autenticada local realizada.

## Resultado esperado

Cambiar estado, origen, temperatura y responsable desde cada fila. Editar tipo/fecha de
próxima acción en un diálogo, sin navegar a ficha.
Ofrecer los mismos controles fuera del enlace de las tarjetas móviles.

## Reglas e invariantes

- Roles, estados y guard de cierre siguen existentes; COM-5 conserva su selector.
- Acciones rápidas con Zod, autorización antes de datos y escritura exclusiva del
  campo elegido; Activity y escritura en una transacción con CAS sobre updatedAt.
- Asignar sólo comerciales activos ADMIN/AGENTE, con auditoría LEAD_ASIGNADO.
- Temperatura nullable para quitar valoración; auditoría TEMPERATURA_ACTUALIZADA.
- Origen usa BuyerSourceSelect y el catálogo actual, admite Sin especificar y conserva
  valores legacy sin cambios implícitos. La acción sólo acepta códigos catalogados o null;
  guarda exclusivamente source y registra una NOTA de cambio en la misma transacción.
  La atribución histórica de landing permanece legible y no se reescribe.
- Próxima acción acepta tipo y fecha opcional; quitar limpia ambos. Usar ISO para
  transportar fechas y convertir datetime-local en el navegador.
- Reintento con valor ya guardado no duplica actividades; conflicto visible y refresco.
- No escribir texto de actividad como fuente canónica, ni añadir PII a logs.
- Mantener navegación, filtros/paginación y estado vacío; errores recuperables.

## Fuera de alcance

Edición masiva, nuevos roles, migraciones, backfill, automatizaciones, refactor de
writers previos, edición de otros campos, commit, PR, despliegue o mutaciones remotas durante pruebas.

## Decisiones

| Decisión            | Alternativas                     | Resolución y motivo                               |
| ------------------- | -------------------------------- | ------------------------------------------------- |
| UX                  | Abrir ficha / controles en lista | Selectores rápidos y diálogos en listado          |
| Concurrencia rápida | Última escritura / CAS           | updatedAt como revisión para evitar pisar cambios |

## Plan técnico

1. Acción rápida validada para origen, temperatura, responsable y próxima acción; CAS y Activity.
2. Componentes de lista con guardado/error/refresco y diálogos accesibles.
3. Unitarios boundary/permisos/no-op/CAS, integración PostgreSQL, navegador aislado,
   typecheck/lint/test/compilación y revisión del diff.

### Impacto

- **Código/consumidores:** listado y nuevos controles.
- **Datos/migraciones:** campos y Activities existentes; sin schema ni backfill.
- **Permisos:** sin ampliación; destinos activos ADMIN/AGENTE.
- **Concurrencia:** acciones rápidas CAS; writers existentes fuera de alcance.
- **Efectos:** invalidar ficha/listado/pipeline/dashboard; sin recalcular matching al cambiar seguimiento.
- **Observabilidad:** Activities existentes, errores UI; sin eventos ni proveedores nuevos.

## Criterios de aceptación

- [x] Estado, temperatura y responsable editables en fila y tarjeta móvil (componentes reales, servidor simulado).
- [x] Origen editable en fila/móvil con opciones actuales, null y conservación legacy (unitarios y navegador aislado).
- [x] Programar, cambiar y quitar próxima acción sin navegar a ficha (navegador aislado).
- [x] Loading/error accesibles; selector y diálogo no activan enlace de fila.
- [x] Entradas inválidas y responsable no comercial/activo no escriben (unitarios).
- [ ] Campos ajenos conservados, no-op sin duplicación, conflicto y rollback atómico.

## Verificación

| Evidencia                          | Resultado                                                                                                                                                                                                                                 |
| ---------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Unitarios de acciones y regresión  | `pnpm test`: 137 archivos y 1.776 tests superados; 49 focalizados de COM-5/COM-6                                                                                                                                                          |
| PostgreSQL real                    | `pnpm test:integration -- tests/integration/buyer-quick-edit.test.ts` aborta antes de conectar: TEST_DATABASE_URL ausente. Cinco casos preparados de conservación/no-op, asignación, carrera y rollback pendientes                        |
| UI navegador con servidor simulado | `node .artifacts/com-6-ui/check.mjs`: Chrome headless, escritorio/móvil, guardado, conflicto, fallo de red, teclado, reabrir, quitar acción, fecha Madrid a ISO, fecha opcional, navegación y overflow superados. Capturas inspeccionadas |
| Tipos/lint/check:sdd               | Superados. Error inicial de narrowing de result.error corregido y typecheck repetido en verde                                                                                                                                             |
| Compilación                        | `pnpm exec next build --experimental-build-mode compile` superado, DB local ficticia y token Sentry vacío; sin guard remoto ni generación de páginas. Avisos existentes de Sentry y caché webpack                                         |
| Formato/diff                       | Prettier de todos los archivos afectados y git diff --check superados                                                                                                                                                                     |

## Rollout, rollback y stop conditions

Ampliación «y origen»: 63 tests focalizados de quick-edit-actions/buyer-source,
typecheck, lint, check:sdd, formato y compilación Next en modo compile superados.
El navegador aislado comprueba cambio de origen escritorio/móvil, conservación de
REFERIDO_ANTIGUO, CHAT_WEB actual y borrado explícito. Los siete casos de integración
preparados siguen sin ejecutarse: el guard rechaza TEST_DATABASE_URL ausente antes
de conectar. La batería de 1.776 tests arriba corresponde al alcance anterior;
para la ampliación se ejecutó la batería focalizada proporcional.

- **Rollout:** preparación local autorizada por petición; publicación fuera de alcance.
- **Rollback:** revertir el cambio de código; campos y estados siguen compatibles.
- **Detener si:** destino no autorizado, datos ajenos sobrescritos o pruebas remotas.
- **Post-deploy:** probar ficha/lista móvil/escritorio, filtros y Activities con lead
  de prueba autorizado; observar errores de guardado y conflictos.

## Revisión adversarial

| Riesgo                             | Mitigación o límite                                    |
| ---------------------------------- | ------------------------------------------------------ |
| Enlace encima de controles         | Celdas sobre overlay y controles fuera de Link móvil   |
| Responsable inválido               | Destino validado en transacción y catálogo UI filtrado |
| Guardado repetido o concurrente    | no-op + CAS + auditoría atómica                        |
| Fallo de red                       | error visible y botón habilitado para reintentar       |
| Próxima acción obsoleta al reabrir | Inicializar formulario desde props actuales al abrir   |

## Cierre

El 2026-10-14 el usuario autorizó publicar todos los cambios, incluidos commit, push,
PR, merge y verificación del despliegue; autorización condicionada a checks verdes.

- **Commit/PR/CI/deploy:** pendientes de ejecución, autorizados.
- **Validación:** implementación local, sin publicar, comprobada con unitarios,
  tipos, lint, compilación y navegador aislado. No implica validación PostgreSQL ni
  flujo autenticado. Artefactos UI locales ignorados en `.artifacts/com-6-ui/`.
- **Deuda:** PostgreSQL real y flujo autenticado antes de publicar.
