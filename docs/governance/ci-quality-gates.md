# Gobierno de CI y quality gates

| Campo                            | Valor                                                                                                             |
| -------------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| **Título**                       | Gobierno de CI y puertas de calidad                                                                               |
| **Estado**                       | ACTIVE                                                                                                            |
| **Owner**                        | Engineering                                                                                                       |
| **Última revisión**              | 2026-08-03                                                                                                        |
| **Fuente de verdad relacionada** | [`.github/workflows/ci.yml`](../../.github/workflows/ci.yml). Este documento describe la intención y el gobierno. |
| **Alcance**                      | Los 4 jobs de CI y la política de branch protection y de acciones.                                                |
| **Fuera de alcance**             | Cambios reales en branch protection (acción de gobierno del repo, no de este PR).                                 |

---

## Jobs

### `quality`

- Corre en cada push a `main` y en todos los PR.
- Pasos: `check-sdd` (sin dependencias) → instalar deps (`--frozen-lockfile`) → `prisma generate` →
  `typecheck` → `lint` → tests unitarios. El workflow y su log son la fuente de verdad del conteo.

### `integration`

- Base **PostgreSQL 17 real y efímera**, local al runner (sin secretos, sin staging/producción).
- Pasos: `prisma generate` → `test:integration:prepare` (guard + `migrate deploy`) → `check:rls`
  (invariante RLS) → tests de integración: operaciones críticas,
  concurrencia (CAS), atomicidad, idempotencia, backfill.

### `migration-replay`

- Reconstruye el esquema desde una base **vacía** (PostgreSQL 17 efímero).
- Pasos: `check:migration-history` → `prisma migrate deploy` → verifica el conjunto de migraciones
  descubierto en el checkout → `migrate status` → `check:rls` → paridad
  (`migrate diff --exit-code`) → invariantes de catálogo → segundo `migrate deploy` idempotente.
  El workflow y el directorio `prisma/migrations/` son la fuente de verdad; este documento no fija
  conteos que se vuelven obsoletos.

### `supabase-storage`

- Supabase **local efímero** (Docker del runner). **Nunca** `link`/`--linked`/`--project-ref`/`db push`.
- Pasos: guard anti-remoto (aborta si hay variables remotas o proyecto enlazado) → `setup-cli` →
  `supabase start` (salida silenciada para no volcar claves) → exportar credenciales locales
  enmascaradas → `assert:local-supabase` → `supabase db reset` (aplica `supabase/migrations`) →
  `check-storage-policies.sql` (invariantes de catálogo de Storage) → tests reales → `stop`
  (`always`).

### `playwright` programado

- `.github/workflows/e2e.yml` sólo ejecuta Playwright cuando existe `E2E_BASE_URL` y los secretos de
  staging necesarios.
- Si faltan, el workflow termina sin ejecutar checkout, instalación ni tests. Ese resultado
  significa **E2E omitido**, no E2E verde.
- Hasta configurar y verificar staging, el E2E programado no puede utilizarse como evidencia de
  aceptación ni como gate de producción.

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
- **`permissions`:** CI declara `contents: read` a nivel de workflow. Cualquier grant adicional debe
  justificarse por job.
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

- Build/deploy verde. `build` = `prisma generate && check-remote-migrations && next build`. El guard
  de migraciones es **solo lectura** y **solo activo en `VERCEL_ENV=production`** (fail-closed si una
  migración local no está aplicada en la BD remota); en Preview/local hace SKIP. Ver
  [`database-migrations.md`](database-migrations.md#guard-de-despliegue-prisma--base-de-datos-fail-closed-en-producción).
  Limitación conocida: los previews requieren las env vars de Supabase en el scope Preview
  (independiente de estos jobs); Production necesita `DIRECT_URL` disponible en el paso de build.

## Evidencia viva

Los conteos de tests, migraciones y catálogo cambian con el repositorio. Consultar el log del último
CI asociado al commit auditado; no copiar cifras a documentos de gobierno.
