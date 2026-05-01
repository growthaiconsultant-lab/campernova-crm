# Acta Fundacional — Campernova CRM

**Documento de origen del proyecto.**
Recoge la génesis, las decisiones estructurales, el inventario de servicios y el estado al cierre de la Fase 0 (pre-desarrollo).

|                            |                                    |
| -------------------------- | ---------------------------------- |
| **Proyecto**               | Campernova CRM                     |
| **Versión del documento**  | 1.0                                |
| **Fecha de cierre Fase 0** | 1 de mayo de 2026                  |
| **Promotor**               | Joel Martínez                      |
| **Estado actual**          | Fase 0 cerrada · Sprint 1 en curso |

---

## 1. Resumen ejecutivo

CampersNova es un negocio de compraventa de autocaravanas y campers semi-nuevas que opera bajo un modelo de intermediación con comisión del 4% sobre el precio de venta. Este documento marca el cierre de la Fase 0 — pre-desarrollo — durante la cual se ha definido el producto, escogido el stack, configurado todos los servicios externos necesarios, generado la documentación de proyecto y dejado el repositorio listo para iniciar el desarrollo del MVP.

El MVP se desarrollará en **5 sprints semanales (25 días laborables)** por un único desarrollador (Joel) apoyado por Claude Code, con un alcance acotado al flujo crítico de captación de vendedor, tasación automática, gestión del CRM y matching simple con compradores en cartera.

Las funcionalidades diferenciadoras de IA (chat público de búsqueda, "chatea con tu furgo", Nova Assistant postventa con QR) se construyen sobre esta base en v2-v4 una vez validado el flujo comercial central.

---

## 2. Origen del proyecto

El punto de partida fue una sesión de pizarra donde Joel mapeó tres caminos para captar leads de vendedor:

- **CN — Captación Normal:** entrega física en oficinas, agente comercial rellena cuestionario y abre ficha
- **Pro — Captación online:** cuestionario web + fotos del propio vendedor, dispara una tasación automatizada con rango de precios
- **W11 / Otros:** canales externos como Wallapop o coches.net (aplazados a v4)

En paralelo se identificó la necesidad de una experiencia de comprador que evolucionara hasta convertirse en el diferencial del producto: una web pública con un chat de búsqueda capaz de matchear semánticamente la necesidad del comprador con el stock disponible, e incluso permitir que la propia ficha de cada vehículo "converse" con el comprador (en v2). Postventa, cada autocaravana vendida llevaría un código QR (Nova Assistant) para que el nuevo dueño pudiera consultar manuales, mantenimiento y soporte técnico específico de su unidad (en v3).

El CRM surge como **columna vertebral común** que centraliza vehículos, leads de vendedor, leads de comprador, y permite al equipo comercial humano gestionar el pipeline mientras la capa de IA se construye encima.

---

## 3. Decisiones estructurales

### 3.1 Modelo de negocio

- **Comisión del 4% sobre el precio de venta**
- Campernova **no es propietaria** del vehículo en ningún momento — relación contractual de mediación
- La comisión se devenga al cierre de la operación
- Implicación legal: contrato de mediación, no de compraventa

### 3.2 Alcance del programa

El proyecto Campernova consta de **4 productos** que se construirán de forma escalonada:

| Producto                                 | Descripción                               | Fase     |
| ---------------------------------------- | ----------------------------------------- | -------- |
| **CRM interno**                          | Gestión de vehículos, leads, pipeline     | v1 (MVP) |
| **Web pública con chat IA**              | Búsqueda semántica + furgo conversacional | v2       |
| **Nova Assistant (QR postventa)**        | Chatbot por vehículo para soporte técnico | v3       |
| **GTC (compraventa entre particulares)** | Mediación para evitar ITP                 | v4       |

### 3.3 Plazo y equipo

- **5 semanas** a tiempo completo para el MVP
- **1 desarrollador** (Joel) apoyado por Claude Code
- **3 agentes comerciales** + 1 admin gestionarán los leads una vez lanzado
- Volumen objetivo año 1: hasta 200 vehículos

### 3.4 Filosofía de producto

- **Ruthless prioritization:** todo lo que no esté en el flujo crítico del MVP se aplaza
- **Polish sacrificable, features no:** si hay que recortar, primero se sacrifica el pulido visual, no el alcance funcional
- **La IA llega encima del CRM, no antes:** v1 es CRM clásico, v2 introduce IA cuando hay datos reales

