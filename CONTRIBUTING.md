# Guía de contribución — Campernova CRM

Flujo de trabajo profesional **trunk-based**: `main` siempre desplegable, cambios vía ramas cortas y Pull Requests con CI en verde.

## Flujo de un cambio

```
1. git checkout main && git pull
2. git checkout -b <tipo>/<descripcion-corta>      # rama corta
3. … desarrollas, commits atómicos (Conventional Commits) …
4. git push -u origin <rama>
5. Abres PR → CI ejecuta typecheck + lint + test
6. Vercel genera un Preview (apuntando a la DB de staging)
7. CI en verde → squash-merge a main → deploy automático a producción
```

## Ramas

Nombre: `<tipo>/<descripcion-kebab>`. Tipos: `feat/`, `fix/`, `chore/`, `docs/`, `refactor/`, `test/`, `ci/`.
Ejemplos: `feat/filtro-origen-compradores`, `fix/tasacion-redondeo`, `chore/project-hardening`.

Ramas cortas y enfocadas — un PR = un cambio coherente. Borra la rama tras el merge.

## Commits — Conventional Commits (obligatorio)

Validado automáticamente por el hook `commit-msg` (commitlint). Formato:

```
<tipo>(<ámbito opcional>): <descripción en imperativo>

<cuerpo opcional explicando el porqué>

Co-Authored-By: ...
```

Tipos: `feat`, `fix`, `docs`, `style`, `refactor`, `perf`, `test`, `build`, `ci`, `chore`, `revert`.
El subject y el cuerpo pueden ir en **español**; el prefijo de tipo es obligatorio.

Ejemplos válidos:

- `feat(compradores): añade pestaña de conversación del chat`
- `fix(tasacion): corrige el factor de año en el fallback de referencia`
- `chore: actualiza dependencias de testing`

## Antes de pushear (automático)

- **pre-commit** (husky + lint-staged): `eslint --fix` + `prettier --write` sobre los ficheros staged.
- **commit-msg** (husky + commitlint): valida el formato del mensaje.
- **pre-push** (husky): `pnpm typecheck && pnpm test` — no se pushea código que rompa tipos o tests.

Comandos útiles:

```bash
pnpm typecheck     # tsc --noEmit
pnpm lint          # next lint
pnpm test          # vitest (unitarios)
pnpm test:e2e      # playwright (e2e)
pnpm format        # prettier --write .
```

## Pull Requests

- Rellena la plantilla de PR (qué cambia, cómo se prueba, ticket CAM, validación manual).
- CI (`quality`) debe quedar en **verde** antes de poder mergear (regla de protección de `main`).
- Revisa el Preview de Vercel del PR (apunta a staging — seguro para probar migraciones).
- **Squash-merge** a `main`. Borra la rama.

## Migraciones de base de datos

Las migraciones de Prisma se prueban primero en **staging** (vía el Preview del PR) antes de llegar a producción al mergear. Sigue el workflow de migraciones documentado en `CLAUDE.md` (sección "Workflow de migraciones Prisma + Supabase").

## Entornos

| Entorno     | Rama / contexto | Base de datos            |
| ----------- | --------------- | ------------------------ |
| Development | local           | Supabase staging o local |
| Preview     | cualquier PR    | Supabase **staging**     |
| Production  | `main`          | Supabase **prod**        |

Ver `README.md` § Entornos para la matriz de variables de entorno.
