# Roadmap — Campernova CRM v1

**Plazo:** 5 semanas (25 días laborables) a tiempo completo
**Equipo:** Joel + Claude Code
**Inicio sugerido:** próximo lunes
**Lanzamiento producción:** fin de semana 5

---

## Visión por fases

| Fase | Alcance | Duración | Cuándo |
|---|---|---|---|
| **v1 — MVP** | CRM interno: captación Pro + CN, tasación auto, matching simple, pipeline, landing pública mínima | **5 semanas** | Mes 1-2 |
| **v2** | Web pública con chat IA de búsqueda, "chatea con tu furgo", matching semántico (embeddings) | 6-8 semanas | Mes 3-4 |
| **v3** | Nova Assistant: QR + chatbot por vehículo postventa | 3-4 semanas | Mes 5 |
| **v4** | GTC + integraciones Wallapop / coches.net | 6+ semanas | Mes 6+ |

---

## Sprints del MVP

Cada sprint son 5 días laborables. Los entregables son acumulativos: lo que se cierra en sprint N está disponible y testeado en sprint N+1.

### Sprint 1 — Foundations (días 1-5)
**Goal:** repositorio, infraestructura, auth y modelo de datos completos. Sin features funcionales todavía, pero la columna vertebral del producto está en pie y desplegada.

- Repo en GitHub + Vercel preview deploys
- Next.js 14 (App Router) + TypeScript + Tailwind + shadcn/ui
- Supabase project: Postgres + Auth + Storage + pgvector activado
- Prisma schema completo con todas las entidades del PRD (User, SellerLead, Vehicle, VehiclePhoto, Valuation, BuyerLead, Match, Activity, Document, ReferencePrice)
- Magic link auth funcionando (Supabase Auth)
- Roles `agente` y `admin`, middleware de protección de rutas
- Layout backoffice: sidebar, topbar, breadcrumbs, theme con paleta extraída de campersnova.com
- Páginas vacías (placeholder) para: Dashboard, Vendedores, Compradores, Vehículos, Matches, Ajustes
- Seed inicial con 3 usuarios agente
- README con instrucciones de setup local

**Milestone:** un nuevo agente puede entrar a la app desplegada con magic link y navegar entre las páginas vacías.

---

### Sprint 2 — Captación vendedor (días 6-10)
**Goal:** los dos canales de captación de vendedor funcionan end-to-end con persistencia y fotos, sin tasación todavía.

- Form completo de SellerLead + Vehicle en backoffice (canal CN)
  - Campos: marca, modelo, año, km, plazas, longitud, equipamiento, estado, ubicación, precio_deseado, datos contacto vendedor
- Subida de fotos: drag&drop, preview, compresión client-side, min 6 / max 30
- Storage de fotos en Supabase Storage con URLs firmadas
- Listado de SellerLeads con filtros (estado, agente, fecha, marca/modelo) y búsqueda
- Ficha SellerLead con datos editables
- Form público `/vender` (mismos campos, optimizado móvil)
- Captcha (hCaptcha) en form público
- Email automático al vendedor confirmando recepción (Resend)
- Email automático al agente asignado por defecto al entrar lead Pro
- Asignación manual/reasignación de agente

**Milestone:** Joel mete un lead manual desde el backoffice y un usuario externo puede subir un vehículo desde `/vender`. Ambos casos generan ficha persistida.

---

### Sprint 3 — Tasación + Matching + Comprador (días 11-15)
**Goal:** las tres piezas de inteligencia del MVP están operativas. Es el sprint con más riesgo.

- Tabla `reference_prices` poblada con 50-100 entradas (1-2 días: scraping asistido + curado manual de marcas/modelos populares de campers/autocaravanas)
- Algoritmo de tasación v1:
  - Búsqueda de comparables internos
  - Fallback a tabla de referencia
  - Ajustes por estado, antigüedad ITV, equipamiento
  - Devuelve rango (min, recomendada, max)
- Histórico de tasaciones (auto + manual override)
- Mostrar rango en form Pro al final del flujo + en email de confirmación
- BuyerLead: form, listado con filtros, ficha con datos editables
- Algoritmo de matching v1:
  - Filtros duros (tipo, plazas, presupuesto)
  - Scoring suave (equipamiento, precio, antigüedad, zona)
  - Top 10 con score normalizado
- Job asíncrono que recalcula matches al crear/actualizar Vehicle o BuyerLead
- UI "Ver matches" en ambas fichas
- Estado del Match con transiciones (sugerido → propuesto → visita → oferta → cerrado/rechazado)

**Milestone:** un vendedor recibe rango de tasación en <60s al enviar el form. Cuando un agente crea un nuevo BuyerLead, ve sugerencias de stock automáticamente.

