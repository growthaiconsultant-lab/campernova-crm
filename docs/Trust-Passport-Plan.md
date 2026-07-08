# Block 20 — Trust Passport unificado (Trust Layer)

Capa de **confianza** del roadmap infraestructura. Fusiona el **expediente legal** (Block 4) y el **checklist técnico del taller** en una única **vista de verificación con estados**, un score, y el sello **"Verificado por CampersNova"** — convertible en estándar de mercado y palanca de demanda pull (el comprador empieza a preguntar "¿está verificado?").

## Decisión de modelado

**Agregación, no tabla nueva de checks** (coherente con el calendario B15). El pasaporte se **calcula en lectura** desde el expediente legal + el último parte de taller. Lo único que se persiste es el **sello**: `Vehicle.trustVerifiedAt` + `trustVerifiedById` + `trustNotes` (migración additiva mínima).

## Schema (migración additiva `20260710000000_add_trust_passport`, aplicada a staging)

- `Vehicle.trustVerifiedAt` / `trustVerifiedById` (FK User `TrustVerifications`, ON DELETE SET NULL) / `trustNotes`.
- `ActivityType += TRUST_SELLO_OTORGADO, TRUST_SELLO_REVOCADO`.

## Lógica (`lib/trust-passport/`, puro + tests)

- **`buildTrustPassport(input, now)`** → secciones (Documentación legal + Estado técnico) con estados por check (`ok`/`warn`/`fail`/`pending`), **score 0-100**, **level** (VERIFICADO/PARCIAL/INCOMPLETO) y **`eligibleForSeal` + `blockers`**.
  - Legal: ITV vigente (warn si <60 días, fail si caducada), cargas DGT, titularidad, VIN, 7 docs obligatorios.
  - Técnico: agrega el checklist del último parte de taller por categoría (Mecánica / Camper / Electricidad) — `NECESITA_REPARACION` → fail, `PENDIENTE` → pending, resto → ok; sin parte → pending.
- `aggregateTechnicalCategory`, `CHECK_STATE_LABELS/COLORS`.
- **`prisma-deps.ts` → `getTrustPassportInput(db, vehicleId)`**: construye el input (docs + checklist del último WorkOrder).

## Server actions (`vendedores/[id]/trust-actions.ts`, guard `requireAgente`)

- **`grantTrustSeal(vehicleId, notes?)`**: solo si `eligibleForSeal`; escribe el sello + Activity. Idempotente.
- **`revokeTrustSeal(vehicleId)`**: limpia el sello + Activity.

## UI

- **`components/trust-passport-panel.tsx`**: panel en la pestaña **Preparación** de la ficha del vendedor — badge de nivel+score, estado del sello (emitir / emitido con fecha+autor / revocar), lista de bloqueos si no es elegible, y las secciones con checks coloreados.
- **Público** (dato seguro, `PublicVehicle.verified = trustVerifiedAt != null`): badge **"Verificado por CampersNova"** en `/comprar/[id]` y en la card del catálogo. Es la palanca comercial de cara al comprador.

## Pendiente (siguientes fases de confianza)

Sello externo/URL verificable (QR), verificación por terceros vía API (capa 9 del roadmap), y checks técnicos dedicados de trust (humedades, gas, agua) como ítems propios si se quiere separar del checklist de taller.
