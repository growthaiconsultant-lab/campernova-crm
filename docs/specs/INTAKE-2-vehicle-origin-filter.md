# INTAKE-2 — Distinguir el origen en el inventario de vehículos

| Campo               | Valor                                              |
| ------------------- | -------------------------------------------------- |
| **Estado**          | IMPLEMENTED                                        |
| **Owner**           | Product / Engineering                              |
| **Ticket**          | INTAKE-2                                           |
| **Rama / PR**       | `codex/intake-2-vehicle-origin-filter` / pendiente |
| **Categorías**      | C0, C1                                             |
| **Riesgo**          | Bajo                                               |
| **Ruta SDD**        | Estándar                                           |
| **Última revisión** | 2026-09-08                                         |

## Problema y evidencia

INTAKE-1 separa correctamente las solicitudes web pendientes del inventario, pero cuando una
solicitud se admite su vehículo vuelve a mostrarse junto a las altas internas sin una señal de
origen. La consulta de `/vehiculos` exige hoy `intakeStatus=ADMITIDO`, pero sus filtros no aceptan
`canal` y las tarjetas no seleccionan ese campo del vendedor.

## Resultado esperado

En Inventario se puede elegir `Todos`, `Alta interna` o `Web admitida`, y cada tarjeta muestra la
misma etiqueta de origen. El valor por defecto conserva todos los vehículos admitidos actuales.

## Reglas e invariantes

- `CN` se presenta como `Alta interna`; `PRO`, como `Web admitida`.
- El filtro de origen se combina siempre con `SellerLead.intakeStatus=ADMITIDO`.
- Un valor de URL desconocido se ignora y nunca amplía el conjunto operativo.
- El origen es informativo: no modifica canal, admisión, estado ni ninguna entidad.

## Fuera de alcance

- Cambiar admisión, formularios, writers, permisos, esquema o migraciones.
- Mostrar solicitudes pendientes o rechazadas en Inventario.
- Redefinir stock físico o KPIs.
- Commit, push, PR, merge o despliegue sin autorización posterior.

## Decisiones

| Decisión        | Alternativas                        | Resolución y motivo                                       |
| --------------- | ----------------------------------- | --------------------------------------------------------- |
| Fuente canónica | Inferir por fecha, Activity o canal | `SellerLead.canal`; ya distingue web de captación interna |
| Presentación    | Solo filtro, solo etiqueta, ambos   | Ambos: descubrimiento rápido y segmentación operativa     |
| Estado inicial  | Recordar filtro o mostrar todos     | Todos; conserva la conducta y evita ocultar inventario    |

## Plan técnico

1. Centralizar etiquetas y construcción del `where` de vehículo admitido por origen.
2. Añadir el parámetro `origin` y el selector en los filtros de `/vehiculos`.
3. Seleccionar `sellerLead.canal` y mostrar una etiqueta en cada tarjeta.
4. Probar origen válido, valor desconocido y preservación del gate de admisión.

### Impacto

- **Código y consumidores:** `/vehiculos`, su componente de filtros y `lib/seller-intake`.
- **Datos/migraciones:** ninguno; consulta campos existentes.
- **Permisos/seguridad:** sin cambios; se conserva `requireCanViewVehiculos`.
- **Concurrencia/idempotencia:** N/A; solo lectura.
- **Integraciones/efectos externos:** ninguno.
- **Observabilidad/KPIs:** sin cambio de métricas; smoke visual proporcional.

## Criterios de aceptación

- [x] Sin filtro aparecen todos los vehículos admitidos y ninguno pendiente/rechazado.
- [x] `Alta interna` limita a `canal=CN` y `Web admitida` a `canal=PRO`.
- [x] Un origen inválido conserva solo el gate de admisión.
- [x] Cada tarjeta muestra la etiqueta coherente con su canal.
- [x] Limpiar filtros elimina también el origen.

## Verificación

| Criterio                | Evidencia prevista                       | Resultado                      |
| ----------------------- | ---------------------------------------- | ------------------------------ |
| Query segura por origen | 11 unitarios verdes; integración añadida | Integración pendiente de CI    |
| Filtro y etiqueta       | Typecheck, lint y build                  | Verde; smoke pendiente Preview |
| No regresión            | 1.487 tests Vitest                       | Verde                          |
| Gobierno y formato      | `check:sdd`, Prettier, `diff --check`    | Verde                          |

## Rollout, rollback y stop conditions

- **Rollout:** validación local → autorización de commit/PR → CI/Preview → autorización separada de
  merge y producción.
- **Rollback/mitigación:** revertir el cambio de UI/query; no hay datos que recuperar.
- **Detener si:** el filtro puede omitir el gate `ADMITIDO`, el canal no está presente en la query o
  cualquier filtro existente deja de componerse correctamente.
- **Validación post-despliegue:** comparar `Todos` con ambos subconjuntos y revisar etiquetas.

## Revisión adversarial

| Riesgo intentado                         | Mitigación o riesgo pendiente                          |
| ---------------------------------------- | ------------------------------------------------------ |
| `origin=PRO` vuelve a incluir pendientes | helper compone canal dentro del gate `ADMITIDO`        |
| URL arbitraria altera la query           | allowlist estricta de `CN` y `PRO`; el resto se ignora |
| El filtro no se limpia                   | `origin` forma parte de `hasFilters`                   |

## Cierre

- **Commit:** pendiente.
- **PR:** pendiente.
- **CI:** pendiente.
- **Deployment:** no autorizado.
- **Validación:** local verde; integración PostgreSQL y smoke de Preview pendientes del siguiente
  gate.
- **Deuda restante:** ninguna conocida dentro del alcance.
