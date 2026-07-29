# Release — CAP-1 en producción (fast-track por urgencia operativa)

**Fecha:** 2026-07-29 · **PR:** #150 (squash `145359f`) · **Migración:** `20260728130000_cap1_business_fields_nullable`

> **Excepción autorizada:** Joel autorizó un rollout productivo fast-track de CAP-1 **omitiendo la
> validación autenticada previa en staging**, tras la revisión dirigida completada (buyer revertido,
> valoración desacoplada, 11 columnas auditadas) y CI verde.
> _Authenticated staging validation skipped under explicit operational urgency; production validation
> completed with one isolated synthetic dossier and exact cleanup._

## Alcance

Captación progresiva en el **CRM interno**: SellerLead, Vehicle, captación de portal y vehículo de
parte de pago pueden crearse/guardarse **sin campos de negocio obligatorios**; ausencia → `null`
(nunca placeholders); formato validado solo si hay valor. **BuyerLead y `/vender` públicos intactos.**
Gates A2/A3 y valoración preliminar (desacoplada, post-commit, no bloqueante) preservados.

## Migración (DB-first)

- 11 `ALTER … DROP NOT NULL`: `seller_leads.{name,email,phone}`, `vehicles.{brand,model,year,km,seats,type}`,
  `vehicle_captures.{listing_url,phone}`. **`buyer_leads` NO tocada.**
- Redacción canónica: _Backward-compatible nullable-relaxation migration; DROP NOT NULL only; no DML,
  no backfill and no destructive data operation._ Checksum SHA-256 `cb2d2dd3ba5380e10fcc16818789a5140ec368d4cf527d507666de5da29812b9`.
- Aplicada con `prisma migrate deploy` (conexión directa `.env` → prod `bbmglaatlyilxutzomxd`), **antes**
  del merge/deploy del cliente. `migrate status` previo: CAP-1 única pendiente.

## Preflight / Postflight (read-only)

| Métrica                                                  | Preflight           | Postflight          | Cleanup final           |
| -------------------------------------------------------- | ------------------- | ------------------- | ----------------------- |
| vehicles / seller_leads / buyer_leads / vehicle_captures | 52 / 52 / 117 / 3   | 52 / 52 / 117 / 3   | **52 / 52 / 117 / 3**   |
| valuations / attempts / work_orders / activities / users | 0 / 1 / 4 / 256 / 8 | 0 / 1 / 4 / 256 / 8 | **0 / 1 / 4 / 256 / 8** |
| catálogo tables/columns/indexes/FKs                      | 33 / 480 / 124 / 77 | 33 / 480 / 124 / 77 | —                       |
| tablas sin RLS                                           | 0                   | 0                   | 0                       |

Las 11 columnas pasaron de `NOT NULL` (`NO`) a nullable (`YES`); `buyer_leads.{name,email,phone}`
permanecen `NO`. Migración registrada (`applied=true`, `rolledBack=false`). **Cero DML/backfill.**

## Merge + Deployment

- PR #150 → Ready → squash merge a `main` = `145359f`.
- Vercel deployment `dpl_B1defat4src6XG8LWrn6DENthGhn`: **state READY, target production, commit `145359f`**,
  alias `campersnova.com`. (No se usó un deployment anterior como evidencia.)

## Smoke autenticado en producción (sesión ADMIN legítima de Joel)

- Read-only: `/vendedores` (52), formularios de alta/edición, `/compradores/nuevo`, `/vender` público
  renderizan; sin P2022/Prisma/5xx.
- **Único expediente sintético** (SellerLead `cms5qaagg0001la04yp70s7ld` / Vehicle `cms5qaagg0002la04rp9qlcbx`):
  - **§8.1** alta con TODOS los campos vacíos → guarda, genera IDs, persiste **NULL reales** (name/email/
    phone/brand/model/year/km/seats/type/plate/vin/desiredPrice/salePrice/location = null), **sin placeholders**,
    navega al expediente, fallback "Vehículo sin identificar", sin 500.
  - **§8.2** edición progresiva: brand→"CAP1-PROD-SMOKE" persiste; borrado→`null` de nuevo.
  - **§8.3** valoración preliminar: 3 intentos `SIN_REFERENCIA`/PRELIMINAR (append-only), `valuations=0`,
    status siempre `NUEVO`, `salePrice` null → **no bloquea, no revierte, no habilita matching**.
  - **§8.4** gates: `NUEVO`, "Listo p/publicar 0%" → no puede tasar oficial/publicar/matchear.
  - **§8.5** compradores conservan `Nombre*/Email*/Teléfono*`; `/vender` mantiene requisitos.

## Limpieza

Borrado transaccional por **IDs exactos** (3 attempts + 1 kpi_event + vehicle + seller_lead); sin
prefijos amplios; sin objetos Storage ni usuarios Auth creados. Conteos **de vuelta al baseline
exacto**; `sellerLead` sintético restante: 0. Cero residuos, cero afectación a datos reales.

## Sentry / observación

Sin issues nuevas en las 2 h posteriores al deploy (sin P2022/Prisma/5xx/ServerAction). El error de
hidratación pre-existente de `/compradores/[id]` (`CAMPERNOVA-CRM-G`) es **anterior y separado** — no
se mezcla con CAP-1. **Observación de 24 h: PENDIENTE** (no declarada completa).

## Hallazgo (deuda menor, no bloqueante)

El **breadcrumb de la ficha de vendedor** (y el `<title>`) renderiza `NULL NULL` cuando el nombre es
`null`, en lugar de un fallback tipo "Vendedor sin identificar" (el _hero_ sí usa el fallback). Es
cosmético (el dato está correctamente en `null`, no hay 500). Corrección fuera del alcance fast-track
→ seguimiento posterior (aplicar `personLabel` al breadcrumb/título de `vendedores/[id]`).

## No incluido

PUB-1, B1A, DATA-1, historial de `salePrice`, marketplace/SaaS/multiempresa. A3 sigue con su
observación de 24 h diferenciada.
