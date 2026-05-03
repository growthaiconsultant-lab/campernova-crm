# Landing Spec — CampersNova `/`

**Spec de diseño y contenido para la landing comercial pública.**
Sustituye al CAM-38 actual con un rediseño completo orientado a conversión.

|                        |                                                                             |
| ---------------------- | --------------------------------------------------------------------------- |
| **Audiencia**          | Vendedores (propietarios pensando en vender su autocaravana o camper)       |
| **Objetivo principal** | Que el vendedor llegue al form `/vender` con confianza y termine enviándolo |
| **KPI primario**       | % visitantes únicos → form_submitted en `/vender`                           |
| **KPI secundario**     | Tiempo en página + scroll depth (calidad del tráfico)                       |
| **Versión**            | 1.0 — base para CAM-38b (rediseño)                                          |

> **Las marcas `[ASUNCIÓN — confirmar]` son defaults razonables que Joel debe validar o ajustar con datos reales antes de que Claude Code implemente.**

---

## 1. Resumen ejecutivo

La landing actual cumple funcionalmente pero no está al nivel de un producto que pide a un usuario confiar 30-60k€ en él. Esta spec define un rediseño con foco en:

1. **Confianza visual inmediata** mediante fotografía real, tipografía premium y espaciado generoso
2. **Calculadora de tasación como hero CTA** — entrega valor ANTES de pedir datos
3. **Argumento claro contra alternativas** (Wallapop / concesionario / vender por mi cuenta)
4. **Pruebas tangibles** — números, casos reales, lifestyle photography
5. **Mobile-first obsesivo** — más del 60% del tráfico será móvil

**Principio rector:** la landing debe transmitir "estos saben lo que hacen, sus campers son buenas, su proceso es claro y honesto, voy a estar tranquilo".

---

## 2. Persona del vendedor

### 2.1 Perfil base **[ASUNCIÓN — confirmar]**

| Dimensión                           | Valor estimado                                          |
| ----------------------------------- | ------------------------------------------------------- |
| Edad                                | 35-65 años                                              |
| Composición                         | 60% parejas, 25% jubilados, 15% familias                |
| Renta                               | Media-alta (la furgo cuesta 30-60k€)                    |
| Experiencia digital                 | Media — usa internet pero no es nativo digital          |
| Conocimiento del mercado de campers | **Bajo** — no sabe cuánto vale realmente su furgo       |
| Frecuencia de uso real              | Salieron mucho 2-3 años, ahora la usan 2-3 veces al año |

### 2.2 Razón principal de venta **[ASUNCIÓN — confirmar]**

Por orden de frecuencia esperada:

1. **Cambio de etapa vital** (jubilación, hijos crecidos, separación) — 30%
2. **Falta de uso** ("la tengo parada, ocupa sitio, pago seguro y no la disfruto") — 30%
3. **Upgrade** (quieren una más grande/nueva) — 20%
4. **Necesidad de liquidez** — 10%
5. **Compraron como impulso post-COVID y se arrepintieron** — 10%

### 2.3 Miedos y fricciones (qué les frena de vender)

Por orden de impacto:

1. **"Me van a pagar poco"** — desconocimiento del precio justo, miedo a regalar valor
2. **"Va a tardar meses"** — la furgo en portales generalistas tarda 3-6 meses de media
3. **"Va a venir gente sin filtro a perder mi tiempo"** — visitas de curiosos sin intención real de compra
4. **"El papeleo del cambio de titularidad es un lío"** — gestoría, ITP, transferencia
5. **"No sé cómo proteger mi datos / la documentación de la furgo"**
6. **"¿Y si me pagan con un cheque falso o me roban?"** — riesgo de fraude

### 2.4 Alternativas que está considerando

