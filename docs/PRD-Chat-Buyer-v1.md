# PRD — Chat de captación de comprador v1

**Versión:** 1.0
**Fecha:** Mayo 2026
**Estado:** Aprobado para implementación
**Audiencia:** Joel + Claude Code

---

## 1. Resumen ejecutivo

Sustituimos el formulario tradicional de captación de comprador por una **conversación guiada con LLM** que vive en `/buscar`. El usuario explica en lenguaje natural lo que busca y va respondiendo a 4-6 preguntas. La conversación queda íntegramente registrada como `BuyerLead` en el CRM con todo el contexto que un formulario tradicional jamás capturaría. Un agente humano contacta en menos de 24h con propuestas reales.

**No** es un chat de búsqueda contra el stock (eso es v2 cuando haya stock real publicado). **Es** un sustituto conversacional del formulario, con UX moderna y captura de información rica.

**Diferencial competitivo:** ningún portal generalista (Wallapop, Coches.net) ofrece captación de comprador conversacional. La barrera de entrada para el usuario baja drásticamente y la calidad del lead para el agente sube notablemente.

---

## 2. Persona del comprador

| Dimensión                     | Valor                                                                                                |
| ----------------------------- | ---------------------------------------------------------------------------------------------------- |
| **Edad**                      | 30-65 años                                                                                           |
| **Composición**               | 50% parejas, 25% familias, 15% singles, 10% grupos amigos                                            |
| **Conocimiento del producto** | Medio-bajo. Sabe que quiere "una camper" o "una autocaravana" pero no domina marcas/modelos          |
| **Madurez de la decisión**    | Mixta — algunos exploran, otros tienen presupuesto definido y quieren cerrar pronto                  |
| **Frustración previa**        | Ha buscado en Wallapop/Coches.net y se ha visto perdido entre cientos de anuncios sin contexto       |
| **Lo que quiere**             | Que alguien le ayude a entender qué necesita realmente y le proponga 2-3 opciones que tengan sentido |

**Frase ancla:** _"No quiero filtrar 200 furgos. Quiero contarle a alguien qué busco y que me diga cuáles me convienen."_

---

## 3. Visión del producto

### 3.1 Qué es

Una conversación amigable que captura un lead de comprador con calidad muy superior a un formulario.

### 3.2 Qué NO es (esta versión)

- No muestra furgos del stock al usuario
- No permite "hablar con cada furgo"
- No hace hand-off a humano en tiempo real
- No usa embeddings ni búsqueda semántica
- No promete plazos de venta
- No da precios

### 3.3 Qué será en v2 (post-lanzamiento, cuando haya stock real)

- Mostrará furgos del stock como cards en el chat después de entender la necesidad
- Permitirá "hablar con cada furgo" (RAG por vehículo)
- Búsqueda semántica con embeddings
- Hand-off opcional con WhatsApp Business

---

## 4. Flujo conversacional detallado

### 4.1 Estados del chat

| Estado                | Objetivo                                                          | Transición                                     |
| --------------------- | ----------------------------------------------------------------- | ---------------------------------------------- |
| **GREETING**          | Saludo + invitación a contar qué busca                            | Usuario envía primer mensaje → DISCOVERY       |
| **DISCOVERY**         | Entender necesidad real (uso, plazas, equipamiento crítico, zona) | Tras 3-5 turnos, suficiente contexto → CONTACT |
| **CONTACT**           | Capturar nombre + email + teléfono (con consentimiento RGPD)      | Datos válidos → QUALIFY                        |
| **QUALIFY**           | Capturar presupuesto + plazos                                     | Datos capturados → CONFIRMATION                |
| **CONFIRMATION**      | Resumir lo capturado + cerrar promesa de contacto                 | Usuario confirma o ajusta → COMPLETED          |
| **COMPLETED**         | Sesión cerrada, BuyerLead creado en CRM                           | —                                              |
| **ABANDONED**         | Sesión inactiva > 30 min sin completar                            | — (cron job)                                   |
| **REDIRECTED_SELLER** | El usuario quería vender, no comprar — redirigido a `/vender`     | —                                              |

### 4.2 Reglas del flujo

