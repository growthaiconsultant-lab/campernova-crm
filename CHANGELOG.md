# Changelog

Todos los cambios notables de este proyecto se documentan aquí.
Formato basado en [Keep a Changelog](https://keepachangelog.com/es/1.1.0/);
el versionado seguirá [SemVer](https://semver.org/lang/es/) a partir del primer release.

Los mensajes de commit siguen [Conventional Commits](https://www.conventionalcommits.org/),
por lo que este changelog puede regenerarse/ampliarse desde el historial.

## [Unreleased]

### Added

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
