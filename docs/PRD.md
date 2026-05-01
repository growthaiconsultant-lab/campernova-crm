# PRD — CRM Campernova v1 (MVP)

**Autor:** Joel Martínez
**Fecha:** Mayo 2026
**Estado:** Borrador v0 — para iteración antes de desarrollo
**Audiencia:** Joel + Claude Code (contexto inicial de implementación)

---

## 1. Resumen ejecutivo

Campernova es un negocio de compraventa de autocaravanas y campers semi-nuevas. Este documento especifica el **MVP del CRM interno** que centraliza todo el ciclo: captación de vendedores, valoración del vehículo, captación de compradores, matching entre oferta y demanda, y gestión del pipeline comercial hasta el cierre.

El MVP cubre el flujo crítico end-to-end con automatizaciones puntuales (tasación, matching). Las experiencias públicas conversacionales con IA (chat de búsqueda, "chatea con tu furgo", Nova Assistant postventa, GTC) se construyen sobre esta base en v2-v4.

**Volumen objetivo:** hasta 200 vehículos/año.
**Equipo:** 1 desarrollador (Joel) usando Claude Code.
**Ventana:** MVP funcional en 6-8 semanas.

---

## 2. Problema

Hoy no existe un sistema único que gestione el inventario de vehículos, los leads de vendedores y compradores, las valoraciones y las negociaciones. Sin esto, el equipo comercial pierde leads, no encuentra match entre stock y demanda en cartera, y no puede escalar más allá del trabajo manual del agente.

**Impacto de no resolverlo:** techo de volumen bajo (~50-80 vehículos/año por agente, sin trazabilidad), pérdida de leads de comprador en cartera por falta de matching automático, dependencia operativa del conocimiento de cada agente.

---

## 3. Usuarios

| Persona | Descripción | Necesidad principal |
|---|---|---|
| **Vendedor (lead externo)** | Propietario que quiere vender su autocaravana o camper | Subir su vehículo de forma sencilla y obtener tasación rápida |
| **Comprador (lead externo)** | Persona buscando comprar un vehículo | En MVP entra solo manualmente vía agente; en v2 entra por chat web |
| **Agente comercial (interno)** | Empleado que gestiona leads, llama, negocia y cierra | Visibilidad total de leads, sugerencias de match, herramientas para gestionar el pipeline |
| **Admin (interno)** | Joel y futuros responsables | Configurar usuarios, ver métricas globales, ajustar parámetros |

---

## 4. Objetivos (Goals)

1. **Centralizar 100% de leads** (vendedor + comprador) en un solo sistema, eliminando hojas de cálculo y notas dispersas.
2. **Automatizar la tasación inicial** del vehículo para que el lead vendedor reciba un rango de precios en menos de 60 segundos tras enviar el cuestionario online.
3. **Habilitar matching automático** entre vehículos en stock y compradores en cartera, generando sugerencias accionables para el agente.
4. **Dar al agente comercial visibilidad total del pipeline** con estados claros, timeline de actividad y notificaciones cuando entran leads nuevos.
5. **Soportar el ramping a 200 vehículos/año** sin necesidad de rediseñar la arquitectura.

---

## 5. No-objetivos (explícitamente fuera de v1)

| No-objetivo | Razón | Cuándo |
|---|---|---|
| Web pública con chat de búsqueda IA | Es la pieza estrella pero no es necesaria para validar el MVP | v2 |
| "Chatea con tu furgo" (cada vehículo conversa) | Depende de la web pública, mismo bloque de IA | v2 |
| Nova Assistant (QR postventa por vehículo) | Requiere ventas cerradas y manuales/datos técnicos por vehículo | v3 |
| GTC (compraventa entre particulares) | Producto independiente, modelo de negocio distinto | v4 |
| Integración con Wallapop / coches.net / W11 | Publicación cruzada no es crítica para el MVP | v4 |
| App móvil nativa | Web responsive es suficiente | Indefinido |
| Pasarela de pago / firma digital | Las ventas se cierran offline en v1 | v3+ |
| Búsqueda semántica con embeddings | El matching de v1 es por filtros + scoring | v2 |

