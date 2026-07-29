# Estándar permanente de calidad para planes

| Campo                | Valor                                                                                                                                                                                                                                                                                                     |
| -------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Título**           | Estándar permanente de calidad para planes                                                                                                                                                                                                                                                                |
| **Estado**           | ACTIVE                                                                                                                                                                                                                                                                                                    |
| **Owner**            | Engineering                                                                                                                                                                                                                                                                                               |
| **Última revisión**  | 2026-07-29                                                                                                                                                                                                                                                                                                |
| **Alcance**          | Calidad, evidencia, completitud y autorización de todo plan funcional o técnico material del CRM de Campers Nova antes de implementar.                                                                                                                                                                    |
| **Fuera de alcance** | Ejecución del cambio, implementación, commits, push, apertura o merge de PR, CI, migraciones y operaciones sobre staging o producción; estas actividades se gobiernan mediante el [proceso universal de cambios de ingeniería](engineering-change-process.md) y requieren sus autorizaciones específicas. |

> Este documento es la fuente canónica para la **calidad del plan**. Complementa el
> [proceso universal de cambios de ingeniería](engineering-change-process.md), que gobierna la
> ejecución, y la [guía de reparto Claude ↔ Codex](claude-codex-division.md), que distribuye trabajo
> sin transferir la responsabilidad arquitectónica. Su aplicación es vinculante desde
> [`CLAUDE.md`](../../CLAUDE.md).

---

## 0. Objetivo

Establecer un método permanente, riguroso, verificable y homogéneo para elaborar planes funcionales
o técnicos del CRM. El estándar evita que un plan se limite al flujo principal o a una lista de
archivos y omita riesgos transversales como:

- concurrencia e idempotencia;
- autorización, seguridad y privacidad;
- integridad, compatibilidad e históricos de datos;
- migraciones, backfills y comportamiento legacy;
- caché y superficies públicas;
- efectos secundarios e integraciones;
- observabilidad y auditoría;
- rollout, rollback y stop conditions;
- experiencia y responsabilidad operativas.

El resultado de la planificación debe permitir que un revisor independiente distinga con precisión
qué está verificado, qué se ha decidido, qué se supone, qué falta decidir y qué acciones están o no
autorizadas.

## 1. Documento canónico y responsabilidades

Este archivo es la fuente de verdad del estándar. [`CLAUDE.md`](../../CLAUDE.md) contiene sólo una
referencia breve y vinculante; no debe duplicar estas reglas.

La responsabilidad sobre la integridad del plan se rige además por
[`claude-codex-division.md`](claude-codex-division.md):

- Claude responde de la **integridad global del plan**.
- Delegar investigación o redacción mecánica a Codex no delega la responsabilidad arquitectónica.
- Claude debe revisar la integración entre todas las partes delegadas antes de presentar el plan.

Ninguna división de trabajo rebaja los requisitos de evidencia, revisión o autorización de este
estándar.

## 2. Aplicación obligatoria y proporcionalidad

Este estándar se aplica a cualquier trabajo que afecte a uno o más de estos ámbitos:

- modelos o reglas de negocio;
- workflows, estados, transiciones o invariantes;
- roles, permisos, autenticación o autorización;
- base de datos, schema, migraciones, backfills o datos existentes;
- Server Actions, APIs, jobs, webhooks o automatizaciones;
- pagos, ofertas, reservas, publicación o venta;
- matching, taller, entregas, garantías o postventa;
- integraciones externas, almacenamiento o caché;
- catálogo o superficies públicas;
- staging, producción o procesos operativos.

Los cambios puramente visuales y sin efecto funcional pueden usar una versión reducida. El plan debe
justificar expresamente esa reducción, clasificar el cambio y confirmar por qué no afecta a datos,
permisos, estados, integraciones, observabilidad ni operación. «Parece visual» no es evidencia
suficiente.

## 3. Proceso obligatorio de planificación

Las cuatro fases se realizan en orden. Puede volverse a una fase anterior cuando aparezca nueva
evidencia, pero ninguna puede omitirse sin justificar que no aplica.

### 3.1 Fase 1 — Baseline verificable

Antes de diseñar la solución, inspeccionar las fuentes disponibles y documentar como mínimo:

