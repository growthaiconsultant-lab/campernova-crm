# ADR 0005 — Trunk-based + entorno de staging + CI como gate

**Estado**: Aceptado

## Contexto

El proyecto commiteaba directo a `main` sin CI ni entorno de pruebas; un solo proyecto Supabase (prod). Falta de garantías para gestionar el proyecto con confianza profesional.

## Decisión

- **Trunk-based**: `main` siempre desplegable; cambios vía ramas cortas + PRs con squash-merge.
- **CI** (`quality`: typecheck + lint + test) como **gate obligatorio** de `main` (branch protection). E2E autenticado en workflow aparte (manual/nightly, no bloqueante).
- **Entornos**: 2º proyecto Supabase gratuito como **staging**. Vercel Preview (PRs) → staging; Production (`main`) → prod. Las migraciones se prueban en staging antes de prod.
- **Conventional Commits** enforced (commitlint) → historial limpio + base para el CHANGELOG.

## Consecuencias

- Nada roto llega a `main`: el gate exige tipos/lint/tests en verde.
- Migraciones y cambios se validan en un Preview contra staging sin tocar producción.
- E2E necesita secretos + DB viva → fuera del gate rápido para no acoplar el merge a infraestructura.
- Coste 0 (staging en free tier). Alternativa de pago (Supabase Branching) queda para un futuro ADR si se necesita aislamiento por-PR.
