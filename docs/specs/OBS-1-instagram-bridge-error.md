# OBS-1 — Distinguir el error del puente de Instagram de los errores del formulario

| Campo               | Valor                                                                                   |
| ------------------- | --------------------------------------------------------------------------------------- |
| **Estado**          | DEPLOYED                                                                                |
| **Owner**           | Engineering                                                                             |
| **Ticket**          | Alerta CAMPERNOVA-CRM-1K enviada por el usuario el 2026-10-15                           |
| **Rama / PR**       | [PR #201](https://github.com/growthaiconsultant-lab/campernova-crm/pull/201), fusionada |
| **Categorías**      | C0, C9                                                                                  |
| **Riesgo**          | Medio: evitar ocultar errores propios en observabilidad                                 |
| **Ruta SDD**        | Estándar: filtro cliente acotado, sin datos, permisos ni lógica de envío                |
| **Última revisión** | 2026-10-15                                                                              |

## Problema y evidencia

Baseline `origin/main` en `64e2306ab3997e2bd96decc19bf375b7374d78be`, checkout limpio.
El usuario adjunta una alerta de producción de /vender/empezar.
[Sentry CAMPERNOVA-CRM-1K](https://ai-marketing-solutions.sentry.io/issues/153844647/)
registra cinco eventos, 100% en Instagram 451.0.0 sobre iOS, al revisar la incidencia.
El evento recomendado tiene tipo InvalidAccessError y mensaje
`The object does not support the operation or argument.`. La traza muestra
postMessage nativo y dispatchToBridge → sendPostMessage → logSubmitButtonClicked
en `app:///`, seguida de un frame anónimo del mismo script.
Esas funciones no aparecen en app, components, lib ni public del repositorio.
La inferencia es que procede del puente inyectado por Instagram, no de nuestro bundle.
La alerta no demuestra si el envío terminó guardándose; no se afirma ausencia de impacto.

## Resultado esperado

Descartar únicamente ese error del puente en Instagram/iOS antes de enviarlo a Sentry.
Los demás errores, incluso InvalidAccessError, deben conservarse. Sin alterar el
formulario, envíos, permisos, muestreo ni masking de Replay.

## Reglas e invariantes

- Exigir user-agent de Instagram/iOS, tipo y mensaje exactos, una única excepción
  y las tres funciones identificadas dentro del mismo script `app:///`.
- No confiar en `in_app`: Sentry marca esos frames como In App aunque sean inyectados.
- Aceptar sólo frames de las tres funciones, un frame anónimo del script y
  postMessage nativo opcional. Cualquier frame de aplicación u origen desconocido
  conserva el evento completo, al igual que excepciones encadenadas.
- Datos incompletos o firma distinta conservan el evento. No incluir datos de
  contacto, payloads del formulario ni nuevos logs/tags.
- No suprimir globalmente InvalidAccessError, Instagram ni los eventos de esa URL.

## Fuera de alcance

Modificar el código interno de Instagram, el formulario o el backend; atribuir la
pérdida de una solicitud sin evidencia; modificar/resolver la incidencia en Sentry;
operaciones sobre datos de producción. El usuario autorizó el 2026-10-15 subir el
ajuste, fusionar la PR y desplegarlo; no se requieren migraciones ni cambios en Sentry.

## Decisiones

| Decisión                     | Alternativas                                         | Resolución y motivo                                                             |
| ---------------------------- | ---------------------------------------------------- | ------------------------------------------------------------------------------- |
| Filtro                       | ignoreErrors por mensaje / filtro de firma           | beforeSend con firma completa; conserva errores legítimos                       |
| Identificación del navegador | Contexto enriquecido por Sentry / user-agent cliente | Leer user-agent localmente al procesar; no depende de enriquecimiento posterior |
| Evidencia insuficiente       | Afirmar envío correcto / reconocer límite            | El evento no acredita persistencia; no modificar datos reales para comprobarlo  |

## Plan técnico

1. Función pura tipada para decidir si el evento coincide con la firma conocida.
2. Integrar beforeSend sólo en configuración cliente; conservar el objeto original.
3. Tests de regresión positivos y negativos, integración de configuración, tipos,
   lint, SDD, formato y diff. Actualizar la descripción canónica de observabilidad.

### Impacto

- **Código y consumidores:** sentry.client.config.ts y helper cliente de observabilidad.
- **Datos/migraciones:** N/A, sin lecturas/escrituras de base de datos.
- **Permisos/seguridad:** N/A, sin cambios de acceso; no nuevos datos en telemetría.
- **Concurrencia/idempotencia:** N/A, filtro puro sin estado ni efectos.
- **Integraciones/efectos externos:** sólo se evita transmitir la firma conocida a Sentry.
- **Observabilidad/KPIs:** resto de errores, Replay y métricas sin cambios; no fuente canónica de envíos.

## Criterios de aceptación

- [x] La firma completa de Instagram/iOS se descarta sin depender de línea/columna.
- [x] Errores propios, mixtos, encadenados, sin stack o en otros navegadores se conservan.
- [x] beforeSend conserva identidad del evento para errores legítimos y no altera otras opciones.
- [x] Tipos, lint, tests focalizados, SDD, formato y diff superados.

## Verificación

| Criterio                          | Evidencia prevista                               | Resultado                                                                       |
| --------------------------------- | ------------------------------------------------ | ------------------------------------------------------------------------------- |
| Firma conocida y falsos positivos | Unitarios del helper                             | Superados; incluye traza sintética con el parser de navegador del SDK instalado |
| Wiring y opciones intactas        | Test de Sentry.init con SDK simulado             | Superado; 25 tests focalizados en total                                         |
| Estática y revisión               | Typecheck, lint, SDD, formato y git diff --check | Superados                                                                       |
| Regresión global                  | pnpm test                                        | 141 archivos y 1.835 tests superados                                            |

## Rollout, rollback y stop conditions

- **Rollout:** publicación autorizada el 2026-10-15 tras revisar el cambio concreto:
  commit/push/PR, CI y Preview, merge con checks requeridos verdes y verificación de
  producción. No mutar la incidencia en Sentry ni datos de compradores/vendedores.
- **Rollback:** retirar beforeSend; los errores vuelven a registrarse, sin pérdida de datos de negocio.
- **Detener si:** la traza contiene código propio, los tests conservadores fallan o se
  pretende ampliar el filtro a errores no identificados.
- **Validación post-despliegue:** revisar nuevos eventos de la firma y errores reales
  del formulario durante una ventana explícita. No afirmar corrección del navegador
  ni validación de envíos por la reducción de alertas.

## Revisión adversarial

| Riesgo intentado                               | Mitigación o riesgo pendiente                                                         |
| ---------------------------------------------- | ------------------------------------------------------------------------------------- |
| Ocultar un error propio con el mismo mensaje   | Exigir las tres funciones y todos los frames conocidos                                |
| Error mixto o excepción encadenada             | Conservar evento completo                                                             |
| SDK no aporta stack o cambia la firma          | Conservar; puede seguir habiendo ruido                                                |
| Filtro elimina diagnóstico de un envío fallido | No elimina errores del backend/formulario; no usar Sentry como prueba de persistencia |

## Cierre

- **Commit/PR:** PR #201 fusionada el 2026-10-15; main
  `d49405466cd83bb2cb35db879fde8c4f4793c57d`.
- **CI:** [run 38747474542](https://github.com/growthaiconsultant-lab/campernova-crm/actions/runs/38747474542)
  superado: quality (tipos, lint, SDD y 1.835 unitarios), integración PostgreSQL,
  migration-replay y Supabase Storage. Preview Vercel READY
  `dpl_4Sim8GcMZ6duvbzJxwVYGrUsdu2X`; formulario cargado sin errores de consola.
- **Producción:** deployment `dpl_AGZ5JHUBQuqzc4wmfVqZBQESvPy9` READY y asociado
  al commit de main por el check Vercel. Alias campersnova.com comprobado contra
  ese deployment el 2026-10-15. Formulario /vender/empezar cargado, paso Vehículo
  visible y botón Continuar habilitado; sin errores de consola en la comprobación.
- **Validación:** implementación local, 25 tests focalizados y 1.835 unitarios
  completos, typecheck, lint, SDD y formato/diff superados. El primer ensayo del
  parser resolvía el entrypoint Node del SDK y no reconocía sintaxis Safari;
  corregido para cargar el parser de navegador instalado, con prueba verde.
  Integración DB/replay/Storage sí ejecutados por CI; E2E de envío no aplica al filtro
  y no se ejecutó. No se creó un lead durante las comprobaciones de navegador.
- **Deuda restante:** observación con tráfico real posterior; el
  resultado de guardado del envío afectado no se ha determinado.
