# AUTH-1 — Acceso fiable por magic link

| Campo               | Valor                                                     |
| ------------------- | --------------------------------------------------------- |
| **Estado**          | IMPLEMENTED                                               |
| **Owner**           | Engineering / Operations                                  |
| **Ticket**          | AUTH-1 (incidencia operativa, sin ticket externo todavía) |
| **Rama / PR**       | `codex/auth-1-magic-link-reliability` / pendiente         |
| **Categorías**      | C1, C5, C8, C9                                            |
| **Riesgo**          | Alto                                                      |
| **Ruta SDD**        | Reforzada                                                 |
| **Última revisión** | 2026-08-11                                                |

## Problema y evidencia (A. Objetivo)

Restablecer un acceso fiable al CRM para el equipo. Un magic link debe regresar al entorno que lo
generó, un rechazo del proveedor debe producir un mensaje recuperable y producción debe dejar de
depender del correo integrado de Supabase, limitado a dos envíos por hora.

Señal de éxito: callbacks correctos en local/Preview/producción, cero `over_email_send_rate_limit`
durante el smoke autorizado y acceso completado usando el enlace más reciente.

## Resultado esperado

El equipo recibe y consume enlaces de acceso sin depender del límite de demostración de Supabase;
cada entorno conserva su callback y todo fallo deja un mensaje recuperable y observable sin PII.

## B. Baseline verificado

- **VERIFICADO EN CÓDIGO:** `main` (`3f037db`) construye `emailRedirectTo` únicamente desde
  `NEXT_PUBLIC_APP_URL` en `app/(auth)/login/actions.ts`; no distingue Preview.
- **VERIFICADO EN CÓDIGO:** el formulario deja de ofrecer el submit tras un envío correcto, pero no
  recupera una excepción inesperada de la Server Action.
- **VERIFICADO EN CÓDIGO:** la rama `codex/intake-1-vehicle-reception-questionnaire` contiene una
  resolución de callback por `VERCEL_BRANCH_URL` con tests y smoke de staging, pero no está en
  `main`.
- **VERIFICADO EN ENTORNO (producción, 2026-08-11):** Supabase Auth usa el servicio de correo
  integrado y `RATE_LIMIT_EMAIL_SENT=2`; en las últimas 24 horas hubo ocho `/otp` rechazados con
  `429 over_email_send_rate_limit` y dos verificaciones inválidas/caducadas.
- **VERIFICADO EN ENTORNO:** Supabase producción permite `https://campersnova.com/auth/callback` y
  el wildcard documentado de Preview; Vercel define `NEXT_PUBLIC_APP_URL` sólo en Production.
- **DECISIÓN DOCUMENTADA:** ADR 0003 mantiene Supabase Auth passwordless y restringe el login a
  emails previamente presentes y activos en `User`.

## C. Alcance

- Resolver el callback con el alias estable de la rama en Vercel Preview y con la URL canónica en
  producción/desarrollo.
- Fallar de forma segura si falta una URL válida fuera de desarrollo.
- Diferenciar el límite temporal de correo del error genérico sin revelar PII ni detalles internos.
- Recuperar la UI ante excepciones inesperadas y aclarar que debe usarse el enlace más reciente.
- Preparar el rollout operativo de Resend SMTP en Supabase Auth producción y un límite inicial
  prudente de 30 emails/hora.

## D. Exclusiones

- No cambiar el modelo passwordless por contraseña, OAuth o código OTP en este hotfix.
- No modificar usuarios, sesiones existentes, schema, migraciones, RLS ni datos.
- No configurar, desplegar ni probar producción sin autorización explícita separada.
- No reutilizar ni exponer secretos existentes; las credenciales SMTP se gestionan sólo en los
  paneles del proveedor.

## E. Decisiones de negocio

| Decisión                | Alternativas                              | Resolución y motivo                                                                                             |
| ----------------------- | ----------------------------------------- | --------------------------------------------------------------------------------------------------------------- |
| Método de acceso        | Magic link / contraseña / OTP escrito     | Mantener magic link para no ampliar alcance ni cambiar ADR 0003.                                                |
| Proveedor de Auth email | SMTP integrado / Resend / proveedor nuevo | Resend: ya está en el stack y el dominio está verificado; Supabase desaconseja su SMTP integrado en producción. |
| Límite inicial          | 25 / 30 / 60 emails por hora              | 30/h: suficiente para el equipo y conservador frente a abuso; se revisará con logs agregados.                   |

## F. Flujo funcional

1. Un usuario registrado y activo solicita acceso.
2. El servidor elige el callback: `VERCEL_BRANCH_URL` válida en Preview; `NEXT_PUBLIC_APP_URL` válida
   en producción; localhost sólo en desarrollo.
3. Supabase acepta el envío: la UI confirma, recuerda usar el enlace más reciente y no reenvía por
   accidente.
4. Supabase devuelve 429: la UI explica que existe un límite temporal y evita prometer que el correo
   fue enviado.
