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

### Ampliación autorizada: preflight Preview y fixture QA (23/09)

Hecho verificado: Vercel protege DATABASE_URL y DIRECT_URL como Secret de Preview y deshabilita
su copia. Decisión aprobada por el usuario: verificar ambas dentro de Preview sin extraerlas y,
sólo si corresponden a staging, crear un vehículo QA con fotos sintéticas y conservarlo para QA.
No se autorizan producción, merge, cambios de variables, migraciones ni datos existentes.

- Implementación: helper puro y script al inicio del build, antes de Prisma/Next. Sólo activo con
  VERCEL_ENV=preview; fuera de Preview retorna sin leer conexiones. Sin endpoint público, red,
  exportación de secretos, librerías nuevas ni cambios al guard de migraciones de producción.
- Criterio: ambas URLs PostgreSQL deben identificar exactamente staging: host directo y usuario,
  o dominio pooler de Supabase y usuario con project ref. Base postgres, puertos esperados,
  parámetros acotados; rechazar ausencia, conexión mixta, host impostor y overrides. No basta
  encontrar el project ref en una contraseña o parámetro. Sólo se imprime PASS o BLOCKED seguro.
- Validación: unitarios de formatos válidos, mezclas producción/staging, spoofing, errores de parseo
  y ausencia de lectura en producción; CI y señal de build del deployment exacto. Verificar también
  Supabase Auth/Storage de staging antes de subir fotos. PASS verifica configuración, no disponibilidad.
- Smoke posterior: crear ficha inequívoca QA OBS-1 sin contacto real, sin publicar ni ejecutar
  acciones comerciales; subir fotos sintéticas distintas, cambiar su orden en UI, recargar y
  verificar persistencia. Conservar registro QA autorizado; no borrar ni tocar registros existentes.
- Stop conditions: guard bloqueado, destino desconocido, pérdida de sesión o fallo de autorización.
  No relajar el guard para hacer verde el build. Rollback: revert del preflight sólo con aprobación;
  no afecta schema. La fixture se conserva identificada y nunca se publica en el catálogo.
- Alcance de revisión reforzada: datos nuevos QA y Storage, guard de build y pruebas. Dinero,
  contratos, permisos y migraciones no cambian. Efectos existentes de crear ficha deben revisarse
  antes de ejecutar. Identificar fixture antes de repetir tras timeout para evitar duplicados.

Estado de autorización del plan: `PLAN READY FOR INDEPENDENT REVIEW`; ejecución de este alcance
aprobada expresamente por el usuario. Evidencia y resultados se añadirán tras ejecutarlos.

### Reconciliación de fotos staging autorizada (23/09)

Ampliación separada C5/C7, ruta reforzada, riesgo alto: usuario autoriza únicamente políticas y
límites de `vehicle-photos` en staging y repetición del smoke QA. No producción, merge, documentos
privados, schema Prisma ni edición/borrado de datos preexistentes. Responsable: Engineering.