---

## 6. Flujos críticos del MVP

### 6.1 Captación Pro (online — automatizada)

1. Vendedor llega a landing pública (`/vender`).
2. Rellena cuestionario web (~15 campos: marca, modelo, año, km, plazas, equipamiento, estado, ubicación, precio deseado, datos de contacto).
3. Sube entre 6 y 30 fotos. Drag & drop, compresión client-side.
4. Submit → backend valida, guarda fotos en Supabase Storage, calcula tasación automática.
5. Vendedor ve en pantalla **rango de tasación** (min / recomendada / max) en menos de 60s.
6. Se crea **SellerLead + Vehicle** en estado `nuevo`.
7. Agente recibe **email + notificación** dentro del CRM.
8. En backoffice, el agente revisa, ajusta tasación si hace falta, y mueve el vehículo a `publicado`.

### 6.2 Captación CN (oficina — asistida)

1. Cliente viene físicamente con su vehículo.
2. Agente abre el backoffice, hace clic en "Nuevo lead vendedor".
3. Mismo cuestionario, rellenado por el agente desde el ordenador o tablet.
4. Sube fotos hechas en oficina.
5. Sistema sugiere tasación automática como referencia.
6. Lead queda creado igual que en Pro.

### 6.3 Captación de comprador (manual en v1)

1. Comprador contacta por canal externo (WhatsApp, teléfono, email, presencial).
2. Agente abre el backoffice, "Nuevo lead comprador".
3. Rellena ficha: datos de contacto, tipo de vehículo deseado, plazas mínimas, presupuesto, equipamiento crítico (cocina, baño, ducha, calefacción), zona de uso, plazos.
4. Lead queda creado en estado `nuevo`.

### 6.4 Matching

1. **Trigger automático A**: cuando se crea o publica un vehículo nuevo → sistema busca compradores en cartera que cumplan filtros duros y devuelve top 10 con score.
2. **Trigger automático B**: cuando se crea un comprador nuevo → sistema busca vehículos disponibles que cumplan filtros y devuelve top 10 con score.
3. Agente ve los matches sugeridos en la ficha del lead y decide a quién llamar.
4. Cada match propuesto al cliente queda registrado como `Match` con estado.

### 6.5 Gestión de pipeline

**Estados del vehículo:**
`nuevo` → `tasado` → `publicado` → `reservado` → `vendido` / `descartado`

**Estados del comprador:**
`nuevo` → `contactado` → `cualificado` → `en negociación` → `cerrado` / `perdido`

**Estados del match:**
`sugerido` → `propuesto al cliente` → `visita` → `oferta` → `cerrado` / `rechazado`

Cada cambio de estado queda en el log de actividad del lead.

---

## 7. Modelo de datos (alto nivel)

### Entidades principales

```
User (agente / admin)
  - id, email, nombre, role, activo

SellerLead
  - id, nombre, email, teléfono, canal (pro|cn), agente_asignado_id
  - estado, created_at, updated_at, source

Vehicle (1:1 con SellerLead)
  - id, seller_lead_id, marca, modelo, año, km, plazas, longitud
  - tipo (camper|autocaravana), equipamiento (jsonb)
  - estado_conservacion, ubicación
  - precio_deseado, tasacion_min, tasacion_recomendada, tasacion_max
  - estado, publicado_at, vendido_at

VehiclePhoto
  - id, vehicle_id, url, orden, alt_text

Valuation (histórico)
  - id, vehicle_id, min, recomendada, max
  - método (auto|manual), parámetros (jsonb), creado_por, created_at

BuyerLead
  - id, nombre, email, teléfono, agente_asignado_id
  - tipo_buscado, plazas_min, presupuesto_max
  - equipamiento_critico (jsonb), zona_uso, plazos_compra
  - estado, created_at, updated_at, source

Match
  - id, vehicle_id, buyer_lead_id, score
  - generado_por (auto|manual), estado
  - created_at, updated_at

Activity
  - id, lead_id (polimorfo: seller|buyer), tipo (llamada|email|wapp|nota|cambio_estado)
  - contenido, agente_id, created_at

Document
  - id, lead_id, tipo (dni|ficha_tecnica|itv|contrato|otros), url
```

