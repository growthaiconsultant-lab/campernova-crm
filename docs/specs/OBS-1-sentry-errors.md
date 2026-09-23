# OBS-1 — Recuperación de errores y diagnóstico fiable de Sentry

| Campo               | Valor                                                                                                   |
| ------------------- | ------------------------------------------------------------------------------------------------------- |
| **Estado**          | DEPLOYED                                                                                                |
| **Owner**           | Engineering                                                                                             |
| **Ticket**          | OBS-1; solicitud del usuario de corregir las incidencias de Sentry                                      |
| **Rama / PR**       | codex/obs-1-sentry-errors; [PR #183](https://github.com/growthaiconsultant-lab/campernova-crm/pull/183) |
| **Categorías**      | C1, C3, C9                                                                                              |
| **Riesgo**          | Medio                                                                                                   |
| **Ruta SDD**        | Reforzada para persistencia y concurrencia del reordenado                                               |
| **Última revisión** | 2026-09-23                                                                                              |

**Entorno del estado DEPLOYED: únicamente Vercel Preview.** PR abierta, sin merge ni despliegue
de OBS-1 en producción. La validación integral y el cierre de incidencias siguen pendientes.

## Problema y evidencia

Base verificada: main `72dbc47af1f337e58e62475e79d5e991a769b032`.
Inventario observado en Sentry: diez incidencias abiertas con actividad en 14 días. Los recuentos
del feed y del detalle tienen ventanas diferentes; no equivalen a usuarios afectados.

| Incidencia                                                                                                                                                                                                         | Evidencia                                                                                           | Tratamiento / límite                                                                                                                                           |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [CRM-1G](https://ai-marketing-solutions.sentry.io/issues/148693603/)                                                                                                                                               | Loader webpack: `a[e] is not a function`, dashboard, 22/09 14:21:40 UTC, release `05167ce25220`     | Fallo de carga anterior a SELLERS-1; skew de versiones es hipótesis, no causa demostrada. Mejorar diagnóstico, no ocultar el error.                            |
| [CRM-6](https://ai-marketing-solutions.sentry.io/issues/119160249/)                                                                                                                                                | `null.get`, misma traza y release; reaparece después del clic en Reintentar global, 14:21:43 UTC    | Recuperación global mediante recarga explícita del documento en lugar de reset del árbol ya roto. Mitigación, no prueba de solución de la causa inicial.       |
| [CRM-A](https://ai-marketing-solutions.sentry.io/issues/125380062/) / [CRM-D](https://ai-marketing-solutions.sentry.io/issues/125503496/)                                                                          | Únicamente frames `navigation_performance_logger_android`, `sendDataToNative`, Java object is gone  | Código inyectado por navegador Android. No modificar la app ni añadir filtros generales para hacerlo desaparecer.                                              |
| [CRM-1C](https://ai-marketing-solutions.sentry.io/issues/146973404/) / [CRM-1D](https://ai-marketing-solutions.sentry.io/issues/146973841/) / [CRM-1E](https://ai-marketing-solutions.sentry.io/issues/146973865/) | Misma traza de Chrome iOS, /vender y /como-funciona, 14/09; recursión Nk/Pk en scripts de documento | Posible traducción/inyección del navegador (título traducido en breadcrumbs); pendiente reproducción y fuente. No desactivar traducción ni filtrar RangeError. |
| [CRM-G](https://ai-marketing-solutions.sentry.io/issues/127403552/)                                                                                                                                                | Hidratación de home, Edge, última muestra 19/09; detalle sin diff HTML ni stack                     | Pendiente reproducción; no suppressHydrationWarning global.                                                                                                    |
| [CRM-18](https://ai-marketing-solutions.sentry.io/issues/139262921/)                                                                                                                                               | UPDATE por foto con 13 spans repetidos; coincide con photo-actions.ts                               | Actualización parametrizada en lote, validación de conjunto y atomicidad.                                                                                      |
| [CRM-C](https://ai-marketing-solutions.sentry.io/issues/125491589/)                                                                                                                                                | GET /\_next/image, 453560 bytes; sin URL original en evidencia                                      | Aviso de rendimiento, no caída. Identificar imagen antes de degradar calidad de todo el catálogo.                                                              |

En el código base se verificó además que los tres SDK usaban NODE_ENV: un Preview compilado se etiquetaba
incorrectamente como production. Las muestras originales de chunks compartidos no estaban
desminificadas y `widenClientFileUpload` no estaba habilitado; OBS-1 corrige esa configuración.

## Resultado esperado

Recuperación explícita de la pantalla global, entornos identificables y source maps privados más
completos; reordenado de fotos sin N actualizaciones ni IDs duplicados. Cada incidencia conserva
su evidencia y estado real; ninguna se considera resuelta sólo por desplegar o silenciarla.

## Reglas e invariantes

- Autorización de OBS-1: commit, push, PR, CI y despliegue/comprobación de Preview. El 23/09 se
  completó la configuración de Sentry en Preview con las autorizaciones separadas correspondientes.
  La eliminación de la variable errónea `CN_sentry` en Production fue una corrección expresamente
  autorizada; no autoriza otros cambios allí. Sin merge, despliegue de producción ni migraciones.
- Antes de pruebas que escriban datos, verificar DATABASE_URL y DIRECT_URL contra staging.
  La identidad de Supabase Auth por sí sola no demuestra el destino de Prisma.
- Preservar requireCanGenerateAds, pertenencia de fotos, orden base cero y revalidación de ficha.
- No exponer URLs de fotos, claves, PII, ni payloads de usuarios en nuevos logs o tests.
- No reintentar escrituras automáticamente; conflicto de transacción devuelve error recuperable.
- Sin recargas automáticas que pierdan formularios: recuperación sólo por clic en error global.

## Fuera de alcance

Upgrade de Next/React, cambios de schema, filtros de Sentry, archivado/resolución de incidencias,
instalación de dependencias nuevas, modificación de producción, correcciones especulativas de iOS.

## Decisiones

| Decisión     | Alternativas                                        | Resolución y motivo                                                                                                                           |
| ------------ | --------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| Error global | reset, recarga automática, recarga explícita        | Recarga explícita: reconstruye runtime sin bucle automático.                                                                                  |
| Entorno      | NODE_ENV, VERCEL_ENV                                | VERCEL_ENV inyectado públicamente como etiqueta no secreta; fallback local.                                                                   |
| Source maps  | Publicarlos, ignorar stack, upload ampliado privado | Ampliar upload, mantener borrado del bundle público. Credencial dedicada Preview configurada con autorización separada y entrada del usuario. |
| Fotos        | N updates, lote                                     | Un UPDATE parametrizado dentro de transacción serializable; validar snapshot y abortar conflicto.                                             |

## Plan técnico

1. Capturar inventario, separar hechos/hipótesis; revisar código en rama aislada.
2. Recuperación global y configuración de observabilidad con unitarios.
3. Adapter de reordenado por lote, validación Zod server-side, unitarios e integración real preparada.
4. Typecheck/lint/tests/build proporcionales; no usar DB remota como sustituto de PostgreSQL efímero.
5. Publicación separada autorizada, Preview y observación de producción antes de cerrar issues.

### Impacto

- **Código y consumidores:** global-error, Sentry SDKs y build config, acción de ordenar fotos.
- **Datos/migraciones:** sin schema/migración; cambia sólo implementación de escritura de orden.
- **Permisos/seguridad:** mismo guard; SQL con parámetros y restricción de vehicle_id.
- **Concurrencia/idempotencia:** transacción serializable; dos reordenados producen un orden completo
  o conflicto recuperable, nunca mezcla parcial; reenviar mismo orden conserva resultado.
- **Integraciones/efectos externos:** upload privado por integración existente; configuración
  remota limitada a lo autorizado y registrada en la evidencia del 23/09.
- **Observabilidad/KPIs:** etiquetas correctas, misma captura de errores; sin cambios de negocio.

## Criterios de aceptación

- [x] Reintentar global hace una recarga por clic y no se recarga automáticamente (unitario).
- [x] Etiquetas de Preview, production y development cubiertas por unitarios; recepción real de `preview` verificada. Sin cambios de replay/privacidad. OBS-1 aún no está en producción.
- [x] Cero `.map` en `.next/static` local; upload privado a Sentry verificado en Preview; sin nuevas dependencias.
- [ ] Comprobación HTTP remota de mapas públicos: bloqueada por el navegador; no equivale a un 404.
- [x] Reordenado válido hace un UPDATE, base cero, sin tocar otros vehículos (unitarios e integración real en CI).
- [x] Vacíos, duplicados, IDs ajenos o faltantes no escriben; permisos se verifican primero (unitarios).
- [x] PostgreSQL real verifica persistencia, repetición y carrera en CI antes de promoción.
- [ ] Smoke de reordenado con fotos en Preview, tras verificar aislamiento de la base de datos.
- [ ] Reproducción móvil e hidratación, validación de producción autorizada y ventana de observación.
- [x] Inventario deja explícitas las incidencias externas/no reproducidas; ninguna se oculta.

## Verificación

### Histórico local del 22/09/2026

Resultados de esa fecha, sin credenciales de servicios remotos. Los bloqueos de CI/Preview aquí
registrados se superaron posteriormente; ver evidencia del 23/09, sin borrar el histórico:

| Verificación                                     | Resultado real                                                                                                                                                                        |
| ------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Dependencias fijadas, instalación offline        | PASS; caché existente, sin cambios del lockfile ni dependencias nuevas. La primera preparación quedó atascada en sandbox y se interrumpió; completada con permiso de ejecución local. |
| Prisma generate 6.19.3                           | PASS; no conecta a la base de datos.                                                                                                                                                  |
| Tests focalizados de OBS-1 + categorías de fotos | 31/31 PASS.                                                                                                                                                                           |
| Suite unitaria completa                          | 123 archivos, 1534 tests PASS.                                                                                                                                                        |
| Typecheck / lint                                 | PASS; lint sin warnings ni errores.                                                                                                                                                   |
| check:sdd / git diff --check                     | PASS.                                                                                                                                                                                 |
| Next build                                       | PASS con servicios ficticios/locales; el primer intento fue bloqueado por acceso de red a fuentes Google y se repitió con permiso.                                                    |
| Mapas públicos del build                         | Cero archivos `.map` en `.next/static`; conserva borrado de mapas tras upload. No se ha probado upload a Sentry.                                                                      |
| PostgreSQL real                                  | BLOQUEADO por guard: falta TEST_DATABASE_URL. No hay docker/psql/postgres en PATH. Cero tests de integración ejecutados, no se cuenta como verde.                                     |
| Preview, E2E, producción y observación           | No ejecutados para OBS-1; sin autorización de publicación.                                                                                                                            |

Build local limitado: avisos existentes de Sentry/Turbopack y caché Webpack; las páginas que leen
catálogo/sitemap registran fallos esperados contra `127.0.0.1:1`. Esto valida compilación, no datos,
autenticación ni funcionamiento conectado. Nunca se ha usado staging/producción como DB de test.

Preparada `tests/integration/vehicle-photo-order.test.ts`: persistencia e idempotencia, aislamiento
entre vehículos, rechazo de conjuntos inválidos y carrera con barrera para forzar dos snapshots
simultáneos. El job `integration` existente dispone de PostgreSQL 17 efímero y posteriormente
ejecutó los tres casos con éxito; esto no sustituye la comprobación de la interfaz en Preview.

Investigación adicional de CRM-C: la traza completa permite ver logo (38.606 B) y hero de 1200 px
(157.026 B), pero ninguno coincide con los 453.560 B del span alertado. No se atribuye el problema a
esos recursos ni se cambia la calidad del catálogo sin evidencia.

### Evidencia remota del 23/09/2026

Código evaluado: `afcfbf6cfb15383ba67074073c52452b083a7789`. Main sigue en
`72dbc47af1f337e58e62475e79d5e991a769b032`; PR #183 abierta, sin merge.

| Comprobación            | Resultado / evidencia                                                                                                                                                                                                                                                                                 |
| ----------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| CI del cambio           | [Run 35755643956](https://github.com/growthaiconsultant-lab/campernova-crm/actions/runs/35755643956): quality, integration, migration-replay y supabase-storage SUCCESS. 1534 unitarios; 34 archivos de integración, incluidos los tres casos de orden de fotos.                                      |
| Preview                 | [Deployment HEbzYAzRFvRmqxnL4Qu6aKkVGEQS](https://vercel.com/growthaiconsultant-8035s-projects/campernova-crm/HEbzYAzRFvRmqxnL4Qu6aKkVGEQS) READY, 23/09 08:37:17 UTC, mismo SHA; build sin caché.                                                                                                    |
| Upload Sentry           | Tres mensajes de upload satisfactorio y paquetes de 254, 262 y 211 archivos en Source Maps, release `afcfbf6cfb15`. Ver [registro de configuración](https://github.com/growthaiconsultant-lab/campernova-crm/pull/183#issuecomment-5791728018).                                                       |
| Variables               | SENTRY_AUTH_TOKEN secreto sólo Preview, introducido por el usuario; SENTRY_ORG, SENTRY_PROJECT y NEXT_PUBLIC_SENTRY_DSN configurados sólo Preview. Variables Sentry Production preexistentes conservadas. `CN_sentry` errónea eliminada con aprobación específica. No secretos leídos ni versionados. |
| Runtime                 | 58 spans para environment `preview` y SHA completo; traza `0293ee0af6c94dbbadb8e44c7d8bb337` contiene Auth del proyecto staging `iatuhydsfwoeprpbklod`. No demuestra por sí sola DATABASE_URL/DIRECT_URL.                                                                                             |
| Smoke autenticado       | Chrome: dashboard, listado de vendedores, dos fichas distintas, preparación, inventario, compradores y ficha de comprador cargan. Sólo lectura. [Evidencia del smoke](https://github.com/growthaiconsultant-lab/campernova-crm/pull/183#issuecomment-5792018208).                                     |
| Anónimo                 | `/vendedores` redirige a `/login`; formulario de acceso visible. No se provocaron excepciones sintéticas ni envíos de correo.                                                                                                                                                                         |
| Errores de Preview      | Consulta Errors filtrada por environment `preview` y SHA completo: cero muestras tras el smoke. Observación puntual, no ventana de 24 h ni garantía de ausencia de errores.                                                                                                                           |
| Mapas públicos remotos  | La petición de prueba recibió `ERR_BLOCKED_BY_CLIENT`; no se sorteó la barrera ni se interpretó como 404. La ausencia local de mapas sí está comprobada.                                                                                                                                              |
| Reordenado en UI        | No ejecutado: la ficha QA inspeccionada tiene 0 fotos. Sin uploads ni escrituras sobre datos remotos.                                                                                                                                                                                                 |
| Producción / móvil real | No desplegado OBS-1 en producción; no ejecutadas pruebas en Android/iOS reales ni observación de 24 h.                                                                                                                                                                                                |

### Seguimiento de incidencias y condiciones de cierre

Responsable técnico de los siguientes pasos: Engineering. No se han modificado asignaciones,
prioridades o estados en Sentry. Consulta del feed del 23/09: diez incidencias abiertas en 14 días.

| Incidencia               | Estado técnico                                                                       | Próxima evidencia necesaria para cerrar                                                                                              |
| ------------------------ | ------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------ |
| CRM-18                   | Corrección implementada y validada en PostgreSQL efímero; desplegada sólo en Preview | Aislamiento Prisma verificado; fixture con fotos y comprobación UI de persistencia; promoción autorizada y traza de un único UPDATE. |
| CRM-6 / CRM-1G           | Recuperación mitigada en Preview; causa inicial del loader desconocida               | Reproducción de navegación/recuperación entre releases, stack desminificado y observación del release autorizado en producción.      |
| CRM-A / CRM-D            | Origen observado en código inyectado Android; no equivale a CRM corregido            | Reproducción en navegador integrado y Chrome externo, atribuir frames y comprobar si el flujo visible falla. No filtro global.       |
| CRM-1C / CRM-1D / CRM-1E | Hipótesis de traducción/inyección, sin causa probada                                 | iOS real, mismo recorrido con/sin traducción, stack y test de regresión antes de modificar código.                                   |
| CRM-G                    | Hidratación sin reproducción ni diff HTML                                            | Reproducir SSR/hidratación con contexto de navegador y aislar componente; regresión determinista.                                    |
| CRM-C                    | Rendimiento, recurso todavía sin identificar                                         | URL del recurso afectado y comparación de bytes/calidad; no rebajar todo el catálogo especulativamente.                              |

Nueva muestra de CRM-A revisada: evento `411ab85122104054b127ae28c879ab62`, 23/09
07:59:07.909 UTC, production release `72dbc47af1f3`, Android 17. El origen sigue siendo
`app://navigation_performance_logger_android` (`sendDataToNative` / `sendJsBlockingTimeMessage`),
pero aparece también un frame de chunk del sitio en la envoltura `addEventListener`, aún minificado.
Por tanto, la descripción inicial de «únicamente frames externos» sólo aplica a la muestra anterior;
no se generaliza a todos los eventos ni se declara inocuo sin reproducir el flujo.

### Aprendizajes aplicados

- Build READY no demuestra que los mapas se hayan subido: exigir logs y paquetes del mismo SHA.
- NODE_ENV identifica compilación, no Preview/Production: etiqueta explícita y recepción real.
- Después de introducir un secreto, comprobar nombre y entorno mediante metadatos, sin revelar el
  valor. Una variable mal nombrada no se consume; el entorno seleccionado por defecto puede ser Production.
- PostgreSQL efímero de CI resolvió la falta de infraestructura local; nunca usar producción como
  sustituto. Separar integración real de smoke UI, y Auth de la conexión Prisma.
- En Sentry, «Recommended» no significa «Latest»: inspeccionar la muestra más reciente y su SHA.
- Cero errores durante una visita no cierra diez incidencias. Diferenciar corrección, mitigación,
  causa externa probable y diagnóstico pendiente; no silenciar para conseguir un panel vacío.
- Actualizar spec y PR al superar cada gate, sin mantener bloqueos históricos como estado actual.

Procedimiento reutilizable: [runbook de diagnóstico Sentry](../runbooks/sentry-incident-triage.md).

Reconciliación documental del 23/09: spec, índice y runbook revisados; `check:sdd`, formato,
`git diff --check`, typecheck y los 1534 unitarios superados de nuevo. El wrapper pnpm del entorno
intentó gestionar dependencias con otra versión y abortó; se utilizó Corepack con pnpm 10.33.2,
sin cambiar lockfile ni dependencias. Prettier se ejecutó mediante su entrypoint local porque su
resolución mediante `pnpm exec` falló. Ningún fallo de herramienta se contabilizó como test verde.

## Rollout, rollback y stop conditions

- **Rollout:** local → autorización de PR/CI → PostgreSQL real → Preview → aprobación producción.
- **Rollback/mitigación:** revert de código; sin datos que revertir ni cambios de schema. Recarga
  manual del navegador es mitigación provisional para runtime antiguo, no cura confirmada.
- **Detener si:** authz cambia, SQL no está parametrizado, integración falla, mapa queda público,
  aparecen nuevos errores o no es posible atribuir una corrección a evidencia.
- **Validación post-despliegue:** Chrome desktop autenticado, Android/iOS con y sin traducción,
  filtros production/release en Sentry y ventana de 24h propuesta (no observada todavía).

## Revisión adversarial

| Riesgo intentado                            | Mitigación o riesgo pendiente                                                  |
| ------------------------------------------- | ------------------------------------------------------------------------------ |
| Confundir viejo release con cambio nuevo    | Timestamp y SHA separados; no atribuir por fecha del correo.                   |
| Duplicar IDs conservando longitud           | Set único y pertenencia verificados.                                           |
| Perder atomicidad al optimizar              | Transacción serializable; abortar ante conflicto; test PostgreSQL obligatorio. |
| Disimular errores externos con catch/filtro | Sin ignoreErrors ni beforeSend que descarte excepciones.                       |
| Confundir mitigación con root cause         | Recuperación global etiquetada como mitigación.                                |
| Perder formulario por recarga               | Sólo botón explícito dentro del fallo global.                                  |

## Cierre

Implementación y CI completados, desplegados en Preview con mapas y telemetría recibidos; smoke
autenticado de lectura completado. Estado DEPLOYED, no VALIDATED ni «todos resueltos».

Siguiente gate: verificar aislamiento Prisma y preparar fixture de fotos para smoke de escritura;
completar comprobación remota de privacidad y reproducción móvil. Merge y producción requieren
aprobación separada. La ventana posterior de observación aún no está cumplida.
CRM-18 tiene corrección candidata; CRM-6 una mitigación, no una causa inicial resuelta. CRM-A/D tienen
origen externo observado, con los límites descritos arriba. CRM-1G/1C/1D/1E/G/C conservan diagnóstico pendiente. Ninguna incidencia se ha cerrado,
archivado o filtrado en Sentry. No se declara «todos resueltos».