- **Wallapop / Milanuncios / Coches.net** — más barato pero más fricción y miedo
- **Concesionario** — cobra 10-15% de comisión, paga menos, proceso opaco
- **Vender por su cuenta a alguien conocido** — si surge la oportunidad
- **Postergar** — "ya verás, total tampoco la necesito vender ya"

CampersNova compite contra todas. La landing debe argumentar contra cada una.

### 2.5 Disparador típico de búsqueda

"Vender mi camper" / "vender mi autocaravana" / "cuánto vale mi furgo" / "tasación autocaravana" / "campers segunda mano". El SEO de la landing debe estar afinado a estos términos.

---

## 3. Tono y posicionamiento de marca

### 3.1 Adjetivos clave **[ASUNCIÓN — confirmar]**

- **Experto** — sabemos del sector, no somos un Wallapop genérico
- **Cercano** — no somos un concesionario frío
- **Transparente** — la comisión, el proceso, los plazos, todo claro

### 3.2 Tono de voz

- **Trato:** **tú** (no usted)
- **Registro:** profesional pero conversacional. Frases cortas. Sin jerga técnica innecesaria.
- **Humor:** **no chiste fácil**, sí cercanía y guiños suaves al universo camper (la "vida furgo", aventura, libertad)
- **Verbos:** activos, presente, segunda persona
- **Prohibido:** "soluciones de movilidad", "experiencia premium", "sinergias", todo el corporate-speak

### 3.3 Frases ancla del posicionamiento

Tres líneas que la landing debe transmitir, una en cada sección clave:

1. **Hero**: "Vende tu camper sin perder valor ni tiempo"
2. **Cómo funciona**: "Nosotros nos encargamos de todo. Tú solo recibes ofertas reales."
3. **Pricing**: "Solo pagas si la vendemos. 4% al cierre, sin sorpresas."

---

## 4. Sistema visual

### 4.1 Tipografía **[ASUNCIÓN — confirmar]**

| Uso                 | Fuente recomendada                                                                  | Razón                                                                 |
| ------------------- | ----------------------------------------------------------------------------------- | --------------------------------------------------------------------- |
| Display / titulares | **Recoleta** (serif moderna premium) o **GT America Mono** alternativa con carácter | Diferenciación vs todo lo que va con Inter genérico                   |
| Cuerpo              | **Inter** (mantener — es excelente para legibilidad)                                | Ya está en el proyecto, gratis vía Google Fonts                       |
| Acentos / metadatos | **JetBrains Mono** o **IBM Plex Mono**                                              | Para precios, números, datos técnicos — añade profesionalidad técnica |

> Si Recoleta no es viable por licencia, alternativa gratuita potente: **Fraunces** (serif con carácter, gratuita, en Google Fonts). Casi tan distintiva.

### 4.2 Paleta de color

Mantenemos la paleta CampersNova existente (extraída de campersnova.com en CAM-005):

- **Primary deep teal** `#294e4c` — fondos sólidos, sidebar, botones secundarios
- **Accent burnt orange** `#cc6119` — CTAs principales, estados activos
- **Deep teal accent** `#153e4d` — bordes, separadores
- **Neutrals**: blanco roto `#fafaf9`, gris cálido `#78716c`, negro casi `#1c1917`

**Añadir para landing**:

- **Sand / cream** `#f5f0e6` — fondos de sección suaves, sensación cálida
- **Forest green** `#2d4a3e` — acento secundario para variar (sostenibilidad, naturaleza)

### 4.3 Fotografía

**El cambio más impactante**. Tres tipos:

1. **Lifestyle aspiracional** (3-4 imágenes): pareja con su camper en un acantilado al amanecer, niños desayunando con la puerta abierta del baul, alguien preparando café en la zona de cocina con vista a un lago. Estilo: cálido, dorado, real, NO catálogo. Fuentes: Unsplash filtros "vanlife", "campervan lifestyle". Filmstock Pexels también.

2. **Stock real** (8-10 imágenes): fotos de furgos vendidas o en stock actual. Esto es donde Joel debe aportar material propio o pedirlo a sus 3 agentes.

