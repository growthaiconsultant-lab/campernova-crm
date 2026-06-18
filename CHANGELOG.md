# Changelog

Todos los cambios notables de este proyecto se documentan aquí.
Formato basado en [Keep a Changelog](https://keepachangelog.com/es/1.1.0/);
el versionado seguirá [SemVer](https://semver.org/lang/es/) a partir del primer release.

Los mensajes de commit siguen [Conventional Commits](https://www.conventionalcommits.org/),
por lo que este changelog puede regenerarse/ampliarse desde el historial.

## [Unreleased]

### Added

- **Calendario de capacidad del taller**: planificación de órdenes con fecha de entrega sugerida según el backlog del mecánico, agenda semanal, horas previstas vs reales y "Crear orden de taller" desde la ficha del vehículo. Migración additiva `WorkOrder.scheduledStart/scheduledEnd` + índice (`20260617000000_add_workorder_scheduling`).
- **Rediseño UX de fichas (vehículo-céntrico)**: fichas de vendedor y comprador unificadas — hero centrado en el vehículo/necesidad, rail derecho persistente con la próxima acción, `StatusPill` compartido (fuente única de estados), `LeadTabNav` accesible (ARIA + teclado). Ficha de comprador tokenizada a la marca.
- **Vistas "Stock" y "Leads web"** en el listado de vendedores (separar inventario real de leads web sin cualificar) + cruce vehículo↔comprador en ambas fichas.
- **Entorno de staging** (2º proyecto Supabase `campernova-crm-staging`) para validar features y migraciones antes de producción.
- Flujo de trabajo profesional: CI (`quality`: typecheck + lint + test) en GitHub Actions, protección de rama `main`, Conventional Commits (commitlint + hook `commit-msg`), hook `pre-push`, `CONTRIBUTING.md` y plantilla de PR.
- Documentación de entrada: `README.md`, `ARCHITECTURE.md`, `CHANGELOG.md` y Architecture Decision Records (`docs/adr/`).
- Pestaña "Conversación" en la ficha de comprador + filtro de origen en el listado (CAM-55).

### Changed

- `.gitignore`: ignora `.codex/` (tokens MCP), `.claude/worktrees/`, documentos legales y artefactos de e2e.
- `package.json`: pin de `packageManager` (pnpm@10.33.2) y `engines.node >= 20`.

### Removed

- Componente huérfano `app/(backoffice)/vendedores/seller-leads-table.tsx` (sustituido por la tabla inline en Block 8 v2).
- Gitlink erróneo del worktree (`mode 160000`).

---

> Historial previo (Sprints 1–5, Blocks 2–8, Taller, módulos de anuncios y portal comprador) documentado en `CLAUDE.md` § "Estado actual".
