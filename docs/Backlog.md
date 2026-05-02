# Backlog — Campernova CRM v1 (MVP)

Tickets organizados por épica, ordenados por dependencia. Listos para importar a Linear / Notion.

**Convenciones:**

- `[P0]` = bloqueante para lanzamiento
- `[P1]` = nice-to-have, fast follow tras lanzamiento
- Cada ticket tiene: descripción, acceptance criteria, sprint estimado
- Los IDs `CAM-XX` son sugeridos, ajusta al naming de tu tracker

---

## E1 — Infraestructura, auth y modelo de datos

### CAM-6 [P0] Setup repositorio y stack base

**Sprint 1**
Crear repo en GitHub, scaffold Next.js 14 (App Router) + TypeScript + Tailwind + ESLint + Prettier. Conectar Vercel para preview deploys en cada PR.

- ✅ Repo público o privado creado, primer commit
- ✅ `npm run dev` levanta la app en local
- ✅ Push a main despliega en Vercel
- ✅ Pre-commit hook con lint y format

### CAM-7 [P0] Configurar Supabase (Postgres + Auth + Storage)

**Sprint 1**
Crear proyecto Supabase, activar pgvector, configurar buckets de Storage para fotos vehículo y documentos.

- ✅ Proyecto Supabase creado, env vars en local y Vercel
- ✅ pgvector extension habilitada
- ✅ Buckets `vehicle-photos` y `lead-documents` creados con políticas
- ✅ Cliente Supabase configurado en Next.js (server + client)

### CAM-8 [P0] Configurar Prisma con schema completo

**Sprint 1**
Definir todas las entidades del PRD en `schema.prisma` y aplicar primera migración.

- ✅ Modelos: User, SellerLead, Vehicle, VehiclePhoto, Valuation, BuyerLead, Match, Activity, Document, ReferencePrice
- ✅ Enums para estados (vehicle, seller, buyer, match)
- ✅ Migración aplicada en Supabase
- ✅ Prisma Client tipado importable desde `lib/db.ts`

### CAM-9 [P0] Auth con magic link y roles

**Sprint 1**
Implementar login con magic link de Supabase Auth, sincronización con tabla `User`, middleware de protección de rutas.

- ✅ Página `/login` con form de email
- ✅ Magic link llega y autentica
- ✅ Tabla User sincroniza al primer login
- ✅ Middleware redirige a /login si no hay sesión
- ✅ Helpers `requireAuth()` y `requireAdmin()` en server actions

### CAM-10 [P0] Layout backoffice y theme con paleta Campernova

**Sprint 1**
Layout con sidebar (Dashboard / Vendedores / Compradores / Vehículos / Matches / Ajustes), topbar con usuario y logout, breadcrumbs. Paleta extraída de campersnova.com.

- ✅ Sidebar con navegación a las 6 secciones
- ✅ Topbar con avatar, email y logout
- ✅ Theme aplicado (colores principales + dark mode opcional)
- ✅ Páginas placeholder en cada sección

### CAM-11 [P0] Seed de 3 usuarios agente

**Sprint 1**
Script de seed que crea 3 cuentas agente + 1 admin (Joel).

- ✅ `npm run seed` crea los 4 usuarios
- ✅ Cada uno puede entrar con magic link

---

## E2 — Captación vendedor

### CAM-12 [P0] Form SellerLead + Vehicle en backoffice (canal CN)

**Sprint 2**
Formulario completo para que el agente cree un lead vendedor con su vehículo.

- ✅ Campos vendedor: nombre, email, teléfono
- ✅ Campos vehículo: marca, modelo, año, km, plazas, longitud, equipamiento (checks), estado_conservacion, ubicación, precio_deseado
- ✅ Validación con Zod
- ✅ Persistencia con server action
- ✅ Redirige a la ficha del lead creado

### CAM-13 [P0] Subida de fotos con drag&drop

**Sprint 2**
Componente reutilizable de subida de fotos del vehículo.

- ✅ Drag&drop o click para seleccionar
- ✅ Min 6 / max 30 fotos, validación
- ✅ Compresión client-side antes de subir (max 1.5MB cada una)
- ✅ Preview con orden reordenable (drag)
- ✅ Subida a Supabase Storage con URL firmada
- ✅ Eliminar foto individual