- **Máximo 8-10 turnos totales** (usuario + asistente). Si supera, fuerza CONTACT.
- **Si el usuario insiste en hablar con humano antes de tiempo:** capturar datos básicos rápido y cerrar con promesa de contacto urgente.
- **Si el usuario es muy vago en DISCOVERY:** repreguntar máx 2 veces antes de avanzar a CONTACT con lo que haya.
- **Si el usuario da datos personales incorrectos** (email malformado, teléfono extraño): repreguntar UNA vez con tono amable.
- **Si el usuario detecta intent de venta** ("quiero vender mi furgo"): redirigir a `/vender` con mensaje cálido.

### 4.3 Ejemplo de conversación ideal

```
🤖 ¡Hola! Soy el asistente de CampersNova. Te ayudo a encontrar la
   camper o autocaravana que mejor encaja contigo.

   Para empezar, cuéntame: ¿qué buscas y para qué la quieres usar?

👤 Hola, busco una camper para irme con mi mujer y nuestros dos niños
   pequeños de vacaciones por la costa.

🤖 ¡Suena genial! Entiendo que necesitas algo familiar y para vacaciones.
   Un par de cosas para afinar:
   - ¿Cuántas camas necesitáis? Con dos niños pequeños lo habitual
     son 4 plazas para dormir.
   - ¿Tenéis preferencia por algo concreto en el equipamiento? Por
     ejemplo: baño dentro, cocina interior, calefacción...

👤 Sí, 4 plazas. Y baño dentro sí o sí, los niños son pequeños y
   no me veo saliendo de noche. Cocina también, para no depender
   de comer fuera todos los días.

🤖 Perfecto, lo apunto: 4 plazas, baño y cocina interior. ¿Pensáis
   usarla principalmente verano o también escapadas en invierno?
   (Te lo pregunto porque eso decide si la calefacción es importante.)

👤 Más bien verano y algunos puentes. Por la costa norte sobre todo.

🤖 Genial, lo tengo todo: familia de 4, baño y cocina interior, uso
   estival principalmente, costa norte.

   Para que un experto te llame con propuestas concretas, ¿me dejas
   tus datos? Empezamos por tu nombre.

👤 Carlos.

🤖 Encantado, Carlos. ¿Cuál es tu email para enviarte las propuestas?

👤 carlos.martin@gmail.com

🤖 Apuntado. Y un teléfono donde te podamos llamar (en horario
   laboral, sin spam, lo prometo):

👤 612345678

🤖 Perfecto. Una última pregunta importante: ¿tienes un presupuesto
   aproximado en mente? No hace falta exacto, un rango va bien.

👤 Pues entre 25.000 y 35.000 euros, depende de lo que vea.

🤖 Anotado. Y por curiosidad, ¿para cuándo te gustaría tenerla?
   ¿Hay algún viaje próximo que la necesites o vas más tranquilo?

👤 Idealmente para junio que nos vamos al norte.

🤖 Vale Carlos, te resumo lo que tengo:

   📋 Necesidad: camper familiar 4 plazas con baño y cocina interior,
       uso vacacional estival
   💰 Presupuesto: 25.000-35.000 €
   📅 Plazos: idealmente junio
   📞 Te contactamos en: carlos.martin@gmail.com / 612345678

   Antes de cerrar, ¿das tu consentimiento para que tratemos tus datos
   según nuestra política de privacidad? [Sí / Política de privacidad]

👤 Sí

🤖 ¡Perfecto, Carlos! Acabo de pasar tu petición a nuestro equipo.

   En menos de 24 horas (días laborables) uno de nuestros expertos
   en campers te llamará al 612345678 con 2-3 opciones que encajen
   con lo que buscas. Si prefieres email primero, también puede ser.

   Mientras tanto, si quieres ver cómo trabajamos: campersnova.com/como-funciona

   Que tengas un gran día y buenos viajes 🚐
```

---

## 5. Sistema prompt (versión completa)

