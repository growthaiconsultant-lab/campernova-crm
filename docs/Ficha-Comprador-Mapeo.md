# Ficha de Comprador — Mapeo spec ideal → CRM actual

**Fuente**: `docs/specs/ficha-comprador-ideal.md` (documento de visión aportado por el dueño, 2026-07).
**Propósito**: decidir qué se adopta, qué ya existe y qué se descarta, mapeado sobre el schema real (`BuyerLead` + módulos existentes). El spec es el **norte**; este documento es el **plan**.

Principio rector: con un equipo de 3 personas, un campo que nadie rellena es peor que no tenerlo. Se adopta lo que el chat/IA puede rellenar solo o lo que el comercial tocará a diario.

---

## 1. Ya existe (mapear, NO duplicar)

| Concepto del spec                               | Campo/módulo actual                                                           | Nota                                                    |
| ----------------------------------------------- | ----------------------------------------------------------------------------- | ------------------------------------------------------- |
| `max_budget`                                    | `BuyerLead.maxBudget`                                                         | —                                                       |
| `required_travel_seats`                         | `BuyerLead.minSeats`                                                          | plazas homologadas                                      |
| `required_sleeping_places`                      | `BuyerLead.sleepingPlacesRequired`                                            | excluyente (Block 11)                                   |
| `bathroom_required`                             | `BuyerLead.bathroomRequired`                                                  | excluyente si true                                      |
| `purchase_timeline`                             | `BuyerLead.purchaseTimeline`                                                  | 5 opciones en `PURCHASE_TIMELINE_OPTIONS`               |
| categorías de vehículo                          | `BuyerLead.vehicleType` + `preferredCategory`                                 | taxonomía RV Block 11                                   |
| `bed_preference`                                | `BuyerLead.preferredBedLayout`                                                | —                                                       |
| carnet / MMA                                    | `BuyerLead.licenseType`                                                       | B → excluye >3.500 kg                                   |
| uso invernal / garaje / medidas parking / niños | `needsWinter`, `needsGarage`, `maxLengthM`, `maxHeightM`, `hasKids`           | —                                                       |
| ubicación                                       | `BuyerLead.useZone`                                                           | —                                                       |
| `source_channel`                                | `BuyerLead.source` + `canal`                                                  | —                                                       |
| comercial asignado                              | `BuyerLead.agentId` (guard ADMIN)                                             | —                                                       |
| must-have vs nice-to-have                       | semántica ya en el matching: filtros duros vs ejes de scoring                 | falta hacerla **visible** en UI (→ CAM-65)              |
| matching + estados                              | modelo `Match` (`SUGERIDO→PROPUESTO_CLIENTE→VISITA→OFERTA→CERRADO/RECHAZADO`) | los estados de visita/oferta del spec §14 ya viven aquí |
| interacciones                                   | `Activity` (timeline, notas, WhatsApp logging) + `BuyerChatSession`           | transcripción de llamadas = futuro                      |
| resumen humano de necesidad                     | `capturedNecesidad` del chat + notas                                          | resumen IA persistido → aplazado                        |
| score comprador                                 | `leadScore` heurístico (calculado en la ficha)                                | formalizar/persistir → aplazado                         |
| documentos                                      | modelo `Document` + tab Documentos ("Próximamente")                           | activar cuando haya operación real                      |
| roles/permisos (§22)                            | RBAC 5 roles (Block 3)                                                        | no añadir roles nuevos                                  |
| reporting demanda (§24)                         | dashboard Blocks 5                                                            | ampliar cuando existan lostReason/temperatura           |

## 2. Adoptar — Bloque 1 (tickets propuestos)

### CAM-60 [P0] Próxima acción real con fecha y alertas

El cambio de mayor ROI del spec (§4.1, §19.2). Campos `nextActionType` (enum: LLAMAR, WHATSAPP, EMAIL, ENVIAR_VEHICULOS, PEDIR_DOCS, AGENDAR_VISITA, SEGUIMIENTO, CERRAR) y `nextActionDueAt` en `BuyerLead` **y** `SellerLead` (aditivo). La `ProximaAccionCard` del rail deja de ser texto estático por estado y muestra la acción real + fecha, editable inline. Dashboard: alertas "próxima acción vencida" y "lead activo sin próxima acción". Al crear lead vía chat/form → próxima acción por defecto "LLAMAR mañana".

### CAM-61 [P1] Motivo de pérdida estructurado

