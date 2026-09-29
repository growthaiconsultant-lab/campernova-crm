# SEARCH-3 — Buscar vehículos y vendedores por matrícula

| Campo               | Valor                                   |
| ------------------- | --------------------------------------- |
| **Estado**          | IMPLEMENTED                             |
| **Owner**           | Engineering                             |
| **Ticket**          | SEARCH-3; reporte del usuario del 29/09 |
| **Rama / PR**       | codex/search-3-vehicle-plate; sin PR    |
| **Categorías**      | C0, C1                                  |
| **Riesgo**          | Medio                                   |
| **Ruta SDD**        | Estándar                                |
| **Última revisión** | 2026-09-29                              |

## Problema y evidencia

Main `72dbc47`: inventario busca sólo marca/modelo y vendedores busca contacto/marca/modelo,
sin matrícula. El buscador global incluye plate pero sólo como substring literal; `1234ABC`
no coincide con `1234-ABC`. Las escrituras existentes conservan separadores. El control de
respuestas fuera de orden de SEARCH-2 está en main y se conserva.
Esto prueba defectos del código, no que todas las incidencias reportadas tengan la misma causa.

## Resultado esperado

Buscar por matrícula completa o parcial en global, inventario y vendedores, sin distinguir
mayúsculas. Aceptar formatos habituales compactos o con espacio/guion entre bloques de letras
y números, sin cambiar los valores guardados.

## Reglas e invariantes

- Conservar autenticación y autorización ADMIN/AGENTE antes de consultar.
- Conservar filtros de admisión, origen, vista, archivado, estado, paginación y destinos.
- Mantener nombre, email, teléfono, marca y modelo; no registrar consultas ni PII.
- SQL de Prisma parametrizado; escapar comodines LIKE en las variantes de matrícula.
- Variantes acotadas (hasta cuatro bloques, máximo 27 combinaciones más entrada literal).
  No usar `%` entre caracteres, escanear datos en memoria ni cambiar schema.

## Fuera de alcance

Permisos nuevos, normalización masiva de datos, búsqueda difusa, cualquier formato internacional
arbitrario, cambios de Supabase, OBS-1/E2E-1, merge y despliegue de producción.
El usuario autorizó commit, push, PR, CI y Vercel Preview el 29/09/2026; no autorizó merge ni producción.

## Decisiones

| Decisión            | Alternativas                                                  | Resolución y motivo                                                                                           |
| ------------------- | ------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------- |
| Formatos habituales | Migración de columna normalizada; regex SQL; variantes Prisma | Variantes acotadas y sin migración para reparar formatos habituales manteniendo count/paginación en servidor. |
| URLs inventario     | Renombrar brand a q; mantener brand                           | Mantener parámetro brand para enlaces existentes; ampliar descripción del campo.                              |

## Plan técnico

1. Tests de regresión de páginas y action antes de implementar.
2. Helper de condiciones matrícula compartido; integrar en tres buscadores y actualizar etiquetas.
3. Unitarios, regresiones existentes, tipos/lint, integración PostgreSQL real y smoke Preview.
4. Registrar bloqueos reales; no usar staging/producción como sustituto de DB efímera.

### Impacto

- **Código y consumidores:** búsqueda global, vendedores, inventario; helper puro Prisma.
- **Datos/migraciones:** ninguno; lecturas adicionales del campo ya expuesto en CRM.
- **Permisos/seguridad:** guard existente intacto, sin nueva audiencia ni datos de respuesta.
- **Concurrencia/idempotencia:** sólo lecturas; conservar secuencia cliente SEARCH-2.
- **Integraciones/efectos externos:** ninguno.
- **Observabilidad/KPIs:** sin logs ni eventos nuevos.

## Criterios de aceptación

- [x] Matrícula incluida en las tres consultas; count y listado usan mismo filtro (tests unitarios).
- [ ] Compacta, espacio/guion entre bloques, minúsculas y fragmentos; nulos sin error.
- [x] Coincidencias de vehículo no eliminan filtros comerciales ni permisos (tests unitarios).
- [x] Pruebas existentes de destinos y respuestas obsoletas conservadas.

## Verificación

| Criterio                 | Evidencia prevista                              | Resultado                                                                                                  |
| ------------------------ | ----------------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| Regresión                | Tests de páginas/action antes y después         | RED: 3 fallos/13 pases; GREEN: 23 tests focalizados; suite completa: 121 archivos/1516 tests pasan         |
| Variantes y casos límite | Unitarios del helper                            | Pasan; integración real de los formatos pendiente                                                          |
| Persistencia de queries  | PostgreSQL efímero con fixtures sintéticas      | Intentada: 0 tests ejecutados; guard bloquea por ausencia de TEST_DATABASE_URL. Docker/psql no disponibles |
| Estática                 | typecheck, lint, check:sdd, diff check          | Pasan; tipos sin caché incremental y lint sin caché                                                        |
| Funcional                | Preview con matrícula conocida y acceso a ficha | Pendiente de publicación autorizada                                                                        |

## Rollout, rollback y stop conditions

- **Rollout:** implementar local → aprobación publicación → CI/integración/Preview → aprobación producción.
- **Rollback/mitigación:** revert de código; datos sin cambios.
- **Detener si:** cambia authz/admisión, aparece acceso a remoto en tests o falla integración.
- **Validación post-despliegue:** tres formatos de la misma matrícula, otra matrícula diferente,
  filtros activos y apertura de la ficha correcta. No basta compilar.

## Revisión adversarial

| Riesgo intentado                         | Mitigación o riesgo pendiente                                            |
| ---------------------------------------- | ------------------------------------------------------------------------ |
| Consulta genera miles de variantes       | Límite de longitud y cuatro bloques; fallback literal fuera del formato. |
| Guion se interpreta como cualquier texto | Variantes literales; no comodines de relleno.                            |
| OR de matrícula evita admisión           | Añadir dentro del OR textual, mantener AND exterior y guards.            |
| Tests con mocks simulan PostgreSQL       | Añadir integración real; no contar como ejecutada sin DB.                |

## Cierre

- **Commit / PR / CI / Deployment:** no ejecutados para SEARCH-3.
- **Validación:** unitarios, tipos, lint y SDD verificados localmente. Integración PostgreSQL preparada pero no ejecutada: el guard impidió alcanzar cualquier base de datos. Build, CI y smoke Preview no ejecutados; requieren completar los siguientes gates. No se han consultado ni modificado datos remotos.
- **Incidencias locales resueltas:** errores de escritura de caché por permisos del worktree, solventados mediante ejecución autorizada sin caché; error TypeScript de primer bloque posiblemente indefinido, corregido con guard explícito y tests focalizados repetidos.
- **Deuda restante:** formatos no habituales requieren evaluación independiente, sin prometer cobertura universal.