### CAM-14 [P0] Listado de SellerLeads

**Sprint 2**
Tabla con filtros, búsqueda y ordenación.

- ✅ Filtros: estado, agente asignado, fecha (rango), marca/modelo
- ✅ Búsqueda por nombre, email, teléfono, matrícula
- ✅ Ordenación: fecha creación, fecha último cambio, precio
- ✅ Paginación (50/página)
- ✅ Click en fila → ficha

### CAM-15 [P0] Ficha SellerLead editable

**Sprint 2**
Vista detalle con todos los datos del lead + vehículo + fotos editables.

- ✅ Datos vendedor editables
- ✅ Datos vehículo editables
- ✅ Galería de fotos con reorder y delete
- ✅ Estado del vehículo y SellerLead editable (selectores)
- ✅ Botón "Ver matches"

### CAM-16 [P0] Form público `/vender` (canal Pro)

**Sprint 2**
Landing pública con el form para vendedores externos. Optimizado móvil.

- ✅ Mismos campos que CN, divididos en 3 pasos (vehículo, fotos, contacto)
- ✅ Indicador de progreso
- ✅ Validación inline en cada paso
- ✅ Mobile-first
- ✅ Submit crea SellerLead con `canal=pro`
- ✅ Página de éxito muestra rango de tasación (placeholder hasta sprint 3)

### CAM-17 [P0] Captcha en form público

**Sprint 2**
hCaptcha o Cloudflare Turnstile en `/vender` para evitar spam.

- ✅ Token validado server-side antes de crear lead
- ✅ Bloqueo si falla la validación

### CAM-18 [P0] Email confirmación al vendedor (Resend)

**Sprint 2**
Email automático tras submit del form Pro.

- ✅ Resend account configurada con dominio verificado
- ✅ Template "Hemos recibido tu vehículo" con resumen y rango de tasación
- ✅ Envío idempotente (no duplica si reenvía)

### CAM-19 [P0] Notificación al agente cuando entra lead

**Sprint 2**
Email al agente asignado cuando entra un SellerLead.

- ✅ Asignación por defecto (round-robin entre los 3 agentes activos)
- ✅ Email con link directo a la ficha
- ✅ Configurable: cada agente puede silenciar en ajustes (P1)

### CAM-20 [P0] Asignación/reasignación manual de agente

**Sprint 2**
Selector en ficha SellerLead y BuyerLead.

- ✅ Solo admin puede reasignar
- ✅ Cambio queda en activity log

---

## E3 — Tasación automática

### CAM-21 [P0] Tabla de precios de referencia

**Sprint 3**
Investigar y poblar la tabla `reference_prices`.

- ✅ 50-100 entradas de marcas/modelos populares (camper + autocaravana)
- ✅ Para cada entrada: marca, modelo, año_base, precio_base, depreciacion_por_km
- ✅ CSV importable + UI de admin para editar (P1)
- ✅ Fuentes: Wallapop, coches.net, Autoscout24

### CAM-22 [P0] Algoritmo tasación con comparables internos

**Sprint 3**
Función `calculateValuation(vehicle): { min, recomendada, max, method, confidence }`.

- ✅ Busca comparables (marca exacta, modelo exacto, año±2, km±20%)
- ✅ Si ≥3 comparables vendidos: usa mediana, p25, p75
- ✅ Si <3: cae a tabla de referencia
- ✅ Aplica ajustes: estado_conservacion, ITV, equipamiento_premium
- ✅ Devuelve método y confidence (alta/media/baja)
- ✅ Cubierto por unit tests

### CAM-23 [P0] Histórico de tasaciones

**Sprint 3**
Cada cálculo (auto o manual) crea una row en `valuations`.

- ✅ Auto = al crear/actualizar vehículo
- ✅ Manual = cuando el agente sobrescribe en la ficha
- ✅ Visible en la ficha como timeline

### CAM-24 [P0] Mostrar rango en form Pro y email

**Sprint 3**
Cuando un vendedor envía el form `/vender`, ve su rango en pantalla y lo recibe por email.

- ✅ Página de éxito muestra min, recomendada, max
- ✅ Etiquetado como "tasación preliminar - el agente confirma en 24h"
- ✅ Mismo rango incluido en el email de confirmación