- `main` actual y commit de referencia;
- rama de trabajo y PR relevantes;
- schema y migraciones aplicadas o pendientes;
- estados, enums e invariantes existentes;
- todos los writers y readers conocidos;
- roles, guards, RLS y límites de autorización;
- tests existentes y cobertura relevante;
- documentación vigente y decisiones registradas;
- estado verificable de local, CI, staging y producción;
- deuda, riesgos o incidencias relacionadas.

No usar memoria como evidencia cuando el repositorio o el entorno puedan confirmar el dato. No
presentar como hecho el estado de una rama, PR, migración, deploy o servicio sin inspeccionarlo.

Toda afirmación material del baseline debe llevar una de estas etiquetas:

| Etiqueta                | Uso obligatorio                                                                                      |
| ----------------------- | ---------------------------------------------------------------------------------------------------- |
| `VERIFICADO EN CÓDIGO`  | Confirmado en una ruta, símbolo, test, migración, commit o diff identificable del repositorio.       |
| `VERIFICADO EN ENTORNO` | Confirmado mediante una consulta o inspección reproducible del entorno indicado.                     |
| `DECISIÓN DOCUMENTADA`  | Respaldado por una fuente de verdad o decisión vigente enlazada.                                     |
| `SUPOSICIÓN`            | Hipótesis provisional, explícita y pendiente de validación; nunca se usa como garantía.              |
| `DECISIÓN REQUERIDA`    | Elección material no derivable de la evidencia y que necesita resolución del responsable de negocio. |

Cada etiqueta debe ir acompañada de evidencia concreta o de la acción necesaria para obtenerla. Una
afirmación sin clasificación se considera no verificada.

### 3.2 Fase 2 — Definición funcional

Definir la conducta de negocio antes de proponer schema, archivos o implementación:

- problema de negocio y evidencia del problema;
- usuario o actor afectado;
- resultado esperado y señal que demostrará el éxito;
- alcance y exclusiones;
- flujo principal;
- flujos alternativos;
- errores, excepciones y recuperación;
- estados antes y después;
- invariantes y reglas de terminalidad o reapertura;
- permisos y responsabilidades;
- datos necesarios;
- impacto operativo y propietario de la operación.

No se considera definición funcional una enumeración de componentes técnicos. Si el comportamiento no
está definido, el diseño técnico todavía no puede cerrarse.

### 3.3 Fase 3 — Inventario de impacto

Buscar de forma exhaustiva consumidores directos e indirectos. El inventario incluye, cuando aplique:

- writers y readers;
- validadores y formularios;
- Server Actions y rutas API;
- jobs, crons y webhooks;
- SQL raw, vistas, triggers y procedimientos;
- cachés e invalidaciones;
- catálogo público, sitemap y feeds;
- matching, KPIs y Activities;
- notificaciones, emails y storage;
- documentación, tests e integraciones relacionadas.

El plan debe incluir esta tabla, con una fila por componente o grupo homogéneo:

| Componente                                   | Comportamiento actual              | Cambio previsto          | Riesgo                    | Validación                                          |
| -------------------------------------------- | ---------------------------------- | ------------------------ | ------------------------- | --------------------------------------------------- |
| _Ruta, símbolo, tabla, proceso o consumidor_ | _Qué hace hoy y con qué evidencia_ | _Conducta futura exacta_ | _Fallo posible e impacto_ | _Test, consulta, revisión o señal que lo demuestra_ |

Una búsqueda sin resultados también es evidencia si se documentan el alcance y el patrón utilizado.
«Revisar consumidores» sin enumerarlos no completa esta fase.

### 3.4 Fase 4 — Revisión transversal obligatoria

Evaluar todas las categorías siguientes. Si una no aplica, escribir «No aplica» y justificarlo con
evidencia:

#### Dominio

Invariantes, máquina de estados, vías alternativas, bypasses, terminalidad, reapertura, actores y
datos históricos. Confirmar que no exista un writer alternativo que evite el gate previsto.

#### Autorización y seguridad

Rol mínimo, comprobación server-side, acceso indirecto por IDs, RLS, mass assignment, PII, secretos y
acciones administrativas. La ocultación en UI no sustituye autorización en servidor.

