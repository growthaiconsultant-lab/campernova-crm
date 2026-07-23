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
2. **Hoy existen exactamente 6 migraciones:** `000000000000_squashed_migrations` (baseline) +
   `20260712000000_add_versioned_document_model` (PR5B1) +
   `20260719120000_add_lead_archiving_model` (B1 · archivado) +
   `20260720000000_add_calendar_event_commitment` (I0) +
   `20260721100000_add_delivery_offer_link_expand` (I3C1A · expand) +
   `20260721200000_make_delivery_offer_link_required` (I3C1B · contract). El job CI
   `migration-replay` lo verifica por nombre y conteo (fuente autoritativa:
   [`.github/workflows/ci.yml`](../../.github/workflows/ci.yml)).
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

## Conteos de catálogo (vigente en `main`, tras I3C1B)

> **Fuente autoritativa y siempre vigente:** el paso _Catalog verifications_ del job
> `migration-replay` en [`.github/workflows/ci.yml`](../../.github/workflows/ci.yml) (falla si el
> catálogo no coincide). Esta tabla es un reflejo; ante discrepancia, **manda CI**.

| Métrica                | Valor            |
| ---------------------- | ---------------- |
| Tablas (`public`)      | **31**           |
| Columnas               | **441**          |
| Enums                  | **51**           |
| Valores de enum        | **269**          |
| Claves foráneas        | **68**           |
| Índices                | **115**          |
| Tablas sin RLS         | **0**            |
| Tablas con `FORCE RLS` | **0**            |
| Políticas en `public`  | **0** (deny-all) |

> Deltas históricos: baseline sola 30/412/48/255/60/101; tras PR5B1 31/431/49/258/65/111 (ver
> [`../migration-history-baseline.md`](../migration-history-baseline.md)). El valor **vigente** (tras
> commitment + I3C1A/B) es el de esta tabla; los conteos por migración están comentados en `ci.yml`.

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

## Guard de despliegue: Prisma ↔ base de datos (fail-closed en producción)

**Incidente que evita (2026-07-15):** Vercel desplegó un cliente Prisma que dependía de
`20260712000000_add_versioned_document_model`, aún **no aplicada** en la base de datos de
producción. El cliente seleccionaba `vehicle_documents.current_version_id` → PostgreSQL respondía
`P2022` → reventaban las fichas de vendedor/vehículo (`/vendedores/[id]`) y de entrega
(`/entregas/[id]`). La lista `/vendedores` no consulta documentos; el mensaje de error procedía del
`error.tsx` compartido del segmento.

**Mecanismo:** `scripts/check-remote-migrations.ts` (lógica pura en
[`../../lib/deploy/migration-guard.ts`](../../lib/deploy/migration-guard.ts)) se integra en el
`build` de Vercel:

```text
install → prisma generate → check-remote-migrations (solo lectura) → next build → deployment
```

- **Solo lectura.** Ejecuta un único `SELECT` sobre `_prisma_migrations`. No ejecuta DDL/DML, ni
  migraciones, ni backfills, ni escribe en `_prisma_migrations`. **No** añade `migrate deploy` al build.
- **Solo bloquea producción.** Se conecta a la base remota únicamente cuando `VERCEL_ENV=production`.
  En **Preview**, build local y CI ordinaria hace **SKIP** (no se conecta a producción, no bloquea
  por falta de credenciales). Los Previews **no** ejecutan migraciones ni consultan producción.
- **Identidad de entorno OBLIGATORIA.** Cuando el guard está activo (Production o modo manual),
  `REMOTE_MIGRATION_GUARD_EXPECT_URL_CONTAINS` es **obligatorio**: si falta, o si la URL resuelta no
  lo contiene, el guard **falla antes de abrir conexión** (exit 2). Así, una `DATABASE_URL`/`DIRECT_URL`
  de staging mal configurada en Production **no puede** validar la base equivocada.
- **Fail-closed.** En producción el build **falla** (exit ≠ 0, el deployment anterior se conserva y
  no es sustituido) si: falta `DIRECT_URL`/`DATABASE_URL`; **falta el marcador de identidad** o no
  coincide con la URL; la base no responde; no existe `_prisma_migrations`; o alguna migración local
  está **ausente**, **sin finalizar**, **revertida**, con **intento fallido no resuelto**, o con
  **checksum distinto**.