3. **Personas / proceso** (2-3 imágenes): un agente de CampersNova explicando algo, una visita a un cliente, un apretón de manos al cerrar. Si no se puede producir ahora, **omitir** — es peor poner stock genérico que no poner.

### 4.4 Iconografía

- **Lucide React** (ya en el proyecto). Stroke 1.5 (no el default 2 — más fino, más premium)
- Cuando un icono represente algo importante, **encerrarlo en un cuadrado teal o naranja** con esquinas redondeadas (8px radius), no usarlo solo

### 4.5 Layout y espaciado

- **Container max 1200px** centrado
- **Padding lateral:** 24px móvil, 48px tablet, 96px desktop
- **Espaciado vertical entre secciones:** mínimo 80px (móvil) / 128px (desktop). Generosidad = sensación premium
- **Grid de 12 columnas** con gap 24px

### 4.6 Microinteracciones

- **Animaciones de entrada al hacer scroll** con Framer Motion: fade + translateY de 20px, duración 0.6s, easing easeOut
- **Hover en cards de furgo:** levantar 4px (`translateY(-4px)`) + sombra creciente
- **Hover en CTAs:** cambio de color suave + scale 1.02
- **Counter animado** en los números clave (87 furgos vendidas → cuenta de 0 a 87 al hacer scroll)
- **Carrusel de stock:** auto-play suave con pausa al hover, dots de paginación
- **Transición de chevron en FAQ** al abrir

---

## 5. Estructura de secciones

12 secciones, en este orden. Cada una tiene un propósito psicológico distinto. **Ninguna se puede borrar sin quitar valor; el orden importa.**

### Sección 1 — Hero (above the fold)

**Propósito:** captar atención + transmitir valor en 3 segundos + dar primera CTA de bajo compromiso.

**Layout (desktop):**

- Columna izquierda (60%): titular + subtitular + 2 CTAs
- Columna derecha (40%): foto lifestyle premium en formato cuadrado o vertical, ligeramente recortada con esquinas redondeadas

**Layout (móvil):** todo apilado, foto debajo del CTA

**Copy:**

- **Eyebrow** (encima del titular, mayúsculas pequeñas, naranja): `EXPERTOS EN COMPRAVENTA DE CAMPERS Y AUTOCARAVANAS`
- **Titular** (Display, 56-72px desktop / 36-44px móvil): `Vende tu camper sin perder valor ni tiempo.`
- **Subtitular** (cuerpo grande, 18-20px, gris cálido): `Tasación gratuita en menos de 60 segundos. Si decides vender, nos encargamos de todo y solo cobramos si la vendemos.`
- **CTA primario** (naranja, grande): `Calcular precio de mi camper`
- **CTA secundario** (link teal con arrow): `Ver cómo funciona →`
- **Microcopy debajo de CTAs** (12px, gris): `Sin coste · Sin compromiso · Resultado al instante`

**Imagen:** lifestyle real, una camper aparcada con vista, momento del día con luz dorada (golden hour). NO render. NO interior estéril.

---

### Sección 2 — Trust strip (números clave)

**Propósito:** legitimar inmediatamente con datos. Los números son la mejor prueba social al inicio.

**Layout:** tira horizontal con 3-4 stats grandes separados por divisor sutil. Fondo crema (`#f5f0e6`).

**Stats** **[ASUNCIÓN — Joel debe rellenar con datos reales]**:

- `87 campers vendidas` _(rellenar con número real)_
- `42 días tiempo medio de venta` _(rellenar)_
- `4% comisión al cierre` _(este es real)_
- `0€ coste por adelantado` _(este es real y diferenciador)_

**Si Joel aún no tiene números reales suficientes, usar:**

- `Tasación en <60 segundos`
- `4% al cierre, 0€ al alta`
- `100% trato profesional`
- `Atención humana en cada paso`

