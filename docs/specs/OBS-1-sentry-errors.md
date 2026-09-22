# OBS-1 — Recuperación de errores y diagnóstico fiable de Sentry

| Campo               | Valor                                                              |
| ------------------- | ------------------------------------------------------------------ |
| **Estado**          | APPROVED                                                           |
| **Owner**           | Engineering                                                        |
| **Ticket**          | OBS-1; solicitud del usuario de corregir las incidencias de Sentry |
| **Rama / PR**       | codex/obs-1-sentry-errors; PR pendiente                            |
| **Categorías**      | C1, C3, C9                                                         |
| **Riesgo**          | Medio                                                              |
| **Ruta SDD**        | Reforzada para persistencia y concurrencia del reordenado          |
| **Última revisión** | 2026-09-22                                                         |

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

En código se verifica además que los tres SDK usan NODE_ENV: un Preview compilado se etiqueta
incorrectamente como production. Los stacks de chunks compartidos no están desminificados y
`widenClientFileUpload` no está habilitado.

## Resultado esperado

Recuperación explícita de la pantalla global, entornos identificables y source maps privados más
completos; reordenado de fotos sin N actualizaciones ni IDs duplicados. Cada incidencia conserva
su evidencia y estado real; ninguna se considera resuelta sólo por desplegar o silenciarla.

## Reglas e invariantes

- Autorización actual (22/09/2026): commit, push, PR, CI y despliegue/comprobación de Preview de
  OBS-1, confirmados por el usuario. Sin merge, producción, migraciones ni cambios de configuración
  remota. Antes de pruebas con datos, verificar que Preview apunta exclusivamente a staging.
- Preservar requireCanGenerateAds, pertenencia de fotos, orden base cero y revalidación de ficha.
- No exponer URLs de fotos, claves, PII, ni payloads de usuarios en nuevos logs o tests.
- No reintentar escrituras automáticamente; conflicto de transacción devuelve error recuperable.
- Sin recargas automáticas que pierdan formularios: recuperación sólo por clic en error global.

## Fuera de alcance

Upgrade de Next/React, cambios de schema, filtros de Sentry, archivado/resolución de incidencias,
instalación de dependencias nuevas, modificación de producción, correcciones especulativas de iOS.

## Decisiones

| Decisión     | Alternativas                                        | Resolución y motivo                                                                               |
| ------------ | --------------------------------------------------- | ------------------------------------------------------------------------------------------------- |
| Error global | reset, recarga automática, recarga explícita        | Recarga explícita: reconstruye runtime sin bucle automático.                                      |
| Entorno      | NODE_ENV, VERCEL_ENV                                | VERCEL_ENV inyectado públicamente como etiqueta no secreta; fallback local.                       |
| Source maps  | Publicarlos, ignorar stack, upload ampliado privado | Ampliar upload, mantener borrado del bundle público. No credenciales nuevas.                      |
| Fotos        | N updates, lote                                     | Un UPDATE parametrizado dentro de transacción serializable; validar snapshot y abortar conflicto. |

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
- **Integraciones/efectos externos:** upload de mapas por integración existente; nada se cambia remoto.
- **Observabilidad/KPIs:** etiquetas correctas, misma captura de errores; sin cambios de negocio.

## Criterios de aceptación

- [x] Reintentar global hace una recarga por clic y no se recarga automáticamente (unitario).
- [x] Preview, production y development quedan separados; no cambian replay/privacidad (config y unitarios; recepción remota pendiente).
- [x] Mapas ampliados permanecen privados en build local: cero `.map` en `.next/static`; sin nuevas dependencias. Upload remoto pendiente.
- [ ] Reordenado válido hace un UPDATE, base cero, sin tocar otros vehículos.
- [x] Vacíos, duplicados, IDs ajenos o faltantes no escriben; permisos se verifican primero (unitarios).
- [ ] PostgreSQL real verifica persistencia, repetición y carrera antes de publicar.
- [x] Inventario deja explícitas las incidencias externas/no reproducidas; ninguna se oculta.

## Verificación

Resultados locales del 22/09/2026, sin credenciales de servicios remotos:

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
simultáneos. El job `integration` existente dispone de PostgreSQL 17 efímero y ejecutará este archivo
al autorizar PR/CI. Hasta entonces el cambio de persistencia NO está validado.

Investigación adicional de CRM-C: la traza completa permite ver logo (38.606 B) y hero de 1200 px
(157.026 B), pero ninguno coincide con los 453.560 B del span alertado. No se atribuye el problema a
esos recursos ni se cambia la calidad del catálogo sin evidencia.

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

Implementación local parcial con checks estáticos/unitarios y build completados. Estado APPROVED
conservado hasta validar la persistencia real. Publicación en PR/CI/Preview autorizada y en curso.

Siguiente gate: PR/CI/Preview de OBS-1, integración real verde,
recepción de mapas/etiquetas en Preview y smoke test. Merge y producción requieren aprobación separada.
CRM-18 tiene corrección candidata; CRM-6 una mitigación, no una causa inicial resuelta. CRM-A/D son
externos. CRM-1G/1C/1D/1E/G/C conservan diagnóstico pendiente. Ninguna incidencia se ha cerrado,
archivado o filtrado en Sentry. No se declara «todos resueltos».