- **Errores sanitizados.** Ante un fallo de conexión/consulta, el guard imprime únicamente un código
  seguro (`code=P#### | TIMEOUT | UNKNOWN`) + el entorno. **Nunca** imprime host, puerto, usuario,
  contraseña, URL ni el mensaje bruto de Prisma.
- **Compatible con el historial post-squash.** Exige que toda migración **presente en el repo** esté
  aplicada y con checksum coincidente; **permite** migraciones remotas históricas adicionales que ya
  no existen como carpeta local. El `checksum` almacenado por Prisma es el **SHA-256 del contenido de
  `migration.sql`** (verificado en staging y producción), por eso la comparación es directa.
- **Sin secretos en logs.** Nunca imprime URLs, credenciales, hosts ni parámetros de conexión: solo
  nombre de migración, tipo de inconsistencia, entorno, commit y conteos.

**Comprobación manual (staging/producción), solo lectura:**

```bash
# Declara el entorno y un marcador inequívoco (p. ej. el project ref) que la URL debe contener.
REMOTE_MIGRATION_GUARD_ENV=staging \
REMOTE_MIGRATION_GUARD_DATABASE_URL="<url staging>" \
REMOTE_MIGRATION_GUARD_EXPECT_URL_CONTAINS="<ref-staging>" \
  pnpm check:remote-migrations
```

Exit `0` = todo coincide · `1` = migración pendiente/incompatible · `2` = error de configuración o
conexión. El comando **no** adivina el entorno ni edita ficheros `.env`.

**Requisito operativo:** en Vercel **Production** deben estar disponibles, en el **paso de build**:
(1) `DIRECT_URL` (o `REMOTE_MIGRATION_GUARD_DATABASE_URL`; si solo hay `DATABASE_URL`, el guard usa
ese fallback); y (2) **`REMOTE_MIGRATION_GUARD_EXPECT_URL_CONTAINS` = project ref de producción**
(obligatorio: sin él el build falla antes de conectar). Configúralo **solo en el scope Production**
— **no** en Preview ni Development (Preview hace SKIP y no debe recibir el marcador). Si algo falta,
el guard falla de forma segura y bloquea el deploy (el deployment anterior sigue sirviendo).

## Secuencia obligatoria para cambios con migración

```text
Migración preparada y validada localmente
→ aplicada en staging → staging validado
→ aplicada en producción → producción validada
→ el código dependiente puede desplegarse
```

El guard es la red de seguridad de este orden: si el código llega a producción **antes** que su
migración, el build queda bloqueado en lugar de servir una versión incompatible. Los cambios **no
compatibles hacia atrás** siguen la estrategia **expand → backfill → observar → contraer** en PRs
separados (regla 7); el guard no sustituye ese diseño ni automatiza nada destructivo.

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

---

## Expand–contract, preflight y recuperación de fallos (runbook operativo)

Runbook **reusable** para cambios de nullability/restricción sobre columnas con datos. La ejecución
concreta de I3C1A/I3C1B queda en su historial ([`docs/Ofertas-Reservas-Plan.md`](../Ofertas-Reservas-Plan.md),
[`docs/roadmap/i3-status.md`](../roadmap/i3-status.md)); aquí queda el **procedimiento estable**.

### 1. Patrón expand–contract

```
expand schema (aditivo, columna nullable) → desplegar código compatible
→ contract schema (SET NOT NULL) → desplegar código que exige la restricción
```

- La columna es **nullable solo durante el rollout**; el código nuevo persiste siempre el valor.
- **Backfill solo si hace falta y está autorizado.** I3C1 **no** necesitó backfill porque había
  **cero filas** afectadas (cero Deliveries): el contract fue seguro sin tocar datos.
- **Compatibilidad de rollback de código** debe verificarse antes de contraer (el cliente antiguo
  debe seguir funcionando contra el schema expandido).

### 2. Identificación inequívoca del entorno (obligatoria antes de conectar)

- Declarar entorno + **marcador de proyecto** (`project ref`) que la URL efectiva **debe contener**;
  fail-closed si no coincide (ver «Guard de despliegue»).