### 7.1 Algoritmo de tasación automática (v1)

Estrategia híbrida simple — sin ML real todavía:

1. Buscar **vehículos comparables** en el propio CRM por: marca exacta, modelo exacto, año ±2, km ±20%.
2. Si hay **≥3 comparables vendidos**: usar mediana, p25 y p75 como recomendada / min / max.
3. Si hay **<3 comparables**: caer a tabla de referencia (`reference_prices` con marca/modelo/año → precio_base + €/km de depreciación). Esta tabla la rellenamos manualmente con datos de mercado al inicio.
4. **Ajustes** sobre el precio_base:
   - Estado conservación (-15% / 0 / +5%)
   - Antigüedad ITV (descuento si <6 meses)
   - Equipamiento premium (+5% si lleva placas solares + cocina + baño + calefacción)
5. Devolver rango: `(precio_ajustado * 0.92, precio_ajustado, precio_ajustado * 1.08)`

> **Nota:** Si el agente discrepa, sobrescribe manualmente y la nueva tasación queda guardada como `manual` en el histórico. Estas tasaciones manuales alimentan los comparables del siguiente caso.

### 7.2 Algoritmo de matching (v1)

1. **Filtros duros** (descartan candidatos):
   - Tipo coincide (camper / autocaravana)
   - Plazas del vehículo ≥ plazas_min del comprador
   - Precio del vehículo ≤ presupuesto_max del comprador (±10% de margen)
2. **Scoring suave** (0-100):
   - Match exacto de equipamiento crítico: +40
   - Cercanía a presupuesto deseado: +25
   - Antigüedad y km: +20
   - Zona/ubicación: +15
3. Devolver top 10 ordenados.

> **v2:** sustituir el scoring por embeddings semánticos cuando metamos el chat público.

---

## 8. Requisitos

### 8.1 P0 — Must-Have (sin esto no hay MVP)

**Acceso y permisos**
- Auth con magic link (Supabase Auth) para usuarios internos
- Dos roles: `agente` y `admin`
- Solo admin puede crear/desactivar usuarios

**Captación vendedor (Pro)**
- Landing pública `/vender` con cuestionario y subida de fotos
- Validación client-side y server-side
- Captcha o rate-limit para evitar spam
- Tasación automática que devuelve rango en pantalla
- Email de confirmación al vendedor con su rango y siguiente paso

**Captación vendedor (CN)**
- Mismo cuestionario en backoffice, rellenado por agente
- Tasación automática como referencia, editable por el agente

**Captación comprador**
- Formulario de creación manual en backoffice
- Campos: contacto, tipo, plazas_min, presupuesto, equipamiento_critico, zona, plazos

**Gestión de leads**
- Lista de SellerLeads con filtros (estado, agente, fecha, marca/modelo)
- Lista de BuyerLeads con filtros equivalentes
- Ficha individual con timeline de actividad, datos editables, fotos del vehículo
- Asignación/reasignación de agente
- Cambio de estado con registro en activity log
- Notas libres en la ficha
- Auditoría: quién creó, modificó, cuándo

**Matching**
- Job que recalcula matches al crear/actualizar vehículo o comprador
- Botón "Ver matches" en la ficha de cada lead
- Marcar match como `propuesto al cliente`, `visita`, `oferta`, `cerrado`, `rechazado`

