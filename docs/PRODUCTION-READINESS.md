# Production Readiness — Campernova CRM

Camino realista desde "MVP bien construido" hasta "producto de producción con garantías para operar la empresa".

**Estado base (jun 2026)**: ingeniería y proceso a nivel senior (CI gate, `main` protegida, Conventional Commits, 292 tests, README/ARCHITECTURE/ADRs, SEO en prod). Lo que sigue es **madurez operativa** y **wiring de producto real** — en su mayoría configuración cloud/negocio, no reescritura de código.

> **Endurecimiento de seguridad (2026-06-03)**: se activó **Row Level Security (deny-all)** en
> todas las tablas del esquema `public` (migración `20260603000000_enable_rls_deny_all_public`).
> Antes, la API REST de Supabase exponía todas las tablas del CRM (PII de leads, márgenes
> internos, tokens de sesión del chat) a quien tuviera la clave anónima (pública). La app no se
> ve afectada porque accede vía Prisma con el rol `postgres` (BYPASSRLS). Linter de Supabase:
> 0 errores de seguridad tras el cambio.

**Leyenda de propietario**: 🧑 Tú (cloud/dashboard/negocio) · 🤖 Yo (código) · 🤝 Ambos.

---

## P0 — Bloqueantes para operar de verdad

Sin esto, el negocio no funciona correctamente en producción.

| #   | Ítem                                                                                                   | Por qué                                                                                                                            | Propietario                           |
| --- | ------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------- |
| 1   | **Verificar dominio en Resend** + cambiar `EMAIL_FROM` a `info@campersnova.com`                        | Hoy los emails están en **sandbox**: no se entregan a clientes/agentes reales                                                      | 🧑 DNS en Resend · 🤖 swap de env var |
| 2   | **Conectar dominio real** `campersnova.com` en Vercel (DNS + HTTPS) + actualizar `NEXT_PUBLIC_APP_URL` | URLs canónicas, sitemap y emails usan hoy la URL `*.vercel.app`                                                                    | 🧑                                    |
| 3   | ✅ **Conectar `/comprar/[id]` al inventario real** (Prisma) — _hecho (Fase B)_                         | Las fichas leen de `lib/public-catalog.ts` (vehículos `PUBLICADO`). Falta **publicar stock real** y el catálogo navegable (Fase C) | 🧑 publicar stock                     |
| 4   | **Rotar los tokens de `.codex/`** (Linear + Supabase)                                                  | Aparecieron en salida de herramientas durante la auditoría                                                                         | 🧑                                    |
| 5   | **`CRON_SECRET` en Vercel**                                                                            | El cron de postventa no exige auth en prod sin él                                                                                  | 🧑 generar · 🤖 código ya listo       |

---

## P1 — Garantías de fiabilidad (entornos, tests, observabilidad)

Lo que convierte "funciona" en "tengo garantías de que sigue funcionando".

| #   | Ítem                                                                              | Por qué                                                                                   | Propietario                            |
| --- | --------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------- | -------------------------------------- |
| 6   | **Entorno de staging** (2º proyecto Supabase + Vercel Preview→staging) — _Fase 4_ | Hoy las migraciones van directas a **prod**. Staging las prueba antes                     | 🤝 tú org/Vercel · 🤖 migraciones/seed |
| 7   | **E2E autenticado** de flujos backoffice — _Fase 7, cierra CAM-42_                | Ningún test recorre lead→tasación→publicación→entrega de punta a punta                    | 🤖 código · 🧑 secrets                 |
| 8   | **`SENTRY_AUTH_TOKEN`** + alerta de error-rate                                    | Sin él, los errores de prod no tienen línea de código exacta; sin alerta, nadie se entera | 🧑 token · 🤝 alerta                   |
| 9   | **Tests del chat API** (streaming + tool-use)                                     | Único módulo crítico sin cobertura                                                        | 🤖                                     |
| 10  | **Backups de DB verificados** + política de retención/restore documentada         | Garantía de recuperación ante desastre                                                    | 🧑 config Supabase · 🤖 doc/runbook    |

---

## P2 — Endurecimiento (seguridad, cumplimiento, rendimiento)

Lo que espera una auditoría de empresa madura.

| #   | Ítem                                                                                                    | Por qué                                                                                                                                                                                                                                                                                    | Propietario                     |
| --- | ------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------- |
| 11  | ✅ **Auditoría de seguridad de Supabase** (RLS de tablas, exposición vía anon key) — _hecho 2026-06-03_ | RLS deny-all activado en todo `public`; fuga vía clave anónima cerrada. Pendientes menores (WARN): mover extensión `vector` fuera de `public`, restringir listado del bucket `vehicle-photos`, activar "leaked password protection" (irrelevante: auth por enlace mágico, sin contraseñas) | 🤖 hecho · 🧑 toggles dashboard |
| 12  | **Rate limiting** en endpoints públicos (`/vender`, chat) más robusto que el in-process actual          | Defensa anti-abuso real en serverless                                                                                                                                                                                                                                                      | 🤖                              |
| 13  | **RGPD operativo**: flujo de borrado/exportación de datos personales + retención                        | Obligación legal con datos de clientes                                                                                                                                                                                                                                                     | 🤝                              |
| 14  | **Accesibilidad (WCAG AA)** del sitio público + presupuestos de rendimiento (Lighthouse)                | Calidad y alcance del sitio de marketing                                                                                                                                                                                                                                                   | 🤖                              |
| 15  | **Monitorización de uptime** + healthcheck                                                              | Saber si la app está caída antes que el cliente                                                                                                                                                                                                                                            | 🧑 servicio · 🤖 endpoint       |
| 16  | **Revisión legal de contenido generado por IA** (anuncios) + disclaimers                                | Responsabilidad sobre lo que se publica en portales                                                                                                                                                                                                                                        | 🧑 / legal                      |
| 17  | **Runbook de incidentes** (qué hacer si cae prod / falla un deploy / fuga de datos)                     | Operación profesional                                                                                                                                                                                                                                                                      | 🤖 doc                          |

---

## Orden recomendado

1. **P0 completo** → el producto opera de verdad (emails, dominio, inventario, secretos). Mayormente tuyo + ayuda mía puntual.
2. **Fase 4 (staging)** → habilita probar todo lo demás sin riesgo. Punto de inflexión.
3. **Fase 7 (e2e) + P1 restante** → garantías de regresión y observabilidad.
4. **P2** → endurecimiento continuo, en paralelo según prioridad de negocio.

> Cuando el P0 y las Fases 4+7 estén hechos, el sistema pasa de "MVP bien construido" a "producto de producción con garantías razonables para operar". El P2 es mejora continua, no bloqueante para lanzar.