- Comprobar los **valores efectivos** de `DATABASE_URL`/`DIRECT_URL` (los exportados prevalecen sobre
  `.env`; recuerda que `.env` apunta a **producción**).
- Nunca imprimir credenciales, URLs completas ni tokens. Usar **placeholders** en la documentación.

### 3. Preflight (solo lectura)

Antes de aplicar un contract, verificar **datos** y **estructura** del schema expandido:
cero filas que violarían la restricción, cero huérfanas, coherencia referencial, cero migraciones
fallidas activas, y la estructura esperada (columna/tipo/FK/índices, fase previa aplicada, fase
contract aún no aplicada). Para el caso Delivery↔Offer existe un preflight versionado y testeado:

```bash
# placeholders — nunca secretos en claro
CHECK_DELIVERY_OFFER_NULLS=1 CHECK_DELIVERY_OFFER_EXPECT_NULLABLE=1 \
REMOTE_MIGRATION_GUARD_ENV=<staging|production> \
REMOTE_MIGRATION_GUARD_EXPECT_URL_CONTAINS=<project-ref> \
pnpm check:delivery-offer-nulls   # exit 0 = seguro aplicar
```

(`EXPECT_NULLABLE=0` = **postflight**: espera la restricción ya aplicada.) El helper es **read-only**;
no repara ni hace backfill.

### 4. Orden de aplicación

```
preflight → prisma migrate deploy → inspección de resultado → postflight
→ guard (check:remote-migrations) → merge → deployment
```

El orden puede variar por compatibilidad (a veces la migración remota va **antes** del merge para que
el guard del build no bloquee el deploy), pero **cada variación debe estar auditada y autorizada**.

### 5. Failure mode real de un contract sobre datos que lo violan

Evidencia estable (probada con `prisma migrate deploy` real, ver
[`docs/quality/delivery-test-matrix.md`](../quality/delivery-test-matrix.md)):

- PostgreSQL **rechaza** el `SET NOT NULL` si existe una fila que lo viola;
- **no** deja el DDL aplicado a medias (la columna sigue como antes);
- Prisma deja un **intento fallido activo** en `_prisma_migrations`:
  `finished_at IS NULL`, `rolled_back_at IS NULL`, `applied_steps_count = 0`, con `logs`;
- el **siguiente** `migrate deploy` **falla con `P3009`** (found failed migration) hasta intervención.

### 6. Recuperación autorizada (nunca automática)

1. **Detener** despliegues.
2. Inspeccionar (solo lectura) datos, schema y la fila de `_prisma_migrations`.
3. Obtener **autorización explícita**.
4. Reconciliar el dato **solo** con un plan autorizado (nunca backfill silencioso).
5. Marcar la migración fallida como revertida:
   ```bash
   prisma migrate resolve --rolled-back <migration_name>
   ```
6. Re-ejecutar el **preflight**.
7. Reintentar **solo** con nueva autorización.

Aclaraciones:

- `migrate resolve` **no** arregla datos ni schema; solo actualiza `_prisma_migrations`.
- `--rolled-back` (recuperación de un intento fallido) **no** es `--applied` (marcar baseline como
  aplicada); no confundirlos.
- Nunca ejecutar `resolve` sin investigar el estado real.

### 7. Rollback (distinguir tres niveles)

- **Código:** revertir el deploy; el cliente anterior debe seguir siendo compatible con el schema.
- **Schema:** ejemplo histórico seguro y **autorizado** (no automático): `ALTER TABLE "deliveries"
ALTER COLUMN "offer_id" DROP NOT NULL;` — no elimina datos, FK ni índices.
- **Datos:** requiere plan y autorización propios; jamás como efecto colateral.

### 8. Postflight (solo lectura)

Historial + checksums, catálogo (los conteos **autoritativos** los fija CI en
`.github/workflows/ci.yml`), nullability, FK, índices, datos, **comparación entre entornos** (el
cambio aparece solo donde se aplicó) y observabilidad inmediata.

### 9. Seguridad

No incluir en documentación ni logs: credenciales, URLs completas, passwords, tokens, comandos
destructivos sin guardas, ni instrucciones que ignoren un `P3009`.