**Notificaciones**
- Email al agente asignado cuando entra un lead nuevo o cuando se crea un match con score >70

**Dashboard básico**
- Leads por estado (vendedor + comprador)
- Vehículos por estado (incluye tiempo medio en cada estado)
- Ventas del mes y mes anterior
- Conversión Pro → publicado → vendido

### 8.2 P1 — Nice-to-Have (fast follow tras lanzamiento)

- Integración WhatsApp Business para enviar mensajes desde la ficha (Twilio o Meta API)
- Plantillas de email/WhatsApp por estado
- Exportación CSV de leads y vehículos
- Recordatorios y tareas asignadas a leads (con fecha)
- Adjuntos de documentos en la ficha (DNI, ficha técnica, ITV, contrato)
- Notificaciones push del navegador para el agente

### 8.3 P2 — Future (no construir, pero diseñar arquitectura para no bloquear)

- Búsqueda semántica con embeddings (pgvector ya queda preparado en v1)
- Web pública con chat IA de búsqueda
- "Chatea con tu furgo": cada vehículo como agente conversacional
- Nova Assistant: chatbot postventa por vehículo accesible vía QR
- Integración con Wallapop, coches.net (publicación cruzada)
- Firma digital de contratos
- Pasarela de pago

---

## 9. Métricas de éxito

### 9.1 Indicadores principales (mensuales, evaluar a M+1, M+3, M+6)

| Métrica | Threshold éxito | Stretch |
|---|---|---|
| SellerLeads captados / mes | 15 a M+3 | 25 a M+3 |
| Conversión Pro → ficha publicada | >70% | >85% |
| Tiempo medio captación → publicado | <48h | <24h |
| Vehículos vendidos / mes | 12 a M+3, 17 a M+6 | 20 a M+6 |
| Match aceptado por comprador (visita o oferta) | >25% | >40% |
| Tiempo medio en pipeline (captación → vendido) | <30 días | <20 días |

### 9.2 Indicadores operativos

| Métrica | Threshold éxito |
|---|---|
| Lead time captación → primera llamada (horario laboral) | <4h |
| % tasaciones automáticas dentro de ±10% del precio final | >60% |
| Tasa de error en formulario público | <3% |

### 9.3 Cómo se miden

- Todas las métricas salen de queries directas a Postgres sobre las tablas `seller_leads`, `vehicles`, `buyer_leads`, `matches`, `activities`.
- Dashboard en backoffice con datos en vivo.
- Revisión mensual por Joel. Si en M+3 los números están <70% del threshold, hacer pivote en captación o matching antes de avanzar a v2.

---

## 10. Riesgos y supuestos

| Riesgo | Mitigación |
|---|---|
| Tasación automática imprecisa al inicio (sin data histórica suficiente) | Fallback obligatorio a revisión humana antes de publicar. Tabla de referencia rellenada manualmente al arranque |
| Solo developer = bus factor alto | Documentar arquitectura y modelo de datos en el repo desde día 1. Tests automatizados de los flujos críticos |
| Captación Pro depende de tráfico web | El MVP no resuelve marketing — asume canal CN como principal en los primeros meses |
| WhatsApp Business API requiere validación Meta | Aplazar a P1, no es bloqueante para v1 |
| Volumen de fotos puede inflar coste de Storage | Compresión client-side antes de subir, max 30 fotos/vehículo |

**Supuestos:**
- Hay un equipo comercial humano disponible para gestionar leads (no es objetivo de este PRD definirlo)
- El stack Next.js + Supabase + Vercel está aceptado
- No hay restricciones legales nuevas (RGPD ya cubierto con consentimientos en el formulario)

---

## 11. Decisiones cerradas (preguntas resueltas)

