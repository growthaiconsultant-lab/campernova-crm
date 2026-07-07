# Captación de vehículos (portales) — Plan

**Origen**: hoja "Gestión de venta" del dueño (② y ①) + conversación 2026-07-07.
**Qué es**: cómo los comerciales registran vehículos que **encuentran ellos en portales** (Coches.net, Wallapop, Milanuncios…), no los que entran por la web. Es la **fase 0** del embudo del vendedor.

## Principios (acordados con el dueño)

1. **Fricción cero**: pegar link + teléfono + un clic de estado. Nada de ficha completa al captar → si no es más rápido que un WhatsApp, no lo usan.
2. **La "cita confirmada" es una ENTRADA** (recepción del vehículo en la nave), no una "Cita" de comprador. El estado se llama **"Entrada agendada"**.
3. **Convierte, no duplica**: cuando el vehículo llega, un clic convierte la captación en `SellerLead` + `Vehicle` (patrón ya usado: trade-in → seller lead; chat session → buyer lead). La captación es entidad **ligera**, NO se mete en `SellerLead`.
4. **Trazabilidad**: portal de origen + dedup por teléfono/link (dos comerciales no persiguen el mismo anuncio).

## Embudo completo (cómo conecta)

Captación (portal) → Contacto → En curso → **Entrada agendada** (evento en calendario) → llega el vehículo → **Convertir a ficha** (`SellerLead`+`Vehicle`, = "Apertura de ficha" del ②) → papeleo (contrato vendedor, cuestionario, taller, fotos, anuncio, publicar — ya existe casi todo).

## Modelo de datos

**`VehicleCapture`** (entidad ligera):

- `listingUrl` (link del anuncio) · `phone` · `portal` (enum: COCHES_NET, WALLAPOP, MILANUNCIOS, OTRO)
- `askingPrice` (precio que pide, opcional)
- `status` (enum `CaptureStatus`: NO_CONTACTADO, CONTACTADO, EN_CURSO, ENTRADA_AGENDADA, CONVERTIDO, RECHAZADO)
- `notes` (observaciones) · `rejectionReason` (reutiliza `LostReason`, opcional)
- `entradaScheduledAt` (fecha/hora de la entrada, nullable)
- `assignedToId` (comercial) · `createdById`
- `sellerLeadId` (1:1 opcional, al convertir) · timestamps

## Fases

### F1 — Entidad + tablero de captación (MVP)

- Schema `VehicleCapture` + enums (migración aditiva).
- `/captaciones`: alta rápida (link + teléfono + portal + precio opcional) y tablero por estado (No contactado / Contactado / En curso / Entrada agendada / Convertido; Rechazado aparte). Cambiar estado, editar notas, asignar comercial.
- **Dedup por teléfono/link** al crear (avisa si ya existe captación o `SellerLead` con ese teléfono — patrón CAM-66).
- Entrada en el sidebar (Pipeline).

### F2 — Agendar Entrada + calendario

- Al pasar a "Entrada agendada": pedir `entradaScheduledAt`.
- **Nuevo origen `captacion` en la agregación del calendario** → la entrada agendada aparece en `/calendario` como "Entrada · {portal/vehículo}". Reutiliza `getCalendarItems` (patrón F1 del calendario).
- Recordatorio incluido en el digest diario (F6 calendario, sin trabajo extra).

### F3 — Convertir a ficha (SellerLead + Vehicle)

- Botón "Convertir a ficha" (cuando llega el vehículo): crea `SellerLead` canal CN + `Vehicle` prellenado (precio/portal/notas), vincula `sellerLeadId`, marca `CONVERTIDO`, registra origen en el timeline. Idempotente. Patrón `createSellerLeadFromTradeIn`.

### F4 — Reporting (opcional)

- Captaciones por portal, tasa de conversión (captación → ficha → publicado), tiempo medio, por comercial. Responde "¿de qué portal sale el mejor stock?".

## Fuera de alcance de este plan (bloque aparte, ② de la hoja)

Los pasos de papeleo tras la conversión que **aún no existen**: **contrato de depósito-venta con el vendedor (crear + firmar)** y **cuestionario de recepción** formal. El resto del ② (taller, tasación, fotos, anuncio, publicar) ya está construido.

---

> Estado: plan aprobado (enfoque) 2026-07-07. Pendiente de decidir por qué fase empezar. Recomendado: F1.