**Animación:** counter animado al entrar en viewport (de 0 al número final, 1.5s)

---

### Sección 3 — Calculadora rápida de tasación (mini-form)

**Propósito:** entregar valor INMEDIATO. La diferencia clave vs portales tradicionales — aquí ya estás obteniendo algo útil sin haber rellenado nada extenso.

**Layout:** card grande centrada con borde sutil y sombra suave. 4 campos:

1. **Tipo:** Camper / Autocaravana (radio buttons grandes con iconos)
2. **Marca y modelo:** combobox autocompletable con la lista de tu tabla `reference_prices`
3. **Año:** slider o select 2000-2025
4. **Kilómetros:** input numérico con sufijo "km"

**Botón:** `Ver mi tasación →` (naranja, full width)

**Resultado (después del click):**

- Card resultado con rango de precios: `Tu camper vale entre 32.000 € y 38.000 €. Precio recomendado: 35.500 €.`
- Microcopy: "Esta es una estimación inicial. La tasación final la confirmamos en 24h tras revisar fotos y datos."
- CTA fuerte: `Vender mi camper a este precio →` (lleva al form `/vender` con los datos pre-rellenados)

> **Implementación técnica:** reutiliza la función `calculateValuation` ya existente en `lib/valuation/`. Requiere endpoint API público (no auth).

> **Decisión importante:** Si quieres aún más fricción cero, puedes capturar el resultado **sin** pedir email. La conversión de "vi mi precio" a "ya quiero venderla" es alta cuando el rango es atractivo.

---

### Sección 4 — Cómo funciona (proceso visual en 4 pasos)

**Propósito:** disipar el miedo a "no sé qué pasa después".

**Layout:** 4 columnas en desktop, stack vertical en móvil. Cada paso tiene número grande, icono, título corto, descripción 2 líneas.

**Pasos:**

1. **Cuéntanos sobre tu camper**
   _Rellenas un formulario rápido con datos y fotos. 5 minutos._

2. **Te damos la tasación final**
   _Un agente revisa todo y te llama en 24h con el precio definitivo y los siguientes pasos._

3. **Publicamos y filtramos compradores**
   _Nos encargamos del anuncio, las fotos profesionales si hace falta, y filtramos solo a compradores reales._

4. **Cierre y papeleo**
   _Cuando aparece la oferta correcta, gestionamos la transferencia, el ITP y la entrega. Tú firmas y cobras._

**Visual:** una línea horizontal con puntos en cada paso conectándolos (desktop). Iconos en cuadrados teal con esquinas redondeadas.

---

### Sección 5 — Por qué CampersNova vs alternativas

**Propósito:** matar las objeciones de las 3 alternativas reales (Wallapop / concesionario / vender por mi cuenta).

**Layout:** tabla comparativa visual. Filas = atributos, columnas = opciones. CampersNova destacada con fondo crema y borde teal.

|                                        | **CampersNova**             | Wallapop / portales       | Concesionario     |
| -------------------------------------- | --------------------------- | ------------------------- | ----------------- |
| **Comisión**                           | 4% al cierre                | 0% pero te ocupas de todo | 10-15%            |
| **Tiempo medio**                       | 42 días                     | 3-6 meses                 | 1-3 meses         |
| **Filtro de visitas**                  | Sí, solo compradores reales | No, viene cualquiera      | Sí                |
| **Fotos profesionales**                | Incluidas                   | A tu cuenta               | Incluidas         |
| **Gestión papeleo (ITP, titularidad)** | Incluida                    | A tu cuenta               | Incluida          |
| **Te pagan**                           | Precio de mercado           | Lo que negocies           | 15-25% por debajo |

**Copy debajo:** _"Por eso te cobramos solo si vendemos. Si nuestro modelo no funciona, no nos pagas. Sin riesgo."_

---

### Sección 6 — Galería del stock actual