#### Concurrencia

Doble clic, dos usuarios, writers concurrentes, locks compartidos, orden global de locks, CAS,
carreras entre tablas, deadlocks y timeouts. Un lock sólo protege si todos los writers concurrentes
adquieren la misma raíz o proporcionan una garantía equivalente.

#### Idempotencia

Reintentos de transporte, doble submit, clave persistida, vinculación de la clave con la petición,
resultado repetido, conflictos y distinción entre reintento e intención nueva.

#### Datos

Nulabilidad, defaults, placeholders, DML, backfill, históricos, legacy, `UNIQUE` con `NULL`, FKs,
`CHECK`, índices, triggers, retención y borrado.

#### Compatibilidad

Cliente antiguo con schema nuevo, cliente nuevo con schema antiguo, orden DB/cliente, APIs, fixtures,
imports y datos legacy.

#### Efectos secundarios

Matching, KPIs, Activities, notificaciones, emails, storage, búsquedas, catálogo, sitemap, caché e
integraciones.

#### Experiencia operativa

Qué puede hacer cada usuario, qué queda bloqueado, qué mensaje recibe, campos vacíos, estados
intermedios, recuperación de errores y dispositivos o navegadores relevantes.

#### Observabilidad

Logs, Sentry, métricas, eventos, auditoría y detección de errores silenciosos. Definir señal, owner,
contexto seguro y datos que deben excluirse; no instrumentar sin una pregunta operativa.

#### Rollout y rollback

Preflight, migración, postflight, merge, deploy, smoke test, ventana de observación, rollback del
cliente, reversibilidad del schema y stop conditions.

#### Documentación

Project Brief, release, runbook, decisiones, riesgos y estado exacto por entorno. No declarar
implementado, migrado o desplegado lo que sólo esté previsto.

## 4. Revisión adversarial interna

Después del primer borrador se realiza una segunda pasada separada, con mentalidad de revisor
independiente que intenta romper el plan. Debe buscar al menos:

- una vía alternativa que evite el gate;
- una carrera concurrente o un orden de locks incompatible;
- un rol con permisos excesivos o un control sólo en UI;
- un registro histórico incompatible;
- una caché o superficie pública no invalidada;
- un efecto secundario omitido;
- un reintento que duplique efectos;
- una dependencia externa o un modo de fallo no tratado;
- una migración incompatible;
- un reader que no tolere el nuevo estado o `NULL`;
- una afirmación no verificada;
- una ampliación de alcance no solicitada.

Los hallazgos se conservan aunque se corrijan, porque son evidencia de que la revisión ocurrió:

| Hallazgo adversarial                         | Materialidad                                | Corrección incorporada                           |
| -------------------------------------------- | ------------------------------------------- | ------------------------------------------------ |
| _Escenario concreto capaz de romper el plan_ | _Baja / Media / Alta / Crítica, con motivo_ | _Cambio realizado en el plan o riesgo pendiente_ |

Un hallazgo material sin corrección debe reflejarse en riesgos, stop conditions y estado de
autorización. No se borra para hacer parecer que el primer borrador era completo.

## 5. Decisiones de negocio

No inventar decisiones materiales ni disfrazarlas de preferencias técnicas. Cuando una decisión no
sea derivable de las fuentes, presentar:

1. contexto y evidencia disponible;
2. alternativas reales;
3. recomendación razonada;
4. impacto funcional, técnico y operativo de cada alternativa;
5. decisión exacta requerida de Joel.

El plan debe detenerse con:

`PLAN REQUIRES TARGETED DOMAIN DECISION`

cuando la decisión afecte a dinero, permisos, datos, estados, contratos, clientes, responsabilidad
operativa, publicación, reserva, venta, borrado o backfill.

La señal identifica un bloqueo dirigido, no invalida el trabajo ya verificado. El plan debe indicar
qué secciones quedan abiertas y qué evidencia permitirá reanudarlo.

## 6. Estructura mínima obligatoria del plan final

Todo plan material debe contener, como mínimo y de forma localizable, las secciones A–U:

| Sección                                    | Contenido mínimo                                                                          |
| ------------------------------------------ | ----------------------------------------------------------------------------------------- |
| **A. Objetivo**                            | Problema, usuario afectado, resultado y señal de éxito.                                   |
| **B. Baseline verificado**                 | Estado actual clasificado con las cinco etiquetas y evidencia reproducible.               |
| **C. Alcance**                             | Conductas, sistemas, datos y entornos incluidos.                                          |
| **D. Exclusiones**                         | Límites explícitos y trabajo deliberadamente diferido.                                    |
| **E. Decisiones de negocio**               | Decisiones vigentes, opciones abiertas y resolución exacta requerida.                     |
| **F. Flujo funcional**                     | Flujo principal, alternativos, errores y recuperación.                                    |
| **G. Estados e invariantes**               | Estado inicial/final, transiciones, terminalidad, bypasses y reglas inquebrantables.      |
| **H. Permisos**                            | Matriz de actores y acciones, enforcement server-side, RLS y casos negativos.             |
| **I. Modelo de datos y migraciones**       | Schema, constraints, índices, DML, backfill, legacy, orden y compatibilidad.              |
| **J. Writers y readers**                   | Inventario completo, incluido SQL raw, jobs, integraciones y consumidores indirectos.     |
| **K. Concurrencia e idempotencia**         | Carreras, raíz de coordinación, CAS/locks/constraints, reintentos y claves.               |
| **L. Efectos secundarios e integraciones** | Matching, KPIs, Activities, notificaciones, storage, caché, catálogo y proveedores.       |
| **M. UX y errores**                        | Estados vacíos, loading, bloqueos, mensajes, recuperación, accesibilidad y dispositivos.  |
| **N. Tests**                               | Casos unitarios, integración PostgreSQL, autorización, concurrencia, E2E y regresión.     |
| **O. Rollout**                             | Orden preflight → DB → cliente → postflight → smoke → observación, con responsables.      |
| **P. Rollback y stop conditions**          | Reversión por capa, mitigación, umbrales de aborto y datos no reversibles.                |
| **Q. Observabilidad**                      | Logs, Sentry, métricas, auditoría, contexto seguro, alertas y ventana de observación.     |
| **R. Documentación**                       | Fuentes de verdad, runbooks, release y estados que deben actualizarse.                    |
| **S. Riesgos y deuda explícita**           | Probabilidad, impacto, mitigación, owner y fecha o condición de resolución.               |
| **T. Criterios de aceptación**             | Resultados observables, verificables y trazables a tests o evidencia.                     |
| **U. Estado de autorización**              | Uno de los cuatro estados permitidos, alcance autorizado, prohibiciones y siguiente gate. |

Un plan no puede finalizar únicamente con una lista de archivos. Las rutas sirven como evidencia y
mapa de implementación, no como sustituto de la conducta, los riesgos y las garantías.

## 7. Matriz de completitud

Todo plan termina con esta matriz. No marcar «Sí» sin evidencia concreta:

| Área                       | Revisada (Sí/No) | Evidencia | Riesgo pendiente |
| -------------------------- | ---------------- | --------- | ---------------- |
| Dominio                    |                  |           |                  |
| Estados                    |                  |           |                  |
| Permisos                   |                  |           |                  |
| Concurrencia               |                  |           |                  |
| Idempotencia               |                  |           |                  |
| Datos                      |                  |           |                  |
| Legacy                     |                  |           |                  |
| Migración                  |                  |           |                  |
| Compatibilidad             |                  |           |                  |
| Readers                    |                  |           |                  |
| Efectos secundarios        |                  |           |                  |
| Caché/superficies públicas |                  |           |                  |
| Observabilidad             |                  |           |                  |
| Rollout                    |                  |           |                  |
| Rollback                   |                  |           |                  |
| Documentación              |                  |           |                  |

### 7.1 Ejemplo cumplimentado

Ejemplo ilustrativo y realista: plan para hacer idempotente la creación de una reserva y evitar que
dos compradores reserven simultáneamente el mismo vehículo. Las referencias a secciones son la
evidencia que un plan de ese cambio debería contener; el ejemplo no declara que la funcionalidad esté
implementada en el repositorio.

