# Campernova CRM — instrucciones para agentes

CRM interno de CampersNova para captación, depósito-venta, preparación, publicación, matching,
ofertas, entregas y postventa de campers y autocaravanas.

Estas instrucciones contienen únicamente reglas duraderas. No mantener aquí backlog, conteos de
tests, features terminadas ni estado de producción.

## 1. Fuentes de verdad

Antes de trabajar, leer:

1. [`docs/governance/sdd-workflow.md`](docs/governance/sdd-workflow.md) — entrada al proceso SDD y
   Definition of Done.
2. [`docs/README.md`](docs/README.md) — mapa de fuentes canónicas de arquitectura, dominio, gobierno
   y operaciones.
3. La spec aprobada de `docs/specs/` o el ticket correspondiente.
4. El código, schema y migraciones de `main` para conocer el comportamiento implementado.

Jerarquía:

- código/schema/migraciones desplegados = realidad implementada;
- spec aprobada = intención del cambio;
- ADR/documento ACTIVE = decisión estable;
- Linear/GitHub issue = estado operativo;
- PR, CI y deployment = evidencia de ejecución.

Si se contradicen, registrar y reconciliar la discrepancia. No asumir que un checklist manual está
más actualizado que el código desplegado.

## 2. Inicio obligatorio de cada cambio

1. Identificar ticket o ID de cambio.
2. Sincronizar con `main` y usar una rama corta; no mezclar trabajo ajeno.
3. Clasificar la ruta SDD: rápida, estándar o reforzada.
4. Para ruta estándar o reforzada, crear/actualizar
   `docs/specs/<ID>-<slug>.md` desde [`docs/templates/change-brief.md`](docs/templates/change-brief.md).
5. Explicar pasos, decisiones abiertas, validación y límites antes de editar.
6. No implementar si falta una decisión material sobre dinero, permisos, estados, contratos,
   publicación, venta, borrado, migración o producción.

## 3. Reglas de implementación

- Server Components por defecto; Client Components sólo cuando sean necesarios.
- Server Actions para mutaciones; Route Handlers para webhooks, cron, descargas o APIs públicas.
- Validación Zod en el boundary del servidor; validación cliente sólo como ayuda UX.
- Lógica de dominio pura en `lib/`; dependencias Prisma/Storage detrás de adaptadores o funciones
  explícitas.
- Autorización server-side antes de leer o mutar datos sensibles.
- Estados compartidos como enums/tipos; no duplicar hechos canónicos en texto o Activities.
- Para concurrencia usar transacción, CAS, lock o constraint; una lectura previa no es garantía.
- Efectos externos deben contemplar timeout, retry, idempotencia, fallo y observabilidad.
- No introducir librerías sin justificar por qué el stack existente no resuelve el problema y sin
  aprobación previa.
- No hacer refactors o limpiezas no relacionados con el ticket.
- No introducir secretos, PII, tokens, URLs firmadas ni payloads sensibles en Git, logs, Sentry o
  PostHog.

## 4. Stack y comandos

- Next.js 14 App Router, React 18 y TypeScript.
- Prisma 6 sobre Supabase PostgreSQL; Supabase Auth y Storage.
- Tailwind y shadcn/ui.
- Vitest, Playwright y PostgreSQL real para integración.
- Vercel, Resend, Sentry, PostHog y hCaptcha.
- Gestor: `pnpm@10.33.2`; Node 20 o superior.

Comandos canónicos:

```bash
pnpm install --frozen-lockfile
pnpm prisma validate
pnpm prisma generate
pnpm check:sdd
pnpm typecheck
pnpm lint
pnpm test
pnpm check:migration-history
pnpm test:integration:prepare
pnpm test:integration
pnpm test:supabase
pnpm test:e2e
pnpm build
```

Ejecutar sólo los comandos proporcionales al cambio y registrar el resultado real. Un job omitido no
cuenta como test verde. No ejecutar comandos que puedan alcanzar producción durante pruebas.

## 5. Tests mínimos

Seguir [`docs/governance/testing-strategy.md`](docs/governance/testing-strategy.md).

- Bug: test de regresión cuando sea técnicamente posible.
- Tasación, matching y transiciones de estado: unitarios obligatorios.
- Queries, persistencia y constraints: integración con PostgreSQL real.
- Concurrencia, idempotencia, oferta, reserva, entrega, venta y garantía: integración real con doble
  ejecución/carrera.
- Migración: replay completo, parity, RLS y compatibilidad.
- Storage: Supabase local, MIME, tamaño, path, authz y compensación.
- UI con comportamiento: estados loading/error/empty y E2E cuando el flujo lo justifique.

No declarar validado un cambio que sólo compila. Distinguir local, CI, staging, producción y ventana
de observación.

## 6. Prisma y Supabase

- Mantener `prisma@^6` y `@prisma/client@^6` hasta una migración explícitamente aprobada.
- Nunca editar una migración ya desplegada.
- No usar `db push` como proceso de producción.
- Preferir expand → backfill → observe → contract.
- Si cambia `schema.prisma`: crear migración nueva, actualizar seed si aplica, regenerar cliente y
  ejecutar las verificaciones de [`docs/governance/database-migrations.md`](docs/governance/database-migrations.md).
- El proyecto Supabase de producción es `bbmglaatlyilxutzomxd`; cualquier mutación remota requiere
  autorización explícita y preflight.
- `vehicle-photos` es público; los documentos privados se sirven mediante acciones autorizadas y
  URLs firmadas de corta duración.
- `service_role`, `DATABASE_URL` y `DIRECT_URL` son sólo server-side y nunca se muestran ni
  commitean.

## 7. Git, PR y operaciones remotas

- Flujo y commits: [`CONTRIBUTING.md`](CONTRIBUTING.md).
- Commits pequeños, atómicos y Conventional Commits en imperativo.
- No commit, push, PR, merge, migración, deploy ni cambio de producción sin autorización dentro del
  alcance actual.
- Antes de cada commit revisar `git diff`, `git status`, secretos, artefactos y archivos ajenos.
- No usar `git reset --hard`, borrar ramas/trabajo o sobrescribir archivos no relacionados.
- GitHub es la fuente técnica; Linear es tracking. Al cerrar, ambos deben enlazar spec, PR y estado
  real.

## 8. Riesgo reforzado

Para cambios de dinero, permisos, PII, documentos privados, schema, migraciones, concurrencia,
efectos externos críticos o producción, aplicar además:

- [`docs/governance/planning-quality-standard.md`](docs/governance/planning-quality-standard.md)
- [`docs/governance/engineering-change-process.md`](docs/governance/engineering-change-process.md)
- [`docs/governance/security-and-secrets.md`](docs/governance/security-and-secrets.md)
- [`docs/governance/ai-handoff-protocol.md`](docs/governance/ai-handoff-protocol.md)

El plan debe separar hechos, inferencias, recomendaciones y desconocidos; incluir rollback, stop
conditions y autorización exacta.

## 9. Cierre y handoff

Antes de entregar:

- comprobar criterios de aceptación y registrar evidencia;
- ejecutar validación proporcional y revisar el diff completo;
- actualizar sólo las fuentes afectadas;
- informar qué se ejecutó y qué no;
- indicar riesgos, deuda y siguiente gate;
- no llamar desplegado a lo sólo implementado, ni validado a lo sólo desplegado.

La Definition of Done completa está en
[`docs/governance/sdd-workflow.md`](docs/governance/sdd-workflow.md#6-definition-of-done).