| # | Pregunta | Decisión |
|---|---|---|
| 1 | Modelo de negocio | **Comisión 4% sobre el precio de venta**. Campernova intermedia, no es propietaria del vehículo. Implicación: contrato de mediación, no de compraventa. La comisión se devenga al cierre. |
| 2 | Tasación automática y validación humana | **Las dos**. Se muestra rango automático en pantalla en <60s etiquetado como "tasación preliminar", el agente envía la tasación definitiva en 24h tras revisar fotos y datos. |
| 3 | Zona geográfica | Sin restricción inicial — se acepta todo España. Campo `ubicación` en vehículo para filtrar y matchear. |
| 4 | Agentes comerciales | **3 agentes al arranque**. Esto exige asignación de leads y vista filtrada por agente desde día 1. |
| 5 | Tabla de precios de referencia | **No hay base de datos previa**. Construir aproximada en sprint 1: 50-100 modelos populares con precio_base + €/km de depreciación, sacados de Wallapop/coches.net. Aproximación es suficiente. |
| 6 | Canal con vendedor | **Email en v1** + **clic-to-WhatsApp** (links `wa.me/...`) en las fichas. La WhatsApp Business API se aplaza a P1. |
| 7 | Política de privacidad y aviso legal | Pendiente. Texto base en sprint 5 antes del lanzamiento. Identidad legal del operador todavía por definir. |

### Preguntas que siguen abiertas (no bloqueantes para empezar)

- Identidad legal del operador (autónomo / S.L. / NIF) para los avisos legales — resolver antes del sprint 5
- Logo y tipografía exactos — extraer de [campersnova.com](https://campersnova.com) en sprint 1
- ¿Las llamadas/visitas a oficina las gestiona algún agente concreto o se distribuyen por carga? — definir reglas de asignación en sprint 4

---

## 12. Plan de fases (alto nivel)

| Fase | Alcance | Tiempo estimado solo dev |
|---|---|---|
| **v1 — MVP** | Todo lo de este PRD | 6-8 semanas |
| **v2** | Web pública con chat IA de búsqueda + furgo conversable + matching semántico (embeddings) | +6-8 semanas |
| **v3** | Nova Assistant (QR + chatbot por vehículo postventa) | +3-4 semanas |
| **v4** | GTC + integraciones Wallapop / coches.net | +6 semanas |

---

## 13. Stack técnico (decisión cerrada)

- **Next.js 14+ (App Router) + TypeScript** — frontend público + backoffice + API en un único proyecto
- **Supabase** — Postgres + Auth + Storage. pgvector activado desde día 1 para no bloquear v2
- **Prisma** como ORM
- **Tailwind + shadcn/ui** para UI
- **Vercel** para deploy
- **API de Anthropic (Claude)** — solo en v2 para chat semántico, no se usa en v1 salvo que aparezca un uso justificado
- **Resend** para email transaccional
- **Sentry** para monitoring
- **Plausible o PostHog** para analytics web del formulario público

---

## 14. Acceptance criteria del MVP (resumen accionable)

El MVP se considera lanzable cuando:

- [ ] Un vendedor desconocido puede entrar a `/vender`, rellenar el cuestionario, subir fotos y recibir una tasación en menos de 60s
- [ ] El SellerLead correspondiente aparece en el backoffice con el vehículo y las fotos
- [ ] El agente recibe un email cuando entra ese lead
- [ ] El agente puede crear manualmente un BuyerLead con todos sus campos
- [ ] Al crear un BuyerLead, ve sugerencias de vehículos en su ficha
- [ ] Al crear/publicar un Vehicle, sus matches con BuyerLeads aparecen automáticamente
- [ ] Cada lead tiene un timeline visible de cambios de estado, notas y actividad
- [ ] El admin puede crear nuevos usuarios agente con magic link
- [ ] El dashboard muestra leads por estado, vehículos por estado y ventas del mes
- [ ] Hay tests automatizados de los flujos: crear SellerLead Pro, crear BuyerLead, generar match, cambiar estado
- [ ] El sistema soporta sin degradación 200 vehículos / 1000 leads activos
