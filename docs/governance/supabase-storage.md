# Gobierno de Supabase Storage

| Campo                            | Valor                                                                                                                                                                                                  |
| -------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Título**                       | Gobierno de buckets y políticas de Supabase Storage                                                                                                                                                    |
| **Estado**                       | ACTIVE                                                                                                                                                                                                 |
| **Owner**                        | Engineering / Security                                                                                                                                                                                 |
| **Última revisión**              | 2026-07-13                                                                                                                                                                                             |
| **Fuente de verdad relacionada** | `supabase/config.toml` + `supabase/migrations/*.sql`. Este documento describe el proceso.                                                                                                              |
| **Alcance**                      | Buckets de Storage, políticas de `storage.objects`, canal de documentos privados.                                                                                                                      |
| **Fuera de alcance**             | Esquema `public` (ver [`database-migrations.md`](database-migrations.md)); ejecución del rollout (ver [`../operations/fase-0-operational-closeout.md`](../operations/fase-0-operational-closeout.md)). |

---

## Fuente de verdad

- **`supabase/config.toml`** — configuración local reproducible del stack de Storage (CI + dev).
- **`supabase/migrations/20260713000000_storage_buckets_and_policies.sql`** — buckets y políticas.
- **`supabase/setup.sql` está DEPRECADO / histórico** (referencia del setup manual que se ejecutó
  una vez en el panel remoto). No ejecutarlo en entornos nuevos; para local/CI usar `supabase start`
  y luego `supabase db reset`.

---

## Buckets

| Bucket              | Público          | Límite | MIME                  | Estado                                                                                             |
| ------------------- | ---------------- | ------ | --------------------- | -------------------------------------------------------------------------------------------------- |
| `vehicle-photos`    | Sí               | 2 MiB  | jpeg/png/webp         | Activo, versionado                                                                                 |
| `vehicle-documents` | **No (privado)** | 10 MiB | jpeg/png/webp/gif/pdf | Activo, versionado, **deny-all**                                                                   |
| `lead-documents`    | No (privado)     | —      | —                     | **Legacy**; presente en remoto; **no** en la config versionada; se reconcilia/retira en el rollout |

## Políticas de `storage.objects`

- **`vehicle-photos`**: políticas acotadas por `bucket_id` (lectura pública + escritura para
  `authenticated`).
- **`vehicle-documents`**: **sin políticas** = deny-all para `anon`/`authenticated`. La
  autorización real vive en Prisma (ver más abajo).
- **`lead-documents`** (legacy): sus políticas remotas no forman parte de la fuente versionada; se
  tratan en el rollout.

---

## Modelo "Opción B" (autorización en Prisma, no en `auth.uid()`)

- La **identidad** se establece vía Supabase Auth (magic link).
- La **autorización** de documentos privados vive en **Prisma** (roles del CRM), **no** en políticas
  RLS de Storage basadas en `auth.uid()`/path.
- Por eso `vehicle-documents` es **deny-all**: nadie accede directamente. Toda operación privada la
  hace el **servidor** con `service_role` (que ignora RLS), **después** de autorizar con Prisma en la
  Server Action.
- Detalle de la decisión: **AD-004** en [`../architecture/architecture-decisions.md`](../architecture/architecture-decisions.md).

## Service role, signed URLs y validación

- **Service role:** cliente **server-only** ([`lib/supabase/admin.ts`](../../lib/supabase/admin.ts)),
  con guard `typeof window`, validación perezosa y sin prefijo `NEXT_PUBLIC_`. Ver
  [`security-and-secrets.md`](security-and-secrets.md).
- **Signed URLs:** las lecturas de documentos privados usan URLs firmadas **efímeras (300 s)**.
  **Prohibido** `getPublicUrl` sobre buckets privados.
- **`upsert:false`** en subidas: evita sobrescribir un objeto existente (los objetos históricos no se
  pisan).
- **Paths seguros:** nombres basados en UUID; rechazo de _path traversal_; validación server-side de
  MIME y tamaño (no confiar en el atributo HTML `accept`).
- **Nota de defensa en profundidad:** la validación de tipo se hace por MIME declarado + extensión,
  **no** por _magic bytes_ (limitación conocida, riesgo bajo; ver
  [`../architecture/fase-0-final-state.md`](../architecture/fase-0-final-state.md#55-riesgos-residuales) R1).

## Huérfanos y borrado

- El borrado de documentos elimina el objeto de Storage **antes** del commit de DB (dirección
  segura: ante fallo raro queda una referencia colgante, no un objeto huérfano).
- La compensación ante fallo de subida es **best-effort**; puede dejar un objeto huérfano.
- **Los huérfanos se detectan y reportan, nunca se borran automáticamente** (barrido de
  reconciliación con `documents:audit-storage`, con revisión manual).

---

## Verificación en CI

- Job **`supabase-storage`** (Supabase local efímero, sólo Docker; **nunca** `link`/`--linked`/
  `--project-ref`/`db push`): guard anti-remoto, `supabase db reset` (aplica `supabase/migrations`),
  `scripts/check-storage-policies.sql` (invariantes de catálogo de Storage), 19 tests reales.
- Detalle: [`ci-quality-gates.md`](ci-quality-gates.md).

## Proceso de rollout remoto (fuera de este PR de documentación)

1. `documents:plan-storage-reconciliation` (read-only) → diff buckets vs config esperada → acciones.
2. Revisión manual del plan.
3. Aplicación **manual y controlada** de la config de buckets + confirmación de deny-all en
   `vehicle-documents`.
4. Auditoría de objetos (`documents:audit-storage`, read-only) y barrido de huérfanos con revisión.
5. Retirada del bucket legacy `lead-documents` tras periodo de observación (**nunca** auto-borrado).

> El detalle operativo está en el runbook
> [`../runbooks/document-storage-rollout.md`](../runbooks/document-storage-rollout.md) y en el
> [cierre operativo](../operations/fase-0-operational-closeout.md). **Este PR de documentación no
> ejecuta ninguna de estas acciones.**

---

## Checklists

### Nuevo bucket

- [ ] Definido en `supabase/config.toml` (si aplica) y en una migración de `supabase/migrations/`.
- [ ] `public` correcto (privado por defecto para datos sensibles).
- [ ] `file_size_limit` y `allowed_mime_types` fijados.
- [ ] Política acorde al modelo (deny-all + Prisma si es privado; `bucket_id` si es público).
- [ ] Invariante de catálogo en `check-storage-policies.sql` actualizada.
- [ ] Tests en el job `supabase-storage`.

### Nueva política

- [ ] Acotada por `bucket_id` (y por lo mínimo necesario).
- [ ] No abre escritura a `anon` en buckets privados.
- [ ] Verificada por test real en Supabase local.

### Nueva operación privada

- [ ] Autorizada con Prisma en la Server Action **antes** de tocar Storage.
- [ ] Ejecutada con el cliente `service_role` server-only.
- [ ] Lectura vía signed URL efímera (300 s); nunca `getPublicUrl`.
- [ ] Validación server-side de MIME/tamaño; path/nombre seguros.

### Cambio de MIME o tamaño

- [ ] Cambiado en la migración de buckets (fuente de verdad), no en el panel.
- [ ] Reflejado en `check-storage-policies.sql` si es invariante.
- [ ] Probado en `supabase-storage`.

### Despliegue remoto

- [ ] Plan de reconciliación revisado.
- [ ] Backup previo.
- [ ] `project_ref` confirmado (staging antes que producción).
- [ ] Verificación post-aplicación (deny-all en `vehicle-documents`, buckets según config).
