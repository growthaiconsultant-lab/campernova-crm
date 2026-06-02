# Arquitectura — Campernova CRM

Documento de diseño del sistema. Para el estado feature-by-feature y decisiones históricas detalladas, ver `CLAUDE.md`. Para decisiones estructurales, ver `docs/adr/`.

---

## 1. Visión del sistema

Aplicación **Next.js 14 (App Router)** desplegada en **Vercel**, con **Supabase** (Postgres + Auth + Storage + pgvector) como backend y **Prisma** como ORM.

```
                 ┌─────────────────────────── Vercel ───────────────────────────┐
   Navegador ──► │  Next.js App Router                                           │
                 │   ├─ RSC (Server Components)  ── render por defecto            │
                 │   ├─ Client Components        ── solo donde hay interactividad │
                 │   ├─ Server Actions           ── mutaciones (no API routes)    │
                 │   ├─ Route Handlers (app/api) ── chat, cron, descargas         │
                 │   └─ middleware.ts            ── auth gate (rutas protegidas)  │
                 └───────────┬───────────────────────────────┬──────────────────┘
                             │ Prisma                         │ supabase-js / ssr
                             ▼                                 ▼
                    ┌──────────────────┐            ┌────────────────────────┐
                    │ Supabase Postgres│            │ Supabase Auth / Storage│
                    │  (Prisma schema) │            │ magic link · buckets   │
                    └──────────────────┘            └────────────────────────┘

   Cron (Vercel)  ──► /api/cron/postventa-followups (09:00 UTC diario)
   Servicios:  Resend (email) · Sentry (errores) · PostHog (analytics) · hCaptcha · Anthropic (chat + anuncios)
```

**Convenciones** (ver `CLAUDE.md` § Convenciones): Server Components por defecto; Server Actions para mutaciones; validación Zod en cliente y servidor; estados como enums Prisma + máquinas de estado centralizadas; tests Vitest (lógica) + Playwright (e2e).

---

## 2. Modelo de datos

Entidades núcleo y relaciones (Prisma — `prisma/schema.prisma`):

```
User ──< SellerLead ──1 Vehicle ──< VehiclePhoto
  │           │            │  ├──< Valuation        (histórico de tasaciones)
  │           │            │  ├──< VehicleAd         (anuncios Wallapop/Coches.net)
  │           │            │  ├──< VehicleCost       (compra, taller, piezas, garantía)
  │           │            │  ├──< VehicleDocument   (expediente legal, 11 categorías)
  │           │            │  └──< WorkOrder ──< {Checklist, TimeEntry, Part}
  │           │            └──< Match >── BuyerLead
  │           └──< Activity (timeline polimórfico: seller/buyer)
  │
  └──< BuyerLead ──1 BuyerChatSession   (conversación del portal /comprar)
            │
            └──< Delivery ──1 Warranty ──< PostventaTicket ──< TicketPhoto
                     │            └──< PostventaFollowup (DIA_7, DIA_30)
                     ├──< DeliveryChecklistItem
                     └──< DeliveryDocument

ReferencePrice   (tabla de precios de mercado para el fallback de tasación)
```

`Activity` es el timeline polimórfico (referencia `sellerLeadId` **o** `buyerLeadId`); los eventos de Vehicle/WorkOrder/Delivery se loguean bajo el `sellerLeadId` asociado. Los `ActivityType` cubren cambios de estado, notas, WhatsApp, asignaciones, taller, entregas, garantías, follow-ups y bloqueos de publicación.

---

## 3. Mapa de módulos (`lib/`)

Lógica de negocio **pura** con dependencias inyectables (fácil de testear), separada de la UI:

| Módulo                 | Responsabilidad                                                                                                                                        |
| ---------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `lib/valuation/`       | Algoritmo de tasación: comparables internos → fallback a `ReferencePrice` → ajustes (conservación, equipamiento, año). Persistencia de histórico.      |
| `lib/matching/`        | Matching comprador↔vehículo: filtros duros + scoring 4 ejes (equip 40 / precio 25 / antigüedad-km 20 / zona 15). Recálculo idempotente + notificación. |
| `lib/vehicle-legal/`   | Validación del expediente legal y reglas de bloqueo de publicación por estado (TASADO / PUBLICADO).                                                    |
| `lib/postventa/`       | Creación de garantía al completar entrega, imputación de coste de tickets, ampliación de garantía.                                                     |
| `lib/ads/`             | Generación de anuncios (Wallapop / Coches.net) con visión multimodal (Anthropic) + knowledge base.                                                     |
| `lib/margin/`          | Cálculo de margen/rentabilidad por vehículo (interno, nunca visible al cliente).                                                                       |
| `lib/dashboard/`       | Métricas financieras y operativas (stock, rotación, funnels, tiempo por estado).                                                                       |
| `lib/email/`           | Resend: plantillas + envío no bloqueante (confirmaciones, notificaciones a agentes, matches, entregas, tickets).                                       |
| `lib/chat/`            | System prompt + tools del asistente del portal comprador (`/comprar`).                                                                                 |
| `lib/state-machine.ts` | Transiciones válidas + labels/colores de SellerLead, Vehicle, BuyerLead, Match.                                                                        |
| `lib/auth.ts`          | Guards RBAC (`requireAuth`, `requireRole`, helpers semánticos por módulo).                                                                             |
| `lib/supabase/`        | Clientes browser/server/middleware + helpers de Storage.                                                                                               |
| `lib/validators/`      | Schemas Zod compartidos (input/output) para formularios y server actions.                                                                              |