---

## 4. Modelo de producto

### 4.1 Personas

| Persona              | Rol                                            | Externa / Interna                         |
| -------------------- | ---------------------------------------------- | ----------------------------------------- |
| **Vendedor**         | Propietario que quiere vender su vehículo      | Externa                                   |
| **Comprador**        | Persona buscando comprar                       | Externa (manual en v1, web pública en v2) |
| **Agente comercial** | Empleado que gestiona leads y cierra           | Interna                                   |
| **Admin**            | Joel — configura sistema, ve métricas globales | Interna                                   |

### 4.2 Flujos críticos del MVP

1. **Captación Pro (online):** cuestionario público `/vender` → tasación automática <60s → SellerLead en CRM → email al agente
2. **Captación CN (oficina):** mismo cuestionario rellenado por agente desde backoffice → tasación como referencia
3. **Captación de comprador (manual en v1):** lead llega por canal externo (WhatsApp, teléfono, presencial) → agente abre BuyerLead manualmente
4. **Matching automático:** al crear/actualizar un Vehicle o BuyerLead, sistema sugiere top 10 candidatos con score
5. **Gestión del pipeline:** agente mueve estados (vehículo, comprador, match) y deja actividad en timeline

### 4.3 Algoritmos centrales (v1)

**Tasación** — híbrida sin ML real:

1. Buscar comparables internos (marca exacta, modelo exacto, año±2, km±20%)
2. Si hay ≥3 comparables vendidos → mediana, p25, p75
3. Si hay <3 → tabla de referencia poblada manualmente al inicio (50-100 modelos)
4. Aplicar ajustes: estado de conservación, antigüedad ITV, equipamiento premium
5. Devolver `(min, recomendada, max)` etiquetado como "tasación preliminar" — el agente envía la definitiva en 24h

**Matching** — filtros + scoring:

1. Filtros duros: tipo, plazas mínimas, presupuesto (±10%)
2. Scoring suave: equipamiento crítico (+40), precio (+25), km/año (+20), zona (+15)
3. Top 10 ordenados por score 0-100

> **v2:** ambos algoritmos se mejorarán con embeddings semánticos y razonamiento LLM.

### 4.4 Estados del pipeline

- **Vehículo:** `nuevo → tasado → publicado → reservado → vendido / descartado`
- **Comprador:** `nuevo → contactado → cualificado → en negociación → cerrado / perdido`
- **Match:** `sugerido → propuesto al cliente → visita → oferta → cerrado / rechazado`

---

## 5. Decisiones técnicas

### 5.1 Stack

| Capa           | Tecnología                                          | Razón                                          |
| -------------- | --------------------------------------------------- | ---------------------------------------------- |
| Frontend + API | **Next.js 14 (App Router) + TypeScript**            | Monolito viable para 1 dev y 200 vehículos/año |
| Backend        | **Supabase** (Postgres + Auth + Storage + pgvector) | 4 servicios en uno, deja v2 desbloqueada       |
| ORM            | **Prisma**                                          | Migraciones limpias + types compartidos        |
| UI             | **Tailwind + shadcn/ui**                            | Velocidad sin sacrificar consistencia          |
| Deploy         | **Vercel**                                          | Preview deploys + zero config Next.js          |
| Email          | **Resend**                                          | API moderna, free hasta 3k/mes                 |
| Monitoring     | **Sentry**                                          | Estándar para Next.js                          |
| Analytics      | **PostHog** (EU instance)                           | Cumple RGPD nativamente                        |
| Captcha        | **hCaptcha**                                        | Privacy-friendly, free tier suficiente         |
| WhatsApp v1    | **`wa.me/...`** (clic-to-chat)                      | Sin validación API de Meta — instantáneo       |

### 5.2 Arquitectura

- **Monolito Next.js**: web pública + backoffice + API en un único proyecto
- **Server Components por defecto**, Client Components solo cuando hace falta interactividad
- **Server Actions para mutaciones**, no API routes salvo webhooks
- **Validación con Zod** en cliente y servidor
- **Estados como enums en Prisma** + types compartidos
- **Tests obligatorios** en lógica crítica: tasación, matching, transiciones de estado
- **pgvector activado desde día 1** para no bloquear v2