Enum `lostReason` (PRECIO, FINANCIACION, COMPRO_A_OTRO, NO_RESPONDE, APLAZA, SIN_STOCK, EXPECTATIVAS, OTRO) + `lostReasonNotes` en `BuyerLead` (y `discardReason` equivalente en `SellerLead`). El diálogo de archivar (BuyerTopbarActions) pide el motivo antes de confirmar. Dashboard: distribución de motivos de pérdida (30/90 días).

### CAM-62 [P1] Temperatura del lead

`leadTemperature` enum (HOT, WARM, COLD), editable con un clic en ficha y visible como chip en el listado (+filtro). Sugerencia automática inicial desde `purchaseTimeline` + engagement (heurística simple, sin LLM). No sustituye al `leadScore`.

### CAM-63 [P1] Vehículo de parte de pago (trade-in)

Sección "Su vehículo actual" en la ficha del comprador (§11): `hasTradeIn`, tipo, marca, modelo, año, km, financiación pendiente, notas (campos aditivos en `BuyerLead` o tabla `buyer_trade_ins` 1:1 — decidir en implementación). CTA **"Crear lead de vendedor desde este vehículo"** → pre-rellena un `SellerLead` canal CN vinculado. Encaje directo con el negocio: el trade-in es captación de stock para el depósito-venta.

### CAM-64 [P2] Explicación del match ("por qué encaja")

§13.5 del spec. Los ejes de scoring existentes (categoría 22 · cama 18 · precio 20 · equipo 15 · antig/km 15 · zona 10) ya contienen los porqués — generar la explicación **determinista** desde los sub-scores (encaja porque… / riesgos…) sin LLM, en `MatchesSection` y ficha. Opcional fase 2: "ángulo comercial" con IA (mismo patrón revisable de rv-suggest).

### CAM-65 [P2] Excluyentes vs preferencias visibles en la ficha

La distinción ya existe en datos (comentarios del schema + `lib/matching`); falta UI: en la card de preferencias del rail, badge "excluyente" (rojo suave) vs "preferencia" (neutro) por campo. Opcional: campo libre `dealBreakersNotes` para lo que no cabe en la taxonomía.

### CAM-66 [P2] Aviso de duplicados por teléfono

§5.2, versión mínima: al crear comprador (backoffice o chat tool), buscar por teléfono normalizado; si existe → aviso con enlace a la ficha existente (backoffice) o reutilizar lead (chat). Sin merge automático.

## 3. Aplazar (con disparador claro)

| Qué                                                        | Cuándo                                                                                                            |
| ---------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| Financiación completa (§10: ingresos, preaprobación, docs) | cuando la financiación 4,99% tenga proceso operativo real. Datos RGPD-sensibles — no antes                        |
| Tablas `buyer_offers` / `buyer_reservations` (§14.3-14.4)  | cuando el volumen exija más granularidad que los estados del `Match` + módulo Entregas. Evitar pipeline duplicado |
| Transcripción/resumen de llamadas (§12, §18)               | cuando haya integración de telefonía. El patrón IA-propone-comercial-revisa ya está validado (rv-suggest)         |
| `buyer_score` persistido con fórmula (§17)                 | ya hay `leadScore` heurístico en ficha; formalizar cuando haya datos de cierre para calibrar pesos                |
| Resumen IA persistido (`ai_buyer_summary`, §4.2)           | tras CAM-60; el valor real llega con las interacciones registradas                                                |
| `buyer_tasks` como entidad (§19)                           | por ahora `nextAction*` (CAM-60) cubre el 90% con 1/10 de complejidad                                             |

## 4. Descartar (con motivo)

- **19 estados de pipeline** (§6.1): con 3 personas = estados que nadie mantiene. Se quedan los 6 actuales + temperatura + próxima acción, que expresan lo mismo.
- **Split en 6 tablas 1:1** (§20): complejidad gratuita a esta escala; `BuyerLead` con columnas aditivas (patrón Block 11) sigue siendo la vía.
- **~150 campos de cola larga** (autonomía Ah/W, etiqueta ambiental, camas separadas…): solo si el chat los captura solo; nunca como formulario manual.
- **Roles nuevos** (§22): el RBAC de 5 roles existente cubre las restricciones.

---

> Estado: **CAM-60 (PR #44) y CAM-61 (PR #45) desplegados a prod (2026-07-07)**. Pendientes: CAM-62…66.