```
Eres el asistente de CampersNova, una empresa especializada en compraventa
de autocaravanas y campers semi-nuevas. Tu única misión es ayudar a un
visitante a contarte qué tipo de vehículo busca para que un experto humano
pueda contactarle con propuestas reales.

# Tu personalidad

- Cercano, conversacional, sin jerga corporativa
- Usas tú (nunca usted)
- Frases cortas y claras
- Empático: la persona puede llevar tiempo dándole vueltas a comprar
- Honesto: si no sabes algo, lo dices ("eso lo confirma mejor el agente")
- Eficiente: no alargas la conversación más de lo necesario

# Tu objetivo en cada conversación

Capturar suficiente información para que un agente humano pueda llamar al
visitante con propuestas concretas. La información que necesitas obtener:

1. **Necesidad real**: para qué quiere el vehículo, cuántas plazas, qué
   equipamiento es crítico (baño, cocina, calefacción, etc.), zona de uso
2. **Datos de contacto**: nombre, email, teléfono
3. **Cualificación comercial**: presupuesto aproximado y plazos

# Reglas del flujo

- Máximo 8-10 turnos en total. Sé eficiente.
- Empieza por entender la necesidad ANTES de pedir datos personales
- Cuando tengas claridad sobre la necesidad (~3-5 turnos), pasa a pedir datos
- Pide los datos de uno en uno, no todos a la vez
- El presupuesto y los plazos se piden al final, son lo más sensible
- Si el usuario es vago, repregunta máximo 2 veces antes de avanzar
- Si pide hablar con un humano, captura lo esencial y cierra con promesa
  de contacto urgente
- Si quiere VENDER su camper en vez de comprar, redirígelo amablemente a
  campersnova.com/vender

# Lo que SÍ puedes hacer

- Hacer preguntas de seguimiento naturales
- Reformular lo entendido para confirmar
- Sugerir consideraciones útiles ("con niños pequeños suele ser
  importante el baño interior")
- Mantener conversaciones cortas y respetuosas
- Cerrar con un resumen claro de lo capturado

# Lo que NO debes hacer

- NO inventes precios, modelos, marcas o disponibilidad de vehículos
- NO prometas plazos de venta, comisiones distintas al 4%, ni nada que
  no aparezca explícitamente en este prompt
- NO recomiendes vehículos específicos (eso es en v2)
- NO juzgues el presupuesto del usuario ni sus prioridades
- NO inventes información sobre la empresa
- NO uses emojis salvo el cierre final 🚐
- NO seas demasiado entusiasta — profesional y cercano, no comercial

# Información sobre CampersNova que puedes mencionar

- Comisión 4% al cierre, sin coste para el comprador
- Especialistas en autocaravanas y campers semi-nuevas
- Equipo humano que filtra y selecciona
- Tasación gratuita para vendedores en menos de 60 segundos
- Atención en horario laboral (lunes a viernes 9-19h)

# Formato de respuesta

Responde siempre en texto plano. Sin markdown, sin listas con asteriscos
en respuestas conversacionales. Solo usa saltos de línea entre bloques
cuando aporte legibilidad.

# Cuando hayas capturado toda la información

Tu último mensaje DEBE incluir un resumen estructurado de lo capturado
(necesidad, presupuesto, plazos, contacto) y la promesa de contacto en
24h por uno de los expertos. Cierra con calidez, sin venderle nada más.

# Detección de intent de venta

Si el usuario menciona que quiere VENDER (no comprar) — palabras como
"tengo una camper", "quiero vender mi furgo", "cuánto vale mi
autocaravana" — responde:

"¡Hola! Veo que quieres vender tu camper o autocaravana, no comprar.
Te ayudamos también con eso. En campersnova.com/vender puedes hacer
una tasación gratuita en 60 segundos y un agente te contactará para
gestionar la venta. ¿Quieres que te lleve allí?"
```

---

## 6. Schema de datos

### 6.1 Migración Prisma