**Propósito:** prueba visual + ofrecer al usuario ver "vehículos como el suyo" ya en el sistema.

**Layout:** carrusel horizontal con 6-8 cards. Cada card:

- Foto principal (16:10)
- Marca + modelo + año
- Km + plazas
- Precio (`32.500 €`)
- Mini badge: `VENDIDA` (con paloma) o `EN VENTA`

**Implementación técnica:** server component que lee `Vehicle` con `estado IN (PUBLICADO, VENDIDO)`, ORDER BY `vendido_at DESC, publicado_at DESC` LIMIT 8.

**Copy** (encima del carrusel):

- Title: `Algunas de nuestras campers`
- Subtitle: `Stock actual y recientemente vendidas. Cada una con su historia.`

---

### Sección 7 — Testimonios

**Propósito:** validación social emocional. Las personas confían en personas, no en empresas.

**Layout:** 3 cards en desktop / 1 con carrusel en móvil. Cada card:

- Foto del testimoniante (cuadrada, redondeada al 100%, 64px)
- Nombre + ciudad
- Camper que vendió + precio (`Vendí mi Volkswagen California 2018 por 38.000 €`)
- Quote (3-4 líneas)
- ⭐⭐⭐⭐⭐

**Si Joel no tiene testimoniales reales aún:**

- **Opción A**: omitir la sección y añadirla en post-launch tras 5-10 ventas
- **Opción B**: usar "lo que dicen nuestros clientes" en formato más neutro con quotes de mensajes reales que hayan llegado por WhatsApp, sin foto, citando solo "Carlos R., Madrid"

**[ASUNCIÓN — confirmar si tienes testimoniales reales o si va a versión inicial sin la sección]**

---

### Sección 8 — Preguntas frecuentes

**Propósito:** disipar las dudas que NO se atrevieron a preguntar.

**Layout:** acordeón clásico, 6-8 preguntas. Animación de chevron rotatorio.

**Preguntas (ordenadas por importancia):**

1. **¿Cuánto cobráis exactamente?**
   4% sobre el precio de venta, solo si vendemos. Sin coste de alta, sin coste mensual, sin sorpresas. Si tu camper se vende por 35.000 €, recibes 33.600 €.

2. **¿Cuánto tarda en venderse mi camper?**
   El tiempo medio en nuestro stock es de 42 días. Depende del precio, estado y época del año. Las campers bien tasadas y en buen estado se venden mucho más rápido.

3. **¿Quién paga el cambio de titularidad y el ITP?**
   El comprador se ocupa del ITP. Nosotros gestionamos la transferencia y el papeleo para que tú no tengas que hacer nada — solo firmar y entregar las llaves.

4. **¿Cómo me protegéis de fraudes y compradores tóxicos?**
   Filtramos cada lead antes de pasarlo a visita. No damos tu teléfono ni dirección hasta que el comprador es serio. Las visitas se hacen de forma controlada.

5. **¿Y si no se vende?**
   Si pasados X días no hay ofertas, revisamos juntos el precio o las condiciones. Sin coste para ti. Si decides retirarla, no nos debes nada.

6. **¿Hacéis fotos profesionales?**
   Sí, si tu camper lo necesita y vives en zona accesible. Tú decides si quieres usar tus fotos o que enviemos a un fotógrafo.

7. **¿Aceptáis cualquier camper o autocaravana?**
   Aceptamos vehículos en buen estado general, ITV en regla y antigüedad razonable. Te decimos si es viable en la primera valoración.

8. **¿Tengo que dejar la furgo en algún sitio?**
   No. La furgo se queda contigo durante la venta. Solo organizamos visitas cuando hay un comprador real interesado.

**[Joel debe revisar y ajustar las respuestas — algunas son asunciones de proceso]**

---

### Sección 9 — Equipo / sobre nosotros (mini)

**Propósito:** humanizar la marca. La gente compra a personas.

