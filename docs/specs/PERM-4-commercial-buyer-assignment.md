# PERM-4 — Asignación manual de responsables de compradores por comerciales

| Campo               | Valor                                                  |
| ------------------- | ------------------------------------------------------ |
| **Estado**          | IMPLEMENTED                                            |
| **Owner**           | Commercial / Engineering                               |
| **Ticket**          | Conversación de producto 2026-08-17                    |
| **Rama / PR**       | `codex/perm-4-commercial-buyer-assignment` / pendiente |
| **Categorías**      | C0, C1, C3, C5                                         |
| **Riesgo**          | Alto                                                   |
| **Ruta SDD**        | Reforzada                                              |
| **Última revisión** | 2026-08-17                                             |

## Problema y evidencia

**Hecho verificado:** `updateBuyerLead` rechaza cualquier cambio de `agentId` cuando el actor tiene
rol `AGENTE`; la interfaz también deshabilita el selector para ese rol. Por tanto, un comercial no
puede asumir, reasignar ni desasignar manualmente un comprador aunque tenga acceso legítimo al
módulo comercial.

**Decisión de producto:** la asignación seguirá siendo manual y opcional. Tanto `ADMIN` como
`AGENTE` podrán asignar un comprador a cualquier comercial activo y también dejarlo sin asignar.

## Resultado esperado

Desde la ficha de un comprador, cualquier `ADMIN` o `AGENTE` puede seleccionar otro comercial
activo como responsable, cambiar el responsable o elegir «Sin asignar». El servidor valida la misma
regla y cada cambio efectivo deja una actividad `LEAD_ASIGNADO`.

## Reglas e invariantes

- La asignación no es obligatoria: `agentId = null` continúa siendo válido.
- No existe reparto ni asignación automática al crear compradores.
- Actores autorizados: usuarios activos con rol `ADMIN` o `AGENTE`, garantizados por
  `requireAgente`.
- Destinos autorizados: usuarios activos con rol `ADMIN` o `AGENTE`.
- La autorización se aplica en el servidor; la habilitación de la UI no constituye seguridad.
- Un cambio efectivo de responsable conserva la auditoría `LEAD_ASIGNADO` con el actor real.
- Los compradores y asignaciones existentes no se modifican mediante backfill.

## Fuera de alcance

- Asignación automática, round-robin, propietario por defecto o asignación obligatoria.
- Permisos o asignaciones de vendedores, vehículos, taller, entregas o postventa.
- Cambios de roles, schema, migraciones, RLS o datos remotos.
- Merge, cambios de `main` o modificación de producción.

## Decisiones

| Decisión                | Alternativas                              | Resolución y motivo                                                                      |
| ----------------------- | ----------------------------------------- | ---------------------------------------------------------------------------------------- |
| Capacidad del comercial | Solo autoasignarse / asignar a cualquiera | Puede asignar a cualquier comercial para permitir coordinación del equipo.               |
| Obligatoriedad          | Obligatoria / opcional                    | Opcional; «Sin asignar» es un estado legítimo.                                           |
| Destinos                | Cualquier usuario / comercial activo      | Solo `ADMIN` o `AGENTE` activos para no delegar leads a perfiles operativos o inactivos. |
| Auditoría               | Sin actividad / registrar actor           | Mantener `LEAD_ASIGNADO` para trazabilidad.                                              |

## Plan técnico

1. Sustituir el veto exclusivo de `ADMIN` por validación server-side del responsable destino.
2. Limitar las opciones de la ficha a comerciales activos y habilitar el selector para todo actor que
   ya pasó `requireAgente`.
3. Cubrir asignación, reasignación, desasignación y destinos no autorizados con tests unitarios.
4. Ejecutar checks SDD, tests focalizados, typecheck, lint y batería unitaria.

### Impacto

- **Código y consumidores:** ficha y server action de compradores.
- **Datos/migraciones:** ninguna migración ni escritura masiva; solo futuras ediciones explícitas.
- **Permisos/seguridad:** amplía la mutación de `agentId` de `ADMIN` a `ADMIN + AGENTE` y valida el
  destino en servidor.
- **Concurrencia/idempotencia:** se conserva la semántica last-write-wins existente; no es una
  transición irreversible ni un hecho financiero.
- **Integraciones/efectos externos:** ninguno.
- **Observabilidad/KPIs:** `Activity` existente es suficiente para auditoría; no se añade PostHog ni
  se envía PII a servicios externos.

## Criterios de aceptación

- [x] Un `AGENTE` puede asignar un comprador a otro comercial activo.
- [x] Un `ADMIN` conserva la misma capacidad.
- [x] Ambos pueden reasignar y dejar el comprador sin responsable.
- [x] Un usuario inactivo o con rol no comercial no puede ser responsable nuevo, incluso mediante
      una petición directa al servidor.
- [x] La ficha solo ofrece comerciales activos y no presenta el aviso «Solo el admin».
- [x] Cada cambio efectivo conserva una actividad `LEAD_ASIGNADO` con el actor real.
- [x] Crear un comprador continúa dejándolo sin asignar.

## Verificación

| Criterio                          | Evidencia ejecutada                                            | Resultado          |
| --------------------------------- | -------------------------------------------------------------- | ------------------ |
| Autorización positiva y auditoría | Vitest focalizado de `updateBuyerLead` para `ADMIN` y `AGENTE` | 19/19 pasan        |
| Desasignación opcional            | Test focalizado con `agentId: null`                            | Pasa               |
| Destino inválido                  | Tests de usuario inexistente, inactivo y rol no comercial      | 3/3 pasan          |
| Contrato y calidad                | `check:sdd`, TypeScript, ESLint y batería Vitest mediante Node | Todos pasan        |
| Regresión unitaria                | `node node_modules/vitest/vitest.mjs run`                      | 112 archivos, 1446 |

## Rollout, rollback y stop conditions

- **Rollout:** PR y Preview contra staging antes de cualquier merge; producción requiere autorización
  independiente.
- **Rollback/mitigación:** revertir el commit restaura el veto anterior sin migración ni pérdida de
  datos. Las asignaciones realizadas durante el rollout siguen siendo válidas y auditadas.
- **Detener si:** un rol fuera de `ADMIN`/`AGENTE` puede mutar `agentId`, se pierde la actividad de
  auditoría, aparecen cambios de schema o los checks de autorización fallan.
- **Validación post-despliegue:** en Preview, probar asignar, reasignar y desasignar con una cuenta QA
  `AGENTE`, y comprobar que un destino no comercial no aparece.

## Revisión adversarial

| Riesgo intentado                                        | Mitigación o riesgo pendiente                                            |
| ------------------------------------------------------- | ------------------------------------------------------------------------ |
| Petición directa con ID de usuario operativo o inactivo | Validación server-side de actividad y rol del destino.                   |
| Actor no comercial llama a la acción                    | `requireAgente` permanece como guard de entrada.                         |
| UI muestra usuarios no elegibles                        | Query limitada a comerciales activos.                                    |
| Cambio sin trazabilidad                                 | Se conserva `LEAD_ASIGNADO` dentro de la transacción.                    |
| Dos comerciales editan simultáneamente                  | Permanece last-write-wins; riesgo aceptado y reversible para este campo. |

## Cierre

- **Commit:** pendiente
- **PR:** pendiente
- **CI:** pendiente
- **Deployment:** no realizado
- **Validación:** local completada; Preview/CI pendientes de publicación
- **Deuda restante:** ninguna identificada dentro del alcance
