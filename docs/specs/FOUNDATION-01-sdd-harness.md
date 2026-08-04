# FOUNDATION-01 — Implantar SDD ligero y un harness verificable

| Campo               | Valor                                |
| ------------------- | ------------------------------------ |
| **Estado**          | IMPLEMENTED                          |
| **Owner**           | Engineering                          |
| **Ticket**          | FOUNDATION-01                        |
| **Rama / PR**       | `codex/project-takeover` / pendiente |
| **Categorías**      | C0, C9                               |
| **Riesgo**          | Medio                                |
| **Ruta SDD**        | Estándar                             |
| **Última revisión** | 2026-08-03                           |

## Problema y evidencia

El repositorio ya tiene gobierno técnico detallado, pero la entrada cotidiana está fragmentada y es
desproporcionada: `AGENTS.md` mezcla instrucciones duraderas con un histórico de implementación,
Linear no refleja el estado desplegado y el proceso universal exige hasta 18 pasos y planes A–U sin
una ruta ligera explícita. Además, el workflow E2E puede terminar verde sin ejecutar Playwright.

Esto aumenta contexto, documentación contradictoria y falsa confianza aunque la ingeniería de
dominio sea sólida.

## Resultado esperado

- Existe una única guía breve para pasar de necesidad a cambio verificable.
- Los cambios se enrutan por riesgo: rápido, estándar o reforzado.
- `AGENTS.md` contiene sólo reglas estables y enlaces canónicos.
- Una plantilla única sirve como spec y plan para cambios normales.
- PR y documentación distinguen claramente `ejecutado`, `desplegado` y `validado`.
- Un E2E omitido no se interpreta como prueba ejecutada.

## Reglas e invariantes

- No rebajar los gates existentes para dinero, permisos, migraciones, concurrencia o producción.
- No introducir librerías ni un generador SDD externo en FOUNDATION-01.
- Git history conserva la documentación retirada de `AGENTS.md`; no se duplica como archivo legacy.
- El código desplegado describe el comportamiento actual; la spec aprobada describe la intención.
- Los cambios remotos y de producción continúan requiriendo autorización explícita.

## Fuera de alcance

- Reparar cron, E2E o staging.
- Reconciliar todos los tickets de Linear.
- Reescribir todos los documentos históricos.
- Instalar GitHub Spec Kit u otra dependencia.

## Decisiones

| Decisión                           | Alternativas                        | Resolución y motivo                                                          |
| ---------------------------------- | ----------------------------------- | ---------------------------------------------------------------------------- |
| Artefacto por cambio               | Spec + plan separados / único brief | Brief único en la ruta estándar para evitar duplicación.                     |
| Cambios críticos                   | Mismo brief / plan completo         | Ruta reforzada mantiene el estándar A–U existente.                           |
| Estado del proyecto en `AGENTS.md` | Snapshot manual / fuentes enlazadas | Se elimina el snapshot porque se vuelve obsoleto.                            |
| Herramienta SDD                    | Instalar framework / proceso nativo | Proceso nativo primero; se evaluará tooling sólo con un problema demostrado. |

## Plan técnico

1. Añadir `docs/governance/sdd-workflow.md` y la plantilla de change brief.
2. Reducir `AGENTS.md` a instrucciones duraderas, comandos y routing.
3. Simplificar la plantilla de PR y enlazarla al brief.
4. Añadir `check:sdd` al job `quality` sin dependencias externas.
5. Actualizar los índices y la descripción real de staging/E2E.
6. Crear CRON-01 como primer change brief reforzado, sin implementar todavía el fix.

### Impacto

- **Código y consumidores:** sólo documentación, plantillas e instrucciones de agentes.
- **Datos/migraciones:** ninguno.
- **Permisos/seguridad:** no cambia permisos; refuerza autorización de mutaciones remotas.
- **Concurrencia/idempotencia:** N/A.
- **Integraciones/efectos externos:** ninguno durante esta implementación.
- **Observabilidad/KPIs:** aclara que checks omitidos no son evidencia verde.

## Criterios de aceptación

- [x] Existe routing proporcional y Definition of Done.
- [x] Existe una plantilla estándar reutilizable.
- [x] `AGENTS.md` no contiene backlog ni estado de features.
- [x] La plantilla de PR pide evidencia sin obligar a rellenar secciones irrelevantes.
- [x] CI valida briefs, estados, enlaces y tamaño estable de `AGENTS.md`.
- [x] CONTRIBUTING y CI no afirman que staging/E2E estén configurados cuando no lo están.
- [x] CRON-01 queda especificado sin tocar producción.
- [x] Enlaces canónicos, estructura SDD y whitespace validados sobre el diff final.

## Verificación

| Criterio               | Evidencia prevista                                     | Resultado                                                      |
| ---------------------- | ------------------------------------------------------ | -------------------------------------------------------------- |
| Rutas y estructura SDD | `node scripts/check-sdd.mjs`                           | OK: 2 briefs y enlaces canónicos válidos                       |
| Formato                | `pnpm exec prettier --check ...`                       | No ejecutado: dependencias locales incompletas y red bloqueada |
| Scope                  | `git diff --check`, `git diff --stat`, revisión manual | OK; pendiente revisión humana final                            |
| Seguridad              | Búsqueda de patrones de secretos en el diff            | OK                                                             |

## Rollout, rollback y stop conditions

- **Rollout:** PR documental; no requiere producción ni migración.
- **Rollback:** revertir el commit; el `AGENTS.md` anterior permanece en Git history.
- **Detener si:** una regla duradera necesaria sólo existe en el snapshot eliminado y no queda
  enlazada o preservada en la versión breve.
- **Validación post-despliegue:** usar el proceso con CRON-01 y ajustar tras el primer PR real.

## Revisión adversarial

| Riesgo intentado                                     | Mitigación o riesgo pendiente                                     |
| ---------------------------------------------------- | ----------------------------------------------------------------- |
| El flujo ligero permite saltarse seguridad           | La ruta reforzada es obligatoria para C4–C8 sensibles.            |
| La spec se convierte en otro estado duplicado        | Se separan explícitamente intención, implementación y producción. |
| Eliminar detalles de `AGENTS.md` pierde conocimiento | Se enlazan fuentes canónicas y Git conserva el histórico.         |
| Plantillas generan burocracia                        | La ruta rápida no exige archivo de spec.                          |

## Cierre

- **Commit:** pendiente.
- **PR:** pendiente.
- **CI:** pendiente.
- **Deployment:** N/A.
- **Validación:** `check:sdd`, sintaxis Node/JSON, enlaces, whitespace y secretos verificados;
  Prettier no ejecutado por dependencias incompletas.
- **Deuda restante:** reconciliar Linear y reparar el harness real en tickets separados.
