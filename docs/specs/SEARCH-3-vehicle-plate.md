# SEARCH-3 — Buscar vehículos y vendedores por matrícula

| Campo               | Valor                                                                                                      |
| ------------------- | ---------------------------------------------------------------------------------------------------------- |
| **Estado**          | DEPLOYED                                                                                                   |
| **Owner**           | Engineering                                                                                                |
| **Ticket**          | SEARCH-3; reporte del usuario del 29/09                                                                    |
| **Rama / PR**       | codex/search-3-vehicle-plate; [PR #184](https://github.com/growthaiconsultant-lab/campernova-crm/pull/184) |
| **Categorías**      | C0, C1                                                                                                     |
| **Riesgo**          | Medio                                                                                                      |
| **Ruta SDD**        | Estándar                                                                                                   |
| **Última revisión** | 2026-09-29                                                                                                 |

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
- [x] Compacta, espacio/guion entre bloques, minúsculas y fragmentos; nulos sin error (PostgreSQL real en CI).
- [x] Coincidencias de vehículo no eliminan filtros comerciales ni permisos (tests unitarios).
- [x] Pruebas existentes de destinos y respuestas obsoletas conservadas.

## Verificación

| Criterio                 | Evidencia prevista                              | Resultado                                                                                                                                          |
| ------------------------ | ----------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| Regresión                | Tests de páginas/action antes y después         | RED: 3 fallos/13 pases; GREEN: 23 tests focalizados; suite completa: 121 archivos/1516 tests pasan                                                 |
| Variantes y casos límite | Unitarios del helper                            | Pasan; 5 tests de integración nuevos también pasan                                                                                                 |
| Persistencia de queries  | PostgreSQL efímero con fixtures sintéticas      | Local bloqueada por guard (sin TEST_DATABASE_URL). CI: 34 archivos / 338 tests PASS, incluidos los 5 de SEARCH-3                                   |
| Estática                 | typecheck, lint, check:sdd, diff check          | Pasan; tipos sin caché incremental y lint sin caché                                                                                                |
| Funcional                | Preview con matrícula conocida y acceso a ficha | Build Preview PASS; login comprobado en Chrome. Smoke autenticado pendiente: nueva URL sin sesión y verificación completa de aislamiento pendiente |

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

- **Entorno del estado DEPLOYED:** únicamente Preview; NO producción.
- **Código:** `a96ad085e5f03200416a78faca755cc94a29abfc`, publicado en PR #184; sin merge.
- **CI:** [run 36588339158](https://github.com/growthaiconsultant-lab/campernova-crm/actions/runs/36588339158) PASS: quality, integration, migration-replay y supabase-storage. Integración: 338 tests; nuevo archivo vehicle-plate-search: 5 PASS.
- **Deployment:** [Vercel Preview 6Ku4nh5Zp9MntpHCrD6CGqKZCmcP](https://vercel.com/growthaiconsultant-8035s-projects/campernova-crm/6Ku4nh5Zp9MntpHCrD6CGqKZCmcP), código `a96ad08`, READY. [Preview de rama](https://campernova-crm-git-cod-8314a8-growthaiconsultant-8035s-projects.vercel.app/login).
- **Validación:** unitarios, tipos, lint y SDD locales; PostgreSQL, replay y Storage efímeros en CI; build Preview. Chrome muestra login sin error; no hay sesión autenticada. E2E/smoke autenticado NO ejecutados ni declarados verdes.
- **Preflight Preview:** panel Vercel confirma ámbito Preview separado para DATABASE_URL, DIRECT_URL y Supabase; sus valores están protegidos y no se extrajeron. No se considera comprobado el destino real de la base de datos sólo por ese ámbito. Antes del smoke con datos, verificar staging `iatuhydsfwoeprpbklod`. No se han creado registros remotos ni modificado configuración o producción.
- **Incidencias locales resueltas:** errores de escritura de caché por permisos del worktree, solventados mediante ejecución autorizada sin caché; error TypeScript de primer bloque posiblemente indefinido, corregido con guard explícito y tests focalizados repetidos.
- **Deuda restante:** formatos no habituales requieren evaluación independiente, sin prometer cobertura universal.