```prisma
// Nuevo modelo
model BuyerChatSession {
  id              String   @id @default(cuid())
  sessionToken    String   @unique  // identifier público anónimo del visitante
  status          BuyerChatStatus @default(IN_PROGRESS)

  // Conversación íntegra (array de {role, content, timestamp})
  messages        Json

  // Datos extraídos durante la conversación
  capturedNombre        String?
  capturedEmail         String?
  capturedTelefono      String?
  capturedNecesidad     String?  // resumen libre del LLM
  capturedPlazas        Int?
  capturedTipo          VehicleTipo?
  capturedEquipamiento  Json?    // {baño: bool, cocina: bool, calefaccion: bool, ...}
  capturedZona          String?
  capturedPresupuestoMin Int?
  capturedPresupuestoMax Int?
  capturedPlazos        String?

  // Consentimiento RGPD
  gdprConsentAt  DateTime?
  gdprConsentIp  String?

  // Vinculación con BuyerLead creado al cerrar
  buyerLeadId    String?  @unique
  buyerLead      BuyerLead? @relation(fields: [buyerLeadId], references: [id])

  // Metadata técnica
  ipAddress      String?
  userAgent      String?
  llmModel       String   @default("claude-sonnet-4-6")
  totalTokens    Int      @default(0)
  totalCostCents Int      @default(0)  // tracking de coste por conversación

  startedAt      DateTime @default(now())
  lastMessageAt  DateTime @default(now())
  completedAt    DateTime?

  @@index([status])
  @@index([startedAt])
  @@map("buyer_chat_sessions")
}

enum BuyerChatStatus {
  IN_PROGRESS
  COMPLETED
  ABANDONED
  REDIRECTED_SELLER
}

// Modificar BuyerLead existente para añadir source
model BuyerLead {
  // ... campos existentes ...
  source          BuyerLeadSource @default(MANUAL)
  chatSession     BuyerChatSession?
}

enum BuyerLeadSource {
  MANUAL    // creado por agente desde el backoffice
  CHAT      // creado desde el chat público
}
```

### 6.2 Mensajes en el JSON

```typescript
type ChatMessage = {
  role: 'user' | 'assistant' | 'system'
  content: string
  timestamp: string // ISO
}
```

---

## 7. Endpoints API

### 7.1 `POST /api/chat/buyer/start`

Inicia una nueva sesión.

**Request:** `{ captchaToken: string }`

**Response:**

```json
{
  "sessionToken": "csk_abc123...",
  "greeting": "¡Hola! Soy el asistente de CampersNova..."
}
```

**Lógica:**

1. Verifica captcha hCaptcha
2. Rate limit por IP (max 3 sesiones nuevas / día)
3. Crea `BuyerChatSession` con greeting inicial en `messages`
4. Devuelve `sessionToken` + greeting

---

### 7.2 `POST /api/chat/buyer/message` (streaming)

Envía un mensaje del usuario y recibe respuesta del asistente.

**Request:**

```json
{
  "sessionToken": "csk_abc123...",
  "message": "Busco una camper para irme con mi mujer..."
}
```

**Response:** `text/event-stream` con la respuesta del LLM en streaming.

**Lógica:**

1. Carga `BuyerChatSession` por token
2. Verifica que `status === 'IN_PROGRESS'`
3. Verifica que no ha pasado el límite de turnos (10)
4. Añade mensaje del usuario a `messages`
5. Llama a Claude API con sistema prompt + historial completo
6. Streamea respuesta al cliente
7. Al terminar, guarda respuesta del asistente en `messages` y actualiza `lastMessageAt`
8. Si la respuesta del LLM contiene marca `[INTENT_VENTA]`, marca como `REDIRECTED_SELLER`
9. Si la respuesta del LLM contiene marca `[CONVERSATION_COMPLETE]` con JSON de datos, va a `/api/chat/buyer/complete`

---

### 7.3 `POST /api/chat/buyer/complete`

Cierra la sesión y crea el `BuyerLead`.

**Request:**

```json
{
  "sessionToken": "csk_abc123...",
  "gdprConsent": true,
  "extractedData": {
    "nombre": "Carlos",
    "email": "carlos.martin@gmail.com",
    "telefono": "612345678",
    "necesidad": "Camper familiar para vacaciones costa norte",
    "plazas": 4,
    "tipo": "CAMPER",
    "equipamiento": { "bano": true, "cocina": true, "calefaccion": false },
    "zona": "Norte España",
    "presupuestoMin": 25000,
    "presupuestoMax": 35000,
    "plazos": "Junio"
  }
}
```

**Response:**

```json
{
  "success": true,
  "buyerLeadId": "bl_xyz789...",
  "message": "Acabo de pasar tu petición..."
}
```

**Lógica:**