---

## E4 — Captación comprador

### CAM-25 [P0] Form BuyerLead en backoffice

**Sprint 3**

- ✅ Campos: contacto, tipo_buscado (camper/autocaravana), plazas_min, presupuesto_max, equipamiento_critico (checks: cocina, baño, ducha, calefacción, placas solares), zona_uso, plazos_compra
- ✅ Validación Zod
- ✅ Persistencia

### CAM-26 [P0] Listado y ficha BuyerLead

**Sprint 3**
Equivalentes a SellerLead.

- ✅ Listado con filtros (estado, agente, presupuesto, plazas, fecha)
- ✅ Ficha editable

---

## E5 — Matching

### CAM-27 [P0] Algoritmo matching v1

**Sprint 3**
Función `findMatches(vehicleOrBuyer): Match[]`.

- ✅ Filtros duros: tipo, plazas_min, presupuesto (±10%)
- ✅ Scoring suave: equipamiento_critico (40), precio (25), antigüedad/km (20), zona (15)
- ✅ Devuelve top 10 con score 0-100
- ✅ Unit tests con casos representativos

### CAM-28 [P0] Job recalcular matches

**Sprint 3**
Trigger automático al crear/actualizar Vehicle o BuyerLead.

- ✅ Edge function o cron de Supabase
- ✅ Crea/actualiza filas en tabla `matches` con estado `sugerido`
- ✅ Idempotente (no duplica)

### CAM-29 [P0] UI "Ver matches" en fichas

**Sprint 3**
Sección colapsable en ficha SellerLead y BuyerLead.

- ✅ Muestra top 10 con score, foto, datos clave
- ✅ Click → abre ficha del otro lado
- ✅ Botón "Marcar como propuesto" / "Visita" / "Oferta" / "Cerrar" / "Rechazar"

---

## E6 — Pipeline y actividad

### CAM-30 [P0] Estados y transiciones

**Sprint 4**
Implementar máquina de estados para Vehicle, SellerLead, BuyerLead, Match.

- ✅ Cada entidad tiene un selector de estado en la ficha
- ✅ Guards: validan transiciones permitidas
- ✅ Cambio queda en activity log
- ✅ UI muestra estados con colores

### CAM-31 [P0] Activity log polimórfico

**Sprint 4**
Tabla `activities` que registra cambios y eventos por lead.

- ✅ Tipos: cambio_estado, nota, llamada, email, whatsapp, match_creado, lead_asignado
- ✅ Cada activity tiene autor (user) y timestamp
- ✅ Renderizada como timeline en la ficha

### CAM-32 [P0] Notas libres en ficha

**Sprint 4**
Componente para añadir notas (rich text simple).

- ✅ Textarea con markdown básico
- ✅ Quedan registradas en activity log
- ✅ Editables/borrables solo por su autor

---

## E7 — Comunicación

### CAM-33 [P0] Click-to-WhatsApp

**Sprint 4**
Botón en ficha que abre WhatsApp Web/app con texto pre-rellenado.

- ✅ Link `wa.me/{telefono}?text={mensaje_template}`
- ✅ Botón visible si el lead tiene teléfono móvil
- ✅ Cada uso queda en activity log como "whatsapp_iniciado"

### CAM-34 [P0] Notificación email match score >70

**Sprint 4**
Email al agente cuando el sistema genera un match con score alto.

- ✅ Trigger al crear match
- ✅ Throttling: máximo 1 email cada 30 min por agente (no spamear)
- ✅ Configurable umbral en ajustes admin

### CAM-35 [P1] Plantillas de mensaje configurables

**Sprint 4 (si hay tiempo)**

- ✅ CRUD de plantillas para email y WhatsApp
- ✅ Variables: {nombre}, {vehiculo}, {precio}, etc.
- ✅ Selección de plantilla al iniciar comunicación

### CAM-36 [P1] Documentos adjuntos en ficha

**Sprint 4 (si hay tiempo)**

- ✅ Subida múltiple a Storage
- ✅ Categorización: DNI, ficha técnica, ITV, contrato, otros
- ✅ Listado con preview/descarga

---

## E8 — Dashboard

### CAM-37 [P0] Dashboard con KPIs principales

**Sprint 4**

