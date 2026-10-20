# COM-8 — Compradores bajo pedido

| Campo           | Valor                                                                    |
| --------------- | ------------------------------------------------------------------------ |
| **Estado**      | IMPLEMENTED                                                              |
| Owner           | Engineering                                                              |
| Ticket          | Petición del usuario del 2026-10-20: añadir «Bajo pedido» en Compradores |
| Rama / PR       | codex/compradores-bajo-pedido; sin PR                                    |
| Categorías      | C0, C1, C2, C3, C4, C9                                                   |
| Riesgo          | Alto por expansión de enum persistido                                    |
| Ruta SDD        | Reforzada                                                                |
| Última revisión | 2026-10-20                                                               |

## Problema y evidencia

Main d8bcc77 tiene siete estados de comprador y no permite marcar «Bajo pedido».
El usuario ha especificado Compradores. Hay cambios ajenos de WhatsApp en el checkout
original; COM-8 se implementa en un worktree separado basado en origin/main.

## Resultado esperado

«Bajo pedido» seleccionable y corregible en ficha, edición rápida y formulario;
filtrable en el listado y visible en pipeline. El comprador permanece activo.

## Reglas e invariantes

- Nuevo valor BAJO_PEDIDO sin backfill ni cambio de defaults.
- Conserva responsable, preferencias, temperatura y próxima acción almacenada.
- Mantiene elegibilidad para matching y las reglas de archivado existentes.
- No representa oferta, reserva o venta. Clasificación conservadora en etapa Lead,
  sin acreditar contacto ni cualificación a partir de esta etiqueta.
- Mismos permisos ADMIN/AGENTE, CAS y auditoría CAMBIO_ESTADO existentes.
- CERRADO conserva el guard de entrega completada.

## Fuera de alcance

Estados de vendedores o vehículos, automatizaciones, nuevas notificaciones y cambios ajenos.
El usuario autorizó el 2026-10-20 subir el cambio, validar la migración y publicarlo,
incluida la actualización de la base de datos de producción.

## Decisiones

| Decisión     | Alternativas                          | Resolución                                            |
| ------------ | ------------------------------------- | ----------------------------------------------------- |
| Persistencia | Nota / estado                         | Estado, según petición                                |
| Actividad    | Terminal / activo                     | Activo, sigue buscando vehículo                       |
| Funnel       | Acreditar cualificación / conservador | Lead; no inventar avances comerciales                 |
| Rollout      | Código primero / expansión primero    | DB primero, después lectores y escritores compatibles |

## Plan técnico

1. Añadir enum y migración aditiva; regenerar Prisma.
2. Actualizar catálogo compartido, colores, sugerencia y mapa KPI.
3. Verificar acciones, matching, filtros, persistencia y catálogo CI.

### Impacto

- Código y consumidores: opciones y validación derivadas del catálogo y enum.
- Datos: +1 valor enum; sin tablas, columnas, FKs, RLS ni filas modificadas.
- Seguridad: mismos roles y límites.
- Concurrencia: se conserva el writer con CAS y Activity transaccional.
- Efectos: revalidación y recálculo de matching existentes.
- KPIs: activo en etapa Lead; sin nuevos eventos ni PII en telemetría.

## Criterios de aceptación

- [x] Elegir y corregir Bajo pedido con auditoría (unitarios); persistencia real pendiente.
- [x] Filtrar el estado y mantener pipeline/matching/KPIs activos (render, unitarios e inspección).
- [x] Migración aditiva, cliente generado y verificaciones offline coherentes.
- [x] Validación proporcional local; distinguir checks pendientes de CI y producción.

## Verificación

| Check                                                        | Resultado                                                                                        |
| ------------------------------------------------------------ | ------------------------------------------------------------------------------------------------ |
| `pnpm test`                                                  | 142 archivos / 1.839 tests superados antes de añadir tests de render                             |
| Tests adicionales `bajo-pedido-ui.test.ts`                   | 3 tests superados: opción desde Nuevo, selección persistida y filtro URL                         |
| `pnpm typecheck` / `pnpm lint`                               | Superados                                                                                        |
| `prisma validate` / `prisma generate`                        | Superados, Prisma 6.19.3                                                                         |
| `prisma migrate diff` offline contra main                    | Exclusivamente `ALTER TYPE "BuyerLeadStatus" ADD VALUE 'BAJO_PEDIDO'`                            |
| `check:migration-history` / `check:sdd` / `git diff --check` | Superados; 20 migraciones, 30 briefs                                                             |
| `next build --experimental-build-mode compile`               | Superado; sin credenciales remotas ni generación de páginas con datos                            |
| PostgreSQL real                                              | Intentado y bloqueado por guard: falta `TEST_DATABASE_URL`; cero tests y cero conexiones remotas |
| Replay, parity, RLS, CI, E2E autenticado                     | Pendientes; no se declaran verdes                                                                |

La revisión del diff corrigió también el listado exacto de migraciones esperado por CI.
Avisos de compilación existentes de Sentry, Browserslist y caché Webpack; sin errores.

## Rollout, rollback y stop conditions

- Rollout: tras autorización de publicación, checks de PostgreSQL y CI, verificar
  identidad/historial de staging y producción; expandir DB antes de desplegar.
- Rollback: conservar enum expandido; no volver a cliente antiguo si existen filas
  BAJO_PEDIDO. No remapear ni borrar datos sin acuerdo.
- Detener ante migraciones ajenas, destino no verificado o incompatibilidad de lectores.
- Post-deploy: comprobar selector/filtro autenticado; no editar compradores reales para pruebas.

## Revisión adversarial

| Riesgo                               | Mitigación                                        |
| ------------------------------------ | ------------------------------------------------- |
| Comprador desaparece de activos      | Catálogo activo compartido y test de query        |
| Cambiar estado omite guard de cierre | Writer existente, tests existentes                |
| Cliente escribe antes de migración   | Expandir primero y guard de migraciones del build |
| Cambios ajenos incluidos             | Worktree separado desde origin/main               |

## Cierre

Implementado y validado localmente dentro de los límites anteriores.
Sin commit, push, PR, CI ni deployment. El worktree original conserva sus cambios.
La autorización recibida comprende publicar la rama/PR, ejecutar CI de PostgreSQL y,
una vez verde, aplicar la migración y desplegar con comprobación de entorno.

## Operación autorizada

Vercel conserva las credenciales sensibles dentro del build. El operador explícito
`scripts/deploy-buyer-bajo-pedido-migration.ts` permite únicamente la migración COM-8
pendiente con historial/checksums y enum previo exactos. Reutiliza el guard de identidad
de COM-7; predeterminado sólo lectura. Aplicación por nombre exacto, postflight y
segundo intento sin escritura. Los despliegues de operador no reciben dominios.
