# INTAKE-2 — Distinguir el origen en el inventario de vehículos

| Campo               | Valor                                         |
| ------------------- | --------------------------------------------- |
| **Estado**          | IMPLEMENTED                                   |
| **Owner**           | Product / Engineering                         |
| **Ticket**          | INTAKE-2                                      |
| **Rama / PR**       | `codex/intake-2-vehicle-origin-filter` / #179 |
| **Categorías**      | C0, C1                                        |
| **Riesgo**          | Bajo                                          |
| **Ruta SDD**        | Estándar                                      |
| **Última revisión** | 2026-09-08                                    |

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

| Criterio                | Evidencia prevista                     | Resultado   |
| ----------------------- | -------------------------------------- | ----------- |
| Query segura por origen | 11 unitarios + integración PostgreSQL  | Verde en CI |
| Filtro y etiqueta       | Typecheck, lint, build y smoke Preview | Verde       |
| No regresión            | 1.487 tests Vitest                     | Verde       |
| Gobierno y formato      | `check:sdd`, Prettier, `diff --check`  | Verde       |

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

- **Commit:** `3e13d70`.
- **PR:** #179, abierta y sin fusionar.
- **CI:** PASS — quality, integration, migration-replay y supabase-storage.
- **Deployment:** Vercel Preview PASS; producción no autorizada ni modificada.
- **Validación:** smoke autenticado PASS el 2026-09-08 sobre el alias estable del Preview. `Todos`
  mostró 3 vehículos internos; `Alta interna`, los mismos 3; `Web admitida`, 0 con estado vacío;
  limpiar filtros restauró los 3. Staging no contiene actualmente un vehículo web admitido, por lo
  que el caso positivo PRO queda cubierto por la integración PostgreSQL verde de CI.
- **Precondición operativa del smoke:** se activó SMTP dedicado de Resend exclusivamente en Supabase
  staging con una clave restringida a envío y al dominio `campersnova.com`; el límite quedó en 30
  emails/h. No se registraron secretos en Git ni se modificó producción.
- **Deuda restante:** ninguna conocida dentro del alcance.