5. Otro fallo o excepción: la UI vuelve a estado recuperable y muestra un error genérico.
6. El callback canjea el código, conserva el guard de usuario activo y redirige al dashboard.

## G. Estados e invariantes

- Sólo un email presente y activo en `User` puede solicitar acceso.
- El callback nunca acepta un host controlado por una cabecera del cliente.
- Preview usa únicamente un host `*.vercel.app` validado; producción exige una URL HTTP(S) válida.
- Un error de envío nunca se muestra como éxito.
- Tokens, códigos, email, cookies y secretos no se registran ni se envían a observabilidad.

## H. Permisos

No cambia la matriz de roles. La prevalidación server-side de existencia/actividad permanece antes
del efecto externo. Casos mínimos: usuario activo, no registrado, inactivo y proveedor rechazando.

## I. Modelo de datos y migraciones

No aplica: no hay cambios de Prisma, datos, migraciones, backfill ni compatibilidad de schema.

## J. Writers y readers

| Componente          | Comportamiento actual                        | Cambio previsto                                    | Riesgo                              | Validación                          |
| ------------------- | -------------------------------------------- | -------------------------------------------------- | ----------------------------------- | ----------------------------------- |
| `sendMagicLink`     | Prevalida `User` y llama `/otp` con URL fija | Resolver URL por entorno y clasificar 429          | Enlace a host erróneo o falso éxito | Unitarios de action y helper        |
| `LoginForm`         | Loading/sent/error sin `catch` de transporte | Recuperación ante excepción y copy de enlace único | Spinner permanente/confusión        | Test estático + typecheck + smoke   |
| `/auth/callback`    | Canjea código y valida activo                | Sin cambio funcional                               | Regresión del callback              | Tests existentes + smoke            |
| Supabase Auth email | SMTP integrado, 2/h                          | Resend SMTP, 30/h                                  | Entrega o reputación                | Preflight, email QA, logs agregados |
| Vercel env          | URL canónica sólo Production                 | Sin secreto nuevo; helper usa system env de Vercel | Preview a dominio incorrecto        | Unitarios y Preview                 |

La búsqueda `rg "signInWithOtp|sendMagicLink|auth/callback|NEXT_PUBLIC_APP_URL"` no encontró otro
writer de magic links.

## K. Concurrencia e idempotencia

Supabase mantiene una ventana por destinatario y enlaces de un solo uso. El cliente no implementa
un segundo sistema de locks. El submit queda deshabilitado durante la petición y desaparece tras el
éxito. Un doble envío concurrente puede recibir 429 y se representa como error recuperable.

## L. Efectos secundarios e integraciones

Único efecto externo: email de Supabase Auth entregado por Resend SMTP. No hay DB writes nuevas,
Activities, PostHog, Storage ni caché. No se registra destinatario, token, enlace ni payload SMTP.

## M. UX y errores

- 429: mensaje específico de límite temporal, sin afirmar envío.
- Error de proveedor/configuración/transporte: mensaje genérico recuperable.
- Éxito: indicar enlace más reciente, de un solo uso, y revisar spam.
- Enlace inválido/caducado: conservar el mensaje actual del callback.
- Botón deshabilitado durante loading; toda excepción termina el loading.

## N. Tests

1. Helper de URL: Preview válida, producción válida, desarrollo local, host malicioso, configuración
   ausente/incorrecta y protocolos no HTTP(S).
2. Action: usuario inexistente/inactivo, envío correcto, 429 por código y status, error genérico,
   excepción de transporte y callback resuelto.
3. Validación proporcional: `pnpm check:sdd`, tests focales, `pnpm typecheck`, `pnpm lint`, suite
   unitaria y `pnpm build`.
4. Preview/staging: solicitar y consumir un enlace, confirmar host y acceso.
5. Producción autorizada: un solo destinatario QA, logs sin 429/errores y sin PII añadida.

## Rollout (O. Orden de despliegue)

1. Implementar y validar localmente en esta rama.
2. Con autorización: commit, push y PR; verificar CI y Preview contra staging.
3. Con autorización separada de producción: confirmar dominio/sender y credencial SMTP de Resend;
   habilitar SMTP en Supabase Auth, ajustar límite a 30/h y enviar un único enlace QA.
4. Fusionar/desplegar el código sólo con autorización y CI verde.
5. Smoke inmediato y observación agregada de `/otp`, `/verify` y `/token` durante 24 horas.

## P. Rollback y stop conditions

- Código: revertir el hotfix; producción conserva la URL canónica previa.
- SMTP: deshabilitar la integración o restaurar la configuración anterior desde el panel; si el
  proveedor falla, detener envíos y no subir reiteradamente el límite.
- Detener ante callback fuera del entorno, error de credenciales/sender/DNS, entrega a un email no
  autorizado, secretos visibles, 429 durante el smoke, enlace consumido antes del usuario o CI rojo.
- No cambiar `main`, Vercel Production ni Supabase Production dentro de la autorización local actual.

## Q. Observabilidad

- Señal primaria: conteos agregados por status/error code de Supabase Auth; nunca `mail_to`, email,
  IP, token o URL.
