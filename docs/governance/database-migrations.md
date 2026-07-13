# Gobierno de migraciones de base de datos

| Campo                            | Valor                                                                                                                                                                                              |
| -------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Título**                       | Gobierno de migraciones Prisma / PostgreSQL                                                                                                                                                        |
| **Estado**                       | ACTIVE                                                                                                                                                                                             |
| **Owner**                        | Engineering                                                                                                                                                                                        |
| **Última revisión**              | 2026-07-13                                                                                                                                                                                         |
| **Fuente de verdad relacionada** | Este documento (proceso). Estado de la baseline: [`../migration-history-baseline.md`](../migration-history-baseline.md).                                                                           |
| **Alcance**                      | Esquema `public` de aplicación gestionado por Prisma.                                                                                                                                              |
| **Fuera de alcance**             | Storage (ver [`supabase-storage.md`](supabase-storage.md)); ejecución del rollout documental (ver [`../operations/fase-0-operational-closeout.md`](../operations/fase-0-operational-closeout.md)). |

---

## Reglas

1. **Prisma es la fuente de verdad** del esquema `public` de aplicación (`prisma/schema.prisma` +
   `prisma/migrations/`).
2. **Hoy existen exactamente 2 migraciones:** `000000000000_squashed_migrations` (baseline) +
   `20260712000000_add_versioned_document_model` (PR5B1). El job CI `migration-replay` lo verifica
   por nombre y conteo.
3. **La baseline es inmutable.** No se edita, no se renombra, no se restaura el historial antiguo
   dentro de `prisma/migrations/` (reintroduciría el defecto de orden). El historial previo vive en
   Git (commit `5ce93d6`, retirado del directorio activo).
4. **No se usa `db push` para cambios de producción.** El flujo es `prisma migrate deploy`.
5. **No se modifica una migración ya desplegada.** Un cambio de esquema = una migración nueva.
6. **Las migraciones nuevas son aditivas** siempre que sea posible (`CREATE`, `ALTER ADD`, nuevos
   índices/constraints) — nunca `DROP`/`DELETE` en la misma migración que introduce el cambio.
7. **Los cambios destructivos** siguen expandir → backfill → observar → contraer, en **PRs
   separados**: (a) expandir (aditivo) → (b) backfill de datos → (c) periodo de observación →
   (d) contraer (retirar lo viejo).
8. **CI verifica** (job `migration-replay`, PostgreSQL 17 efímero): orden e invariantes del
   historial, catálogo, paridad de esquema, RLS e idempotencia (ver [`ci-quality-gates.md`](ci-quality-gates.md)).

---

## Conteos de catálogo (estado actual, tras PR5B1)

| Métrica                | Valor            |
| ---------------------- | ---------------- |
| Tablas (`public`)      | **31**           |
| Columnas               | **431**          |
| Enums                  | **49**           |
| Valores de enum        | **258**          |
| Claves foráneas        | **65**           |
| Índices                | **111**          |
| Tablas sin RLS         | **0**            |
| Tablas con `FORCE RLS` | **0**            |
| Políticas en `public`  | **0** (deny-all) |

> El conteo de la **baseline sola** (antes de PR5B1) era 30/412/48/255/60/101; es un dato histórico
> documentado en [`../migration-history-baseline.md`](../migration-history-baseline.md). El valor
> **vigente** es el de esta tabla (baseline + PR5B1).

### Cómo actualizar los conteos de catálogo

Toda migración aditiva futura cambia el catálogo. Al añadir una migración:

1. Aplica la migración en una base efímera (`pnpm test:integration:prepare` o `prisma migrate deploy`).
2. Recalcula los 6 conteos + los 3 de RLS (las mismas consultas del job `migration-replay` en
   [`.github/workflows/ci.yml`](../../.github/workflows/ci.yml), paso _Catalog verifications_).
3. Actualiza los valores esperados (`assert … <n>`) y el bloque de comentario del delta en `ci.yml`.
4. Actualiza **todos** los lugares que reescriben los conteos: esta tabla, la de
   [`../architecture/fase-0-final-state.md`](../architecture/fase-0-final-state.md#52-estado-validado)
   y las de [`ci-quality-gates.md`](ci-quality-gates.md) (pasos de `migration-replay` y «Números de
   referencia»). Esta tabla es la fuente principal; las demás deben coincidir con ella.

---

## Cómo añadir CHECKs manuales o SQL no modelable por Prisma

- Prisma **no modela** RLS, `CHECK` complejos ni políticas. Ese SQL se **añade a mano** al final del
  fichero `migration.sql` de la migración correspondiente (patrón de la baseline con el bloque
  `ENABLE ROW LEVEL SECURITY`, y de PR5B1 con sus 4 `CHECK`).
- Documenta cada bloque manual con un comentario que explique qué garantiza y por qué no lo genera
  Prisma.
- Si el SQL manual afecta a RLS/catálogo, actualiza las aserciones de CI en consecuencia.

## Cómo verificar FKs compuestas

- Las FKs compuestas (p. ej. `(id, currentVersionId) → (rootId, id)` de PR5B1) requieren `@@unique`
  en **ambos** lados (referenciado y definidor). Verifícalo con `prisma validate` y con el conteo de
  FKs del job `migration-replay`.

## Cómo actuar ante drift

- `migration-replay` corre `prisma migrate diff --from-url <db> --to-schema-datamodel prisma/schema.prisma
--exit-code`: si hay drift entre el esquema construido desde migraciones y `schema.prisma`, **falla**.
- Si aparece drift: **no** parchear la base a mano; corregir la migración/el schema en una migración
  nueva y volver a verificar. RLS no cuenta como drift (Prisma no lo modela).

---

## Comandos prohibidos contra remoto sin autorización

- ❌ `prisma migrate deploy`/`db push`/`migrate reset` contra staging o producción sin autorización
  y sin confirmar el `project_ref`.
- ❌ `supabase db push`/`link`/`--linked`/`--project-ref` como parte del flujo de esquema de
  aplicación (Storage tiene su propio gobierno).
- ❌ `UPDATE`/`DELETE` manual sobre `_prisma_migrations`.
- ✅ `prisma migrate resolve --applied <baseline>` es el **único** mecanismo autorizado para marcar
  la baseline como aplicada en un entorno existente (inserta metadatos; no ejecuta DDL ni toca datos)
  — con backup previo y `project_ref` confirmado.

---

## Checklist para una nueva migración

- [ ] `pnpm prisma migrate dev --name <slug>` (timestamp único de 14 dígitos; nunca reutilizar prefijo).
- [ ] La migración es aditiva (o parte de un ciclo expand/contract documentado).
- [ ] SQL manual (RLS/CHECK) reincorporado y comentado si aplica.
- [ ] `pnpm prisma validate` · `pnpm typecheck` · `pnpm lint` · `pnpm test` verdes.
- [ ] `pnpm check:migration-history` verde (sin colisiones de prefijo, nombres válidos, baseline
      presente).
- [ ] Conteos de catálogo recalculados y aserciones de `ci.yml` actualizadas.
- [ ] `migration-replay` verde (reconstrucción desde vacío + idempotencia).
- [ ] Documentación actualizada (esta tabla + estado final si procede).
- [ ] Despliegue: staging primero, verificación, luego producción, con backup y `project_ref`
      confirmado.

## Proceso de revisión y responsabilidades

- **Autor:** prepara la migración y actualiza los conteos + documentación.
- **Engineering (revisión):** verifica aditividad, invariantes de CI y checklist.
- **Operaciones:** ejecuta el despliegue remoto (staging → prod) con backup y `project_ref`
  confirmado, sólo tras CI verde.
