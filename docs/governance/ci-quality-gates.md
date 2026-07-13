# Gobierno de CI y quality gates

| Campo                            | Valor                                                                                                             |
| -------------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| **Título**                       | Gobierno de CI y puertas de calidad                                                                               |
| **Estado**                       | ACTIVE                                                                                                            |
| **Owner**                        | Engineering                                                                                                       |
| **Última revisión**              | 2026-07-13                                                                                                        |
| **Fuente de verdad relacionada** | [`.github/workflows/ci.yml`](../../.github/workflows/ci.yml). Este documento describe la intención y el gobierno. |
| **Alcance**                      | Los 4 jobs de CI y la política de branch protection y de acciones.                                                |
| **Fuera de alcance**             | Cambios reales en branch protection (acción de gobierno del repo, no de este PR).                                 |

---

## Jobs

### `quality`

- Corre en cada push a `main` y en todos los PR.
- Pasos: instalar deps (`--frozen-lockfile`) → `prisma generate` → `typecheck` → `lint` →
  **tests unitarios** (721). Usa DB dummy (los tests mockean Prisma).

### `integration`

- Base **PostgreSQL 17 real y efímera**, local al runner (sin secretos, sin staging/producción).
- Pasos: `prisma generate` → `test:integration:prepare` (guard + `migrate deploy`) → `check:rls`
  (invariante RLS) → **tests de integración** (59, sobre 10 ficheros): operaciones críticas,
  concurrencia (CAS), atomicidad, idempotencia, backfill.

### `migration-replay`

- Reconstruye el esquema desde una base **vacía** (PostgreSQL 17 efímero).
- Pasos: `check:migration-history` → `prisma migrate deploy` → confirma que se aplicaron
  **exactamente** `000000000000_squashed_migrations` + `20260712000000_add_versioned_document_model`
  → `migrate status` (up to date) → `check:rls` → **paridad** (`migrate diff --exit-code`, sin drift)
  → **conteos de catálogo** (31/431/49/258/65/111; 0 sin RLS; 0 `FORCE`; 0 políticas) → **segundo
  `migrate deploy` idempotente**.

### `supabase-storage`

- Supabase **local efímero** (Docker del runner). **Nunca** `link`/`--linked`/`--project-ref`/`db push`.
- Pasos: guard anti-remoto (aborta si hay variables remotas o proyecto enlazado) → `setup-cli` →
  `supabase start` (salida silenciada para no volcar claves) → exportar credenciales locales
  enmascaradas → `assert:local-supabase` → `supabase db reset` (aplica `supabase/migrations`) →
  `check-storage-policies.sql` (invariantes de catálogo de Storage) → **tests reales** (19, sobre 2
  ficheros) → `stop` (`always`).

---

## Checks existentes vs required

- **Requerido en branch protection hoy:** `quality`.
- **No requeridos (pero se ejecutan):** `integration`, `migration-replay`, `supabase-storage`.

**Recomendación (gobierno, no ejecutada en este PR):** promover `migration-replay` (e idealmente
`integration` y `supabase-storage`) a **checks obligatorios** de `main`, para que la red de
seguridad de migraciones/Storage sea una puerta de merge dura. Es una configuración del repositorio,
no un cambio de código.

---

## Política de acciones y workflows

- **Acciones fijadas a tags mayores** (`actions/checkout@v4`, `pnpm/action-setup@v4`,
  `actions/setup-node@v4`, `supabase/setup-cli@v1`). **Recomendación:** SHA-pin de las acciones de
  **terceros** (p. ej. `supabase/setup-cli`) para reducir exposición de cadena de suministro.
- **Supabase CLI:** `version: latest` (flotante, no determinista). **Recomendación:** pin a una
  release conocida y bump deliberado.
- **`permissions`:** los workflows no declaran un bloque `permissions` explícito.
  **Recomendación:** añadir `permissions: contents: read` a nivel de workflow (mínimo privilegio),
  con grants más finos por job sólo si un paso futuro lo necesita.
- **Node/pnpm:** Node 20, pnpm pineado en `package.json` (`packageManager`). Bump deliberado y
  probado.
- **Cambios en workflows:** revisión explícita; nunca introducir `continue-on-error` en gates.

> Estas recomendaciones son **deuda de hardening**, no bloqueos de cierre técnico. Ninguna afecta a
> la corrección de las migraciones ni a las invariantes de RLS/catálogo. Están registradas como
> riesgos residuales en
> [`../architecture/fase-0-final-state.md`](../architecture/fase-0-final-state.md#55-riesgos-residuales):
> R3 (CLI `version: latest`), R5 (acciones por tag mutable), R6 (jobs no _required_) y R17 (sin
> bloque `permissions:`).

---

## Vercel

- Build/deploy verde. `build` = `prisma generate && next build`. Limitación conocida: los previews
  requieren las env vars de Supabase en el scope Preview (independiente de estos jobs).

## Números de referencia (validados)

- Tests unitarios: **721** · integración: **59** (10 ficheros) · Supabase: **19** (2 ficheros).
- Catálogo `public`: **31/431/49/258/65/111**; **0** tablas sin RLS.
