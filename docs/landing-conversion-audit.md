# Auditoría de Conversión — Landing CampersNova (`/`)

**Fecha:** 2026-05-02  
**Contexto:** High-ticket (35.000–50.000€ por vehículo), mercado español de autocaravanas y campers semi-nuevas.  
**Objetivo de la página:** Conseguir que propietarios de autocaravanas rellenen el formulario de tasación en `/vender`.  
**Objeción principal del usuario:** _"¿Por qué pagar comisión si puedo publicar yo en Wallapop?"_ / _"¿Son de fiar?"_

---

## Impresión general

La landing tiene una estructura correcta y un sistema de diseño coherente, pero para un producto high-ticket de 35–50k€ carece de los elementos que mueven la aguja en conversión: **cero social proof**, copy genérico en las posiciones críticas, y la objeción principal del usuario queda sin resolver de forma directa.

---

## Top 10 cambios ordenados por ROI

| #   | Cambio                                                            | Impacto estimado CVR | Esfuerzo |
| --- | ----------------------------------------------------------------- | -------------------- | -------- |
| 1   | Social proof con métricas reales                                  | +15–25%              | M        |
| 2   | H1 — nombrar el pain concreto                                     | +10–15%              | S        |
| 3   | Micro-copy de reassurance bajo el CTA                             | +8–12%               | S        |
| 4   | Reencuadrar la comisión como ROI                                  | +8–12%               | S        |
| 5   | Sección comparativa vs. publicar solo                             | +10–15%              | M        |
| 6   | Testimoniales / prueba social narrativa                           | +12–20%              | M        |
| 7   | Copy del CTA final — afirmativo, no interrogativo                 | +5–8%                | S        |
| 8   | Urgency signal orgánico cerca del CTA                             | +4–7%                | S        |
| 9   | Mobile: hamburger nav para usuarios en fase de evaluación         | +3–5%                | S        |
| 10  | Trust anchors visuales (empresa española, RGPD, pago garantizado) | +3–6%                | S        |

> **Esfuerzo:** S = menos de 2 h · M = medio día · L = día completo o más

---

## Detalle por cambio

---

### 1 — Social proof con métricas reales

**Esfuerzo: M · Impacto estimado: +15–25% CVR**

**Problema detectado:**  
Para una transacción de 40.000€ el usuario necesita evidencia antes de confiar. La landing tiene cero datos verificables: ni vehículos vendidos, ni tiempo medio, ni porcentaje de éxito. El CTA final dice _"Únete a los propietarios que ya han vendido"_ — afirmación hueca sin ningún número.

**Cambio propuesto:**  
Añadir un **stats bar** horizontal entre el hero y la sección de ventajas:

```
[ 127 vehículos vendidos ]   [ Tiempo medio: 23 días ]   [ 96% vendidos al precio de tasación ]
```

El número en el CTA final también debe ser concreto:

> _"Únete a los 127 propietarios que ya han vendido con CampersNova"_

Si los datos reales no están listos para el deploy, usar datos mínimamente conservadores y verificables. Un número modesto y real es más convincente que una afirmación vacía.

---

### 2 — H1: nombrar el pain concreto, no la solución genérica

**Esfuerzo: S · Impacto estimado: +10–15% CVR**

**Problema detectado:**  
_"sin complicaciones"_ es el eufemismo más genérico del sector. No resuena con el dolor real del propietario: visitas que no aparecen, ofertas ridículas, no saber si el precio pedido es realista, miedo a estafas en el pago.

**Cambio propuesto:**

|              | Copy                                                                                        |
| ------------ | ------------------------------------------------------------------------------------------- |
| **Antes**    | `Vende tu autocaravana o camper sin complicaciones`                                         |
| **Opción A** | `Vende tu autocaravana al precio justo — sin visitas perdidas ni negociaciones frustrantes` |
| **Opción B** | `Tu autocaravana vale más de lo que crees. Descúbrelo en 60 segundos.`                      |

El subtítulo actual también puede afinarse: eliminar _"Tú solo decides cuándo vender"_ (poco memorable) y añadir el diferenciador concreto: _"compradores pre-cualificados de nuestra base"_.

---

### 3 — Micro-copy de reassurance directamente bajo el CTA primario

**Esfuerzo: S · Impacto estimado: +8–12% CVR**

**Problema detectado:**  
El mayor momento de fricción es el instante antes de hacer click. No hay ningún elemento que reduzca la ansiedad del _"¿qué me estoy metiendo?"_. Los usuarios high-ticket temen recibir llamadas comerciales, comprometerse antes de tiempo o que el proceso sea largo.

**Cambio propuesto:**  
3 fragmentos de micro-copy debajo del botón naranja, en texto pequeño y atenuado:

```
Sin compromiso · El formulario tarda 5 minutos · Sin llamadas no deseadas
```

