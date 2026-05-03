# Diseño Claude Design — Landing & páginas públicas Campernova

**Este es el diseño de referencia generado por Joel en Claude Design. Es la fuente de verdad visual para portar a Next.js.**

Estos archivos NO se ejecutan en producción — son **referencia para Claude Code** durante la implementación. El código JSX usa React UMD + Babel standalone (válido para preview, no para producción).

---

## Archivos

| Archivo | Qué contiene |
|---|---|
| `Campers-Nova.html` | Wrapper HTML con setup React UMD + tipografías Google Fonts + montaje de la app |
| `styles.css` | **Sistema de diseño completo** — variables CSS de paleta, tipografía, spacing, shadows + estilos por componente. ~52KB |
| `data.jsx` | Vehículos dummy + atomos UI (`Icon`, `SmartImg`, `VCard`, helpers `eur`, `km`) |
| `page-home.jsx` | Página `/` completa con 9+ secciones |
| `page-others.jsx` | Páginas `/comprar`, `/vender`, `/comprar/[id]` (Detalle), `/como-funciona`, `/sobre` |
| `tweaks-panel.jsx` | Panel de tweaks de Claude Design — **NO portar**, era solo para preview interactivo |

---

## Sistema visual (extraer de `styles.css`)

### Paleta
```
--teal-900:  #1a3a37   /* Principal oscuro */
--teal-700:  #264d49   /* Principal */
--teal-500:  #3a6b66   /* Principal medio */
--teal-300:  #7ea29d   /* Principal claro */

--cream-50:  #faf6ed   /* Fondo claro */
--cream-100: #f5f0e6   /* Fondo principal */
--cream-200: #ece4d2   /* Fondo medio */

--sand-300:  #d9c9a8
--sand-500:  #b89c6e
--wood-700:  #8a6a3f

--terra-500: #c26a4a   /* Acento principal (CTAs) */
--terra-600: #a85636   /* Acento hover */

--ink-900:   #1f211f   /* Texto principal */
--ink-700:   #3a3a38
--ink-500:   #6b6b67
--ink-300:   #b3b1aa
--line:      #e6dfd0
```

### Tipografías (Google Fonts)
- **Fraunces** (variable serif) → títulos H1-H4, clase `.serif`
- **Inter** (sans) → cuerpo, navegación, labels
- **JetBrains Mono** (mono) → eyebrows, números, datos técnicos

### Radius / Shadow
```
--r-sm: 8px    --r-md: 14px   --r-lg: 20px   --r-xl: 28px
--sh-sm, --sh-md, --sh-lg
```

---

## Páginas a portar

### 1. Home (`/`) — `page-home.jsx`
Secciones en orden:
1. **Hero** con foto rotativa (3 opciones — `hero-vw-bus.jpg`, `hero-sunset-couple.png`, `hero-sunset-window.png`) — usar `hero-sunset-window.png` por defecto
2. **Trust strip** — 4 ventajas (vehículos revisados, asesoramiento experto, gestión profesional, proceso transparente)
3. **Two routes** — Comprar vs Vender, dos cards grandes con foto
4. **Search method** — explica el chat conversacional (3 pasos)
5. **Sell block** — con stats reales `42 días · 98% operaciones cerradas` + benefit list
6. **Nova Assistant** — sección con mockup de chat + QR + features (DEJAR como está, mockup estático)
7. **How it works** con tabs Comprar/Vender (4 pasos cada uno)
8. **Why us pillars** — 6 pilares
9. **Inspiration** — sección lifestyle con foto fondo
10. **Podcast** — bloque "próximamente" con CTA Instagram
11. **Testimonials** — 3 testimoniales reales (Marta & Carlos, Lucía, Iñaki)
12. **Final CTA**
13. **Footer**

### 2. Comprar (`/comprar`) — `page-others.jsx → ComprarPage`
Listado de vehículos con filtros + comparativa "vs alternativas"

### 3. Vender (`/vender`) — `page-others.jsx → VenderPage`
**OJO**: ya existe `/vender` en el repo (CAM-16, CAM-17, CAM-41). NO sobrescribir el wizard funcional. Esta página del diseño es una landing previa al wizard. Hay que reconciliar:
- Opción A: usar el diseño nuevo como `/vender` (landing) y mover el wizard funcional a `/vender/empezar`
- Opción B: solo usar el copy y estructura visual del diseño, dejando el wizard funcional en `/vender`

### 4. Detalle vehículo (`/comprar/[id]`) — `page-others.jsx → DetallePage`
Ficha de vehículo (galería, specs, CTA)

### 5. Cómo funciona (`/como-funciona`) — `page-others.jsx → ComoFuncionaPage`
Explicación paso a paso del proceso

### 6. Sobre nosotros (`/sobre`) — `page-others.jsx → SobrePage`

---

## Componentes globales (extraer)

- `Header` — logo + navegación + 2 CTAs
- `Footer` — multicolumna
- `WhatsAppFab` — botón flotante WhatsApp
- `VCard` — card de vehículo (reutilizable)
- `Icon` — usar **`lucide-react`** del proyecto, no el componente custom

---

## Decisiones de port confirmadas con Joel

| Decisión | Valor |
|---|---|
| **Scope** | C — todas las páginas (Home + Comprar + Vender + Detalle + Como funciona + Sobre) |
| **Nova Assistant en home** | Mantener como está en el diseño, mockup estático con chat + QR |
| **Stats `42 días · 98% · 36 reseñas Google`** | **Reales**, usar tal cual |
| **Vehículos** | Datos vienen de Prisma cuando hay stock; fallback a `lib/dummy/vehicles.ts` con los 5 del diseño |
| **Tipografía display** | Fraunces (gratuita Google Fonts) — ya en el HTML del diseño |

---

## Imágenes ya copiadas a `public/images/`

```
public/images/
├── brand/
│   └── logo-campersnova.png
└── landing/
    ├── hero-sunset-couple.png       (2.1 MB — optimizar a webp)
    ├── hero-sunset-window.png       (2.0 MB — optimizar a webp)
    ├── hero-vw-bus.jpg              (3.6 MB — optimizar fuerte a webp ~400KB)
    ├── sell-driver.jpg              (89 KB — OK)
    ├── instalaciones.jpg            (92 KB — OK)
    └── podcast-studio.jpg           (110 KB — OK)
```

> **Importante:** las 3 fotos del hero pesan demasiado. En el port, convertirlas a `.webp` con `next/image` — que Next.js lo hace automáticamente al usar el componente `<Image>`.

---

## Lo que NO se porta

- `tweaks-panel.jsx` (era preview interactivo)
- React UMD + Babel standalone (sustituir por Next.js compilado)
- `SmartImg` custom (usar `next/image`)
- `Icon` custom (usar `lucide-react`)
- Routing custom con `setPage` (usar Next.js App Router)