| Área                       | Revisada (Sí/No) | Evidencia                                                                                                          | Riesgo pendiente                                            |
| -------------------------- | ---------------- | ------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------- |
| Dominio                    | Sí               | Sección G: invariante «un vehículo tiene como máximo una reserva activa».                                          | Falta decisión sobre caducidad automática.                  |
| Estados                    | Sí               | Secciones F–G: transición `DISPONIBLE → RESERVADO`; cancelación vuelve a `DISPONIBLE`.                             | Reapertura tras pago fallido pendiente de negocio.          |
| Permisos                   | Sí               | Sección H: matriz ADMIN/AGENTE; guard server-side y casos negativos cross-entity.                                  | Ninguno identificado.                                       |
| Concurrencia               | Sí               | Sección K: transacción PostgreSQL y constraint parcial para una reserva activa por vehículo; test con dos writers. | Contención bajo carga aún no medida.                        |
| Idempotencia               | Sí               | Sección K: clave persistida vinculada a vehículo, comprador y payload; mismo resultado al reintentar.              | Política de retención de claves por confirmar.              |
| Datos                      | Sí               | Sección I: nulabilidad, FK, `CHECK`, timestamps y política de borrado lógico.                                      | Ninguno identificado.                                       |
| Legacy                     | Sí               | Sección I: reservas históricas sin clave se conservan; no se les aplica backfill inventado.                        | Filas incoherentes requieren informe preflight.             |
| Migración                  | Sí               | Sección O: migración aditiva, preflight de duplicados, índice y postflight de constraints.                         | El contract posterior queda fuera de este cambio.           |
| Compatibilidad             | Sí               | Secciones I y O: schema nuevo tolera cliente anterior; cliente nuevo se despliega sólo tras DB.                    | Ventana dual sin UI de idempotencia.                        |
| Readers                    | Sí               | Sección J: ficha de vehículo, listado de reservas, KPIs, jobs de caducidad y exportaciones inventariados.          | Integración externa de financiación pendiente de confirmar. |
| Efectos secundarios        | Sí               | Sección L: Activity una sola vez, notificación post-commit y KPI basado en reserva canónica.                       | Retry del proveedor de email se valida por separado.        |
| Caché/superficies públicas | Sí               | Sección L: invalidar ficha pública y listado de disponibilidad después del commit.                                 | TTL externo del portal no está bajo control directo.        |
| Observabilidad             | Sí               | Sección Q: métrica de conflictos, retries y fallos; Sentry sin PII; auditoría de transición.                       | Umbral de alerta se calibra durante observación.            |
| Rollout                    | Sí               | Sección O: preflight, migración, deploy, smoke concurrente y ventana de 24 h.                                      | Requiere autorización separada para producción.             |
| Rollback                   | Sí               | Sección P: rollback de cliente; schema aditivo permanece; stop si hay doble reserva o errores >1 %.                | Deshacer reservas creadas exige decisión operativa.         |
| Documentación              | Sí               | Sección R: modelo de estados, runbook de conflictos, release y registro de decisión.                               | Ninguno identificado.                                       |

La matriz no reemplaza el análisis: resume y enlaza su evidencia.

## 8. Criterio de autorización

Al final del plan debe aparecer **exactamente uno** de estos estados:

- `PLAN READY FOR INDEPENDENT REVIEW`
- `PLAN REQUIRES TARGETED CORRECTION`
- `PLAN REQUIRES TARGETED DOMAIN DECISION`
- `PLAN BLOCKED — INSUFFICIENT REPOSITORY OR ENVIRONMENT EVIDENCE`

El bloque de autorización debe indicar además:

1. qué está permitido después de aprobar el plan;
2. qué continúa expresamente prohibido;
3. cuál es el siguiente gate.

Un plan no autoriza automáticamente implementación, migración, commit, push, PR, merge, staging ni
producción. `PLAN READY FOR INDEPENDENT REVIEW` significa que el plan puede revisarse; no que el
cambio pueda ejecutarse.

El estado se selecciona así:

| Estado                                                           | Criterio                                                                                                                                 |
| ---------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| `PLAN READY FOR INDEPENDENT REVIEW`                              | Baseline suficiente, secciones A–U completas, revisión adversarial registrada, matriz con evidencia y ninguna decisión material abierta. |
| `PLAN REQUIRES TARGETED CORRECTION`                              | El alcance es decidible, pero existen defectos concretos de completitud, coherencia o mitigación que deben corregirse.                   |
| `PLAN REQUIRES TARGETED DOMAIN DECISION`                         | Falta una decisión material de negocio en alguno de los ámbitos del §5.                                                                  |
| `PLAN BLOCKED — INSUFFICIENT REPOSITORY OR ENVIRONMENT EVIDENCE` | No existe evidencia suficiente para afirmar el baseline o diseñar garantías seguras.                                                     |

## 9. Prompts operativos posteriores

Una vez aprobado el plan, toda instrucción de ejecución debe:

- referenciar el plan canónico y su versión o commit;
- incorporar sus decisiones vinculantes;
- declarar la autorización exacta;
- conservar las exclusiones;
- incluir stop conditions;
- exigir evidencia de cada resultado;
- identificar el siguiente gate;
- usar con precisión los estados operativos siguientes.

| Estado operativo | Significado permitido                                                                 | Evidencia mínima                                                       |
| ---------------- | ------------------------------------------------------------------------------------- | ---------------------------------------------------------------------- |
| **Preparado**    | Artefacto o acción listo para ejecutar, pero aún no ejecutado.                        | Diff, script, comando o checklist disponible.                          |
| **Implementado** | Cambio realizado en el working tree y validado localmente según el alcance declarado. | Diff y resultados locales; no implica commit ni remoto.                |
| **Commit**       | Cambio incluido en un commit local identificable.                                     | SHA local y árbol limpio respecto de ese alcance.                      |
| **Push**         | Commit enviado a una rama remota.                                                     | Rama remota y SHA verificados.                                         |
| **PR**           | Pull request abierto con el SHA y alcance correctos.                                  | URL/identificador, head SHA y estado del PR.                           |
| **CI**           | Checks remotos ejecutados con resultado conocido.                                     | Nombres, estado y ejecución vinculada al SHA; «pendiente» no es verde. |
| **Migrado**      | Migración aplicada al entorno nombrado y verificada.                                  | Entorno, versión/migration ID, preflight/postflight y resultado.       |
| **Fusionado**    | PR integrado en la rama objetivo.                                                     | Merge/squash SHA presente en la rama remota objetivo.                  |
| **Desplegado**   | Versión concreta desplegada en el entorno nombrado.                                   | Deployment ID/URL, commit y estado del proveedor.                      |
| **Validado**     | Criterios funcionales/técnicos comprobados en el entorno nombrado.                    | Smoke/tests/consultas y resultados trazables.                          |
| **Observado**    | Señales post-despliegue revisadas durante la ventana definida.                        | Intervalo, métricas/logs/Sentry/KPIs, resultado y decisión.            |

No declarar ejecutado lo que sólo está propuesto o preparado. Los estados no se heredan: por ejemplo,
un PR con CI verde no está fusionado; un commit fusionado no está necesariamente desplegado; un
deploy no está validado ni observado por el mero hecho de finalizar.

Los prompts operativos deben seguir también las autorizaciones y los 18 pasos del
[proceso universal de cambios de ingeniería](engineering-change-process.md).

## 10. Relación con el proceso de cambios existente

Este estándar y los documentos relacionados tienen responsabilidades complementarias:

| Documento                                                        | Responsabilidad                                                                                          |
| ---------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------- |
| Este estándar                                                    | Gobierna la calidad, evidencia, completitud y autorización del plan antes de implementar.                |
| [`engineering-change-process.md`](engineering-change-process.md) | Gobierna clasificación C0–C9, riesgo y ejecución del cambio mediante sus 18 pasos.                       |
| [`claude-codex-division.md`](claude-codex-division.md)           | Distribuye trabajo entre Claude y Codex sin delegar integridad global ni responsabilidad arquitectónica. |
| [`CLAUDE.md`](../../CLAUDE.md)                                   | Activa de forma breve y vinculante estas obligaciones para el trabajo cotidiano del repositorio.         |

No se contradicen ni se duplican. Ante un plan material se aplica primero este estándar; tras su
revisión y una autorización explícita, la ejecución continúa bajo
[`engineering-change-process.md`](engineering-change-process.md). La aprobación del plan no omite
ningún gate posterior.