1. Verifica sesión existe y está IN_PROGRESS
2. Valida `gdprConsent === true`
3. Valida email y teléfono
4. Crea `BuyerLead` con `source = CHAT`
5. Vincula `buyerLeadId` en `BuyerChatSession`
6. Cambia status a `COMPLETED`, rellena `completedAt`
7. Crea `Activity` tipo `LEAD_CREADO_CHAT`
8. Envía email a todos los agentes activos (reutiliza función de CAM-19)
9. Devuelve confirmación

---

### 7.4 Cron job: marcar sesiones abandonadas

Vercel Cron diario que marca como `ABANDONED` cualquier sesión `IN_PROGRESS` con `lastMessageAt > 30 minutos`.

---

## 8. UI/UX

### 8.1 Página `/buscar`

Layout:

- Header simple con logo CampersNova (sin nav completa, foco total en chat)
- Container centrado max-w-2xl
- Chat ocupa altura ~70% del viewport
- Mensajes con burbujas: usuario derecha (teal), asistente izquierda (cream)
- Input fijo abajo con botón send
- Indicador de typing del asistente (3 puntos animados)
- Streaming visible: el texto aparece carácter a carácter

### 8.2 Estados visuales

- **Idle**: input activo, placeholder "Escribe tu mensaje..."
- **Typing assistant**: input deshabilitado, indicador "El asistente está escribiendo..."
- **Streaming**: el último mensaje del asistente se va construyendo en tiempo real
- **Error**: toast en rojo "Algo ha fallado, vuelve a intentarlo"
- **Completed**: chat se queda en modo lectura con mensaje final + botón "Volver al inicio"
- **Captcha al inicio**: invisible, ejecutado en background al cargar

### 8.3 Mobile-first

- Pantalla completa al hacer focus en input (sin nav molestando)
- Teclado no tapa el último mensaje (scroll automático)
- Botón send accesible con pulgar
- Burbujas de mensaje legibles a 16px+ tamaño base

### 8.4 Accesibilidad

- ARIA live region para mensajes nuevos del asistente (lectores de pantalla)
- Focus management: tras enviar, focus vuelve al input
- Keyboard: Enter envía, Shift+Enter nueva línea
- Contraste AA en todas las burbujas

### 8.5 Microcopy

- Placeholder input: `Escribe lo que buscas...`
- Botón send: icono flecha, sin texto (mobile-friendly)
- Indicador typing: `CampersNova está escribiendo...`
- Mensaje de bienvenida (vacío estado): `Cuéntale al asistente qué buscas. Tarda 2 minutos.`
- Error: `Vaya, algo ha fallado. ¿Volvemos a intentarlo?`
- Completed: `Listo. Te llamamos en 24h con propuestas. ¿Vuelves a la web?`

---

## 9. Integración con CRM

### 9.1 Cuando se completa una sesión de chat

1. Se crea `BuyerLead` con `source = CHAT`
2. Se crea `BuyerChatSession` enlazada
3. Se crea `Activity` con `type = LEAD_CREADO_CHAT` en el lead
4. Email a agentes activos con asunto "Nuevo lead chat: Carlos M. — buscando camper familiar 25-35k€"

### 9.2 Vista de la sesión en el CRM

En la ficha del `BuyerLead` (cuando `source = CHAT`):

- Pestaña nueva "Conversación" que muestra el chat completo en formato burbujas (read-only)
- Datos del lead extraídos arriba como siempre
- Botón "Ver conversación completa" lleva a una página dedicada con la transcripción

### 9.3 Dashboard

Añadir KPIs a la sección de leads:

- "Conversaciones iniciadas hoy"
- "Conversaciones completadas hoy" (% conversion)
- "Coste medio por lead chat" (calculado de `totalCostCents`)

### 9.4 Filtro en listado de BuyerLeads

Filtro nuevo `Origen: Manual / Chat` para que el agente pueda ver solo los leads chat.

---

## 10. Edge cases y manejo

