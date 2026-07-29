# Reparto de trabajo Claude ↔ Codex

| Campo                | Valor                                                                                               |
| -------------------- | --------------------------------------------------------------------------------------------------- |
| **Estado**           | GUÍA (no normativa; complementa el proceso de cambios)                                              |
| **Última revisión**  | 2026-07-29                                                                                          |
| **Alcance**          | Cómo dividir un cambio entre Claude (cerebro/revisor) y Codex (constructor) sin romper el gobierno. |
| **Fuera de alcance** | Instalación del plugin; flujo git; contenido de `engineering-change-process.md`.                    |

> Regla de oro: **el reparto de herramientas no cambia el gobierno.** Los criterios de bloqueo (§14 del
> proceso) y la validación mínima por categoría (C0–C9) siguen aplicando exactamente igual, sin importar
> qué agente escribió cada línea. Codex es un ejecutor; **la responsabilidad del cambio es tuya y la
> revisión final la conduce Claude.**
>
> Claude es responsable de la **integridad global del plan**. Delegar a Codex partes mecánicas no
> delega la responsabilidad arquitectónica: Claude debe revisar la integración entre todas las partes
> delegadas y comprobar el cumplimiento del
> [estándar permanente de calidad para planes](planning-quality-standard.md) antes de presentar o
> autorizar el plan.

---

## 1. Principio de reparto

- **Claude (Fable/Opus) = cerebro.** Definir el problema, clasificar (C0–C9 + riesgo), mapear impacto,
  identificar invariantes, diseñar tests y observabilidad, revisar el diff, decidir merge. Es lo que ya
  hace hoy en este proyecto.
- **Codex = manos.** Traducir un plan cerrado en código: implementación mecánica, boilerplate,
  refactors acotados, tests una vez definidos los casos, migraciones ya diseñadas.

El objetivo operativo secundario es **ahorrar límites de Claude** descargando la generación voluminosa
en la cuenta de OpenAI, sin perder la capa de arquitectura/revisión.

---

## 2. Mapeo sobre los 18 pasos del proceso

| Paso del proceso (§4)              | Quién conduce  | Nota                                                             |
| ---------------------------------- | -------------- | ---------------------------------------------------------------- |
| 1 Sincronizar rama                 | Cualquiera     | Mecánico.                                                        |
| 2 Leer fuentes de verdad           | **Claude**     | Requiere criterio: ADRs, migraciones, roadmap Fase 1.            |
| 3 Definir problema + señal         | **Claude**     | Es la decisión, no la ejecución.                                 |
| 4 Clasificar C0–C9 + riesgo        | **Claude**     | Determina la validación mínima. No delegar.                      |
| 5 Mapear impacto (plantilla §5)    | **Claude**     | Codex puede rellenar el borrador; Claude valida.                 |
| 6 Identificar invariantes          | **Claude**     | Núcleo del dominio. No delegar.                                  |
| 7 Diseñar estrategia de tests      | **Claude**     | Codex escribe los tests **después**, con los casos ya fijados.   |
| 8 Diseñar observabilidad/analítica | **Claude**     | Qué capturar y qué PII excluir es decisión.                      |
| 9 Implementar cambio mínimo        | **Codex**      | Aquí es donde brilla. Plan cerrado → código.                     |
| 10 Validación local                | Codex ejecuta  | Corre tests/typecheck/lint; Claude interpreta fallos.            |
| 11 Revisión adversarial            | **Claude**     | `/codex:adversarial-review` como segunda voz, no como sustituto. |
| 12 Actualizar documentación        | Codex borrador | Claude revisa que no sobre-declare (criterio de bloqueo §14.15). |
| 13 Revisar el diff                 | **Claude**     | Secretos, PII, archivos no justificados, scope creep.            |
| 14 Commit + PR                     | Cualquiera     | Descripción debe corresponder al diff (§14.14).                  |
| 15 CI                              | Automático     | Nadie fuerza el merge con checks pendientes.                     |
| 16 Merge                           | **Humano**     | Sólo tras aprobación. Ningún agente auto-mergea.                 |
| 17 Post-merge técnico              | Cualquiera     | Mecánico.                                                        |
| 18 Validación post-despliegue      | **Claude**     | Sentry/PostHog/KPIs; no marcar antes de desplegar de verdad.     |

**Lectura corta:** Claude conduce pasos 2–8, 11, 13 y 18 (las decisiones). Codex conduce el paso 9 y
ejecuta 10. Todo lo demás es compartido o humano.

---

## 3. Comandos del plugin y cuándo usarlos

- `/codex:setup` — una vez por proyecto, para dar contexto de la carpeta a Codex.
- **Delegar construcción** — tras cerrar el plan con Claude, pásale a Codex una tarea acotada
  (un objetivo, sin refactors colaterales, respetando "cambio mínimo" §1.2 del proceso).
- `/codex:review` — auditoría adicional del diff. **Complementa** tu revisión (paso 13), no la sustituye.
- `/codex:adversarial-review` — segunda opinión de diseño/concurrencia. Útil en cambios **C5/C6** (auth,
  transacciones críticas: oferta/reserva/entrega/venta/garantía), donde ya exigís PostgreSQL real y carreras.
- `/codex:rescue` — cuando un enfoque se atasca; pide alternativa antes de acumular deuda.

---

## 4. Qué NO delegar nunca a Codex (o revisar con lupa si lo toca)

Alineado con los criterios de bloqueo (§14) y las categorías de mayor riesgo:

1. **Decidir la clasificación C0–C9 y el nivel de riesgo** — determina toda la validación aguas abajo.
2. **Invariantes de dominio y concurrencia (C6)** — nada de "un pre-read como garantía" (AD-002); exige
   transacción/CAS/constraint. Codex puede escribir el código, pero el diseño y los tests reales en
   PostgreSQL los valida Claude.
3. **Autorización (C5)** — casos negativos, cross-entity, boundary server/client. Revisión humana obligada.
4. **Migraciones (C4)** — additive-first, replay, catálogo, separadas del rollout documental de Fase 0.
   Codex genera SQL; Claude verifica el gobierno de migraciones.
5. **No crear entidades diferidas sin driver** (AD-009: Party/Listing/Deal/Organization/marketplace).
   Codex tiende a "completar" abstracciones; vigila el scope creep (§14.11).
6. **Secretos y PII** — este CRM maneja datos de clientes y `.env.local`. Codex ve el código del proyecto
   donde lo actives; nunca le pidas que toque secretos ni que envíe datos sensibles a Sentry/PostHog.
7. **Merge y operaciones remotas** — ningún agente mergea, ni toca staging/producción sin autorización
   explícita (§14.16).

---

## 5. Flujo tipo recomendado

```
Claude:  problema → clasificar (C?) → invariantes → plan de tests → plan de implementación
  │
  ├─►  Codex:  implementa el cambio mínimo + escribe los tests definidos
  │            corre typecheck + lint + vitest
  │
Claude:  /codex:adversarial-review (si es C5/C6) → revisa el diff (secretos/PII/scope) → doc
  │
Humano:  commit → PR → espera CI verde → merge
  │
Claude:  validación post-despliegue (Sentry/PostHog/KPIs) cuando llegue a un entorno real
```

Regla práctica: **si el paso requiere criterio de dominio, riesgo o seguridad, lo conduce Claude. Si es
traducir un plan cerrado en código, lo hace Codex.**

El reparto descrito aquí complementa el
[proceso universal de cambios de ingeniería](engineering-change-process.md); no sustituye sus gates,
autorizaciones ni criterios de bloqueo.
