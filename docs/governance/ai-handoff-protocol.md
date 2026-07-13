# Protocolo de comunicación y handoff para agentes de IA

| Campo                            | Valor                                                                                                                                                                                                                                                                                               |
| -------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Título**                       | Cómo un agente comunica y entrega resultados de forma verificable                                                                                                                                                                                                                                   |
| **Estado**                       | ACTIVE                                                                                                                                                                                                                                                                                              |
| **Owner**                        | Engineering                                                                                                                                                                                                                                                                                         |
| **Co-owners**                    | Architecture · Product · Operations                                                                                                                                                                                                                                                                 |
| **Última revisión**              | 2026-07-13                                                                                                                                                                                                                                                                                          |
| **Fuente de verdad relacionada** | Este documento (**comunicación de resultados**). Proceso del trabajo: [`engineering-change-process.md`](engineering-change-process.md). Testing: [`testing-strategy.md`](testing-strategy.md). Plantilla de PR: [`../../.github/PULL_REQUEST_TEMPLATE.md`](../../.github/PULL_REQUEST_TEMPLATE.md). |
| **Alcance**                      | El **formato** de la respuesta del agente: cómo presentar evidencia, distinguir hechos de inferencias, y hacer el resultado revisable por otra persona o agente.                                                                                                                                    |
| **Fuera de alcance**             | Cómo hacer el trabajo (eso es [`engineering-change-process.md`](engineering-change-process.md)); flujo git y commits ([`../../CONTRIBUTING.md`](../../CONTRIBUTING.md)); qué probar ([`testing-strategy.md`](testing-strategy.md)).                                                                 |

> Este documento **complementa**, no sustituye, [`engineering-change-process.md`](engineering-change-process.md).
> Aquel gobierna **cómo se hace** el cambio; este gobierna **cómo se comunica** el resultado. Enlaza a
> él; no repite su contenido.

## Objetivo

Una respuesta debe ser **autosuficiente**: poder copiarse íntegra y entregarse a otra persona o agente
para revisión **sin depender del contexto completo de la conversación**.

El formato es **proporcional al riesgo**. No se escribe un informe enorme para una pregunta simple; sí
se documenta con detalle un merge o una operación sobre datos. Ver los niveles A–F en §2.

---

## 1. Principios obligatorios

### 1.1 Evidencia antes que narrativa

- No afirmar "todo correcto" sin indicar la evidencia (comando, check, archivo, resultado).
- No presentar una prueba **no ejecutada** como superada.
- No presentar una acción **preparada** como ejecutada.
- No presentar código **fusionado** como **desplegado**.
- No presentar un **deployment inmediato** como **observación operativa completada**.

### 1.2 Separación de tipos de afirmación

Diferenciar sin mezclar de forma engañosa:

- **`HECHO VERIFICADO`** — observado directamente en código, Git, CI, infraestructura o datos.
- **`INFERENCIA`** — conclusión razonable derivada de evidencia, pero no verificada directamente.
- **`RECOMENDACIÓN`** — siguiente acción propuesta.
- **`DESCONOCIDO`** — información que no pudo comprobarse.

No hace falta etiquetar cada frase cuando el contexto ya es inequívoco; sí es obligatorio no
presentar una inferencia o una recomendación como si fueran un hecho verificado.

### 1.3 Acciones ejecutadas y no ejecutadas

La respuesta distingue expresamente: acciones **realizadas** · **no realizadas** · **fallidas** ·
que **requieren autorización** · que estaban **fuera de alcance**.

### 1.4 Entornos y niveles de validación

Diferenciar siempre que sea relevante: **inspección estática** · **ejecución local** · **CI** ·
**Preview** · **staging** · **producción** · **validación inmediata** · **observación posterior**.
Un check verde en un entorno no se presenta como validación en otro.

### 1.5 Incertidumbre

- Declarar las limitaciones reales.
- No rellenar huecos con suposiciones.
- No ocultar fallos para presentar un resultado más limpio.
- No declarar producción sana solo porque el build terminó.
- No declarar un dato remoto cuando no hay acceso verificable (marcar `DESCONOCIDO`).

### 1.6 Identificadores verificables

Cuando existan y sean relevantes, incluir: rama · commit · PR · archivos modificados · checks ·
deployment · entorno · migraciones · tests ejecutados. **Nunca** incluir secretos, credenciales, PII
ni identificadores internos innecesarios (ver [`security-and-secrets.md`](security-and-secrets.md)).