| Caso                                                    | Comportamiento                                                                                                                            |
| ------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| **Usuario abre /buscar y no escribe nada**              | Sesión queda IN_PROGRESS hasta que cron job la marca ABANDONED a los 30min                                                                |
| **Usuario escribe spam o lenguaje ofensivo**            | El sistema prompt indica al LLM que rechace educadamente y reconduzca                                                                     |
| **Usuario insiste en obtener precios o disponibilidad** | LLM responde que esa info la dará el agente humano en la llamada                                                                          |
| **Email malformado**                                    | LLM repregunta UNA vez con tono amable. Si segunda vez sigue mal, captura "no_email_valido" y avanza                                      |
| **Teléfono extraño**                                    | Mismo patrón que email                                                                                                                    |
| **Usuario ya cerrado quiere reabrir**                   | Cada sesión es nueva — el sessionToken caduca al COMPLETED                                                                                |
| **Anthropic API falla**                                 | Mensaje de error en el chat: "Vaya, problema técnico. Vuelve a intentarlo en 1 minuto o llámanos al [WhatsApp]". Sentry captura el error. |
| **Usuario detectado como bot**                          | Captcha al inicio + análisis de patrones (mensajes muy rápidos, etc.)                                                                     |
| **Coste excesivo**                                      | Hard limit 10 turnos. Soft limit en sistema prompt para ser eficiente. Tracking de coste por sesión.                                      |
| **GDPR: usuario quiere borrar sus datos**               | Endpoint `/api/chat/buyer/delete-by-email` — borra BuyerChatSession + BuyerLead asociado                                                  |

---

## 11. Métricas a trackear (PostHog)

| Evento                            | Properties                                              | Cuándo                                      |
| --------------------------------- | ------------------------------------------------------- | ------------------------------------------- |
| `chat_buyer_started`              | `sessionToken`                                          | Al cargar `/buscar` y aceptar captcha       |
| `chat_buyer_message_sent`         | `sessionToken`, `turnNumber`                            | Cada mensaje del usuario                    |
| `chat_buyer_data_captured`        | `sessionToken`, `field`                                 | Cuando se extrae nombre/email/teléfono/etc. |
| `chat_buyer_completed`            | `sessionToken`, `turnsCount`, `durationMs`, `costCents` | Al completar la sesión                      |
| `chat_buyer_abandoned`            | `sessionToken`, `lastTurn`                              | Cron lo marca                               |
| `chat_buyer_redirected_to_seller` | `sessionToken`, `lastTurn`                              | Cuando detecta intent de venta              |
| `chat_buyer_error`                | `sessionToken`, `errorType`                             | Anthropic falla, validación falla, etc.     |

**Dashboard que crear en PostHog:**

- Funnel: started → first_message → contact_data → completed
- Distribución de conversaciones por número de turnos
- Coste medio y total mensual
- Tasa de conversión vs form tradicional

---

## 12. Stack añadido

| Librería             | Uso                                   | Coste                          |
| -------------------- | ------------------------------------- | ------------------------------ |
| `ai` (Vercel AI SDK) | Hook `useChat` + helpers de streaming | Gratis                         |
| `@ai-sdk/anthropic`  | Provider de Claude                    | Gratis                         |
| Anthropic API key    | Llamadas LLM (Claude Haiku 4.5)       | **~$0.02-0.05 / conversación** |

**Env vars nuevas en `.env.local`:**

```
ANTHROPIC_API_KEY=sk-ant-...
ANTHROPIC_MODEL=claude-haiku-4-5-20251001
ANTHROPIC_FALLBACK_MODEL=claude-sonnet-4-6     # opcional, ver sección 12.1
```

### 12.1 Estrategia híbrida Haiku → Sonnet (opcional pero recomendada)

Haiku 4.5 es ~5× más barato que Sonnet pero pierde calidad cuando el usuario es vago, da respuestas largas o cambia de tema. Para captura de leads guiada Haiku va sobrado en el 80-90% de casos.

**Patrón sugerido:**

- **Default: Haiku 4.5** para todos los turnos
- **Escalado a Sonnet 4.6** si se cumple alguna condición:
  - El usuario lleva ≥3 mensajes muy largos (>200 palabras) → conversación compleja
  - Haiku ha repreguntado lo mismo 2 veces sin obtener dato claro → puede haber matiz que se le escapa
  - El último mensaje del usuario contiene >2 cláusulas condicionales ("si fuera más barata pero solo si tiene baño...") → razonamiento estructurado