---

### Sprint 4 — Pipeline, comunicación y dashboard (días 16-20)
**Goal:** el agente comercial tiene todas las herramientas que necesita para gestionar el pipeline en su día a día.

- Estados y transiciones implementados para Vehicle, SellerLead, BuyerLead (con guards: no se puede pasar a vendido sin oferta cerrada, etc.)
- Activity log polimórfico: cambios de estado, notas, llamadas, emails, eventos automáticos
- Timeline visible en ficha de cada lead
- Notas libres con autor y timestamp
- Notificaciones email al agente: lead nuevo + match generado con score >70
- Click-to-WhatsApp en fichas: link `wa.me/{teléfono}?text={plantilla}` con texto pre-rellenado
- Plantillas de mensaje (email + WhatsApp) por estado, editables en ajustes
- Documentos adjuntos en ficha (DNI, ficha técnica, ITV) — Supabase Storage
- Asignación/reasignación de leads
- Dashboard backoffice: leads por estado (vendedor + comprador), vehículos por estado, ventas mes vs mes anterior, conversión Pro→publicado→vendido, tiempo medio en cada estado del pipeline

**Milestone:** los 3 agentes pueden gestionar todo su día con la app: ver leads asignados, llamar/whatsappear desde la ficha, mover estados, ver matches y dejar histórico de actividad.

---

### Sprint 5 — Public face + Lanzamiento (días 21-25)
**Goal:** la cara pública está pulida, lo legal está en orden, hay observabilidad y QA. Se lanza a producción.

- Landing comercial `/` (1 página): hero, 3 ventajas clave, "cómo funciona" en 3 pasos, mini-FAQ, CTA al form `/vender`
- Aviso legal, política de privacidad, política de cookies, banner consent
- Página `/contacto` simple
- Tests automatizados (Vitest + Playwright):
  - Crear SellerLead Pro end-to-end
  - Crear BuyerLead manual
  - Generar matches automáticos
  - Cambiar estados del pipeline
  - Subir fotos a Storage
- Sentry instalado en frontend y API
- Plausible o PostHog en landing y form
- QA exploratorio + bugfixing
- Onboarding de los 3 agentes: creación de cuentas, mini guía interna (1 página) en `/ajustes/guia`
- Deploy producción + dominio definitivo apuntado
- Plan de soporte post-launch para los primeros 7 días

**Milestone:** Campernova CRM v1 está en producción, los 3 agentes lo usan en su día a día y entra el primer lead real.

---

## Riesgos del calendario y plan de contingencia

| Riesgo | Probabilidad | Impacto | Plan |
|---|---|---|---|
| Tabla de precios cuesta más de 2 días | Media | Atrasa sprint 3 | Bajar a 30 modelos en lugar de 50-100 — mejor aproximación que retraso |
| Matching no funciona bien con datos de prueba | Media | Atrasa sprint 3 | Simplificar scoring (solo filtros duros + orden por precio) hasta tener datos reales |
| Validación de Resend tarda | Baja | Atrasa sprint 2 | Tener cuenta lista en sprint 1, dominio verificado |
| Aviso legal sin redactar | Alta | Bloquea lanzamiento | Asignar a abogado/gestor en sprint 1, no en sprint 5 |
| QA descubre bugs serios en sprint 5 | Media | Atrasa lanzamiento | Reservar día 25 como buffer puro de bugfixes |

**Si el sprint 3 se atrasa**, el orden de sacrificio es:
1. Documentos adjuntos (sprint 4) → P1
2. Plantillas configurables (sprint 4) → texto fijo en código
3. Dashboard avanzado → solo KPIs básicos
4. Tests Playwright → solo Vitest

Los flujos críticos de captación, tasación, matching y pipeline son intocables.

---

## Después del MVP — preview de v2 y siguientes

**v2 (mes 3-4):** Web pública con chat IA. Esta es la pieza diferenciadora. Cada vehículo se vuelve agente conversacional alimentado con su ficha técnica + fotos. Embeddings sobre vehículos y necesidades de comprador para matching semántico real. Aquí se materializa el "chatea con tu furgo".

**v3 (mes 5):** Nova Assistant. QR físico pegado en cada autocaravana vendida. Lleva a `app.campersnova.com/v/{vehicle_id}/assist` con un chatbot cargado de la documentación técnica de ese vehículo concreto. Soporte postventa 24/7.

**v4 (mes 6+):** GTC (compraventa entre particulares con Campernova mediando para ahorrar ITP) + publicación cruzada en Wallapop / coches.net / W11.

La arquitectura del MVP está pensada para soportar todo esto sin reescritura: pgvector ya activado, modelo de datos extensible, separación limpia frontend público / backoffice / API.