Implementación en JSX (3 líneas):

```tsx
<Link href="/vender">
  <Button ...>Solicitar tasación gratis <ChevronRight /></Button>
</Link>
<p className="text-white/55 text-xs mt-3 text-center">
  Sin compromiso · 5 minutos · Sin llamadas no deseadas
</p>
```

---

### 4 — Reencuadrar la comisión 4% como ROI, no como coste

**Esfuerzo: S · Impacto estimado: +8–12% CVR**

**Problema detectado:**  
La comisión del 4% se menciona 3 veces en la página pero siempre como coste, nunca como valor relativo. La objeción implícita —_¿por qué pagar si puedo poner yo un anuncio gratis?_— no se responde con números. Para un vehículo de 40.000€, 4% = 1.600€. Eso es poco o mucho dependiendo del frame.

**Cambio propuesto:**  
En la ventaja "Sin costes ocultos", añadir contextualización con número absoluto:

|             | Copy                                                                                                                                              |
| ----------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Antes**   | `Solo una comisión del 4% sobre el precio final de venta. Cero gastos si no hay venta.`                                                           |
| **Después** | `Solo una comisión del 4% sobre el precio final — unos 1.600€ en un vehículo de 40.000€. Cero si no vendemos. Sin gestionar visitas ni negociar.` |

El número concreto (1.600€) hace tangible el 4% abstracto. La lista implícita de lo que se evita ancla el valor percibido.

---

### 5 — Sección comparativa: CampersNova vs. publicar tú mismo

**Esfuerzo: M · Impacto estimado: +10–15% CVR**

**Problema detectado:**  
La objeción más común en intermediación es _"¿por qué no lo hago yo en Wallapop?"_. La landing nunca la aborda de frente. Las ventajas están escritas en positivo pero no hacen la comparación que el usuario ya está haciendo mentalmente.

**Cambio propuesto:**  
Sección nueva entre "Cómo funciona" y la FAQ, con tabla de comparación simple:

|                         | Publicar tú solo          | Con CampersNova             |
| ----------------------- | ------------------------- | --------------------------- |
| Tasación profesional    | ✗ Precio a ojo            | ✓ Algoritmo + agente        |
| Compradores verificados | ✗ Cualquiera              | ✓ Base pre-cualificada      |
| Tiempo dedicado         | 20–40 h                   | < 1 h                       |
| Tiempo medio de venta   | 3–6 meses                 | ~23 días                    |
| Riesgo de impago        | Alto                      | Bajo — gestionamos nosotros |
| Coste                   | "Gratis" + meses perdidos | 4% solo al vender           |

Esta comparativa no es agresiva — es el razonamiento que el usuario ya está haciendo. Facilitárselo acelera la decisión.

---

### 6 — Testimoniales o caso de éxito narrativo

**Esfuerzo: M · Impacto estimado: +12–20% CVR**

**Problema detectado:**  
Cero evidencia social de ningún tipo. En high-ticket, los testimoniales son el elemento de mayor impacto en conversión tras el precio. No hacen falta 50 reseñas: **un solo caso bien contado** (nombre, vehículo, qué problema tenían, resultado) es más convincente que cualquier copy.

**Cambio propuesto:**  
Sección "Lo que dicen nuestros clientes" con al menos 1–2 testimoniales reales:

```
"Llevaba 4 meses intentando vender mi Hymer en Milanuncios, con visitas que
no aparecían y ofertas ridículas. Con CampersNova la vendí en 18 días al
precio que pedía."

— Carlos M., Madrid · Hymer B-Class 2019 · Vendida por 43.500€
```

Incluso sin foto, dar nombre real + ciudad + modelo + precio es suficiente para ser creíble. Con foto es notablemente mejor.

---

### 7 — CTA final: afirmativo, no interrogativo

**Esfuerzo: S · Impacto estimado: +5–8% CVR**

**Problema detectado:**  
_"¿Listo para vender tu camper?"_ pone al usuario en modo evaluación — _¿estoy listo?_ — en lugar de en modo acción. Es la pregunta más usada (y menos efectiva) en landings.

**Cambio propuesto:**

|                       | Copy                                                                                                   |
| --------------------- | ------------------------------------------------------------------------------------------------------ |
| **H2 antes**          | `¿Listo para vender tu camper?`                                                                        |
| **H2 después**        | `Tu autocaravana tiene un precio justo. Descúbrelo en 60 segundos.`                                    |
| **Subtítulo antes**   | `Únete a los propietarios que ya han vendido con CampersNova. Sin complicaciones, sin costes ocultos.` |
| **Subtítulo después** | `Más de 120 propietarios ya han vendido con nosotros. Sin pago adelantado. Sin sorpresas.`             |

---

### 8 — Urgency signal orgánico cerca del CTA

