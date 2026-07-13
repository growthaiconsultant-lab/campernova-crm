# Gobierno de seguridad y secretos

| Campo                            | Valor                                                                                          |
| -------------------------------- | ---------------------------------------------------------------------------------------------- |
| **Título**                       | Gobierno de secretos y seguridad operativa                                                     |
| **Estado**                       | ACTIVE                                                                                         |
| **Owner**                        | Security / Engineering                                                                         |
| **Última revisión**              | 2026-07-13                                                                                     |
| **Fuente de verdad relacionada** | Este documento. Nombres de variables (sin valores) en `.env.example`.                          |
| **Alcance**                      | Secretos de runtime y de tooling introducidos/afectados por Fase 0.                            |
| **Fuera de alcance**             | Aprovisionamiento real de secretos en entornos remotos (acción de Operaciones, no de este PR). |

> **Este documento no contiene ningún valor de secreto.** Sólo nombres de variables y su política de
> uso. Los valores viven en `.env.local`/`.env.staging` (gitignored) y en el panel de Vercel/Supabase.

---

## `SUPABASE_SERVICE_ROLE_KEY`

- **Naturaleza:** clave **privilegiada** que **ignora RLS**. Sólo para el canal de documentos
  privados (`vehicle-documents`), tras autorizar con Prisma.
- **Server-only:** se usa exclusivamente en el servidor
  ([`lib/supabase/admin.ts`](../../lib/supabase/admin.ts)).
- **Sin `NEXT_PUBLIC_`:** por el prefijo, Next.js **nunca** la inyecta en el bundle de cliente (en el
  navegador sería `undefined`). Guard adicional `typeof window` que lanza si se invoca en el
  navegador.
- **Inicialización perezosa:** no se evalúa en import/build (Vercel compila sin el secreto); sólo al
  invocarse en runtime server-side. Si falta, **falla en cerrado** con un mensaje claro (no hay
  fallback inseguro).
- **No logs / no serialización:** la clave no se vuelca a logs ni cruza el límite RSC→cliente; el
  cliente encapsula la credencial.
- **Scopes por entorno:** una clave distinta por proyecto (dev local / staging / producción).
- **Rotación / revocación:** rotar desde el panel de Supabase (API settings). Tras rotar, actualizar
  la variable en cada entorno (Vercel + `.env.*` locales) y redeploy. Revocar de inmediato ante
  sospecha de exposición.
- **Acceso mínimo:** sólo el runtime del servidor la necesita; no se comparte con clientes ni
  terceros.
- **Configuración en Vercel:** debe estar en **Production** (y Preview/staging) **antes o en lockstep**
  con el deploy de la capa de documentos privados; si falta, cada operación de documento privado
  falla en el primer uso (regresión). Es el **gate de go-live #1** (ver
  [cierre operativo](../operations/fase-0-operational-closeout.md)).
- **Configuración en CI local:** el job `supabase-storage` obtiene una `service_role` **local y
  efímera** de `supabase status -o env` y la enmascara (`::add-mask::`). Nunca usa la clave remota.

## Variables de guarda del tooling de migración documental

Nombres declarados en `.env.example` (comentados; **no** definir en local salvo para una operación
real autorizada):

- `ALLOW_STAGING_DOCUMENT_AUDIT`, `ALLOW_STAGING_DOCUMENT_BACKFILL`
- `ALLOW_PRODUCTION_DOCUMENT_AUDIT`, `ALLOW_PRODUCTION_DOCUMENT_BACKFILL`
- Token de confirmación de producción: `--ack I_UNDERSTAND_THIS_IS_PRODUCTION`

Política: el tooling es dry-run/read-only por defecto; escribir contra staging/producción exige la
allow-var del entorno + confirmación (+ `--ack` en producción) + URL del entorno correcto. Sin
fallback silencioso a remoto (guard en `lib/documents/migration-env-guard.ts`).

## Otras variables sensibles

- `DATABASE_URL` / `DIRECT_URL`: conexión Prisma. Nunca en Git; distintas por entorno.
- `ALLOW_INTEGRATION_DB_RESET`: sólo para la base **efímera** del job `integration`; el guard rechaza
  URLs de staging/producción.
- `CRON_SECRET`, claves de Resend/Anthropic/hCaptcha/Sentry/PostHog: fuera del alcance de Fase 0;
  gestionadas en el panel de Vercel.

---

## Reglas transversales

- **Prohibido** incluir valores de secretos en Git, en documentación, en logs o en artefactos.
- Los artefactos del tooling (`.artifacts/`) están **gitignored** (permisos `600`) y nunca contienen
  tokens de firma ni PII; los planes contienen IDs/object paths reales (por eso no se commitean).
- **Revisión de logs:** confirmar que ninguna salida de CI/app vuelca claves (el job
  `supabase-storage` filtra líneas de `key|secret|token|jwt`).
- **Respuesta ante exposición:** revocar/rotar de inmediato la credencial afectada, invalidar
  sesiones si aplica, revisar accesos, y registrar el incidente.

---

## Checklist de go-live (seguridad)

- [ ] `SUPABASE_SERVICE_ROLE_KEY` presente en Vercel **Production** (y Preview/staging), por entorno.
- [ ] Ninguna variable remota (`SUPABASE_ACCESS_TOKEN`/`PROJECT_ID`/`PROJECT_REF`) presente en el
      entorno de CI.
- [ ] `.artifacts/` gitignored; sin secretos/PII en artefactos ni logs.
- [ ] Allow-vars de documento **no** definidas salvo durante una operación real autorizada.
- [ ] Rotación de credenciales planificada; procedimiento de revocación conocido.
- [ ] `service_role` nunca referenciada desde componentes de cliente.