---

## 4. Flujos clave

**Captación de vendedor** (`/vender` público o backoffice): form (Zod + hCaptcha) → `SellerLead` + `Vehicle` (tx) → subida de fotos a Storage → tasación automática → email de confirmación + notificación a agentes → recálculo de matches.

**Tasación** (`lib/valuation`): al crear/editar vehículo → busca ≥3 comparables vendidos; si no, cae a `ReferencePrice` por año más cercano → aplica ajustes → persiste `Valuation` + denormaliza `valuationMin/Recommended/Max` en `Vehicle`. NUEVO→TASADO si hay resultado.

**Matching** (`lib/matching`): filtros duros (tipo, plazas, presupuesto +10%) → scoring 4 ejes → top 10 → persiste `Match` (idempotente). Score ≥70 → email a agentes (throttle 30 min).

**Entrega → garantía** (`lib/postventa`): `Delivery` PROGRAMADA→EN_CURSO→COMPLETADA (requiere checklist + firma) → al COMPLETADA crea `Warranty` (12m) + 2 `PostventaFollowup` (día 7 y 30) en la misma tx. Cron diario procesa follow-ups pendientes.

---

## 5. Máquinas de estado

Centralizadas en `lib/state-machine.ts` (Match y WorkOrder/Ticket/Delivery tienen sus mapas en sus respectivos módulos). Estados terminales en **negrita**; las transiciones se validan en el servidor antes de escribir y se loguean como `CAMBIO_ESTADO`.

- **SellerLead**: NUEVO → CONTACTADO → CUALIFICADO → EN_NEGOCIACION → CERRADO / **DESCARTADO**
- **Vehicle**: NUEVO → TASADO → PUBLICADO → RESERVADO → **VENDIDO** / **DESCARTADO** (guards de expediente legal en TASADO y PUBLICADO; VENDIDO exige entrega firmada)
- **BuyerLead**: NUEVO → CONTACTADO → CUALIFICADO → EN_NEGOCIACION → CERRADO / **PERDIDO**
- **Match**: SUGERIDO → PROPUESTO_CLIENTE → VISITA → OFERTA → **CERRADO** / **RECHAZADO**
- **Delivery**: PROGRAMADA → EN_CURSO → **COMPLETADA** / **CANCELADA**
- **WorkOrder**: PENDIENTE → EN_DIAGNOSTICO → PRESUPUESTADA → EN_CURSO → **COMPLETADA** / **RECHAZADA** (aprobación CEO si `estimatedCost > approvalLimit`)
- **PostventaTicket**: ABIERTO → EN_PROGRESO → RESUELTO → **CERRADO** / **ANULADO** (imputa coste al vehículo al cerrar)

---

## 6. Autenticación y permisos

**Magic link (Supabase Auth)**: `/login` envía OTP (solo a emails presentes en `User`) → `/auth/callback` intercambia el code, sincroniza `authId` y redirige a `/dashboard`. `middleware.ts` protege todo salvo `PUBLIC_PATHS`.

**RBAC** (`lib/auth.ts`): 5 roles — `ADMIN`, `AGENTE`, `TALLER`, `ENTREGAS`, `MARKETING`. Guards en server actions (`requireRole`/helpers semánticos), en páginas (redirect `?error=forbidden`) y en UI (`userHasRole`). El sidebar filtra navegación por rol.

---

## 7. Almacenamiento (Supabase Storage)

- **`vehicle-photos`** — público; URLs directas. Visibilidad controlada en app (no se muestran si el vehículo no está PUBLICADO).
- **`vehicle-documents`** — privado; URLs firmadas (expediente legal). Path `docs/{vehicleId}/{categoria}_{timestamp}.{ext}`.

Compresión de imágenes en cliente con canvas nativo (≤1.5 MB), sin librería externa.

---

## 8. Jobs / Cron

- **`/api/cron/postventa-followups`** (Vercel cron, 09:00 UTC): procesa `PostventaFollowup` pendientes y vencidos → envía email → marca ENVIADO/FALLIDO. Auth por `Bearer $CRON_SECRET` (solo en prod).

---

## 9. Despliegue y entornos

- **Vercel**: Production (`main`) → Supabase prod · Preview (PRs) → Supabase **staging** · Development (local).
- **CI** (`.github/workflows/ci.yml`): `quality` (typecheck + lint + test) — gate de merge en `main`.
- **E2E** (`.github/workflows/e2e.yml`): autenticado contra staging, manual/nightly, no bloqueante.
- **Migraciones**: se prueban en staging (vía el Preview del PR) antes de llegar a prod. Workflow detallado en `CLAUDE.md`.

Matriz de variables de entorno: ver `README.md` § Entornos y `.env.example`.

---

## 10. Observabilidad

- **Sentry**: client + server + edge configs; source maps en build (requiere `SENTRY_AUTH_TOKEN`).
- **PostHog**: analytics con consentimiento (opt-out por defecto hasta aceptar cookies); funnel del form `/vender`.
