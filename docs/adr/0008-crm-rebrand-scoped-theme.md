# ADR 0008 — Rebrand del CRM vía tema `.crm-theme` scopeado (no rebuild)

**Estado**: Aceptado (F1 fundación en curso; reskin por módulo en fases siguientes)

## Contexto

Handoff de Claude Design con una **nueva identidad para el backoffice/CRM**: verde `#0e7d6b` + carbón `#12151c` + fondo `#f4f6f8`, tipografías **Hanken Grotesk** (UI) + **JetBrains Mono** (datos). Sustituye la identidad crema/negro/tan + Inter/Fraunces. Decisiones del dueño: **solo el CRM** (la web pública mantiene su look) y **entrega por fases**.

## Decisión

- **Reskin, no rebuild**: rutas, entidades, enums, flujos y cálculos no cambian. Solo capa visual.
- **Tema scopeado con `.crm-theme`**: un bloque en `app/globals.css` sobreescribe los tokens semánticos de shadcn (`--background`, `--primary`, `--sidebar-*`, `--radius`, …) a los valores del handoff y fija Hanken como fuente base. Se aplica en el `<div>` raíz de `app/(backoffice)/layout.tsx`. Todo lo que usa tokens semánticos (shell, `components/ui/*`, los 7 dashboards de analytics, y los módulos taller/entregas/postventa/calendario/vehículos/matches) se rebrandea **de golpe**; la web pública (bajo el mismo `app/layout.tsx` raíz pero sin la clase) **no se toca**.
- **`--font-inter` remapeado a Hanken dentro del scope** para que las utilidades `font-sans` (que apuntan a `--font-inter`) también cambien sin tocar la web pública.
- **Semáforo unificado** en los mapas de color transversales (`lib/kpi/thresholds.ts`, `lib/captacion.ts`) a los hex del handoff: verde `#1a9d5f`, ámbar `#c9820a`, rojo `#d64545`, azul `#3a6fd4`, gris `#8b94a3`.
- **Hex hardcodeado** (dashboard, compradores, vendedores, captaciones, ofertas, usuarios) se migra a tokens **módulo a módulo** en fases F2+ (un PR por módulo). Fraunces→Hanken en las cabeceras de ficha se hace en esas fases.

## Consecuencias

- La frontera pública/privada es limpia: la clase `.crm-theme` es el único interruptor. Sin `next-themes` ni `.dark` activo.
- El **header desktop global nuevo** del prototipo (buscador/⌘K, "Nuevo lead", campana) se **difiere**: hoy cada página del backoffice renderiza su propia cabecera `sticky top-0`; añadir una barra global chocaría con esos offsets → se aborda cuando se ajuste el layout por módulo, no en la fundación.
- Sin migración de BD en ninguna fase. Verificación: backoffice verde/carbón + Hanken; web pública intacta (cream/Inter/Fraunces).