| Área del plan                        | Evidencia, decisión y verificación                                                                                                                                                                                                                                                                                                                                                                                                |
| ------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| A–B Objetivo/baseline                | Resolver rechazo RLS del upload. VERIFICADO EN ENTORNO mediante SELECT en el editor SQL del proyecto `iatuhydsfwoeprpbklod`: dos buckets, 0 objetos, 0 políticas Storage, RLS activo; fotos públicas y documentos privados, límites/MIME nulos en ambos. Respaldo de metadatos sin secretos en `.artifacts/obs-1/staging-storage-preflight.json` (ignorado). Main `72dbc47`; PR #183 `8de9822`, cuatro jobs CI y Preview SUCCESS. |
| C–E Alcance/decisión                 | DECISIÓN DOCUMENTADA: aplicar sólo contrato de fotos de `20260713000000_storage_buckets_and_policies.sql`; el archivo completo NO se ejecuta. Confirmación recibida del usuario; el navegador exige además confirmación inmediatamente antes de aplicar acceso.                                                                                                                                                                   |
| F–I Flujo/invariantes/permisos/datos | Lectura pública; INSERT/UPDATE/DELETE sólo authenticated y sólo bucket de fotos, igual que fuente versionada. No es autorización por rol/propietario del CRM: los guards Prisma siguen en Server Actions y ese límite preexistente queda explícito. Fotos hasta 2 MiB, JPEG/PNG/WebP; RLS sigue activo; documentos sin cambios ni políticas. Ningún objeto se modifica por la reconciliación.                                     |
| J Consumers                          | `photo-actions.ts`: subida/borrado con sesión Supabase; reordenado en Prisma no cambia. `vehicle-photo-uploader.tsx`: carga y drag/drop. Readers de fotos públicas conservan URLs; clientes antiguos respetan mismos límites ya validados por servidor. No readers de documentos afectados.                                                                                                                                       |
| K Concurrencia/reintentos            | Transacción única, lock de objetos y filas de los dos buckets; lock timeout 5 s y statement timeout 15 s. Guard exige exactamente baseline, incluido cero objetos/políticas. Reejecución aborta sin duplicar efectos; ante resultado incierto consultar catálogo, nunca repetir ciegamente.                                                                                                                                       |
| L–M Efectos/UX                       | Sin emails, contratos, publicación, matching, KPIs nuevos ni cambios de estado por configurar Storage. QA conserva estado NUEVO. Upload rechazado debe pasar a tres imágenes visibles; error explícito detiene el smoke.                                                                                                                                                                                                          |
| N–O Tests/rollout                    | Contrato existente probado por supabase-storage CI 35849036364; no equivale a remoto. Preflight → confirmación de acceso → transacción con postflight interno → consulta de catálogo → smoke QA en Preview → recarga y persistencia. No se fuerza redeploy por un cambio de Storage.                                                                                                                                              |
| P Rollback/stop                      | Error de transacción revierte todo. Tras commit, detener subidas y solicitar reversión controlada de las cuatro políticas y límites previos si hay regresión; nunca borrar fotos. Abortar ante otro project ref, catálogo distinto, RLS desactivado, sesión perdida o permisos no aprobados.                                                                                                                                      |
| Q–T Evidencia/riesgos/aceptación     | Registrar resultado y entorno, sin claves, objetos ni PII. Aceptación: cuatro políticas de fotos exactas, límites correctos, bucket privado inalterado, subida QA y orden persistente. Ventana inmediata, no 24 h; resto de incidencias Sentry conserva estado anterior.                                                                                                                                                          |
| U Autorización                       | `PLAN READY FOR INDEPENDENT REVIEW`; alcance operativo aprobado por usuario y reconfirmado antes de Run mediante respuesta «si considereas que es lo mejor adelante» a la pregunta con las cuatro políticas y límites exactos.                                                                                                                                                                                                    |

Revisión adversarial: ejecutar el SQL completo tocaría documentos privados → SQL específico de
fotos; carrera tras preflight → lock y guard dentro de transacción; permisos autenticados no equivalen
a ADMIN → limitación explícita del contrato existente, sin prometer aislamiento por rol; secretos
para tooling → no exportarlos, usar sesión de dashboard staging. No aplicar nada sobre el conector
Supabase configurado para producción.

Matriz de completitud: dominio/estados/legacy sin cambio (C–M); permisos y datos revisados (F–I);
concurrencia/idempotencia (K); migración operativa/compatibilidad/readers (F–J); efectos y superficie
pública (L); observabilidad/documentación (Q–T); rollout/rollback (N–P). Configuración y smoke
de fotos verificados posteriormente, como se detalla a continuación.

Resultado ejecutado del 23/09: transacción confirmada en el SQL Editor de staging con
`OBS-1 vehicle-photos staging reconciliation committed`. El postflight independiente devuelve
exactamente cuatro políticas acotadas a `vehicle-photos`, SELECT público e INSERT/UPDATE/DELETE
condicionados por `auth.role()='authenticated'`; RLS continúa activo. Bucket de fotos público,
límite 2097152 y MIME JPEG/PNG/WebP. `vehicle-documents` continúa privado, sin políticas y con
límites/MIME nulos previos; no se intentó reconciliarlo. Cero objetos antes y después del cambio.
Respaldo y postflight locales ignorados bajo `.artifacts/obs-1/`; ningún secreto exportado.

