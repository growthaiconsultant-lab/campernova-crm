# SEARCH-2 — El buscador global conserva únicamente la consulta más reciente

| Campo               | Valor                                          |
| ------------------- | ---------------------------------------------- |
| **Estado**          | IMPLEMENTED                                    |
| **Owner**           | Engineering                                    |
| **Ticket**          | SEARCH-2                                       |
| **Rama / PR**       | `codex/search-2-latest-query-wins` / pendiente |
| **Categorías**      | C0, C1, C5                                     |
| **Riesgo**          | Bajo                                           |
| **Ruta SDD**        | Estándar                                       |
| **Última revisión** | 2026-09-22                                     |

## Problema y evidencia

El buscador global lanza una Server Action tras un debounce, pero no asocia la respuesta a la
consulta que la originó. Si una búsqueda anterior ya está en curso y termina después de una más
reciente, sobrescribe los resultados actuales. El usuario puede escribir otro nombre y seguir
viendo el mismo contacto. La deuda de carrera ya constaba explícitamente en SEARCH-1 y el reporte
actual aporta la evidencia necesaria para corregirla.

## Resultado esperado

Sólo la búsqueda iniciada más recientemente puede actualizar resultados y estado de carga. Las
respuestas anteriores se ignoran, incluso si llegan después; cerrar o limpiar el buscador invalida
cualquier respuesta pendiente.

## Reglas e invariantes

- El servidor continúa aplicando el RBAC y construyendo los mismos destinos.
- El debounce permanece en 250 ms.
- Una respuesta obsoleta no cambia resultados, vacío, error ni indicador de carga.
- Cerrar el diálogo o dejar la consulta por debajo de dos caracteres invalida lo pendiente.

## Fuera de alcance

- Cambiar consultas Prisma, ordenación, permisos, schema o datos.
- Añadir búsqueda de usuarios internos o nuevos grupos de resultados.
- Modificar rutas o destinos de SEARCH-1.
- Commit, push, PR, despliegue o cambios remotos sin autorización posterior.

## Decisiones

| Decisión                | Alternativas                                                 | Resolución y motivo                                                                                                                          |
| ----------------------- | ------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------- |
| Control de concurrencia | Cancelar Server Action; comparar texto; secuencia monotónica | Secuencia monotónica local: las Server Actions en curso no son cancelables de forma fiable y comparar texto falla si se repite una consulta. |
| Alcance del test        | E2E con latencia artificial; helper determinista             | Helper determinista con unitarios; evita introducir hooks de latencia en producto.                                                           |

## Plan técnico

1. Añadir un guard de secuencia sin dependencias que identifique la solicitud vigente.
2. Aplicarlo antes de publicar éxito, error o fin de carga y al cerrar/limpiar el diálogo.
3. Cubrir respuesta fuera de orden e invalidación con tests unitarios y ejecutar validación estática.

### Impacto

- **Código y consumidores:** sólo el estado cliente del buscador global.
- **Datos/migraciones:** ninguno.
- **Permisos/seguridad:** sin cambios; permanece `globalSearch` server-side.
- **Concurrencia/idempotencia:** orden total local por instancia del buscador.
- **Integraciones/efectos externos:** ninguno.
- **Observabilidad/KPIs:** sin PII ni telemetría adicional.

## Criterios de aceptación

- [x] Una respuesta antigua no sustituye los resultados de la consulta más reciente.
- [x] Una respuesta pendiente no reaparece después de cerrar o limpiar el buscador.
- [x] Loading sólo termina por la solicitud vigente.
- [x] Consultas, destinos y permisos existentes no cambian.

## Verificación

| Criterio                 | Evidencia ejecutada                                   | Resultado                |
| ------------------------ | ----------------------------------------------------- | ------------------------ |
| Secuencia e invalidación | `vitest run lib/latest-search-request.test.ts`        | 2/2 tests verdes         |
| Integridad estática      | `check:sdd`, `typecheck`, `lint` y `git diff --check` | Verde, sin avisos        |
| Regresión                | `pnpm test`                                           | 1.489/1.489 tests verdes |
| Compilación              | `pnpm build`                                          | Verde                    |

## Rollout, rollback y stop conditions

- **Rollout:** PR de código cliente sin migración ni configuración.
- **Rollback/mitigación:** revertir el commit; no existe rollback de datos.
- **Detener si:** cambia una consulta, permiso, destino o archivo ajeno al alcance.
- **Validación post-despliegue:** escribir dos nombres consecutivos y confirmar que cada resultado
  corresponde al texto visible antes de abrir su ficha.

## Revisión adversarial

| Riesgo intentado                                  | Mitigación o riesgo pendiente                               |
| ------------------------------------------------- | ----------------------------------------------------------- |
| La respuesta antigua termina la carga de la nueva | Éxito, error y `finally` comprueban el mismo identificador. |
| Cerrar y reabrir deja reaparecer resultados       | El cierre invalida secuencia, timer y estado visible.       |
| Dos consultas iguales se confunden                | Se usa identificador monotónico, no comparación de texto.   |

## Cierre

- **Commit:** pendiente.
- **PR:** pendiente.
- **CI:** pendiente.
- **Deployment:** no realizado.
- **Validación:** local completa; pendiente CI y smoke autenticado en Preview.
- **Deuda restante:** smoke autenticado posterior al despliegue.
