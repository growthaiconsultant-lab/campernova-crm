# Guía de contribución — Campernova CRM

Flujo de trabajo profesional **trunk-based**: `main` siempre desplegable, cambios vía ramas cortas y Pull Requests con CI en verde.

## Flujo de un cambio

```
1. git checkout main && git pull
2. git checkout -b <tipo>/<descripcion-corta>      # rama corta
3. … desarrollas, commits atómicos (Conventional Commits) …
4. git push -u origin <rama>
5. Abres PR → CI ejecuta typecheck + lint + test
6. Vercel genera un Preview; sólo usa staging si sus variables están configuradas y verificadas
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

- Sigue el routing de `docs/governance/sdd-workflow.md` y enlaza ticket/change brief cuando aplique.
- Rellena la plantilla de PR con evidencia ejecutada; un check omitido no cuenta como verde.
- CI (`quality`) debe quedar en **verde** antes de poder mergear (regla de protección de `main`).
- Revisa el Preview de Vercel. No asumir que apunta a staging: comprobar variables y proyecto de
  Supabase antes de ejecutar pruebas con datos o migraciones.
- **Squash-merge** a `main`. Borra la rama.

## Migraciones de base de datos

Las migraciones de Prisma se reproducen primero en PostgreSQL efímero y Supabase local mediante CI.
Staging sólo puede utilizarse después de verificar que existe, está aislado y las variables Preview
no apuntan a producción. Sigue `docs/governance/database-migrations.md`.

## Entornos

| Entorno     | Rama / contexto | Base de datos                                                 |
| ----------- | --------------- | ------------------------------------------------------------- |
| Development | local           | Supabase staging o local                                      |
| Preview     | cualquier PR    | Staging sólo si está configurado y verificado; nunca asumirlo |
| Production  | `main`          | Supabase **prod**                                             |

Ver `README.md` § Entornos para la matriz de variables de entorno.