### 5.3 Patrón "agente conversable" (preview v2-v3)

Tres lugares del producto necesitan que un vehículo se comporte como agente conversacional:

- Pre-venta: en el chat público, la furgo se "auto-vende"
- Búsqueda: matching semántico contra ficha + fotos
- Postventa: Nova Assistant con manual técnico cargado

La arquitectura del MVP queda preparada para que estos tres usos compartan una misma capa de embeddings y prompts contextuales en v2-v3, sin reescritura.

---

## 6. Identidad y dominio

| Atributo        | Valor                                                             |
| --------------- | ----------------------------------------------------------------- |
| Marca comercial | **CampersNova** (con S)                                           |
| Dominio         | **campersnova.com** (pendiente de registro)                       |
| Email contacto  | `info@campersnova.com`                                            |
| Paleta visual   | Extraída de [campersnova.com](https://campersnova.com) en CAM-005 |

> **Identidad legal del operador (autónomo / S.L. / NIF) pendiente de definir** con gestor. Bloquea exclusivamente los avisos legales del Sprint 5 (CAM-901).

---

## 7. Inventario de servicios configurados

Estado de cada servicio externo al cierre de la Fase 0.

### 7.1 Repositorio y deploy

| Servicio   | Estado                                                                   | Detalle                                                                                                                                                      |
| ---------- | ------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **GitHub** | ✅ Activo                                                                | Repo privado [`growthaiconsultant-lab/campernova-crm`](https://github.com/growthaiconsultant-lab/campernova-crm). Primer commit con docs subido el 1/5/2026. |
| **Vercel** | 🟡 Conexión hecha, proyecto pendiente del primer push con `package.json` | Team `growthaiconsultant-8035s-projects` (Hobby tier). GitHub App instalada con scope solo a `campernova-crm`.                                               |

### 7.2 Backend y datos

| Servicio     | Estado                                   | Detalle                                                                                                                                                                                                                  |
| ------------ | ---------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Supabase** | ✅ Activo                                | Proyecto `campersnova-crm` (ref `bbmglaatlyilxutzomxd`) en **Frankfurt — eu-central-1**, tier NANO (Free). Status Healthy. pgvector pendiente de activar via SQL en sprint 1 (`CREATE EXTENSION IF NOT EXISTS vector;`). |
| **Resend**   | 🟡 API key activa, dominio sin verificar | Workspace `growth.ai.consultant`. API key con Full access (clave `campernova-crm-server`). En `onboarding@resend.dev` mientras se verifica `campersnova.com`.                                                            |

### 7.3 Observabilidad y analítica

| Servicio    | Estado    | Detalle                                                                                                                                                  |
| ----------- | --------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Sentry**  | ✅ Activo | Org `ai-marketing-solutions`, project `campernova-crm` (Next.js). DSN en `.env.local`. Auth token para source maps pendiente de generar (no bloqueante). |
| **PostHog** | ✅ Activo | Project ID 170402, **EU instance** (`https://eu.posthog.com`). API key capturada.                                                                        |

### 7.4 Anti-spam

| Servicio     | Estado    | Detalle                                |
| ------------ | --------- | -------------------------------------- |
| **hCaptcha** | ✅ Activo | Sitekey + secret generados. Free tier. |

### 7.5 Tracker de tickets

| Servicio   | Estado                                | Detalle                                                                                                                               |
| ---------- | ------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| **Linear** | 🟡 Workspace listo, project pendiente | Workspace `campersnova` creado. Project "CRM v1" se crea en sprint 1 — Claude Code importa los 41 tickets del backlog vía Linear MCP. |

### 7.6 Pendientes en este bloque

- **Dominio `campersnova.com`** sin registrar — ~10-15€/año en Namecheap, IONOS o Cloudflare Registrar
- **Verificación DNS de Resend** una vez se registre el dominio
- **Sentry auth token** para subir source maps en producción (no bloqueante v1)
- **pgvector** activación en Supabase

---

## 8. Credenciales — ubicación y gestión

| Archivo        | Ubicación         | En git                   | Contiene                                            |
| -------------- | ----------------- | ------------------------ | --------------------------------------------------- |
| `.env.local`   | Raíz del proyecto | **NO** (en `.gitignore`) | Valores reales: keys, DSNs, connection string, etc. |
| `.env.example` | Raíz del proyecto | **Sí**                   | Plantilla con placeholders, sin secretos            |

### 8.1 Inventario de variables

- **App:** `NEXT_PUBLIC_APP_NAME`, `NEXT_PUBLIC_APP_URL`, `NEXT_PUBLIC_CONTACT_EMAIL`
- **Supabase:** `NEXT_PUBLIC_SUPABASE_URL`, publishable key, secret key, alias `ANON`/`SERVICE_ROLE`, `DATABASE_URL`, `DIRECT_URL`
- **Resend:** `RESEND_API_KEY`, `RESEND_FROM_EMAIL`, sandbox alternativo
- **Sentry:** `NEXT_PUBLIC_SENTRY_DSN`, `SENTRY_ORG`, `SENTRY_PROJECT`, auth token (pendiente)
- **PostHog:** `NEXT_PUBLIC_POSTHOG_KEY`, `NEXT_PUBLIC_POSTHOG_HOST`
- **hCaptcha:** `NEXT_PUBLIC_HCAPTCHA_SITE_KEY`, `HCAPTCHA_SECRET_KEY`
- **GitHub / Linear:** URLs informativas

### 8.2 Reglas de manejo

- `.env.local` **nunca se commitea**. El `.gitignore` ya lo bloquea.
- En Vercel se configurarán las mismas variables vía dashboard antes del primer deploy real
- Para nuevos miembros del equipo en el futuro: copiar `.env.example` → `.env.local` y rellenar pidiendo los valores al admin (Joel)

---

## 9. Documentación generada en Fase 0

Todos los documentos viven en `docs/` excepto `CLAUDE.md` que está en la raíz.

| Documento                   | Propósito                                                             | Cuándo consultarlo                                        |
| --------------------------- | --------------------------------------------------------------------- | --------------------------------------------------------- |
| **`docs/PRD.md`**           | Producto: problema, usuarios, alcance, modelo de datos, métricas      | Para cualquier decisión de producto durante el desarrollo |
| **`docs/Roadmap.md`**       | Plan por sprints, milestones, riesgos del calendario                  | Antes de empezar cada sprint                              |
| **`docs/Backlog.md`**       | 41 tickets `CAM-001` a `CAM-1006` priorizados con acceptance criteria | Para saber qué ticket toca y qué incluye                  |
| **`docs/Setup.md`**         | Stack, MCPs, servicios, estructura del repo, plan de día 1            | Setup inicial y dudas de arquitectura general             |
| **`docs/Quickstart.md`**    | Receta paso a paso de arranque (instalaciones, repo, primera sesión)  | Si te quedas sin contexto y necesitas re-arrancar         |
| **`docs/00-Foundation.md`** | Este documento — origen, decisiones, inventario                       | Onboarding, retrospectivas, presentaciones a terceros     |
| **`CLAUDE.md`**             | Resumen ultra-corto + reglas de trabajo para Claude Code              | Lo lee Claude Code cada sesión automáticamente            |

---

## 10. Pendientes externos (no bloqueantes para iniciar Sprint 1)

| Pendiente                                            | Bloquea                                           | ETA                                    |
| ---------------------------------------------------- | ------------------------------------------------- | -------------------------------------- |
| Registrar dominio `campersnova.com`                  | Verificación Resend, deploy producción definitivo | Esta semana                            |
| Verificar DNS en Resend (SPF, DKIM, DMARC)           | Envío de emails desde `info@campersnova.com`      | Tras dominio                           |
| Identidad legal del operador (autónomo / S.L. / NIF) | Avisos legales (CAM-901) en Sprint 5              | Antes de Sprint 5                      |
| Activar `pgvector` en Supabase (SQL Editor)          | Embeddings de v2 (no MVP)                         | Sprint 1 incluido                      |
| Crear project "CRM v1" en Linear                     | Tracking de tickets                               | Sprint 1, automatizado por Claude Code |
| Generar Sentry auth token                            | Subir source maps en producción                   | Antes del deploy de producción         |

---

## 11. Cronología de la Fase 0

Toda la Fase 0 se ejecutó el **1 de mayo de 2026** en una sesión continuada de varias horas con Claude (Cowork mode). Hitos:

1. **Brainstorming inicial** sobre la pizarra subida por Joel — clarificación de los 3 productos (CRM, Nova Assistant, GTC) y los 4 canales de captación
2. **Generación del PRD v0** vía la skill `product-management:write-spec`
3. **Cierre de las 7 preguntas bloqueantes** del PRD (modelo, equipo, dominio, etc.)
4. **Generación del Roadmap, Backlog, Setup y Quickstart**
5. **Creación de cuentas externas** (8 servicios) en una sesión con browser automation — captura de credenciales en `.env.local`
6. **Instalación local** de Node 24, Git 2.52, pnpm en Windows 11
7. **Creación del repo local**, primer commit y push autenticado vía GitHub CLI
8. **Generación de este documento** y cierre de la fase

---

## 12. Roadmap de fases del programa

| Fase                        | Alcance                                                                    | Duración    | Estado                 |
| --------------------------- | -------------------------------------------------------------------------- | ----------- | ---------------------- |
| **Fase 0 — Pre-desarrollo** | Producto definido, servicios configurados, repo listo                      | 1 día       | ✅ Cerrada             |
| **Fase 1 — MVP (v1)**       | CRM interno: captación + tasación + matching + pipeline                    | 5 semanas   | ▶️ En curso (Sprint 1) |
| **Fase 2 — v2**             | Web pública + chat IA de búsqueda + furgo conversable + matching semántico | 6-8 semanas | Pendiente              |
| **Fase 3 — v3**             | Nova Assistant: QR postventa + chatbot por vehículo                        | 3-4 semanas | Pendiente              |
| **Fase 4 — v4**             | GTC + integraciones Wallapop / coches.net / W11                            | 6+ semanas  | Pendiente              |

---

## 13. Decisiones diferidas (a tomar en sus sprints)

- **Tabla de referencia de tasación**: se construirá en Sprint 3 con 50-100 modelos de campers/autocaravanas populares. Datos aproximados — fuentes: Wallapop, coches.net, AutoScout24.
- **Plantillas de email/WhatsApp**: P1 si hay tiempo en Sprint 4, si no hardcodeadas en código por ahora.
- **Integración WhatsApp Business API**: P1 (post-MVP). En v1 solo `wa.me/...` clic-to-chat.
- **Stripe**: cuando se decida cobrar la comisión digitalmente, no antes.
- **Embeddings y matching semántico**: v2.
- **Política de retención de datos** y derechos RGPD avanzados (acceso, rectificación, supresión): redactar antes del lanzamiento de Sprint 5.

---

## 14. Apéndices

### 14.1 Enlaces rápidos

- Repo: https://github.com/growthaiconsultant-lab/campernova-crm
- Workspace Linear: https://linear.app/campersnova
- Dashboard Supabase: https://supabase.com/dashboard/project/bbmglaatlyilxutzomxd
- Org Sentry: https://ai-marketing-solutions.sentry.io
- PostHog (EU): https://eu.posthog.com
- Web pública existente: https://campersnova.com

### 14.2 Glosario

- **CN**: Captación Normal — entrega física en oficina
- **Pro**: Captación online — formulario web del vendedor
- **GTC**: Gestión de Transferencia entre Compradores — producto v4 para mediar compraventas entre particulares
- **Nova Assistant**: chatbot postventa por vehículo accesible vía QR (v3)
- **ITP**: Impuesto de Transmisiones Patrimoniales — relevante para GTC
- **MVP**: Minimum Viable Product — alcance de Fase 1
- **DSN**: Data Source Name — endpoint de Sentry
- **RLS**: Row Level Security — modelo de seguridad de Postgres / Supabase
- **pgvector**: extensión Postgres para embeddings vectoriales

### 14.3 Convenciones del proyecto

- **Commits:** mensaje en inglés, imperativo, prefijo tipo conventional commits (`docs:`, `feat:`, `fix:`, `chore:`)
- **Ramas:** `main` para producción. Para features grandes: `feat/CAM-XXX-descripcion`
- **PRs:** referenciar el ticket en el título, ej: `CAM-101 — Form SellerLead en backoffice`
- **Issues:** prefijo `CAM-XXX` consistente con el backlog

---

**Fin del Acta Fundacional.**

Este documento se actualiza al inicio de cada nueva fase mayor (v2, v3, v4) y al cierre del MVP. No es un documento mensual ni semanal — es un documento de referencia de larga vida.
