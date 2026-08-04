# SDD ligero y harness de desarrollo

| Campo                | Valor                                                                               |
| -------------------- | ----------------------------------------------------------------------------------- |
| **Estado**           | ACTIVE                                                                              |
| **Owner**            | Engineering                                                                         |
| **Última revisión**  | 2026-08-03                                                                          |
| **Alcance**          | Convertir una necesidad en un cambio verificable sin añadir burocracia innecesaria. |
| **Proceso ampliado** | [`engineering-change-process.md`](engineering-change-process.md)                    |
| **Testing**          | [`testing-strategy.md`](testing-strategy.md)                                        |
| **Plantilla**        | [`../templates/change-brief.md`](../templates/change-brief.md)                      |

## 1. Principio

La especificación describe **qué comportamiento debe existir y por qué**. El plan describe **cómo se
implementará**. El harness —tests, comandos, CI, entornos y observabilidad— demuestra si el resultado
cumple la especificación.

No se crea documentación por defecto. Se crea el artefacto mínimo que permita tomar las decisiones,
implementar con seguridad y verificar el resultado.

## 2. Fuente de verdad

Cada tipo de hecho tiene una única fuente canónica:

| Hecho                                   | Fuente de verdad                                                              |
| --------------------------------------- | ----------------------------------------------------------------------------- |
| Comportamiento implementado actualmente | Código de `main`, schema y migraciones desplegadas                            |
| Comportamiento que se quiere construir  | Spec aprobada en `docs/specs/`                                                |
| Decisiones arquitectónicas estables     | ADR y documentos ACTIVE enlazados desde `docs/README.md`                      |
| Estado operativo de una tarea           | Linear o GitHub issue, enlazado a la spec y al PR                             |
| Evidencia de implementación             | Commit, PR, CI y deployment identificables                                    |
| Estado de producción                    | Deployment más validación post-despliegue; no una lista manual en `AGENTS.md` |

Si dos fuentes se contradicen, no se elige silenciosamente. Se registra la discrepancia y se
reconcilia. Un ticket marcado como pendiente no invalida código ya desplegado; una spec prevista no
demuestra que algo esté implementado.

## 3. Enrutado proporcional

### Ruta rápida

Para documentación, copy, estilos aislados o mantenimiento sin cambio de comportamiento, datos,
permisos ni producción.

Requiere:

- ticket o descripción breve del problema;
- resultado esperado y fuera de alcance;
- diff revisado;
- validación proporcional.

No requiere un archivo de spec independiente.

### Ruta estándar

Para bugs y funcionalidades que cambian comportamiento, queries o integraciones de riesgo bajo o
medio.

Requiere un único _change brief_ basado en
[`docs/templates/change-brief.md`](../templates/change-brief.md), guardado como
`docs/specs/<ID>-<slug>.md`. El mismo documento contiene spec, plan, criterios de aceptación,
verificación y rollout para evitar artefactos duplicados.

### Ruta reforzada

Obligatoria para dinero, reservas, venta, permisos, PII, migraciones, Storage privado, concurrencia,
efectos irreversibles o producción sensible.

Además del _change brief_, aplica el análisis completo de
[`planning-quality-standard.md`](planning-quality-standard.md) y
[`engineering-change-process.md`](engineering-change-process.md). Las secciones no aplicables pueden
ser `N/A` con justificación; no se rellenan con texto ficticio.

## 4. Ciclo de un cambio

1. **Identificar** — asignar ID y describir el problema observable.
2. **Baselinar** — comprobar código, datos y entorno; separar hechos de inferencias.
3. **Especificar** — resultado, reglas, casos límite, exclusiones y aceptación.
4. **Clasificar** — elegir ruta, categorías C0–C9 y nivel de riesgo.
5. **Planificar** — solución mínima, archivos, datos, permisos, efectos y rollback.
6. **Implementar** — rama corta; un objetivo principal; sin limpieza no relacionada.
7. **Verificar** — tests proporcionales, diff y revisión adversarial.
8. **Entregar** — PR enlazada a ticket/spec con evidencia real.
9. **Desplegar** — sólo con autorización y configuración del entorno verificadas.
10. **Validar** — smoke test, logs/métricas y reconciliación cuando corresponda.
11. **Cerrar** — actualizar ticket y spec con commit, PR, deployment y resultado.

## 5. Estados de una spec

| Estado        | Significado                                                                         |
| ------------- | ----------------------------------------------------------------------------------- |
| `DRAFT`       | En definición; no autoriza implementar.                                             |
| `APPROVED`    | Decisiones materiales resueltas; autoriza el alcance indicado.                      |
| `IMPLEMENTED` | Cambio presente y verificado localmente o en CI; todavía puede no estar desplegado. |
| `DEPLOYED`    | Commit concreto desplegado en el entorno indicado.                                  |
| `VALIDATED`   | Criterios comprobados en ese entorno durante la ventana definida.                   |
| `SUPERSEDED`  | Sustituida por otra fuente enlazada.                                                |

Nunca se salta de `APPROVED` a `VALIDATED` sólo porque el build esté verde.

## 6. Definition of Done

Un cambio está terminado cuando:

- los criterios de aceptación tienen evidencia;
- se ejecutaron los checks exigidos por su riesgo y se registró el resultado;
- se revisó el diff completo;
- no contiene secretos, PII ni artefactos accidentales;
- migraciones, concurrencia, autorización y efectos externos están cubiertos cuando aplican;
- el rollback o mitigación está descrito;
- ticket, spec y PR coinciden con lo implementado;
- si fue desplegado, existe validación del entorno y observación proporcional.

## 7. Harness mínimo del repositorio

El harness se considera operativo sólo si proporciona feedback real:

- `pnpm check:sdd` valida briefs, estados, enlaces canónicos y el tamaño estable de `AGENTS.md`;
- `pnpm typecheck`, `pnpm lint` y `pnpm test` ejecutan y fallan de forma visible;
- los tests de integración usan PostgreSQL real cuando la garantía depende de la base de datos;
- migration replay y Supabase local no acceden accidentalmente a producción;
- Playwright ejecuta contra un entorno configurado; un run omitido no cuenta como E2E verde;
- los cron y jobs tienen autenticación, idempotencia, logs y una señal de última ejecución;
- CI informa qué se ejecutó y qué se omitió;
- Sentry, PostHog y logs no sustituyen tests ni contienen PII innecesaria;
- los conectores externos se usan con mínimo privilegio y las mutaciones remotas requieren alcance
  y autorización explícitos.

## 8. Revisión periódica

Revisar trimestralmente o tras un incidente:

- instrucciones obsoletas en `AGENTS.md`;
- specs `DRAFT` o `APPROVED` abandonadas;
- tickets que contradicen código desplegado;
- checks verdes con pasos omitidos;
- cifras de tests copiadas en documentación;
- runbooks sin owner o sin señal verificable.
