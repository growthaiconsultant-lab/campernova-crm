# COM-2 — Consultar el origen desde el listado de compradores

| Campo               | Valor                                         |
| ------------------- | --------------------------------------------- |
| **Estado**          | IMPLEMENTED                                   |
| **Owner**           | Engineering / Joel                            |
| **Ticket**          | COM-2 — petición directa de columna de origen |
| **Rama / PR**       | codex/buyer-source-column / pendiente         |
| **Categorías**      | C0, C1                                        |
| **Riesgo**          | Bajo; presentación de un dato existente       |
| **Ruta SDD**        | Estándar                                      |
| **Última revisión** | 2026-10-07                                    |

## Problema y evidencia

La pantalla de compradores permite filtrar por origen, pero sus filas no lo muestran. Verificado en main e378c14 y en la captura del usuario. La query existente ya incluye BuyerLead.source.

## Resultado esperado

Columna Origen después de Comprador, con la misma etiqueta de la ficha. En móvil, mostrar Origen en cada tarjeta.

## Reglas e invariantes

- Reutilizar buyerSourceLabel de COM-1, incluidos null y fuentes antiguas.
- Sin especificar cuando no hay origen; no inferir ni modificar históricos.
- Conservar consultas, filtros, paginación, enlaces de ficha y permisos actuales.

## Fuera de alcance

Edición desde tabla, ordenación nueva, métricas, migraciones y cambios de datos.

## Decisiones

Colocar Origen junto al comprador para localizarlo sin abrir la ficha. Reutilizar el helper canónico para evitar etiquetas divergentes.

## Plan técnico

1. Añadir columna y línea móvil en compradores/page.tsx.
2. Typecheck, lint, tests existentes del catálogo y comprobación visual con datos sintéticos.
3. Publicar por PR y CI como continuación del origen de captación, previamente autorizado en esta conversación; smoke de lectura.

### Impacto

Sólo presentación en Server Component. Sin cambios de queries, schema, permisos, concurrencia, efectos externos, instrumentación o KPIs.

## Criterios de aceptación

- [x] Columna Origen visible después de Comprador con etiquetas legibles.
- [x] Null y fuentes antiguas coinciden con la ficha.
- [x] Origen visible en móvil, conservando enlace de ficha y demás datos.
- [x] Typecheck, lint, catálogo y verificación visual pasan.

## Verificación

PASS local: tsc --noEmit, ESLint de compradores/page.tsx, Vitest buyer-source (17 tests), check-sdd (16 briefs) y git diff --check. Navegador sobre el Server Component real con lectores db/auth sustituidos por datos sintéticos: tabla de escritorio y tarjetas a 390 px; plataformas, null y legacy correctos. Sin acceso a base de datos ni escritura remota. No es E2E autenticado. CI/Preview y producción se registrarán en la PR.

## Rollout, rollback y stop conditions

- Rollout: PR corta sobre main, CI y Preview antes de squash; mismo despliegue Vercel, sin variables ni migraciones.
- Rollback: revertir esta presentación; datos de origen intactos.
- Detener si: se ocultan datos de la tabla o cambia una consulta/permiso.
- Post-despliegue: comprobar cabecera y etiquetas en compradores, sólo lectura.

## Revisión adversarial

Texto largo puede ocupar más espacio: permitir ajuste de línea y conservar scroll horizontal existente. Histórico desconocido usa fallback existente; null conserva Sin especificar. No se crean registros reales para verificar.

## Cierre

Evidencia local completada. Commit, PR, CI y deployment definitivos se registrarán en la PR; no confundir implementación con publicación.
