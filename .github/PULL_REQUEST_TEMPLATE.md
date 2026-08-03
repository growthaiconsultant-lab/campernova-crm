<!--
SDD: docs/governance/sdd-workflow.md
Plantilla de cambio: docs/templates/change-brief.md
Testing: docs/governance/testing-strategy.md
Marca N/A con una frase; no inventes evidencia ni marques validación no ejecutada.
-->

## Objetivo

<!-- Problema real y resultado observable. -->

- Ticket / change ID:
- Spec o change brief:
- Ruta SDD: rápida / estándar / reforzada
- Categorías C0–C9:
- Riesgo: bajo / medio / alto / crítico

## Comportamiento

**Antes:**

**Después:**

**Fuera de alcance:**

## Solución

<!-- Cambio mínimo y decisiones relevantes. -->

## Impacto condicionado

Rellenar sólo lo que aplica:

- Datos o migraciones:
- Permisos, PII o seguridad:
- Concurrencia o idempotencia:
- Integraciones o efectos externos:
- KPIs, Sentry, PostHog o logs:
- Compatibilidad y consumidores:

## Criterios de aceptación

- [ ] Criterio enlazado a test, comando, consulta o validación.
- [ ] Caso límite/negativo relevante.
- [ ] Conducta legítima anterior preservada.

## Verificación ejecutada

<!-- Escribe comando/check + resultado. Un paso omitido no cuenta como verde. -->

| Check                  | Resultado | Evidencia/nota |
| ---------------------- | --------- | -------------- |
| Typecheck              | N/A       |                |
| Lint                   | N/A       |                |
| Unit                   | N/A       |                |
| Integration PostgreSQL | N/A       |                |
| Migration replay       | N/A       |                |
| Supabase local         | N/A       |                |
| Build                  | N/A       |                |
| E2E                    | N/A       |                |
| Revisión manual/diff   | Pendiente |                |

## Rollout y recuperación

- Entornos/configuración necesaria:
- Rollout:
- Rollback o mitigación:
- Stop conditions:
- Validación post-despliegue:

## Checklist final

- [ ] El diff está acotado al objetivo.
- [ ] No contiene secretos, PII ni artefactos accidentales.
- [ ] Se revisaron autorización y límites server/client cuando aplican.
- [ ] Se revisaron carreras y reintentos cuando aplican.
- [ ] Las migraciones son nuevas, reproducibles y compatibles cuando aplican.
- [ ] Ticket, spec, código y documentación no se contradicen.
- [ ] No se declara implementado, desplegado o validado sin evidencia del estado correspondiente.
