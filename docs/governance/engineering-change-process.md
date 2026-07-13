# Proceso universal de cambios de ingeniería

| Campo                            | Valor                                                                                                                                                                                                                                                |
| -------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Título**                       | Proceso universal de cambios de ingeniería                                                                                                                                                                                                           |
| **Estado**                       | ACTIVE                                                                                                                                                                                                                                               |
| **Owner**                        | Engineering                                                                                                                                                                                                                                          |
| **Co-owners**                    | Architecture · Security · Operations · Data                                                                                                                                                                                                          |
| **Última revisión**              | 2026-07-13                                                                                                                                                                                                                                           |
| **Fuente de verdad relacionada** | Este documento (proceso). Testing: [`testing-strategy.md`](testing-strategy.md). Plantilla: [`../../.github/PULL_REQUEST_TEMPLATE.md`](../../.github/PULL_REQUEST_TEMPLATE.md). Flujo git/commits: [`../../CONTRIBUTING.md`](../../CONTRIBUTING.md). |
| **Alcance**                      | Cómo convertir cualquier petición en un cambio proporcionado al riesgo y verificable.                                                                                                                                                                |
| **Fuera de alcance**             | Flujo git básico y Conventional Commits (ya en `CONTRIBUTING.md`); implementación de cualquier PR técnico; configuración real de Sentry/PostHog.                                                                                                     |

> Este documento **complementa**, no sustituye, [`CONTRIBUTING.md`](../../CONTRIBUTING.md) (ramas,
> commits, hooks, PR flow) y el gobierno existente ([migraciones](database-migrations.md),
> [Storage](supabase-storage.md), [seguridad](security-and-secrets.md), [CI](ci-quality-gates.md)).
> Enlaza a ellos; no repite su contenido. **Cómo comunicar el resultado** de un cambio (evidencia,
> hecho vs inferencia, niveles de respuesta): [`ai-handoff-protocol.md`](ai-handoff-protocol.md).

---

## 1. Principios

### 1.1 Cambios guiados por problemas reales