Primer intento de smoke tras la reconciliación: ficha QA existente abierta, autenticada, 0/30 fotos. El selector
automático sí se obtuvo (`multiple=true`), pero `setFiles` para las tres imágenes sintéticas
locales fue rechazado con `Not allowed`. No se repitió ni se sorteó la protección. Según la guía
de Chrome del control de navegador, el usuario debe habilitar acceso a URLs de archivo en la
extensión ChatGPT antes de repetir. Ese intento quedó BLOQUEADO; no invalida el postflight de
configuración ni demuestra un nuevo error de Supabase.

Smoke completado el 23/09 tras la confirmación «listo» del usuario sobre el permiso de Chrome:

- Subida única de tres PNG sintéticos (rojo, verde y azul) al vehículo QA existente; contador
  pasó de 0/30 a 3/30. Las tres URLs de imágenes observadas en DOM corresponden al host de
  staging `iatuhydsfwoeprpbklod.supabase.co`; no se registran sus rutas.
- Arrastre real en Chrome de la tercera foto a la primera posición: orden inicial rojo → verde
  → azul; orden final azul → rojo → verde, comprobado comparando las tres fuentes del DOM.
- Recarga completa: persisten las tres fotos en orden azul → rojo → verde. Comprobación visual
  de la galería confirma las tres imágenes y el contador 3/30; alerta vacía, sin error visible.
  La foto azul también pasa a portada de la ficha. Las imágenes de la galería se cargan al
  acercarlas al viewport; la primera lectura inmediatamente tras recargar no bastaba para
  validar su carga visual.
- Preview comprobado: `8de9822`, deployment `7M1H4qZpzSXYTFRW4eEu9bNyGTKf`; mismo código de
  aplicación/preflight que `0fcdedf` (el commit posterior sólo documenta). Resultado de este
  smoke: PASS; no equivale a validación de producción ni a cerrar CRM-18 en Sentry.
- Se conserva la ficha QA y sus tres fotos por autorización. Sin publicar, borrar archivos,
  tocar registros comerciales existentes, documentos privados o producción.

