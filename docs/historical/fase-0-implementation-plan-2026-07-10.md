<!-- ───────────────────────────────────────────────────────────────────────── -->
<!--  CABECERA DE ESTADO (añadida en el PR de documentación y gobierno de Fase 0) -->
<!-- ───────────────────────────────────────────────────────────────────────── -->

> **Estado: HISTÓRICO.** No es fuente de verdad del estado actual.
>
> - **Documento:** plan de implementación de Fase 0 (propuesta previa a ejecución).
> - **Fecha original:** 2026-07-10 · **Commit auditado:** `0ae8631`.
> - **Propósito original:** planificar los PRs de Fase 0 (SEG-01, SEG-02, NEG-01/02/03, TEST-01).
> - **Por qué es histórico:** el plan se **ejecutó** (con variaciones respecto a la numeración
>   propuesta). La numeración real de PRs y sus commits está en
>   [`../architecture/fase-0-final-state.md`](../architecture/fase-0-final-state.md#53-historial-de-prs).
>   Algunos detalles del plan quedaron superados: p. ej. la reserva atómica se implementó sin el
>   índice único parcial opcional; el alcance de Storage se amplió a la capa versionada (PR5B1–B3).
> - **Sustituido por (estado actual):**
>   - Estado y garantías → [`../architecture/fase-0-final-state.md`](../architecture/fase-0-final-state.md)
>   - Gobierno de migraciones → [`../governance/database-migrations.md`](../governance/database-migrations.md)
>   - Gobierno de Storage → [`../governance/supabase-storage.md`](../governance/supabase-storage.md)
>   - Cierre operativo → [`../operations/fase-0-operational-closeout.md`](../operations/fase-0-operational-closeout.md)
> - **Conservado por trazabilidad:** documenta la revalidación de hallazgos y la comprobación (en
>   su momento) de que no había datos dañados que reconciliar.
> - **Advertencia:** las consultas de verificación fueron **read-only** contra staging/producción;
>   **no** re-ejecutar sin autorización y sin confirmar el `project_ref`. Nota: el conteo de tests
>   citado (543) es el de aquella fecha; el **actual** es 721 unitarios + 59 integración + 19 Supabase.

---

# Plan de Implementación — Fase 0 (Riesgos críticos)

> **Estado:** propuesta para aprobación. **No se ha modificado código, esquema, migraciones, políticas, configuración ni datos.** Toda la verificación de base de datos se hizo en **modo solo lectura** (`SELECT` y advisors de lectura). No implementar ningún PR hasta aprobación explícita.
>
> **Alcance estricto:** SEG-01, SEG-02, NEG-01, NEG-02, NEG-03, TEST-01. **Fuera de alcance** (Fase 1+): `Organization`/`Membership`/`organizationId`, multi-tenancy, `Party`, unificación comprador/vendedor, `Listing`, separación vehículo/anuncio, `Deal`/`Operation`, outbox general, rediseño de analítica, refactor de componentes.

**Fecha:** 2026-07-10 · **Commit auditado:** `0ae8631` (`main`, working tree limpio) · **Entornos verificados:** staging `iatuhydsfwoeprpbklod` y producción `bbmglaatlyilxutzomxd` (ambos solo lectura).

---

## 1. Resumen de la revalidación

Se recontrastó cada hallazgo contra el código en el commit actual y contra la base de datos real (staging **y** producción). Resultado: **los seis hallazgos se sostienen**, con matices relevantes en SEG-02 y TEST-01 que **mejoran la precisión** del plan.

Dos conclusiones transversales cambian la estrategia respecto a lo que sugería la auditoría:

1. **SEG-01 es una exposición REAL y ACTIVA en producción** (no solo teórica): además de RLS deshabilitada, los roles `anon` y `authenticated` tienen **grants DML completos** sobre las 4 tablas y **no hay políticas** → la clave pública puede leer/insertar/actualizar/borrar vía PostgREST **hoy**.
2. **NEG-01/02/03 no tienen datos dañados que reconciliar**: producción tiene **0 ofertas aceptadas, 0 entregas completadas** y **1 captación convertida correctamente vinculada**. Los fixes son **preventivos** (blindar los flujos antes de que se usen a volumen), no correctivos. Esto **elimina la necesidad de scripts de reconciliación de datos** y reduce a cero el riesgo de que un fix toque registros inconsistentes.

---

## 2. Estado de cada hallazgo

| Hallazgo                                                      | Veredicto                            | Evidencia (commit `0ae8631`)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       | Matiz                                                                                                                                                                                                                                                                                  |
| ------------------------------------------------------------- | ------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **SEG-01** RLS ausente en 4 tablas                            | **Confirmado (Crítico)**             | `prisma/migrations/20260603000000_enable_rls_deny_all_public/migration.sql:17-28` (DO-loop de una pasada). Prod+staging: `offers`, `calendar_events`, `vehicle_captures`, `kpi_events` → `relrowsecurity=false`, 0 políticas, `anon`/`authenticated` con `SELECT,INSERT,UPDATE,DELETE,TRUNCATE`. Advisor prod: 4× `rls_disabled_in_public` (ERROR).                                                                                                                                                                                | Exposición activa confirmada por grants efectivos, no solo por RLS off.                                                                                                                                                                                                                |
| **SEG-02** Storage cliente + políticas no versionadas         | **Confirmado con matices**           | `app/(backoffice)/entregas/[id]/documents-section.tsx:48-56` (upload con `createBrowserClient` anon al bucket privado `vehicle-documents`), `:122` (`accept` solo HTML). Prod: `storage.objects` con 8 políticas **no versionadas** (no están en `prisma/migrations`); staging tiene **0** → divergencia confirmada. **`vehicle-documents` no tiene ninguna política en prod** → la subida cliente está de hecho **denegada** (no expuesta). Buckets prod con `file_size_limit` (2–10 MB) y `allowed_mime_types` (staging = NULL). | El riesgo real es **divergencia + no-versionado + feature rota + arquitectura incorrecta**, no exposición de escritura. La afirmación de la auditoría "buckets sin límites" era **solo de staging** (refutada en prod).                                                                |
| **NEG-01** Carrera al aceptar oferta                          | **Confirmado (Alto, latente)**       | `app/(backoffice)/ofertas/actions.ts:117-160` (lee `offer.vehicle.status` fuera del `$transaction`), `:170-206` (tx), `:184` (`tx.vehicle.update` a `RESERVADO` sin re-verificar). Patrón atómico correcto solo en `lib/valuation/save.ts:42`.                                                                                                                                                                                                                                                                                     | Prod: **0 ofertas aceptadas** → sin daño existente; fix preventivo antes de usar el flujo.                                                                                                                                                                                             |
| **NEG-02** Garantía fuera de la transacción                   | **Confirmado (Alto, latente)**       | `app/(backoffice)/entregas/actions.ts:144-205` (tx) vs `:208-226` (`createWarrantyForDelivery(deliveryId, db)` **fuera**, con `db` no `tx`). `lib/postventa/create-warranty.ts:5` docstring miente ("same transaction"); `:21` `warranty.create` no idempotente; `warranties.delivery_id @unique`. El propio test `entregas/actions.test.ts:11,103` mockea la garantía y asserta que se llama con `mockDb` — corrobora que no está en la tx.                                                                                       | Prod: **0 entregas completadas** → sin daño. El `@unique` hace que un reintento **lance excepción** (no duplica en silencio); el riesgo es "vendido sin garantía", no "garantía duplicada".                                                                                            |
| **NEG-03** `SellerLead` fuera de la transacción de vínculo    | **Confirmado (Medio-Alto, latente)** | `app/(backoffice)/captaciones/actions.ts:168-196` (`sellerLead.create` con vehicle+activity anidados **fuera**), `:198-210` (tx de vínculo), `:155` (idempotencia depende de `sellerLeadId` ya seteado). Mismo patrón en `compradores/[id]/trade-in-actions.ts`.                                                                                                                                                                                                                                                                   | Prod: **1 captación convertida, correctamente vinculada, 0 huérfanos**; **0 trade-in parciales**. Sin daño.                                                                                                                                                                            |
| **TEST-01** Sin tests de los flujos críticos/RLS/concurrencia | **Confirmado con matices**           | No existe `ofertas/actions.test.ts` ni `captaciones/actions.test.ts` (dirs verificados). `lib/auth.test.ts` solo prueba `userHasRole` puro. Único e2e: `e2e/public-pages.spec.ts` (público). Todos los tests de acciones **mockean Prisma** (`vi.fn()`), no hay infraestructura de integración con DB real → **imposible testar concurrencia/atomicidad/RLS hoy**.                                                                                                                                                                 | Existen tests adyacentes: `trade-in-actions.test.ts`, `entregas/actions.test.ts` (mockea garantía), `lib/postventa/create-warranty.test.ts`, `lib/offers.test.ts`, `lib/captacion.test.ts` (módulos puros). La carencia es de **integración/concurrencia/RLS**, no de cobertura total. |

**Interacciones entre fixes:** NEG-01/02/03 son independientes entre sí (archivos distintos). SEG-01 y SEG-02 tocan seguridad de infraestructura (migraciones raw SQL), no lógica de negocio. Ningún fix depende de otro para ser correcto → se pueden desplegar en PRs pequeños e independientes.

**Riesgo que introduce cada corrección:** todos bajos (ver cada PR). El de mayor cuidado es SEG-02 (cambia el flujo de subida y añade políticas de storage que ya existen parcialmente en prod → la migración debe ser idempotente para no chocar con las políticas creadas por panel).

---

## 3. Línea base del proyecto (previa a implementación)

Ejecutado con los scripts oficiales de `package.json`, sin instalar ni actualizar dependencias, sin modificar el repo.

| Comando                             | Resultado                                  | Detalle                                                                                                                                                                                   |
| ----------------------------------- | ------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `git rev-parse HEAD`                | `0ae863183eaef41cbf18b828c81f9ba118667536` | rama `main`, `git status` limpio                                                                                                                                                          |
| `pnpm typecheck` (`tsc --noEmit`)   | ✅ **exit 0**                              | sin errores de tipos                                                                                                                                                                      |
| `pnpm lint` (`next lint`)           | ✅ **exit 0**                              | "No ESLint warnings or errors"                                                                                                                                                            |
| `pnpm test` (`vitest run`)          | ✅ **exit 0**                              | **60 archivos, 543 tests, 543 passed**, ~3,0 s (import 10,4 s)                                                                                                                            |
| `pnpm test:e2e` (`playwright test`) | ⏸️ **No ejecutado**                        | Requiere levantar `pnpm dev` (webServer) y navegador; el e2e actual solo cubre páginas públicas. No aporta a la Fase 0 y no se ejecuta para evitar efectos/tiempo. Limitación registrada. |

**Conclusión de la línea base:** el proyecto está **verde** (typecheck + lint + 543 tests). No hay fallos preexistentes que corregir antes de empezar. Nota: el conteo real es **543 tests** (no 531/531 como aparece en partes de `CLAUDE.md`).

---

## 4. Verificación de producción (solo lectura)

**Confirmación de identidad antes de consultar:** `get_project` devolvió `id/ref = bbmglaatlyilxutzomxd`, `name = campersnova-crm`, `eu-central-1`, `ACTIVE_HEALTHY`. **No** es staging (`iatuhydsfwoeprpbklod`). Solo se ejecutaron `SELECT` y advisors de lectura; **no** se ejecutó ningún `INSERT/UPDATE/DELETE/ALTER/CREATE/DROP/TRUNCATE` ni advisor con remediación. No se muestran secretos ni PII.

### RLS y grants (SEG-01)

| Tabla                                                                           | RLS (prod)   | Políticas    | Grants `anon` / `authenticated`                           | Advisor prod                            |
| ------------------------------------------------------------------------------- | ------------ | ------------ | --------------------------------------------------------- | --------------------------------------- |
| `offers`                                                                        | ❌ **false** | 0            | `SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER` | 🔴 ERROR `rls_disabled_in_public`       |
| `calendar_events`                                                               | ❌ **false** | 0            | idem                                                      | 🔴 ERROR                                |
| `vehicle_captures`                                                              | ❌ **false** | 0            | idem                                                      | 🔴 ERROR                                |
| `kpi_events`                                                                    | ❌ **false** | 0            | idem                                                      | 🔴 ERROR                                |
| `buyer_leads`, `seller_leads`, `vehicles`, `deliveries`, `warranties` (muestra) | ✅ true      | 0 (deny-all) | grants presentes, **bloqueados por RLS**                  | INFO `rls_enabled_no_policy` (esperado) |

**Veredicto SEG-01 en producción:** las cuatro tablas están **expuestas de forma efectiva** a la API PostgREST con la clave anónima (que viaja al navegador). Combinación confirmada: RLS off **+** grant DML **+** sin política. Las demás tablas están protegidas (RLS on sin política = deny-all para `anon`/`authenticated`; Prisma accede con rol `BYPASSRLS` y no se ve afectado).

### Storage (SEG-02)

- **Buckets (prod):** `vehicle-photos` (público, límite 2 MB, MIME `jpeg/png/webp`), `vehicle-documents` (privado, 10 MB, MIME `jpeg/png/webp/gif/pdf`), `lead-documents` (privado, 10 MB, MIME `pdf/jpeg/png/webp`). **Los límites de tamaño/MIME SÍ están configurados en prod** (a diferencia de staging, donde son NULL).
- **`storage.objects` (prod):** RLS on, **8 políticas**. Cubren `lead-documents` (4: read/insert/update/delete para `authenticated`) y `vehicle-photos` (4: `public read` + insert/update/delete para `authenticated`). **No hay ninguna política para `vehicle-documents`.**
- **Implicación:** el upload cliente de `documents-section.tsx` va a `vehicle-documents` como rol `anon` (sesión de navegador sin `auth.role()='authenticated'` sobre el cliente de storage) → **denegado por RLS** (no hay política). La feature está **rota/denegada en prod**, no expuesta.
- **Políticas gatean por `auth.role()='authenticated'` + `bucket_id`**, no por propiedad/path ni organización → cualquier usuario autenticado puede leer/escribir cualquier objeto de esos buckets (amplio, pero staff de confianza hoy).
- **No versionadas:** ninguna de las 8 políticas está en `prisma/migrations`; se crearon por panel. Staging tiene 0 → **divergencia confirmada** entre entornos.
- Advisor adicional (fuera de Fase 0, anotado): `public_bucket_allows_listing` (WARN) en `vehicle-photos` (permite listar objetos); `extension_in_public` (vector) WARN; `auth_leaked_password_protection` WARN (N/A: auth por magic link, sin contraseñas).

### Comparación staging ↔ producción (relevante para el despliegue)

| Aspecto                       | Staging | Producción                        |
| ----------------------------- | ------- | --------------------------------- |
| RLS en las 4 tablas           | off     | off                               |
| Políticas `storage.objects`   | **0**   | **8** (dashboard, no versionadas) |
| Límites de bucket (size/MIME) | NULL    | Configurados                      |
| Política `vehicle-documents`  | ninguna | ninguna                           |

**Los entornos NO son idénticos.** Cualquier migración de storage debe ser **idempotente** (`DROP POLICY IF EXISTS` + `CREATE`, o guard con `pg_policies`) para no fallar en prod (donde las políticas ya existen) y a la vez crearlas en staging.

---

## 5. Comprobación de inconsistencias existentes (solo `SELECT`, sin PII)

12 comprobaciones agregadas ejecutadas en **producción y staging**. **Todas dan 0.** Solo conteos, sin IDs ni PII.

| Comprobación                            | Qué detecta                                                                          | Por qué la detecta                                                       | Prod  | Staging |
| --------------------------------------- | ------------------------------------------------------------------------------------ | ------------------------------------------------------------------------ | ----- | ------- |
| `multi_accepted_offers_per_vehicle`     | Vehículos con >1 oferta `ACEPTADA`                                                   | `GROUP BY vehicle_id HAVING count(*)>1` sobre `offers.status='ACEPTADA'` | **0** | 0       |
| `accepted_offer_vehicle_incompatible`   | Oferta `ACEPTADA` con vehículo no `RESERVADO`/`VENDIDO`                              | join `offers`×`vehicles` con estado incompatible                         | **0** | 0       |
| `multi_active_reservations_per_vehicle` | >1 reserva activa (`ACEPTADA`+`deposit>0`) por vehículo                              | doble reserva con señal                                                  | **0** | 0       |
| `total_accepted_offers`                 | (contexto) ofertas aceptadas totales                                                 | —                                                                        | **0** | 0       |
| `completed_deliveries_without_warranty` | Entregas `COMPLETADA` sin garantía                                                   | `LEFT JOIN warranties ... IS NULL`                                       | **0** | 0       |
| `completed_deliveries_wrong_followups`  | Entregas completadas cuya garantía no tiene exactamente 2 follow-ups                 | `HAVING count(followups)<>2`                                             | **0** | 0       |
| `total_completed_deliveries`            | (contexto) entregas completadas                                                      | —                                                                        | **0** | 0       |
| `vendido_without_warranty`              | Vehículos `VENDIDO` sin ninguna garantía                                             | `NOT EXISTS warranties`                                                  | **0** | 0       |
| `captures_converted_without_lead`       | Captaciones `CONVERTIDO` sin `seller_lead_id`                                        | vínculo roto tras conversión                                             | **0** | 0       |
| `orphan_sellerleads_from_capture`       | `SellerLead` con actividad "Origen: captación%" pero sin captación que lo referencie | huérfano por fallo tras `create` fuera de la tx                          | **0** | 0       |
| `tradein_partial_links`                 | `BuyerLead` con `hasTradeIn` + camper/autocaravana pero sin `tradeInSellerLeadId`    | vínculo trade-in parcial                                                 | **0** | 0       |
| `total_converted_captures`              | (contexto) captaciones convertidas                                                   | —                                                                        | **1** | 0       |

**Conclusión:** **no hay inconsistencias de datos** en ninguno de los dos entornos. Los flujos transaccionales de riesgo (ofertas/reservas, entregas/garantías) **aún no se han ejercido en producción** (0 y 0). La única conversión de captación existente está bien formada. → **No se requiere reconciliación de datos** (sección 9 vacía por diseño), y los fixes preventivos pueden desplegarse sin riesgo de tocar datos inconsistentes.

_Limitación:_ las comprobaciones son un _snapshot_ del momento de la auditoría; si entre ahora y la implementación se usan esos flujos, conviene re-ejecutar los mismos `SELECT` antes de desplegar (están documentados aquí y son reproducibles).

---

## 6. Decisiones técnicas

### 6.1 SEG-01 — RLS e invariante

**Comparación de alternativas:**

| Criterio                       | A. Migraciones explícitas por tabla               | B. Test de invariante en CI | C. Event trigger DDL                                                                              |
| ------------------------------ | ------------------------------------------------- | --------------------------- | ------------------------------------------------------------------------------------------------- |
| Seguridad                      | Alta (explícito)                                  | Alta (previene regresión)   | Alta pero implícita                                                                               |
| Transparencia                  | Alta (greppable en `migrations/`)                 | Alta (falla visible en CI)  | **Baja** (magia oculta en DB)                                                                     |
| Mantenibilidad                 | Alta                                              | Alta                        | Media (código en la DB, fuera del repo salvo que se migre)                                        |
| Riesgo operativo               | Bajo                                              | Bajo                        | **Medio** (corre como superusuario en cada `CREATE TABLE`, puede sorprender a migraciones/Prisma) |
| Compatibilidad Prisma/Supabase | Total (raw SQL migration; Prisma no gestiona RLS) | Total                       | Media (Prisma no conoce el trigger; posibles efectos en `migrate`)                                |
| Diagnóstico                    | Fácil                                             | Fácil                       | **Difícil** (¿por qué esta tabla tiene RLS? no hay rastro en la migración)                        |
| Rollback                       | Fácil (`DISABLE RLS` en migración inversa)        | N/A (solo test)             | Medio (`DROP EVENT TRIGGER`)                                                                      |

**Decisión (según preferencia y evidencia): A + B, sin event trigger.**

- **A:** una migración raw SQL que activa RLS **explícitamente** en las 4 tablas: `ALTER TABLE public.offers ENABLE ROW LEVEL SECURITY;` (×4). Idempotente (re-enable = no-op). Sin políticas (deny-all; Prisma con `BYPASSRLS` sigue operando → **cero impacto en la app**).
- **B:** un test de invariante que **falla si cualquier tabla de `public` no tiene RLS habilitada**, ejecutado en CI. Esto cubre las tablas futuras (que era el objetivo del event trigger) de forma transparente y diagnosticable.
- **Descartado C:** el event trigger es implícito y difícil de diagnosticar; la invariante en CI da la misma garantía con más transparencia.

**Sobre el test de invariante (matiz de implementación):** hoy la CI usa DB dummy y **mockea Prisma** (no hay conexión real). La invariante necesita una DB con las migraciones aplicadas. Opciones, de más a menos robusta:

1. **Servicio Postgres en el job de CI** (`services: postgres`) → `prisma migrate deploy` → query `pg_class.relrowsecurity` para todas las tablas de `public`. Self-contained, determinista. _(Recomendada; añade ~1 min al job.)_
2. **Comprobación contra staging** en solo lectura (query `pg_class`) como paso post-deploy. Más simple pero acopla CI a staging.
3. **Interino:** script manual documentado hasta montar (1). Permite **no bloquear PR1** en la infraestructura de CI.

Recomendación: PR1 activa RLS ya (crítico) con un **script de verificación** que puede correr contra staging/prod en solo lectura; la invariante robusta en CI (opción 1) se consolida junto con la infraestructura de integración del PR0.

### 6.2 NEG-01 — Reserva atómica

- Mover la **decisión y la escritura del estado del vehículo dentro del `$transaction`**, con update condicional atómico:
  ```
  const r = await tx.vehicle.updateMany({ where: { id: veh.id, status: 'PUBLICADO' }, data: { status: 'RESERVADO' } })
  if (r.count === 0) throw new ConflictError('El vehículo ya no está disponible para reservar')
  ```
- **No** depender de la lectura previa fuera de la transacción (`ofertas/actions.ts:150-160`) para decidir el cambio.
- Hacer también **atómica la transición de la propia oferta** (evita doble-aceptar la misma oferta): `tx.offer.updateMany({ where: { id, status: <estado_esperado> }, data: {...} })` + comprobar `count`.
- La ruta inversa (liberar reserva: `CANCELADA`/`RETIRADA`/`EXPIRADA` → vehículo `PUBLICADO`) también debe ser condicional (`where: { id, status: 'RESERVADO' }`).
- Traducir `ConflictError` a un mensaje de usuario claro; el cliente muestra "el vehículo ya no está disponible".
- **Invariante de BD opcional (hardening):** índice único parcial `CREATE UNIQUE INDEX ON offers (vehicle_id) WHERE status='ACEPTADA' AND deposit_amount>0` → garantiza a nivel de motor una sola reserva viva por vehículo. Viable hoy sin conflicto (0 ofertas aceptadas). Evaluar semántica (¿puede haber dos `ACEPTADA` sin señal?) antes de aplicarlo; si hay dudas, dejarlo para revisión y confiar en el update condicional.

### 6.3 NEG-02 — Garantía y follow-ups

- **Misma transacción, mismas escrituras de la misma DB:** garantía + 2 follow-ups son escrituras locales → van **dentro** del `$transaction` de completar la entrega. Pasar `tx` a `createWarrantyForDelivery` (cambiar la firma a `PrismaClient | Prisma.TransactionClient`; la función solo usa `.delivery.findUnique`/`.warranty.create`/`.postventaFollowup.createMany`, disponibles en el cliente transaccional). Dentro de la misma tx, el `completedAt` recién escrito es visible.
- **Idempotencia:** antes de crear, comprobar garantía existente por `deliveryId` (o `upsert`), de modo que un reintento no lance por el `@unique`.
- **Efectos externos:** en el flujo de completar entrega **no hay** efectos externos (el email de confirmación está en `createDelivery`, no aquí). Por tanto **no** se necesita outbox para este fix. Si en el futuro se añade un email "entrega completada", quedaría fuera de la tx y sí requeriría el patrón diferido (Fase 2, fuera de alcance).
- Corregir el docstring de `create-warranty.ts:5` para reflejar la realidad.

### 6.4 NEG-03 — Conversión de captaciones y trade-in

- Envolver en un **único `$transaction`**: `sellerLead.create` (con vehicle + activity anidados) **+** `vehicleCapture.update` (status `CONVERTIDO` + `sellerLeadId`) **+** la nota de conversión. Así la idempotencia (`if capture.sellerLeadId return`) pasa a ser real: un reintento encuentra o bien la captación totalmente vinculada, o bien un estado limpio.
- **Efectos derivados fuera de la tx** (aceptable): `runAndSaveAutoValuation` y `recalculateMatchesForVehicle` (`captaciones/actions.ts:214,223`) son **reintentables** y no dejan la operación principal inconsistente si fallan. Mejorar: **registrar el fallo** (Sentry) en vez de tragarlo, y anotar la estrategia futura de reconciliación (un cron que re-tase/re-matchee vehículos en `NUEVO` sin valoración — Fase 2, fuera de alcance).
- Aplicar el mismo patrón en `compradores/[id]/trade-in-actions.ts` (`createSellerLeadFromTradeIn`).

### 6.5 SEG-02 — Storage privado

Con los matices de prod (buckets con límites, 8 políticas no versionadas, `vehicle-documents` sin política):

- **Versionar las políticas de `storage.objects` en una migración raw SQL idempotente** (`DROP POLICY IF EXISTS ...; CREATE POLICY ...`) que reproduzca el estado deseado en **ambos** entornos → elimina la divergencia y da fuente de verdad.
- **Añadir la política ausente de `vehicle-documents`** (espejo de `lead-documents`: read/insert/update/delete para `authenticated`) — sin ella la feature está rota.
- **Mover la subida a server-side:** un Server Action recibe el fichero (FormData), **valida MIME y tamaño en servidor** (no confiar en `accept` HTML), genera un **nombre de archivo seguro** y un **path con ownership verificable** (`{deliveryId}/{uuid}-{safeName}`), y sube usando el cliente de servidor **autenticado por la cookie del usuario** (`auth.role()='authenticated'`, que satisface las políticas). Alternativa: **URL firmada de subida de un solo uso** generada en el server. Evita exponer escritura del bucket a `anon` y centraliza la validación.
- **Descarga** ya usa URLs firmadas server-side (`lib/supabase/storage.ts`) — mantener.
- **Configurar límites de bucket también en staging** (igualar a prod) vía la definición versionada.
- **Ownership por path (hardening opcional):** tightening de las políticas a path-based en vez de solo `auth.role()` — anotado como mejora, **no obligatorio** en Fase 0 (staff de confianza).
- **No** depender de `accept` HTML como validación de seguridad.

---

## 7. Plan de implementación por PRs pequeños

Orden **recomendado** (difiere ligeramente del propuesto, justificado por la evidencia): **PR1 primero** (única exposición activa en prod), luego **PR0** (infraestructura de test que desbloquea la verificación de PR2-4), luego PR2→PR4 (integridad transaccional preventiva), y **PR5 al final** (storage: la feature está denegada, no expuesta → menor urgencia).

> Regla transversal: **no mezclar** seguridad, transacciones y storage en un mismo PR. Cada PR es revisable y reversible por separado.

### PR1 — RLS en las 4 tablas + invariante _(PRIMERO)_

- **Objetivo:** cerrar la exposición activa de `offers`/`calendar_events`/`vehicle_captures`/`kpi_events` y garantizar cobertura de tablas futuras.
- **Resuelve:** SEG-01.
- **Ficheros:** nueva migración `prisma/migrations/<ts>_enable_rls_new_public_tables/migration.sql`; script/test de invariante RLS (`scripts/check-rls.ts` o `tests/rls-invariant.test.ts`); ajuste de `.github/workflows/ci.yml` (opción 1 de §6.1, si se consolida ya).
- **Tablas:** `offers`, `calendar_events`, `vehicle_captures`, `kpi_events` (y verificación de todas las de `public`).
- **Migración:** `ALTER TABLE public.<t> ENABLE ROW LEVEL SECURITY;` ×4 (idempotente, sin políticas).
- **Código:** solo el script/test de invariante (no toca lógica de app).
- **Tests previos:** verificación en vivo (ya hecha) del estado actual; snapshot del advisor.
- **Tests posteriores:** advisor sin `rls_disabled_in_public`; invariante verde; comprobación de que un `GET /rest/v1/offers` con anon key devuelve 401/`[]` (verificación manual read-only).
- **Riesgo:** **muy bajo.** Prisma usa rol `BYPASSRLS` → la app no se ve afectada. `ALTER ... ENABLE RLS` es metadata-only (lock breve sobre cada tabla, instantáneo a cualquier tamaño).
- **Dependencias:** ninguna.
- **Despliegue:** **migración a prod primero** (fix crítico), la PR con el test/CI después. No requiere ventana de mantenimiento.
- **Verificación posterior:** re-consultar `pg_class.relrowsecurity` + advisor en prod y staging.
- **Rollback:** migración inversa `ALTER TABLE ... DISABLE ROW LEVEL SECURITY;` (vuelve al estado actual; no destruye datos).
- **Criterio de aceptación:** las 4 tablas con RLS on; advisor limpio en ambos entornos; invariante en CI (o script) que falla si una tabla de `public` no tiene RLS; anon key no puede leer ni escribir las tablas.
- **No incluir:** políticas RLS por organización (Fase 3), cambios de storage, cambios de lógica.

### PR0 — Línea base + infraestructura de tests de caracterización

- **Objetivo:** dejar registrada la línea base (esta sección) y **montar infraestructura de test de integración con Postgres real** (hoy inexistente: todo mockea Prisma), requisito para testar concurrencia/atomicidad/RLS de PR2-4.
- **Resuelve:** habilita TEST-01 (no lo cierra solo).
- **Ficheros:** config de test de integración (p. ej. Postgres efímero en CI o proyecto Supabase de test), helpers de seed/teardown, `vitest` project separado "integration".
- **Tests:** de caracterización que **reproduzcan** los fallos (rojo) donde sea viable: atomicidad de entrega, atomicidad de conversión. La concurrencia de NEG-01 se caracteriza mejor con dos transacciones simultáneas contra la DB real (posible solo con esta infra).
- **Riesgo:** bajo (solo tooling de test; no toca producción ni lógica).
- **Dependencias:** ninguna; puede ir en paralelo a PR1.
- **Rollback:** revertir el PR (no hay efectos en runtime).
- **Criterio de aceptación:** existe un comando `pnpm test:integration` que levanta DB real, aplica migraciones y ejecuta al menos un test de integración verde; CI lo ejecuta.
- **No incluir:** los fixes de comportamiento (van en PR2-4).

### PR2 — Reserva atómica de ofertas

- **Objetivo:** eliminar la carrera de doble reserva.
- **Resuelve:** NEG-01.
- **Ficheros:** `app/(backoffice)/ofertas/actions.ts`; nuevo test `app/(backoffice)/ofertas/actions.test.ts` + test de concurrencia (integración, sobre PR0).
- **Tablas:** `offers`, `vehicles` (+ opcional índice único parcial en `offers`).
- **Migración:** solo si se adopta el índice único parcial (opcional; tabla vacía → instantáneo).
- **Código:** update condicional `updateMany` dentro del `$transaction` + `ConflictError` + transición de oferta condicional.
- **Tests posteriores:** dos aceptaciones concurrentes → una OK, otra conflicto; nunca dos reservas activas.
- **Riesgo:** bajo (cambio localizado; 0 datos afectados).
- **Dependencias:** PR0 (para el test de concurrencia). El fix puede escribirse sin PR0, pero su test de concurrencia lo necesita.
- **Despliegue:** código; sin migración (salvo índice opcional → migración antes del código).
- **Rollback:** revertir el PR; (si se añadió el índice) `DROP INDEX`.
- **Criterio de aceptación:** test de concurrencia verde; el flujo manual de aceptar oferta sigue funcionando.
- **No incluir:** cambios en el modelo de reservas, pagos, contratos.

### PR3 — Entrega, garantía y follow-ups en una transacción

- **Objetivo:** garantizar que completar una entrega crea garantía + follow-ups atómicamente e idempotente.
- **Resuelve:** NEG-02.
- **Ficheros:** `app/(backoffice)/entregas/actions.ts`, `lib/postventa/create-warranty.ts` (firma `tx` + idempotencia + docstring); `entregas/actions.test.ts` (dejar de mockear la garantía en el caso de atomicidad; añadir test de idempotencia/rollback en integración).
- **Tablas:** `deliveries`, `warranties`, `postventa_followups`.
- **Migración:** ninguna.
- **Código:** mover `createWarrantyForDelivery` dentro del `$transaction` con `tx`; `upsert`/guard por `deliveryId`.
- **Tests posteriores:** completar entrega crea 1 garantía + 2 follow-ups; fallo simulado en la garantía revierte el estado de la entrega; reintentar no duplica.
- **Riesgo:** bajo (0 entregas completadas en prod).
- **Dependencias:** PR0 (test de rollback en integración).
- **Despliegue:** código; sin migración.
- **Rollback:** revertir el PR.
- **Criterio de aceptación:** tests verdes; el flujo de completar entrega sigue creando garantía.
- **No incluir:** outbox, emails nuevos, cambios en postventa.

### PR4 — Conversión de captaciones y trade-in atómica

- **Objetivo:** que la creación del lead+vehículo+actividad y el vínculo con la captación sean atómicos.
- **Resuelve:** NEG-03.
- **Ficheros:** `app/(backoffice)/captaciones/actions.ts`, `app/(backoffice)/compradores/[id]/trade-in-actions.ts`; nuevos `captaciones/actions.test.ts` + ampliar `trade-in-actions.test.ts`.
- **Tablas:** `seller_leads`, `vehicles`, `activities`, `vehicle_captures`, `buyer_leads` (trade-in).
- **Migración:** ninguna.
- **Código:** un único `$transaction` para create+vínculo+nota; efectos derivados (tasación/matching) fuera, con logging de fallo.
- **Tests posteriores:** conversión atómica; fallo tras `create` no deja huérfanos; reintentar no duplica; trade-in mantiene vínculos.
- **Riesgo:** bajo (0 huérfanos existentes).
- **Dependencias:** PR0 (integración).
- **Despliegue:** código; sin migración.
- **Rollback:** revertir el PR.
- **Criterio de aceptación:** tests verdes; conversión manual sigue funcionando.
- **No incluir:** `Party`, unificación de identidades, cambios de modelo.

### PR5 — Storage privado _(ÚLTIMO)_

- **Objetivo:** versionar las políticas de storage, reparar la subida de `vehicle-documents`, validar server-side y alinear entornos.
- **Resuelve:** SEG-02.
- **Ficheros:** nueva migración raw SQL idempotente de políticas + límites de bucket; nueva Server Action de subida validada; `documents-section.tsx` (llamar a la Server Action en vez de subir con anon); tests de autorización de storage.
- **Tablas/infra:** `storage.objects` (políticas), `storage.buckets` (límites).
- **Migración:** `DROP POLICY IF EXISTS ... ; CREATE POLICY ...` para `lead-documents`, `vehicle-photos` **y** `vehicle-documents` (nueva); ajustar límites de bucket en staging. **Idempotente** para no chocar con las políticas ya existentes en prod.
- **Código:** subida server-side (validación MIME/tamaño, nombre seguro, path con ownership) o URL firmada de un solo uso.
- **Tests posteriores:** el bucket privado rechaza subidas no autorizadas; MIME/tamaño se validan en servidor; un usuario no autenticado no puede subir.
- **Riesgo:** **medio** (cambia el flujo de subida y toca políticas que ya existen en prod). Mitigación: migración idempotente + probar primero en staging + la subida actual ya está denegada (no se rompe nada que funcione).
- **Dependencias:** PR1 (disciplina de seguridad); PR0 (tests).
- **Despliegue:** **migración de políticas primero** (repara `vehicle-documents` + versiona), luego el código de subida server-side.
- **Verificación posterior:** subir un documento de entrega end-to-end en staging; confirmar rechazo de MIME/tamaño inválidos; advisor de storage.
- **Rollback:** migración inversa que restablezca las políticas previas (documentar el estado actual de prod antes de tocar); revertir el código de subida.
- **Criterio de aceptación:** políticas versionadas e idénticas en staging/prod; subida de documentos funciona server-side con validación; sin subida posible con anon.
- **No incluir:** ownership por path estricto (hardening posterior), reorganización de buckets, borrado RGPD.

---

## 8. Migraciones previstas

Ninguna se genera ni aplica ahora. Todas se escriben como raw SQL en `prisma/migrations/` (Prisma no modela RLS/políticas; las aplica `prisma migrate deploy`, coherente con el flujo actual del proyecto).

| Migración                                | PR  | SQL (pseudocódigo)                                                                                                                                                                       | Bloqueos                                     | Compatible con prod activa | Tiempo      | Pérdida de datos | Bloqueo de escrituras | Rollback                                   | Ventana |
| ---------------------------------------- | --- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------- | -------------------------- | ----------- | ---------------- | --------------------- | ------------------------------------------ | ------- |
| Enable RLS 4 tablas                      | PR1 | `ALTER TABLE public.{offers,calendar_events,vehicle_captures,kpi_events} ENABLE ROW LEVEL SECURITY;`                                                                                     | Lock `ACCESS EXCLUSIVE` brevísimo por tabla  | ✅ Sí (Prisma BYPASSRLS)   | Instantáneo | Ninguno          | No (instantáneo)      | `DISABLE ROW LEVEL SECURITY`               | No      |
| Índice único parcial reservas (opcional) | PR2 | `CREATE UNIQUE INDEX CONCURRENTLY ... ON offers (vehicle_id) WHERE status='ACEPTADA' AND deposit_amount>0`                                                                               | `CONCURRENTLY` evita lock de escritura       | ✅ Sí (0 filas)            | Instantáneo | Ninguno          | No (concurrently)     | `DROP INDEX`                               | No      |
| Políticas storage + límites              | PR5 | `DROP POLICY IF EXISTS ...; CREATE POLICY ...` (lead-documents, vehicle-photos, **vehicle-documents nuevo**); `UPDATE storage.buckets SET file_size_limit/allowed_mime_types` en staging | Locks breves en `storage.objects` (metadata) | ✅ Sí (idempotente)        | Segundos    | Ninguno          | No                    | Restaurar políticas previas (documentadas) | No      |

**Verificación previa a cada migración:** re-ejecutar los `SELECT` de estado (RLS/policies/grants) para confirmar el punto de partida. **Verificación posterior:** re-consultar el mismo estado + advisor. **Ninguna migración es destructiva ni requiere ventana de mantenimiento.**

---

## 9. Reconciliación de datos

**No aplica.** Las 12 comprobaciones de inconsistencias (§5) dan **0 en producción y staging**. No hay datos huérfanos, dobles reservas, entregas sin garantía ni conversiones rotas que reparar. Los fixes de Fase 0 son **preventivos**.

_Salvaguarda:_ re-ejecutar los `SELECT` de §5 inmediatamente antes de desplegar PR2/PR3/PR4. Si para entonces existiera algún registro inconsistente (porque el flujo se usó entre medias), se abriría aquí un sub-apartado con: tipo, nº de registros, cómo identificarlos (IDs parciales), decisión de negocio necesaria, propuesta de reparación en pseudocódigo y casos de revisión manual — **sin ejecutar reparaciones** hasta aprobación.

---

## 10. Testing obligatorio de la Fase 0

| Test                                           | Tipo                     | Entorno                     | Estado inicial                  | Acción                                   | Resultado esperado                        | Limpieza                 | CI              |
| ---------------------------------------------- | ------------------------ | --------------------------- | ------------------------------- | ---------------------------------------- | ----------------------------------------- | ------------------------ | --------------- |
| Todas las tablas de `public` tienen RLS        | Integración/infra        | Postgres CI con migraciones | esquema aplicado                | query `pg_class.relrowsecurity`          | ninguna sin RLS                           | —                        | ✅ (bloqueante) |
| anon no puede leer las 4 tablas                | Integración              | DB test / staging RO        | RLS on                          | `SELECT` como `anon` vía PostgREST       | 0 filas / 401                             | —                        | ✅              |
| anon no puede insertar/actualizar/borrar       | Integración              | DB test                     | RLS on                          | `INSERT/UPDATE/DELETE` como `anon`       | denegado                                  | rollback                 | ✅              |
| Bucket privado rechaza subida no autorizada    | Integración              | staging                     | políticas aplicadas             | upload como `anon` a `vehicle-documents` | denegado                                  | borrar objeto si se creó | ✅              |
| MIME/tamaño validados en servidor              | Integración              | —                           | Server Action                   | subir fichero inválido                   | rechazo server-side                       | —                        | ✅              |
| Dos aceptaciones concurrentes, mismo vehículo  | Integración/concurrencia | Postgres real               | vehículo `PUBLICADO`, 2 ofertas | aceptar ambas en paralelo                | solo 1 OK; otra conflicto; 1 sola reserva | truncate test data       | ✅              |
| Completar entrega crea garantía + 2 follow-ups | Integración              | Postgres real               | entrega firmada, checklist OK   | completar                                | 1 garantía + 2 follow-ups atómicos        | truncate                 | ✅              |
| Fallo en garantía no deja entrega a medias     | Integración              | Postgres real               | idem + fallo inyectado          | completar                                | rollback total                            | truncate                 | ✅              |
| Reintentar completar no duplica                | Integración              | Postgres real               | entrega ya completada           | reintentar                               | sin duplicados (idempotente)              | truncate                 | ✅              |
| Conversión de captación atómica                | Integración              | Postgres real               | captación `ENTRADA_AGENDADA`    | convertir                                | lead+vehículo+vínculo o nada              | truncate                 | ✅              |
| Fallo en conversión no deja lead huérfano      | Integración              | Postgres real               | idem + fallo inyectado          | convertir                                | rollback; sin huérfanos                   | truncate                 | ✅              |
| Reintentar conversión no duplica               | Integración              | Postgres real               | captación convertida            | reintentar                               | idempotente                               | truncate                 | ✅              |
| Trade-in mantiene vínculos                     | Integración              | Postgres real               | buyer con trade-in camper       | convertir                                | `tradeInSellerLeadId` seteado             | truncate                 | ✅              |

Los tests de lógica pura existentes (`lib/offers`, `lib/captacion`, `lib/postventa/create-warranty`, 543 en total) se mantienen. La novedad es la **capa de integración con DB real** (PR0), sin la cual la concurrencia/atomicidad/RLS no son testables.

---

## 11. Despliegue seguro

Secuencia por PR (todas las migraciones son no destructivas, sin ventana de mantenimiento):

1. **Preparación:** re-ejecutar los `SELECT` de estado (§4/§5) para confirmar el punto de partida; confirmar project ref de prod.
2. **Punto de restauración:** crear un backup/PITR de prod antes de cualquier migración (prod está en plan Pro → PITR disponible). Registrar el estado actual de las políticas de storage antes de PR5 (para el rollback).
3. **Migración:** aplicar con `prisma migrate deploy` contra **staging primero**, verificar, luego prod.
4. **Despliegue de código:** tras la migración (para PR1 y PR5, migración antes que código; PR2-4 no tienen migración salvo el índice opcional de PR2).
5. **Smoke tests:** login backoffice; abrir una ficha; (PR2) aceptar una oferta de prueba en staging; (PR3) completar una entrega de prueba en staging; (PR5) subir un documento en staging.
6. **Verificación de RLS:** advisor + `pg_class` en prod tras PR1.
7. **Verificación de flujos:** re-ejecutar los `SELECT` de inconsistencias (§5) → deben seguir en 0.
8. **Monitorización:** Sentry (errores nuevos), logs de Vercel, tras cada deploy.
9. **Criterios de rollback:** ver cada PR. Para PR1, si (improbable) la app fallara, `DISABLE RLS` restablece en segundos. Para PR5, restaurar las políticas de storage documentadas.

**Orden migración↔código:** PR1 y PR5 → **migración antes que código** (la migración es independiente y segura; el código depende del nuevo estado). PR2-4 → **código sin migración** (salvo el índice opcional de PR2, que iría antes). No se requiere despliegue en dos fases con compatibilidad temporal para ningún PR de Fase 0 (los cambios son compatibles hacia atrás).

**Staging ≠ producción:** confirmado en §4 (políticas de storage divergentes). Por eso todo pasa por staging primero y las migraciones de storage son idempotentes.

---

## 12. Rollback (resumen)

| PR  | Rollback                                                                                                     |
| --- | ------------------------------------------------------------------------------------------------------------ |
| PR1 | Migración inversa `ALTER TABLE ... DISABLE ROW LEVEL SECURITY` (vuelve al estado actual; no destruye datos). |
| PR0 | Revertir el PR (solo tooling de test).                                                                       |
| PR2 | Revertir el PR; si se añadió el índice, `DROP INDEX`.                                                        |
| PR3 | Revertir el PR (código).                                                                                     |
| PR4 | Revertir el PR (código).                                                                                     |
| PR5 | Restaurar las políticas de storage previas (documentadas antes de aplicar) + revertir el código de subida.   |

Todos los rollbacks son de bajo riesgo porque: (a) no hay datos que migrar; (b) las migraciones son additivas/metadata; (c) los cambios de código son compatibles hacia atrás.

---

## 13. Riesgos residuales

- **SEG-01 en producción sigue abierto hasta desplegar PR1.** Es el único riesgo **activo**; recomendación: desplegar PR1 lo antes posible (es aislado y de riesgo casi nulo).
- **PR5 toca políticas creadas por panel en prod.** Riesgo medio mitigado por idempotencia + prueba en staging + documentar el estado previo. Si el equipo prefiere, PR5 puede subdividirse: (5a) versionar/añadir políticas; (5b) mover la subida a server-side.
- **La invariante RLS robusta requiere infraestructura de CI con Postgres** (PR0). Hasta consolidarla, la garantía de "tablas futuras cubiertas" depende de un script manual/against-staging. Riesgo bajo si se prioriza montar la infra.
- **`vehicle-documents` roto en prod** (subida denegada) es un bug latente que PR5 repara; hasta entonces, esa feature no funciona (no es una regresión nueva).
- **Hallazgos fuera de alcance detectados en el advisor** (no Fase 0, anotados para el backlog): `public_bucket_allows_listing` en `vehicle-photos`, `extension_in_public` (vector), `auth_leaked_password_protection`. No urgentes.
- **Cobertura e2e de backoffice sigue ausente** tras la Fase 0 (los tests nuevos son de integración, no e2e). Aceptable para Fase 0; e2e queda para más adelante.

---

## 14. Criterios de finalización de la Fase 0

La Fase 0 se considera cerrada cuando:

1. Advisor de seguridad de Supabase **sin ningún `rls_disabled_in_public`** en **producción y staging**; las 4 tablas con RLS on; verificado que la anon key no puede leer/escribir esas tablas.
2. Existe una **invariante** (test CI con Postgres, u opción interina documentada) que **falla si cualquier tabla de `public` carece de RLS**.
3. La aceptación de oferta es **atómica**: test de concurrencia verde; imposible una segunda reserva viva sobre el mismo vehículo.
4. Completar una entrega crea garantía + follow-ups **atómicamente e idempotente**: tests verdes; un fallo no deja la entrega "a medias".
5. La conversión de captación/trade-in es **atómica**: sin huérfanos ante fallo; idempotente ante reintento; tests verdes.
6. La subida de documentos privados es **server-side, validada (MIME/tamaño), con nombre/path seguros**; las políticas de storage están **versionadas** e **idénticas en staging y prod**; el bucket privado rechaza subidas no autorizadas.
7. Existe **infraestructura de test de integración** con DB real ejecutándose en CI, cubriendo los flujos anteriores.
8. `typecheck` + `lint` + `test` (unit) + `test:integration` **verdes** en CI; línea base de 543 tests preservada o ampliada.
9. Re-ejecución de las 12 comprobaciones de inconsistencias (§5) → **0** en ambos entornos.

---

## 15. Recomendación: qué PR implementar primero

**PR1 (RLS + invariante).**

- **Por qué primero:** es la **única exposición de seguridad activa en producción** (datos de negocio y PII accesibles con la clave pública **ahora**). Los hallazgos NEG-01/02/03 son latentes (0 datos afectados, flujos aún no usados); SEG-02 está denegado (roto), no expuesto. PR1 es el único que cierra un riesgo en curso.
- **Riesgo de esa primera implementación:** **muy bajo.** Prisma accede con un rol `BYPASSRLS`, así que activar RLS en esas 4 tablas **no afecta a la aplicación**; `ALTER TABLE ... ENABLE ROW LEVEL SECURITY` es metadata-only e instantáneo; el rollback es un `DISABLE` inmediato. Sin migración de datos, sin cambios de lógica, aislado del resto.
- **Aislamiento:** no depende de PR0 ni de ningún otro PR para su corrección (la invariante robusta en CI puede consolidarse con PR0, pero el fix de seguridad se puede desplegar de inmediato con verificación read-only).

En paralelo, **PR0** (infraestructura de test de integración) puede empezar, ya que desbloquea la verificación de concurrencia/atomicidad de PR2-PR4.

---

_Fin del plan. Documento de planificación; no se ha modificado código, esquema, migraciones, políticas, configuración ni datos. No implementar ningún PR hasta aprobación explícita._