Implementación: un middleware sencillo en el endpoint `/api/chat/buyer/message` que detecta esas condiciones y cambia el modelo en esa request. La conversación sigue siendo continua, el usuario no nota nada.

**Cost ballpark mensual:**

- 100% Haiku: ~$5-15/mes para 250-500 conversaciones
- Híbrido (90% Haiku + 10% Sonnet escalado): ~$10-25/mes
- 100% Sonnet: ~$25-100/mes

> **Mi recomendación: arrancar con 100% Haiku** para validar la calidad real. Si en 2 semanas de producción ves que Haiku flaquea en algún tipo de conversación, activamos el fallback. Empezar simple, optimizar con datos.

---

## 13. Plan de tickets

| ID         | Ticket                                                                                  | Estimación |
| ---------- | --------------------------------------------------------------------------------------- | ---------- |
| **CAM-50** | Schema Prisma: `BuyerChatSession` + enums + migración + actualizar BuyerLead con source | 0.5d       |
| **CAM-51** | Endpoint `POST /api/chat/buyer/start` con captcha + rate limit + greeting inicial       | 0.5d       |
| **CAM-52** | Endpoint `POST /api/chat/buyer/message` con streaming Claude + persistencia             | 1d         |
| **CAM-53** | Endpoint `POST /api/chat/buyer/complete` + creación BuyerLead + email a agentes         | 0.5d       |
| **CAM-54** | Página `/buscar` con UI de chat (Vercel AI SDK), streaming visible, mobile-first        | 1d         |
| **CAM-55** | Vista en CRM: pestaña "Conversación" en ficha BuyerLead chat + filtro origen            | 0.5d       |
| **CAM-56** | Cron job para marcar sesiones abandonadas + KPIs PostHog + dashboard                    | 0.5d       |
| **CAM-57** | Tests Vitest del flujo de extracción de datos + Playwright E2E del chat completo        | 0.5d       |

**Total estimado: 5 días de trabajo (1 semana laborable)**

---

## 14. Calendario para el lanzamiento total (camino Y)

| Día     | Bloque                                    | Detalle                                             |
| ------- | ----------------------------------------- | --------------------------------------------------- |
| **1**   | Quick wins audit landing                  | Cambios #2, #3, #4, #7, #8, #10 del audit           |
| **2-3** | Rediseño completo landing                 | Implementación según `Landing-Spec.md` con imágenes |
| **4**   | Iteración fina landing + audit backoffice | Pulido + estados vacíos + emails bonitos            |
| **5-9** | Chat Buyer v1 (CAM-50 a CAM-57)           | 5 días según este PRD                               |
| **10**  | Pre-launch checklist + deploy CAM-46      | Dominio, DNS, env vars Vercel, smoke tests          |

**Total: 10 días laborables (~2 semanas) hasta lanzamiento.** Lanzas con landing pulida + chat conversacional + todo en producción. Storytelling completo.

---

## 15. Decisiones cerradas

| #   | Decisión                      | Valor                                                                                                                                                                                          |
| --- | ----------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | **Modelo LLM**                | **Claude Haiku 4.5** (vía Anthropic API). Estrategia híbrida con fallback a Sonnet documentada en 12.1, no implementada en v1 — solo si la calidad de Haiku no es suficiente con datos reales. |
| 2   | **Coste mensual estimado**    | $5-15/mes con Haiku 100% — irrelevante para validar                                                                                                                                            |
| 3   | **Horario de operación**      | 24/7. Email a agentes con tag "[FUERA HORARIO]" si llega entre 19h-9h o fines de semana                                                                                                        |
| 4   | **Idioma**                    | Solo español en v1                                                                                                                                                                             |
| 5   | **Editar respuestas previas** | No en v1, solo conversación lineal                                                                                                                                                             |
| 6   | **Botón flotante WhatsApp**   | Sí, fallback para los que prefieren contacto directo                                                                                                                                           |

---

**Fin del PRD.**

**Siguiente paso:** Joel revisa, ajusta lo que considere, y se lo pasamos a Claude Code junto con la `Landing-Spec.md` para empezar la implementación coordinada de las dos cosas.