CI y Preview del commit documental `8de9822` comprobados: cuatro jobs SUCCESS en
[35849036364](https://github.com/growthaiconsultant-lab/campernova-crm/actions/runs/35849036364) y
[Preview 7M1H4qZpzSXYTFRW4eEu9bNyGTKf](https://vercel.com/growthaiconsultant-8035s-projects/campernova-crm/7M1H4qZpzSXYTFRW4eEu9bNyGTKf)
SUCCESS. No merge, cambios en producción, datos comerciales, variables ni documentos privados.

### Implementación original

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
- [x] Smoke de subida y reordenado con tres fotos sintéticas en Chrome/Preview, tras verificar aislamiento; orden persistente después de recargar (23/09).
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

### Histórico del preflight y primer intento QA del 23/09/2026

El bloqueo descrito en esta subsección se superó con la reconciliación y el smoke detallados arriba.

Código evaluado: `0fcdedf1f9140dadfe9f99acbdf6edb638a04be0`, sólo Preview.

- Validación local: typecheck, lint, check:sdd y diff check PASS; 124 archivos y 1562 tests
  unitarios PASS, incluidos 28 casos del preflight. Sin dependencias nuevas ni cambios de schema.
- [CI 35847735284](https://github.com/growthaiconsultant-lab/campernova-crm/actions/runs/35847735284):
  quality, integration, migration-replay y supabase-storage SUCCESS.
- [Preview Wa33tGP6XrePsoxXyyioeYXHuzmr](https://vercel.com/growthaiconsultant-8035s-projects/campernova-crm/Wa33tGP6XrePsoxXyyioeYXHuzmr)
  READY a las 10:18:52 UTC, mismo SHA. Build a las 10:15:36 UTC:
  `preview-db-preflight: PASS — staging correcto (DATABASE_URL y DIRECT_URL)`.
  Las credenciales permanecieron dentro de Vercel: no se exportaron, mostraron ni persistieron.
- Chrome autenticado recargó ese Preview. Creada una única ficha nueva
  `QA OBS-1 · Orden de fotos · 2026-09-23`, vehículo `QA OBS-1 FOTOS SINTETICAS`, sin email,
  teléfono ni publicación; estado NUEVO y sin agente. Se conserva para QA por autorización.
  No se editaron registros preexistentes.
- El selector automático de archivos terminó en timeout antes de entregar archivos al agente.
  El usuario confirmó haber seleccionado él un archivo. La interfaz mostró
  `Error al subir: new row violates row-level security policy` y mantuvo 0/30 fotos.
  No se atribuye el timeout a permisos de la extensión: no está demostrado. No se repitió la
  escritura ni se ejecutó reordenado; el smoke permanece BLOQUEADO, no PASS.
- Diagnóstico de sólo lectura en el panel del proyecto staging `iatuhydsfwoeprpbklod`:
  `vehicle-photos` es público, con 0 políticas, límite sin configurar (50 MB) y MIME Any.
  Policies confirma ausencia de políticas para ese bucket y de otras políticas en storage.objects.
  El repositorio define cuatro políticas de fotos, 2 MiB y allowlist JPEG/PNG/WebP en
  `supabase/migrations/20260713000000_storage_buckets_and_policies.sql`.
  La ausencia de políticas explica el rechazo RLS observado; no se ha reconciliado remotamente.
- `vehicle-documents` aparece privado y sin políticas: la ausencia de políticas allí es deliberada
  en el diseño, no se debe copiar la solución de fotos a documentos privados. No se modificó.
- Una lectura amplia de la pantalla de variables fue bloqueada por la revisión de seguridad.
  Se respetó el bloqueo; la inspección posterior se limitó a metadatos de la variable pública y
  no reveló su valor. No se cambiaron variables, credenciales, permisos, migraciones ni producción.

Gate identificado en aquel intento (ya superado): autorización separada y preflight para reconciliar exclusivamente la configuración
de `vehicle-photos` en staging con el contrato versionado; comprobar catálogo y repetir subida y
persistencia del orden con imágenes sintéticas. No aplicar el archivo completo a remoto: también
incluye el bucket privado y fue diseñado para entornos nuevos/local/CI. Preservar datos, RLS,
documentos privados y producción; abortar si el catálogo contradice el diagnóstico.

### Seguimiento de incidencias y condiciones de cierre

Responsable técnico de los siguientes pasos: Engineering. No se han modificado asignaciones,
prioridades o estados en Sentry. Consulta del feed del 23/09: diez incidencias abiertas en 14 días.

| Incidencia               | Estado técnico                                                                                                          | Próxima evidencia necesaria para cerrar                                                                                              |
| ------------------------ | ----------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| CRM-18                   | Corrección validada en PostgreSQL efímero y smoke Chrome/Preview; tres fotos QA reordenadas y persistentes tras recarga | Pendientes promoción autorizada y traza de un único UPDATE en el entorno objetivo.                                                   |
| CRM-6 / CRM-1G           | Recuperación mitigada en Preview; causa inicial del loader desconocida                                                  | Reproducción de navegación/recuperación entre releases, stack desminificado y observación del release autorizado en producción.      |
| CRM-A / CRM-D            | Origen observado en código inyectado Android; no equivale a CRM corregido                                               | Reproducción en navegador integrado y Chrome externo, atribuir frames y comprobar si el flujo visible falla. No filtro global.       |
| CRM-1C / CRM-1D / CRM-1E | Hipótesis de traducción/inyección, sin causa probada                                                                    | iOS real, mismo recorrido con/sin traducción, stack y test de regresión antes de modificar código.                                   |
| CRM-G                    | Diff HTML recuperado: mutaciones externas compatibles con traducción antes de hidratar; sin reproducción controlada     | Reproducir en Edge con/sin traducción y aislar el primer nodo divergente; no deshabilitar traducción ni ocultar alertas globalmente. |
| CRM-C                    | Rendimiento, recurso todavía sin identificar                                                                            | URL del recurso afectado y comparación de bytes/calidad; no rebajar todo el catálogo especulativamente.                              |

Nueva muestra de CRM-A revisada: evento `411ab85122104054b127ae28c879ab62`, 23/09
07:59:07.909 UTC, production release `72dbc47af1f3`, Android 17. El origen sigue siendo
`app://navigation_performance_logger_android` (`sendDataToNative` / `sendJsBlockingTimeMessage`),
pero aparece también un frame de chunk del sitio en la envoltura `addEventListener`, aún minificado.
Por tanto, la descripción inicial de «únicamente frames externos» sólo aplica a la muestra anterior;
no se generaliza a todos los eventos ni se declara inocuo sin reproducir el flujo.

### Aprendizajes aplicados

Continuación del diagnóstico del 23/09, posterior al smoke de fotos:

- El feed de Sentry sigue mostrando diez incidencias abiertas en 14 días. CRM-6/1G tienen última
  actividad el 22/09; CRM-G el 19/09; CRM-C el 16/09. La revisión no cerró ni archivó ninguna.
- CRM-G: tras seleccionar Latest, se pudo cargar `Open Diff Viewer` → `HTML Diff` y `Mutations`
  del evento `aa414613d616493e8829ed0a0970c865`, release `05167ce25220`, Edge 140.0.0.
  La evidencia anterior de «sin diff» queda superada, no borrada: el DOM anterior al error contiene
  atributos `_msthash`, `_msttexthash` y nodos `font` con `_mstmutation`, mientras el posterior
  vuelve a contener texto directo en navegación y CTAs. El registro de mutaciones incluye
  sustituciones a 1284 ms y una nueva modificación de atributos del enlace flotante a 1285 ms.
- Hecho: esas marcas/nodos no aparecen en `app/` ni `components/`; `app/layout.tsx` ya declara
  `lang="es"`. Inferencia: modificación externa compatible con traducción previa a hidratación,
  no un idioma ausente en el layout. No basta para generalizar la causa a los 91 eventos históricos
  ni demostrar una corrección. La documentación de [Next.js](https://nextjs.org/docs/messages/react-hydration-error)
  reconoce modificaciones externas de HTML como una causa de desajuste de hidratación.
- No se implementa `notranslate`, `suppressHydrationWarning`, monkey patch del DOM ni filtro
  Sentry: impedirían diagnosticar o alterarían la experiencia sin reproducción validada. El
  siguiente experimento necesita Edge con traducción real; Chrome sin traducir no lo sustituye.
- CRM-C conserva la muestra de 453560 bytes y release antiguo; no hay evidencia nueva suficiente
  para identificar el recurso original. No se modifica la compresión de todo el catálogo.
- Smoke público adicional en Chrome/Preview `8de9822`: home cargada, pestaña Para vender muestra
  Depósito en instalaciones y selección correcta; regreso a Para comprar correcto. Navegación por
  enlaces a `/como-funciona` y `/vender` comprobada por URL y contenido. Cero mensajes warn/error
  capturados por la consola de esa pestaña. Sin formularios enviados ni escrituras. Es una muestra
  desktop sin traducción; no reproduce ni descarta el problema en Edge/iOS.

Aprendizajes:

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
- CI de Storage valida un Supabase efímero, no la paridad de políticas del proyecto remoto.
  El preflight de DATABASE_URL/DIRECT_URL tampoco valida Storage: son gates independientes.
- Un timeout del selector no prueba un problema de la extensión. Contrastar la UI y las acciones
  manuales del usuario antes de atribuir el fallo; no reintentar una subida rechazada por RLS.
- Separar tres comprobaciones: upload aceptado, orden persistente tras recarga e imágenes visibles.
  La carga diferida fuera del viewport no demuestra por sí sola un fallo de Storage.

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

El aislamiento Prisma está verificado por el preflight de Preview y la ficha QA está creada.
Storage staging de fotos está reconciliado y verificado por consulta de catálogo; documentos intactos.
Smoke de subida/reordenado completado en Chrome: tres imágenes QA visibles y nuevo orden persistente
tras recarga. Pendientes comprobación remota de privacidad y reproducción móvil.
Merge y producción requieren
aprobación separada. La ventana posterior de observación aún no está cumplida.
CRM-18 tiene corrección candidata; CRM-6 una mitigación, no una causa inicial resuelta. CRM-A/D tienen
origen externo observado, con los límites descritos arriba. CRM-1G/1C/1D/1E/G/C conservan diagnóstico pendiente. Ninguna incidencia se ha cerrado,
archivado o filtrado en Sentry. No se declara «todos resueltos».