- ✅ SellerLeads por estado (gráfico funnel)
- ✅ BuyerLeads por estado
- ✅ Vehículos por estado
- ✅ Ventas mes actual vs anterior
- ✅ Conversión Pro: lead → publicado → vendido
- ✅ Tiempo medio en cada estado (tabla)
- ✅ Filtro por agente (admin) o solo agente actual

---

## E9 — Web pública

### CAM-38 [P0] Landing comercial `/`

**Sprint 5**
Página única de aterrizaje.

- ✅ Hero con propuesta de valor
- ✅ 3 ventajas (tasación rápida, comisión 4%, gestión integral)
- ✅ "Cómo funciona" en 3 pasos
- ✅ Mini FAQ (5-6 preguntas)
- ✅ CTA grande al form `/vender`
- ✅ Footer con enlaces legales y contacto
- ✅ Optimizado móvil + tiempos de carga (LCP <2.5s)

### CAM-39 [P0] Página `/contacto`

**Sprint 5**

- ✅ Form simple (nombre, email, mensaje)
- ✅ Email a buzón general

---

## E10 — Legal y compliance

### CAM-40 [P0] Aviso legal, política privacidad, cookies

**Sprint 5 (idealmente sprint 1)**

- ✅ Tres páginas: `/aviso-legal`, `/privacidad`, `/cookies`
- ✅ Banner de cookies con consent (rechazar, aceptar todo, configurar)
- ✅ Datos del operador correctos (NIF, dirección, contacto)
- ✅ Revisado por gestor/abogado

### CAM-41 [P0] Consentimientos en formularios

**Sprint 5**

- ✅ Checkbox de consentimiento RGPD en form `/vender` y `/contacto`
- ✅ Texto legal aprobado
- ✅ Almacenamiento del consentimiento con timestamp e IP

---

## E11 — QA, observabilidad y lanzamiento

### CAM-42 [P0] Tests automatizados de flujos críticos

**Sprint 5**

- ✅ Vitest para utils y server actions (target: tasación, matching, transiciones)
- ✅ Playwright e2e: crear SellerLead Pro, crear BuyerLead, matching, cambio estado, subir fotos
- ✅ Run en CI antes de merge

### CAM-43 [P0] Sentry instalado

**Sprint 5**

- ✅ Frontend + server con DSNs separadas
- ✅ Source maps subidos en build
- ✅ Alerta a email/Slack si error rate >1%

### CAM-44 [P0] Analytics web

**Sprint 5**

- ✅ Plausible (o PostHog) en landing y form
- ✅ Eventos: form_view, form_step_completed, form_submitted
- ✅ Funnel visible

### CAM-45 [P0] Onboarding agentes

**Sprint 5**

- ✅ Crear cuentas de los 3 agentes con sus emails reales
- ✅ Mini guía interna en `/ajustes/guia` (1 página, screenshots)
- ✅ Sesión 1:1 de 30 min con cada agente

### CAM-46 [P0] Deploy producción

**Sprint 5**

- ✅ Dominio definitivo apuntado
- ✅ DNS verificado, SSL OK
- ✅ Variables de entorno production configuradas
- ✅ Backup automático de Postgres habilitado en Supabase

### CAM-47 [P0] Plan post-launch primeros 7 días

**Sprint 5**

- ✅ Joel disponible para hotfixes en horario laboral
- ✅ Slack/email check diario con los agentes
- ✅ Lista de bugs/feedback semanal → backlog v1.1

---

## Resumen de carga por sprint

| Sprint        | Tickets P0       | Tickets P1        |
| ------------- | ---------------- | ----------------- |
| 1             | 6                | 0                 |
| 2             | 9                | 0                 |
| 3             | 8                | 0                 |
| 4             | 5                | 2 (si hay tiempo) |
| 5             | 11               | 0                 |
| **Total MVP** | **39 P0 + 2 P1** |                   |

---

## Después del MVP — pre-backlog v2

- Embeddings de vehículos y necesidades (pgvector)
- Chat IA público de búsqueda
- Furgo conversacional con su ficha técnica como contexto
- Matching semántico
- Edición de tabla de referencia con UI admin
- Gestión de plantillas avanzada
- Reportes exportables PDF
- WhatsApp Business API real (no solo wa.me)