- Éxito: `/otp` 200, `/verify` 303 y `/token` 200 durante el smoke.
- Fallo: `over_email_send_rate_limit`, enlace inválido/caducado, rechazo SMTP o callback error.
- Ventana: inmediata y 24 h; owner Operations/Engineering.

## R. Documentación

Esta spec es la fuente del hotfix. Si se despliega, registrar commit/PR/deployment, configuración
SMTP sin secretos, límite final y evidencia de observación. ADR 0003 no cambia.

## S. Riesgos y deuda explícita

| Riesgo                                       | Probabilidad | Impacto | Mitigación                                                   | Owner/cierre           |
| -------------------------------------------- | ------------ | ------- | ------------------------------------------------------------ | ---------------------- |
| SMTP mal configurado bloquea todo acceso     | Media        | Alto    | Smoke antes del deploy y rollback de panel                   | Engineering / rollout  |
| Escáner de correo consume enlace único       | Baja-media   | Alto    | Copy claro; evaluar OTP escrito sólo si persiste             | Product / follow-up    |
| Límite 30/h permite abuso                    | Baja         | Medio   | Prevalidación de `User`, límite de OTP e inspección agregada | Security / observación |
| Fix de Preview queda acoplado a alias Vercel | Baja         | Medio   | Validación estricta y fallback canónico fuera de Preview     | Engineering            |

## Criterios de aceptación (T. Resultados verificables)

- [ ] Preview genera el callback al alias estable de su rama, nunca a localhost/producción.
- [ ] Producción genera el callback a la URL canónica configurada.
- [x] Configuración ausente o host inválido falla de forma segura.
- [x] 429 muestra un mensaje específico y no confirma un envío inexistente.
- [x] Una excepción no deja la UI en `Enviando…`.
- [x] Usuario no registrado o inactivo sigue bloqueado antes de Supabase.
- [ ] Resend SMTP y el límite quedan validados sólo tras autorización de producción.
- [x] No aparecen secretos ni PII nueva en Git, logs, Sentry o PostHog.

## U. Estado de autorización

`PLAN READY FOR INDEPENDENT REVIEW`

Autorizado por el usuario el 2026-08-11: implementar y validar localmente; commit, push, PR y
despliegue/prueba únicamente de Vercel Preview contra staging. No autorizado: merge, `main`, cambios
de Supabase/Vercel Production, deploy ni smoke de producción. Siguiente gate: CI y smoke de Preview;
la operación SMTP y producción tendrá un gate posterior separado.

## Revisión adversarial

| Hallazgo adversarial                                                 | Materialidad | Corrección incorporada                                               |
| -------------------------------------------------------------------- | ------------ | -------------------------------------------------------------------- |
| Usar `Host`/`Origin` del request permitiría callback manipulable     | Alta         | Sólo envs server-side y regex `*.vercel.app`                         |
| Fallback silencioso a localhost en producción reproduce el incidente | Alta         | Localhost limitado a desarrollo; fail-closed fuera de él             |
| Capturar el error puede dejar la UI cargando                         | Alta         | `try/catch` cliente y resultado recuperable                          |
| Loguear el error completo puede exponer email/enlace                 | Alta         | Sólo códigos/status agregables; sin payload ni mensaje del proveedor |
| Subir el límite sin SMTP no resuelve la restricción                  | Alta         | SMTP custom como gate previo al límite                               |

## Matriz de completitud

| Área                      | Revisada | Evidencia    | Riesgo pendiente                            |
| ------------------------- | -------- | ------------ | ------------------------------------------- |
| Dominio/estados           | Sí       | F–G          | Enlace único depende del proveedor          |
| Permisos                  | Sí       | H y ADR 0003 | Smoke real pendiente                        |
| Concurrencia/idempotencia | Sí       | K            | Doble solicitud delegada a límites Supabase |
| Datos/legacy/migración    | Sí       | I            | No aplica; sin cambios                      |
| Compatibilidad/readers    | Sí       | J            | Preview y producción pendientes             |
| Efectos externos          | Sí       | L            | Credencial/sender SMTP por configurar       |
| UX                        | Sí       | M            | Smoke pendiente                             |
| Observabilidad            | Sí       | Q            | Ventana de 24 h pendiente                   |
| Rollout/rollback          | Sí       | O–P          | Requiere autorización de producción         |
| Documentación             | Sí       | R            | PR/deployment pendientes                    |

## Cierre

- **Commit:** pendiente.
- **PR:** pendiente.
- **CI:** pendiente; no se ha publicado la rama.
- **Deployment:** no autorizado.
- **Validación local:** PASS — 23 tests focales; suite completa 114 archivos/1.464 tests;
  `check:sdd`, Prisma generate, typecheck, lint y `next build` con endpoints locales no remotos.
- **Limitación del build:** el catálogo registró fallos esperados y tolerados al intentar alcanzar
  `127.0.0.1:1`; el build terminó con exit 0 y no se consultó producción.
- **Deuda restante:** evaluar OTP escrito sólo si los escáneres siguen consumiendo enlaces tras SMTP.