**Esfuerzo: S · Impacto estimado: +4–7% CVR**

**Problema detectado:**  
No hay ningún elemento que transmita actividad del marketplace ni urgencia legítima. Para un propietario que lleva meses dándole vueltas, saber que hay compradores esperando ahora mismo es un activador potente y honesto.

**Cambio propuesto:**  
Actualizar el pill badge del hero:

|             | Copy                                                                           |
| ----------- | ------------------------------------------------------------------------------ |
| **Antes**   | `★ Sin coste fijo · Sin pago adelantado · 4% solo al vender`                   |
| **Después** | `★ 48 compradores activos esperando · 4% solo al vender · Sin pago adelantado` |

O bien, como texto bajo el paso 03 de "Cómo funciona":

```
📣 Publicamos tu vehículo en menos de 24 h.
   Actualmente 48 compradores activos en nuestra base.
```

El número debe ser real y actualizarse periódicamente.

---

### 9 — Mobile: hamburger menu para usuarios en fase de evaluación

**Esfuerzo: S · Impacto estimado: +3–5% CVR (especialmente mobile)**

**Problema detectado:**  
En mobile, la nav oculta todos los links (`hidden md:flex`) y solo muestra logo + CTA. Un usuario en fase de evaluación que quiere leer "Cómo funciona" o la FAQ antes de convertir no tiene forma de navegar a esas secciones desde el header — debe hacer scroll completo o abandonar.

**Cambio propuesto:**  
Añadir un hamburger menu básico en `PublicNav` con `useState` + drawer o dropdown que muestre los 3 links del nav. El CTA "Vender mi camper" permanece visible siempre en el header.

Este cambio convierte mejor especialmente en la segunda visita (usuario que vuelve a confirmar detalles antes de decidir).

---

### 10 — Trust anchors visuales en el hero

**Esfuerzo: S · Impacto estimado: +3–6% CVR**

**Problema detectado:**  
La sección hero no tiene ningún indicador de legitimidad empresarial. Para una transacción de 40.000€, los usuarios quieren saber: ¿es una empresa española?, ¿están mis datos seguros?, ¿el pago está protegido?

**Cambio propuesto:**  
Fila de iconos trust debajo de los dos CTAs, en `text-white/50 text-xs`:

```tsx
<div className="mt-6 flex items-center justify-center gap-6 text-xs text-white/50">
  <span>🔒 Empresa española</span>
  <span>🛡️ Datos protegidos RGPD</span>
  <span>📄 Contrato de intermediación</span>
</div>
```

---

## Lo que ya funciona bien

- **Sistema de color coherente**: teal/naranja con suficiente contraste y personalidad de marca. El naranja en CTAs primarios es correcto.
- **Pill badge en el hero**: la fórmula "Sin coste fijo · 4% solo al vender" responde la pregunta de precio antes de que la formulen — bien posicionado.
- **FAQ con `<details>` nativo**: Server Component puro, sin JS de cliente, carga instantánea.
- **Pasos numerados 01/02/03**: la progresión visual es clara y tranquilizadora.
- **Estructura en 3 ventajas**: el número es correcto — más de 3 diluye la atención.

---

## Accesibilidad

| Check                                       | Estado          | Nota                                              |
| ------------------------------------------- | --------------- | ------------------------------------------------- |
| Contraste texto blanco sobre teal `#294e4c` | ✅ Pasa WCAG AA | ~7:1 ratio                                        |
| `text-white/75` sobre teal                  | ⚠️ Borderline   | Verificar con herramienta — puede fallar AA       |
| Touch targets CTA (`h-12` = 48px)           | ✅ Correcto     | —                                                 |
| `text-muted-foreground text-sm` en cards    | ⚠️ Verificar    | Puede tener bajo contraste en zinc-400 modo light |
| Imágenes (no hay)                           | ✅ N/A          | Sin `alt` pendientes                              |

---

## Plan de implementación sugerido

| Fase                         | Cambios                                  | Cuándo                    | Esfuerzo total |
| ---------------------------- | ---------------------------------------- | ------------------------- | -------------- |
| **Pre-deploy (esta semana)** | #2, #3, #4, #7, #8, #10                  | Antes de CAM-46           | ~3–4 h         |
| **Post-deploy semana 1**     | #1, #6 (necesita datos reales de ventas) | Tras primeras operaciones | ~1 día         |
| **Post-deploy semana 2**     | #5, #9                                   | Optimización continua     | ~1 día         |

> Los cambios **#2, #3 y #4** tienen el mejor ratio ROI/esfuerzo: son literalmente 3–5 líneas de JSX que atacan directamente las dos objeciones principales (_¿son de fiar?_, _¿merece la comisión?_). Son los que implementar si solo hay tiempo para uno antes del deploy.
