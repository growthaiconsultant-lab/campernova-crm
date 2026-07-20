# Architecture Decision Records (ADR)

Registro de las decisiones estructurales del proyecto: el **porqué**, no solo el qué. Cada ADR es inmutable una vez aceptado; si una decisión cambia, se crea un ADR nuevo que **supersedes** al anterior.

Formato corto: Contexto · Decisión · Consecuencias · Estado.

| #    | Título                                                | Estado   |
| ---- | ----------------------------------------------------- | -------- |
| 0001 | Prisma 6 (no 7)                                       | Aceptado |
| 0002 | Matching in-process (no edge function ni cron)        | Aceptado |
| 0003 | Autenticación por magic link (sin contraseñas)        | Aceptado |
| 0004 | Lógica de negocio pura en `lib/` con deps inyectables | Aceptado |
| 0005 | Trunk-based + entorno de staging + CI como gate       | Aceptado |
| 0006 | Taxonomía RV en el matching (distribución, camas…)    | Aceptado |
| 0009 | Coordinación de locks de filas raíz (infra inerte)    | Aceptado |

Para crear uno nuevo: copia un ADR existente, incrementa el número y rellena las secciones.