---

## 2. Niveles de respuesta (proporcionales)

Elegir el nivel más bajo que cubra la interacción. No inflar el formato.

### Nivel A — Respuesta simple

Para preguntas directas, aclaraciones, explicación de código, decisiones sin cambios.
**Formato:** (1) respuesta directa; (2) evidencia/referencia si procede; (3) incertidumbre relevante;
(4) recomendación solo si es necesaria. **No** generar un informe de implementación.

### Nivel B — Análisis técnico

Para investigación, diagnóstico, diseño, revisión de arquitectura, causa raíz.
**Formato mínimo:** (1) objetivo analizado; (2) hallazgos; (3) evidencia; (4) riesgos; (5) hechos no
verificados; (6) recomendación. **No** afirmar que se ha implementado nada.

### Nivel C — Implementación local

Para cambios preparados pero no publicados.
**Formato mínimo:** (1) estado; (2) comportamiento implementado; (3) archivos modificados;
(4) decisiones técnicas; (5) tests ejecutados; (6) tests no ejecutados; (7) riesgos y limitaciones;
(8) estado de Git; (9) acciones no realizadas; (10) siguiente autorización necesaria.

### Nivel D — PR publicado

**Formato mínimo:** (1) rama; (2) commit; (3) PR; (4) lista de archivos; (5) resumen del diff;
(6) tests locales; (7) resultados de CI; (8) riesgos; (9) cambios de datos o infraestructura;
(10) confirmación de que no se hizo merge cuando no estaba autorizado; (11) recomendación sobre
readiness.

### Nivel E — Merge, despliegue u operación sensible

Para merge · producción · migraciones · backfill · permisos · autenticación · datos · rollback ·
operaciones destructivas.
**Formato mínimo:** (1) autorización recibida; (2) estado previo; (3) acciones ejecutadas; (4) commit
fusionado; (5) CI; (6) deployment y entorno; (7) cambios de datos; (8) validación inmediata;
(9) errores observados; (10) rollback disponible o ejecutado; (11) observación pendiente; (12) estado
final; (13) siguiente decisión requerida.

### Nivel F — Bloqueo o fallo

**Formato mínimo:** (1) tarea bloqueada; (2) punto exacto del bloqueo; (3) evidencia; (4) acciones
intentadas; (5) acciones descartadas por seguridad; (6) impacto; (7) información o autorización
necesaria; (8) recomendación segura. **No** ampliar alcance para evitar el bloqueo.

---

## 3. Plantilla de handoff estándar (Niveles C–E)

Copiable tal cual. Omitir las secciones que no apliquen; no inventar contenido para rellenarlas.

```text
Estado
- Estado exacto del trabajo.

Objetivo
- Qué problema debía resolverse.

Cambios
- Qué se modificó. Archivos relevantes.

Decisiones
- Decisiones técnicas importantes. Invariantes preservados.

Evidencia
- Tests locales. CI. Inspecciones o consultas realizadas.

Limitaciones
- Qué no pudo verificarse. Qué pruebas no se ejecutaron.

Riesgos
- Riesgos conocidos. Blast radius. Compatibilidad y rollback.

Acciones ejecutadas
- Git, PR, merge, deployment, datos o infraestructura.

Acciones no ejecutadas
- Operaciones fuera de alcance o pendientes de autorización.

Estado final
- Rama, commit, PR, entorno y working tree.

Decisión requerida
- Acción concreta que necesita autorización.

Recomendación
- Siguiente paso más seguro.
```

---

## 4. Relación con el resto del gobierno

- **Qué hacer y cuándo bloquear:** [`engineering-change-process.md`](engineering-change-process.md)
  (clasificación C0–C9, riesgo, 18 pasos, criterios de bloqueo, validación post-despliegue).
- **Qué probar y a qué nivel:** [`testing-strategy.md`](testing-strategy.md).
- **Qué escribir en el PR:** [`../../.github/PULL_REQUEST_TEMPLATE.md`](../../.github/PULL_REQUEST_TEMPLATE.md).
- **Secretos y datos que nunca se exponen:** [`security-and-secrets.md`](security-and-secrets.md).

Regla de oro: **no declarar implementado, desplegado, validado u observado nada que no lo esté** — con
la evidencia al lado.