**Layout:** sección con foto grupal o 3 fotos individuales de los agentes + un párrafo corto. Si no hay foto disponible, omitir esta sección o usar ilustración.

**Copy:**

- Title: `Un equipo que entiende de campers`
- Body: _"Somos [N] personas apasionadas por el mundo camper. Hemos sido propietarios, hemos viajado, conocemos los pros y contras de cada modelo. Por eso podemos ayudarte a vender la tuya por su valor justo."_

**[ASUNCIÓN — confirmar si Joel quiere que esta sección aparezca o pase al footer]**

---

### Sección 10 — CTA final fuerte

**Propósito:** último empujón antes del footer.

**Layout:** sección con fondo deep teal completo, texto blanco, botón naranja grande centrado.

**Copy:**

- Title (grande, blanco): `¿Listo para vender tu camper?`
- Subtitle: `Empieza con una tasación gratuita. Te respondemos en 24h.`
- CTA: `Calcular precio de mi camper →`
- Microcopy: `O escríbenos a info@campersnova.com`

---

### Sección 11 — Footer

**Propósito:** legal + contacto + sitemap.

**Layout:** 4 columnas en desktop, stack en móvil.

- **Columna 1:** logo CampersNova + tagline + redes sociales
- **Columna 2:** "Producto" — Vender tu camper, Cómo funciona, Tasación, Stock
- **Columna 3:** "Empresa" — Sobre nosotros, Contacto, Blog (si aplica)
- **Columna 4:** "Legal" — Aviso legal, Privacidad, Cookies

**Bottom bar:** © 2026 CampersNova · CIF · Dirección · Tel · Email

---

### Sección 12 — Botón flotante de WhatsApp (sticky)

**Propósito:** canal de baja fricción para los que no quieren rellenar formularios.

**Layout:** botón circular verde WhatsApp en esquina inferior derecha. Visible siempre. Al click abre `wa.me/{teléfono CampersNova}?text=Hola, quiero información sobre vender mi camper`.

---

## 6. Mobile-first considerations

- Hero: foto debajo del CTA, no al lado
- Calculadora: campos apilados, slider de año más usable que select
- Comparativa: scroll horizontal con sticky-left de los atributos
- Galería de stock: scroll horizontal nativo con snap
- FAQ: chevron grande, área clickable amplia (44px mínimo)
- WhatsApp button: NO sobre el form para que no tape el botón submit

---

## 7. Accesibilidad (WCAG 2.1 AA mínimo)

- Contraste: todos los textos sobre fondos pasan AA
- Foco visible en todos los elementos interactivos (outline naranja)
- ARIA labels en iconos sin texto (botón WhatsApp, redes sociales, chevron FAQ)
- Alt text en todas las imágenes (especialmente las de stock — describir el modelo)
- Skip-to-content link al inicio para usuarios de teclado
- Tamaño de texto base 16px mínimo, jerarquía clara

---

## 8. SEO básico

- **Title tag:** `CampersNova · Vende tu camper o autocaravana sin perder valor`
- **Meta description:** `Tasación gratuita en 60 segundos. Te ayudamos a vender tu camper o autocaravana al precio justo. Solo 4% al cierre. Sin coste por adelantado.`
- **OpenGraph:** imagen del hero (1200x630), title, description
- **JSON-LD Organization** con info de la empresa
- **JSON-LD FAQPage** con las 6-8 preguntas (visible para Google)
- **Sitemap.xml** generado automáticamente
- **robots.txt** permitiendo todo en producción

---

## 9. Analytics — eventos a trackear

(PostHog ya configurado en CAM-44)