Ningún cambio estructural sin problema o consumidor verificable. Respetar **AD-009** ("ship the
field, gate the entity"). No crear Party, Listing, Deal, Organization, Membership, BuyerIntent u
otras entidades diferidas sin driver (ver [`../architecture/fase-1-evolution-roadmap.md`](../architecture/fase-1-evolution-roadmap.md)).

### 1.2 Cambios pequeños

Un objetivo principal por PR. No mezclar feature + refactor + migración + limpieza no relacionada.
Separar cambios operativos de cambios de código; separar el **rollout documental** de Fase 0 de las
migraciones de Fase 1.

### 1.3 Additive first

Preferir expansión antes que contracción; mantener compatibilidad; evitar cambios destructivos
directos. Patrón: **expand → backfill → observe → contract**.

### 1.4 Invariantes antes que implementación

Identificar las reglas de dominio y las garantías; tests sobre invariantes. **Nunca** usar una
lectura previa como garantía de concurrencia; usar transacción/CAS/constraint cuando corresponda
(patrón AD-002).

### 1.5 Una fuente de verdad por hecho

No derivar KPIs desde texto humano; no duplicar estados sin estrategia. Definir la columna, relación
o agregado canónico y documentar cualquier dual-read/dual-write temporal.

### 1.6 Seguridad por defecto

Autorización antes de efectos privilegiados; `service_role` sólo server-side; mínimo privilegio; sin
secretos en Git; sin operaciones remotas accidentales (ver [`security-and-secrets.md`](security-and-secrets.md)).

### 1.7 Evidencia antes del merge

Tests locales, CI completa, revisión del diff, documentación, comprobación post-merge.

### 1.8 Observabilidad proporcional al riesgo

No instrumentar por instrumentar; cada señal responde a una pregunta operativa o de producto. Sentry
no sustituye tests; PostHog no sustituye una fuente de verdad transaccional; los logs no sustituyen
auditoría estructurada. Evitar eventos/propiedades sin uso. No enviar PII ni información sensible.
Definir cómo se detectará una regresión real después del despliegue.

### 1.9 Medición antes de declarar éxito

Una funcionalidad no está validada sólo porque compila, los tests pasan o está desplegada. Cuando
corresponda debe existir una **señal post-despliegue** (ausencia de errores nuevos, adopción,
finalización de flujo, conversión, rendimiento, ratio de fallo, volumen, métrica de negocio,
feedback operativo).

### 1.10 Separación entre herramientas

- **Tests y CI** — previenen regresiones conocidas antes del merge.
- **Sentry** — detecta errores, excepciones, trazas y degradaciones técnicas en ejecución.
- **PostHog** — mide comportamiento, adopción, funnels, eventos y (a futuro) feature flags.
- **Base de datos y KPIs internos** — hechos canónicos del negocio.
- **Logs operativos** — diagnóstico de procesos y rollouts supervisados.

Ninguna capa sustituye completamente a otra.

---

## 2. Clasificación obligatoria del cambio (C0–C9)

Un cambio puede pertenecer a varias categorías; **la de mayor riesgo determina la validación mínima**.

| Cat.   | Qué es                                                                                                                                     | Validación mínima (además de la batería base)                                                                                                                                                                               |
| ------ | ------------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **C0** | Documentación (ADR, runbook, README, gobierno)                                                                                             | Enlaces, consistencia, secretos; batería base si toca instrucciones técnicas                                                                                                                                                |
| **C1** | UI / presentación (sin reglas ni datos)                                                                                                    | Accesibilidad, estados vacíos/loading/error, visibilidad por permiso; test de componente si hay lógica; error en Sentry si puede fallar en runtime; evento PostHog **sólo** si hay pregunta de adopción real                |
| **C2** | Lógica de dominio (estados, cálculos, servicios puros)                                                                                     | Invariantes, tests unitarios, revisión de consumidores, análisis de concurrencia, error de dominio vs excepción inesperada, impacto en eventos/KPIs                                                                         |
| **C3** | Persistencia / queries (lecturas, escrituras, Prisma sin migración)                                                                        | Integración PostgreSQL si afecta comportamiento real, índices, autorización, N+1, transacciones, observabilidad de errores/degradación si el impacto lo justifica                                                           |
| **C4** | Schema y migración (tabla/columna/enum/constraint/índice/FK)                                                                               | [Gobierno de migraciones](database-migrations.md): migración nueva, replay, parity, catálogo, idempotencia, estrategia de datos, rollback lógico, plan de observación                                                       |
| **C5** | Seguridad y autorización (roles, guards, docs, service role, secretos)                                                                     | Threat model reducido, pruebas positivas **y** negativas, intentos cross-entity, boundary server/client, redacción de datos a Sentry/PostHog/logs                                                                           |
| **C6** | Concurrencia / transacción crítica (oferta, reserva, entrega, venta, garantía, costes, conversiones, idempotencia)                         | PostgreSQL **real**, carreras, CAS, idempotencia, doble ejecución, señal observable de conflictos/reintentos/fallos si corresponde                                                                                          |
| **C7** | Storage y documentos (buckets, policies, uploads, signed URLs, versiones, backfill)                                                        | [Gobierno de Storage](supabase-storage.md), Supabase local, límites MIME/tamaño, path safety, compensación, reconciliación, respeto del gate documental, prohibición de URLs firmadas/contenido en Sentry/PostHog           |
| **C8** | Integración externa / efecto asíncrono (email, calendario, proveedor, webhook, financiación, seguro)                                       | Idempotencia, retry, timeouts, failure modes, compensación, observabilidad, decisión de outbox por driver, captura de error con contexto seguro, métricas éxito/fallo, sin payloads sensibles                               |
| **C9** | CI, tooling, observabilidad, supply chain (workflows, actions, versiones, scripts, deps, Sentry, PostHog, logs, feature flags, monitoring) | `permissions`, SHA-pin cuando proceda, no acceso remoto accidental, reproducibilidad, revisión de secretos/PII, control de cardinalidad, nombres estables de eventos, compatibilidad cliente/servidor, plan de verificación |

---

## 3. Niveles de riesgo

| Nivel       | Criterios                                                                                                                                                                                                                           | Determina                                                                                                   |
| ----------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| **Bajo**    | Aislado; sin schema/autorización/concurrencia/efectos externos; sin impacto material en tracking o decisiones                                                                                                                       | Análisis breve; tests puntuales                                                                             |
| **Medio**   | Afecta un flujo existente; modifica queries/reglas; posible impacto en métricas; requiere integración; toca eventos/funnels/flags no críticos                                                                                       | Análisis de impacto completo; matriz de tests                                                               |
| **Alto**    | Dinero, venta, reserva, garantía, autorización, documentos privados, migración, backfill, tenant isolation, efectos irreversibles; tracking usado para decisiones comerciales; flag que controla una capacidad crítica              | Análisis profundo; tests de integración/concurrencia; rollback; instrumentación; validación post-despliegue |
| **Crítico** | Acceso cruzado a datos, pérdida de datos, exposición de secretos/PII, modificación remota, corrupción de migraciones, bypass de seguridad, envío de datos sensibles a terceros, pérdida total de observabilidad de un flujo crítico | Todo lo anterior + revisores adicionales + plan de aborto/rollback + alertas                                |

La severidad determina: profundidad del análisis, tests, revisores, plan de rollback,
instrumentación, alertas, validación post-merge y validación post-despliegue.

---

## 4. Flujo obligatorio de trabajo (18 pasos)

1. **Sincronizar** — partir de `main` actualizado, working tree limpio, rama nueva (ver `CONTRIBUTING.md`).
2. **Leer fuentes de verdad** — según el cambio: arquitectura, ADRs, migraciones, Storage, seguridad, CI, observabilidad, rollout, roadmap de Fase 1.
3. **Definir el problema** — comportamiento actual, esperado, evidencia, impacto, no-objetivos, y la **señal** que demostrará que funciona.
4. **Clasificar** — categorías C0–C9, riesgo, bounded context, driver.
5. **Mapear impacto** — archivos, modelos, flujos, usuarios, datos, permisos, concurrencia, métricas, Sentry, PostHog, feature flags, documentación (plantilla §5).
6. **Identificar invariantes** — p. ej.: una oferta aceptada no reserva dos veces; completar entrega no duplica costes/garantías; una versión documental pertenece a su raíz; una operación de Storage privado requiere autorización previa; una venta tiene una única fuente canónica.
7. **Diseñar la estrategia de tests** — **antes** de implementar (ver [`testing-strategy.md`](testing-strategy.md)).
8. **Diseñar observabilidad y analítica** — **antes** de implementar (§10, §11): errores a capturar, contexto seguro, evento(s) de producto, feature flag, métricas de éxito/fallo, ventana de observación, PII a excluir.
9. **Implementar el cambio mínimo** — sin refactors no relacionados, sin entidades sin driver, sin deuda futura, sin tracking sin pregunta.
10. **Validación local** — según la matriz de testing.
11. **Revisión adversarial** — seguridad, concurrencia, datos, regresiones, scope creep, abstracción prematura, observabilidad, PII, eventos duplicados, métricas inconsistentes.
12. **Actualizar documentación** — sólo la afectada (§9).
13. **Revisar el diff** — archivos esperados, secretos, artefactos, migraciones, lockfiles, código/instrumentación accidental, datos sensibles a terceros.
14. **Commit y PR** — commit coherente, descripción completa (plantilla), sin ocultar riesgos.
15. **CI** — todos los checks; no merge con pendientes; distinguir flake de fallo real (ver el protocolo de flakes en [`testing-strategy.md`](testing-strategy.md#9-protocolo-de-flakes)).
16. **Merge** — sólo tras aprobación; sin bypass; squash cuando sea la convención.
17. **Post-merge técnico** — actualizar `main`, comprobar workflows, batería local cuando corresponda, confirmar ausencia de operaciones remotas.
18. **Validación post-despliegue** — cuando llegue a un entorno real: revisar Sentry, logs, eventos PostHog, métrica de éxito/error, feature flag, comparar esperado vs real, documentar incidencias, decidir mantener/corregir/revertir. **No** marcar una validación post-despliegue antes de que el cambio esté desplegado realmente.

---

## 5. Plantilla de análisis de impacto

Completar **antes de implementar** para riesgo medio o superior; versión reducida (pero no omitida)
para riesgo bajo.

```text
Problema:
Comportamiento actual:
Comportamiento esperado:
Usuarios afectados:
Bounded context:
Categorías de cambio:
Nivel de riesgo:
Modelos afectados:
Servicios/acciones afectados:
Queries afectadas:
Invariantes:
Autorización:
Concurrencia:
Datos existentes:
Migración:
Backfill:
Storage:
Efectos externos:
KPIs:
Sentry:
PostHog:
Eventos de producto:
Feature flags:
Métricas de éxito:
Métricas de fallo:
Alertas/dashboards:
PII y datos sensibles:
Validación post-despliegue:
Tests:
Documentación:
Rollback:
Fuera de alcance:
Driver arquitectónico:
Dependencia del rollout documental:
```

---

## 6. Gobierno de cambios de schema

Fuente: [`database-migrations.md`](database-migrations.md) (no se duplica). Obligaciones resumidas:
nunca editar una migración desplegada; no `db push` remoto como proceso; migración nueva; aditiva
cuando sea posible; `CHECK`/FK/índices explícitos; actualizar catálogo; replay desde base vacía;
parity; segundo deploy idempotente; backfill separado; observación antes de contracción; PR
destructivo separado.

**Regla especial:** cualquier migración de Fase 1 debe estar **separada** del rollout documental
pendiente de Fase 0 ([`../operations/fase-0-operational-closeout.md`](../operations/fase-0-operational-closeout.md)).

Post-despliegue: definir señales de error; observar fallos de lectura/escritura, constraints y
volumen de registros afectados; **no** enviar datos de filas ni PII a Sentry.

---

## 7. Gobierno de cambios de autorización

Revisar quién puede listar/leer/crear/modificar/borrar/descargar documentos; ownership de entidad;
acceso desde cliente y servidor; `service_role`; casos negativos; y qué datos de autorización llegan
a observabilidad.

Todo cambio de autorización debe tener tests de: (1) usuario autorizado; (2) no autorizado; (3)
sesión ausente; (4) entidad inexistente; (5) intento de acceder a otra entidad cuando aplique; (6)
cliente intentando usar una primitiva server-only cuando aplique.

**Observabilidad:** no incluir tokens, cookies, cabeceras de autorización, URLs firmadas, documentos
ni PII innecesaria; usar identificadores internos seguros o hashes; revisar el `user context`
enviado a Sentry y la identificación enviada a PostHog. **No** implementar un policy engine todavía
(ver evolución en AD-014/authz del diseño de Fase 1).

---

## 8. Gobierno de concurrencia y de efectos externos

### 8.1 Concurrencia

Análisis **obligatorio** en: transición de estado, oferta, reserva, venta, entrega, garantía, coste,
conversión, reemplazo documental, contadores y recursos únicos. **Prohibido** usar un pre-read como
única garantía. Evaluar transacción, CAS, unique constraint, row lock, idempotency key, retry,
compensación. Exigir tests **reales en PostgreSQL** para flujos críticos. Instrumentación posible
(sin alta cardinalidad injustificada): conflictos CAS, retries agotados, violaciones de constraint
inesperadas, dobles envíos, degradación de latencia, tasa de fallos.

### 8.2 Efectos externos

Persistir primero el estado transaccional; ejecutar el efecto externo **después** del commit cuando
sea seguro; registrar fallo; retry; compensación; idempotencia. **No** ocultar errores con
`.catch(() => {})` sin justificación **y** observabilidad. Evaluar `Outbox` sólo si existe necesidad
real de entrega garantizada (**no** implementar Outbox ahora). Definir por efecto: nombre de la
operación, proveedor, resultado, timeout, error categorizado, retry count, idempotency key cuando
aplique, métrica éxito/fallo, alerta si es crítico, contexto seguro para Sentry, sin payload sensible.

---

## 9. Gobierno de KPIs y analítica + matriz de actualización documental

### 9.1 KPIs

Una **fuente canónica por hecho**. **No** usar texto de `Activity` para KPIs (ver el primer PR
técnico recomendado, sin implementar aquí). No duplicar métricas entre `KpiEvent` y queries sin
definición. Documentar denominador, ventana y timezone (Europe/Madrid). Tests de reconciliación. Un
cambio de KPI incluye: definición, fuente, query, casos límite, comparación antes/después, impacto
en dashboards, owner, frecuencia, interpretación.

Distinción obligatoria:

- **KPIs operativos** (datos transaccionales del CRM): ventas, reservas, margen, costes, tiempo en estado.
- **Analítica de producto** (comportamiento/uso): uso de pantalla, finalización de flujo, abandono, adopción, interacción con flag.
- **Observabilidad técnica** (errores/trazas/rendimiento): excepciones, latencia, fallos de proveedor, errores de Server Actions.

**PostHog no es fuente canónica** de ventas, reservas, dinero ni garantías. **Sentry no es** sistema
de auditoría ni base de métricas de negocio.

### 9.2 Matriz de actualización documental

| Si cambia…                          | Actualizar                                                                                                    |
| ----------------------------------- | ------------------------------------------------------------------------------------------------------------- |
| Arquitectura                        | `architecture-decisions.md`, fuente de verdad de la fase, roadmap si cambia la secuencia                      |
| Schema                              | `database-migrations.md` (si cambia la regla), catálogo, doc del modelo afectado                              |
| Storage                             | `supabase-storage.md`, seguridad, runbook si cambia el rollout                                                |
| CI                                  | `ci-quality-gates.md`, este proceso, `testing-strategy.md`                                                    |
| Observabilidad                      | este proceso, `testing-strategy.md`, convenciones de eventos, privacidad, doc de despliegue, riesgos          |
| Analítica de producto               | definición del evento, propiedades, funnel/métrica, owner, doc del flag, criterio de éxito, política de PII   |
| Un riesgo                           | matriz de riesgos de la fuente de verdad correspondiente                                                      |
| Se implementa una pieza recomendada | cambiar su estado de recomendado/diferido a **implementado** **sólo** tras fusionarse y verificarse en `main` |

---

## 10. Gobierno de Sentry (según la integración real)

> **Integración verificada en el repositorio:** `sentry.client.config.ts`, `sentry.server.config.ts`,
> `sentry.edge.config.ts`, registrados por `instrumentation.ts`; `next.config.mjs` con
> `withSentryConfig` (`hideSourceMaps`, `silent: !CI`). Captura manual **en un solo punto**:
> `app/global-error.tsx` (`Sentry.captureException`). **Session Replay** en cliente con
> `maskAllText: true` + `blockAllMedia: true`. DSN vía `NEXT_PUBLIC_SENTRY_DSN`; source maps vía
> `SENTRY_AUTH_TOKEN`. Muestreo de trazas 10% prod / 100% dev-staging; replay 1% sesión / 100% error.
> **No existen** hoy `beforeSend`, `setUser`, `setContext`, `setTag`, `addBreadcrumb`, `withScope`
> ni `ignoreErrors` → la instrumentación contextual y el scrubbing server-side son **recomendaciones**,
> no hechos.

**Qué capturar:** excepciones inesperadas; fallos técnicos no recuperables; errores de integraciones;
fallos de Server Actions que **no** sean errores de dominio esperados; degradaciones de rendimiento
si tracing está habilitado; fallos de procesos críticos.

**Qué NO capturar como error:** validaciones esperadas, permisos denegados correctamente, errores de
dominio normales, condiciones de negocio esperadas, cancelaciones válidas. Pueden ir como breadcrumbs,
métricas o logs estructurados si aportan valor, sin ruido.

**Contexto permitido:** nombre de operación, módulo, bounded context, identificador técnico seguro,
estado no sensible, versión, entorno, feature flag relevante.

**Datos prohibidos/restringidos:** contraseñas, tokens, cookies, cabeceras de autorización,
`service_role`, claves, DNI, datos bancarios, documentación, URLs firmadas, mensajes con PII,
payloads externos completos, emails/teléfonos salvo política explícita y justificada.

**Calidad de señal:** no capturar el mismo error varias veces; evitar cardinalidad infinita en tags;
agrupar correctamente; mensajes estables; sin valores variables en el fingerprint sin necesidad;
distinguir errores de usuario/dominio/infraestructura/programación.

**Verificación posterior (riesgo medio+):** revisar nuevos issues, regresiones, performance, tasa de
errores; confirmar ausencia de PII; documentar la ventana de observación.

**No modificar la configuración real de Sentry en un PR de gobierno.**

---

## 11. Gobierno de PostHog (según la integración real)

> **Integración verificada:** `components/posthog-provider.tsx` inicializa PostHog con
> `NEXT_PUBLIC_POSTHOG_KEY`/`NEXT_PUBLIC_POSTHOG_HOST` (default `eu.posthog.com`),
> **`opt_out_capturing_by_default: true`** (captura **consent-gated** vía el banner de cookies),
> `capture_pageview` y `capture_pageleave`, persistencia `localStorage+cookie`. Eventos personalizados
> **reales** (todos en la **web pública**, no en el backoffice), `snake_case`: `form_view`,
> `form_step_completed` (props `form`,`step`), `form_submitted`, `landing_view`, `hero_cta_click`,
> `final_cta_click`, `comparison_section_viewed`, `whatsapp_button_click`, `faq_opened` (prop
> `question`), `calculator_started`, `calculator_submitted` (props `type`/`brand`/`model`/`year`/`km`/`method`),
> `calculator_to_form`. **No existen** hoy `posthog.identify`, `reset`, `group` ni **feature flags**
> → captura anónima; la identidad de usuario y los feature flags son **recomendaciones**, no hechos.

**Cuándo crear un evento:** sólo ante una pregunta concreta (¿se usa la función? ¿se completa el
flujo? ¿en qué paso se abandona? ¿mejora la conversión? ¿qué segmento la usa? ¿funciona el flag?).
**No** un evento por cada clic.

**Convención de nombres (la observada en el repo, de facto):** `snake_case`, semántica
`objeto_acción` (`form_submitted`, `calculator_started`), estable, independiente del texto visual,
sin valores dinámicos en el nombre. _(No existe un documento de convención aparte; ésta es la
convención vigente extraída del código.)_ Ejemplos **conceptuales, no implementados** para el CRM
futuro: `vehicle_inspection_started`, `vehicle_inspection_completed`, `financing_request_submitted` —
**no añadir estos eventos al código en este PR.**

**Propiedades:** mínimas, documentadas, de cardinalidad controlada, sin PII, sin documentos, sin
texto libre sensible, con enums/categorías cuando sea posible.

**Identidad:** revisar cuándo se identifica al usuario, qué identificador, cuándo se resetea, cómo se
evita mezclar identidades, qué perfil es legítimo y cómo se cumple privacidad. _(Hoy la captura es
anónima; cualquier `identify` futuro es una decisión con revisión de privacidad.)_ No documentar
identificadores reales.

**Feature flags (recomendación; no hay ninguno hoy):** al introducir uno evaluar necesidad real,
default seguro, comportamiento sin conexión, targeting, **owner**, **fecha/criterio de retirada**,
métrica de éxito, rollback y **eliminación del flag al finalizar**. No usar flags permanentes sin
owner ni plan de retirada.

**Funnels y métricas:** definir evento inicial/final/intermedios, ventana, segmentos, exclusiones,
criterio de éxito. _(Los funnels se configuran en la UI de PostHog, no en el repo.)_

**Verificación posterior:** confirmar recepción, propiedades, ausencia de duplicados y de PII;
revisar adopción; comparar con la fuente transaccional cuando aplique.

**No modificar la configuración real de PostHog en un PR de gobierno.**

---

## 12. Matriz cambio → observabilidad (guía mínima, no obligación de instrumentar todo)

| Tipo de cambio                 | Sentry                                  | PostHog                               | Feature flag   | Métrica post-despliegue |
| ------------------------------ | --------------------------------------- | ------------------------------------- | -------------- | ----------------------- |
| Documentación                  | no                                      | no                                    | no             | no                      |
| UI puramente visual            | solo errores reales                     | normalmente no                        | normalmente no | revisión visual         |
| Nueva funcionalidad de usuario | errores inesperados                     | si hay pregunta de adopción           | según riesgo   | adopción/completitud    |
| Regla de dominio               | errores inesperados                     | solo si cambia comportamiento visible | según rollout  | reconciliación          |
| Query crítica                  | errores/latencia                        | no como fuente canónica               | opcional       | error rate/latencia     |
| Venta/reserva                  | errores críticos                        | comportamiento, no fact canónico      | según riesgo   | reconciliación DB       |
| Integración externa            | obligatorio si es crítica               | evento éxito/fallo si aporta valor    | opcional       | success/failure rate    |
| Storage/documentos             | errores técnicos sin contenido sensible | normalmente no                        | opcional       | errores/huérfanos       |
| KPI                            | errores de cálculo                      | no como fuente del KPI                | no             | before/after            |
| Feature flag                   | errores del código bajo flag            | exposición + resultado                | sí             | lift/guardrail          |
| Migración/backfill             | errores y logs operativos               | no                                    | no             | verify/reconcile        |

---

## 13. Proceso para cambios urgentes (hotfix)

Un hotfix puede **reducir el alcance** pero **no** saltarse: autorización, secretos, migraciones
seguras, tests mínimos, revisión del diff, CI, documentación del riesgo, observabilidad mínima y
verificación post-merge. Debe incluir: incidente, impacto, evidencia de Sentry/logs si existe,
mitigación inmediata, cambio mínimo, follow-up, deuda aceptada, owner, fecha límite y la señal que
confirmará la recuperación. **No** usar bypass de branch protection (no existe hoy una política
excepcional que lo permita).

---

## 14. Criterios de bloqueo (no fusionar si…)

1. Hay checks pendientes.
2. Hay checks fallidos sin diagnóstico.
3. La migración no replaya.
4. Existe drift.
5. Faltan tests críticos.
6. Falla un caso negativo de autorización.
7. No se probó concurrencia cuando corresponde.
8. Hay secreto o PII accidental.
9. El diff incluye archivos no justificados.
10. El lockfile cambió sin dependencia explicada.
11. El cambio introduce una entidad diferida sin driver.
12. El PR mezcla rollout documental y migración de Fase 1.
13. No existe rollback o mitigación para riesgo alto.
14. La descripción del PR no corresponde al diff.
15. Se afirma como implementado algo aún no fusionado.
16. Staging o producción se modifican sin autorización explícita.
17. Una función crítica puede fallar silenciosamente sin señal de diagnóstico.
18. Se envía PII o información sensible a Sentry, PostHog o logs.
19. Se añade un evento de PostHog sin pregunta, owner o uso definido.
20. Se añade un feature flag sin default seguro, criterio de retirada o métrica de éxito.
21. Se usa PostHog como fuente canónica de un hecho transaccional.
22. Se usa Sentry como sistema de auditoría o métrica de negocio.
23. No existe plan de validación post-despliegue para un cambio de riesgo alto.
24. La instrumentación genera eventos duplicados o cardinalidad no controlada conocida.

_(Bloqueos relacionados con observabilidad: 17–24.)_

---

## 15. Relación con Fase 1 y con el rollout documental

Este PR de gobierno es el **gate previo** al primer PR técnico. Una vez fusionado: podrá prepararse
el PR del **fact de venta canónico**; cada PR seguirá este proceso; el roadmap sigue siendo
revalidable; **no** autoriza automáticamente PR 2–5 ni Party/Listing/Deal/Organization/marketplace.

El primer PR técnico deberá evaluar además: si el KPI necesita señal en Sentry; cómo reconciliar el
dato transaccional; que PostHog interviene sólo en comportamiento (no en la fuente canónica de la
venta); y cómo validar el cambio tras el despliegue.

**Rollout documental:** cierre técnico de Fase 0 = PASS; operativo = PENDING; los cambios no
documentales pueden avanzar en paralelo; las tablas documentales permanecen **congeladas**; ningún
PR mezcla rollout documental con una migración de Fase 1; staging/producción requieren autorización
separada; la observabilidad del rollout sigue su [runbook](../runbooks/document-storage-rollout.md).