| Evento                      | Cuándo                                           |
| --------------------------- | ------------------------------------------------ |
| `landing_view`              | Al cargar `/`                                    |
| `hero_cta_click`            | Click en "Calcular precio de mi camper" del hero |
| `calculator_started`        | Click en cualquier campo de la calculadora       |
| `calculator_submitted`      | Submit con resultado mostrado                    |
| `calculator_to_form`        | Click en "Vender mi camper a este precio"        |
| `comparison_section_viewed` | Sección comparativa entra en viewport            |
| `gallery_card_click`        | Click en una furgo del carrusel                  |
| `faq_opened`                | Cada vez que se abre una pregunta                |
| `final_cta_click`           | Click en CTA final teal                          |
| `whatsapp_button_click`     | Click en botón flotante                          |

---

## 10. Material visual a producir antes de implementar

**Joel debe entregar a Claude Code:**

- [ ] **Logo CampersNova** en SVG/PNG transparente alta resolución
- [ ] **8-10 fotos lifestyle** (Unsplash filtros vanlife/campervan, descargar y guardar en `public/images/lifestyle/`)
- [ ] **Foto hero principal** (la más impactante de las 8-10)
- [ ] **Foto del equipo** (opcional pero impactante)
- [ ] **Stats reales** o aprobar las versiones genéricas propuestas en sección 2
- [ ] **Testimoniales** — texto + nombres + ciudades (3 mínimo) o decisión de omitir sección
- [ ] **Decisión sobre tipografía display:** Recoleta (premium, requiere licencia) o Fraunces (gratuita)
- [ ] **Validar copy** de todas las secciones — especialmente el FAQ

---

## 11. Brief para Claude Code

Cuando todo el material esté listo, le pasamos esto a Claude Code:

> Vamos a rehacer la landing comercial `/` (CAM-38) siguiendo `docs/Landing-Spec.md`. Antes de tocar código:
>
> 1. Carga las skills `design:design-critique`, `design:ux-copy` y `design:user-research`
> 2. Lee la spec completa
> 3. Audita la landing actual contra la spec y dime qué cambios prioritarios identificas
> 4. Propón un plan de implementación dividido en commits pequeños y atómicos
> 5. Espera mi aprobación antes de empezar
>
> Stack: mantén Next.js 14 + Tailwind + shadcn/ui. Añade `framer-motion` (justifícame por qué es la mejor opción frente a alternativas). Las fotos están en `public/images/`. Las tipografías display se cargan via `next/font/google` (Fraunces) o `next/font/local` (Recoleta si licencia).
>
> Tests: smoke tests de Playwright cubriendo el form de la calculadora y el CTA principal. Lighthouse score objetivo: Performance >85, Accessibility 100, Best Practices >90, SEO 100.
>
> Calendar: 1.5-2 días de trabajo. Sonnet 4.6 + Esfuerzo Alto.

---

## 12. Open questions a resolver antes de implementar

| #   | Pregunta                                                                                        | Quién                         |
| --- | ----------------------------------------------------------------------------------------------- | ----------------------------- |
| 1   | ¿Stats reales que tenéis? (ventas, tiempo medio, etc.)                                          | Joel                          |
| 2   | ¿Hay testimoniales reales disponibles para v1 o se omite la sección?                            | Joel                          |
| 3   | ¿Tienes presupuesto para licencia Recoleta o vamos con Fraunces gratuita?                       | Joel                          |
| 4   | ¿Foto del equipo o no aparece?                                                                  | Joel                          |
| 5   | ¿Tienes fotos propias de stock real o usamos solo Unsplash al inicio?                           | Joel                          |
| 6   | ¿Número de WhatsApp definitivo para el botón flotante?                                          | Joel                          |
| 7   | ¿Los servicios "fotos profesionales" y "gestión papeleo" están incluidos en el 4% o son extras? | Joel — afecta al copy del FAQ |
| 8   | ¿Tiempo medio real de venta para usar en stat?                                                  | Joel                          |

---

**Fin del Landing Spec.**

Próximo paso: Joel responde las open questions, aporta material visual, y se lo pasa a Claude Code junto con esta spec para implementar.
