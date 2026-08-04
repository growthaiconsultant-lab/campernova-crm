# CRON-01 — Garantizar autenticación, routing e idempotencia de Vercel Cron

| Campo               | Valor                     |
| ------------------- | ------------------------- |
| **Estado**          | IMPLEMENTED               |
| **Owner**           | Engineering / Operations  |
| **Ticket**          | CRON-01                   |
| **Rama / PR**       | `codex/cron-auth-routing` |
| **Categorías**      | C5, C8, C9                |
| **Riesgo**          | Alto                      |
| **Ruta SDD**        | Reforzada                 |
| **Última revisión** | 2026-08-04                |

## Problema y evidencia

`vercel.json` programa `/api/cron/postventa-followups` y
`/api/cron/calendar-reminders`. El middleware incluía ambas rutas en el matcher global y redirigía
las peticiones sin sesión Supabase a `/login`. Vercel Cron no sigue redirects, por lo que el Route
Handler nunca llegaba a ejecutarse.

La auditoría reveló una segunda vulnerabilidad: los handlers solo comparaban el Bearer cuando
`NODE_ENV === 'production'`. Preview, test y desarrollo podían ejecutar los efectos del job sin
`CRON_SECRET`, aunque compartieran credenciales reales de base de datos o email.

La reproducción previa a la corrección dejó 10 fallos de 13 tests específicos: redirects 307 para
las dos rutas válidas, respuestas 200 sin Bearer y ausencia de claves de idempotencia.

Referencias de contrato:

- [Vercel envía `Authorization: Bearer <CRON_SECRET>`](https://vercel.com/docs/cron-jobs/manage-cron-jobs).
- [Vercel Cron no sigue redirects](https://vercel.com/kb/guide/troubleshooting-vercel-cron-jobs).
- [Resend deduplica por idempotency key durante 24 horas](https://resend.com/docs/dashboard/emails/idempotency-keys).

## Resultado esperado

- Solo las dos rutas exactas configuradas atraviesan el guard de sesión del middleware.
- Cada handler exige un `CRON_SECRET` no vacío y un Bearer exacto en todos los entornos.
- Las respuestas de autorización son JSON 401, nunca redirects HTML.
- Reintentos equivalentes entregan a Resend la misma clave de idempotencia.
- Los resultados registran una señal estructurada sin PII, secretos ni cabeceras.
- La ausencia o falta de verificación del secreto de Production bloquea el despliegue.

## Reglas e invariantes

- Nunca autorizar por el prefijo genérico `/api/cron`.
- El middleware solo decide routing; la autorización permanece en cada Route Handler.
- No registrar `CRON_SECRET`, Authorization, emails, nombres ni payloads.
- Fallar cerrado si el secreto está ausente, incluso fuera de Production.
- La misma operación lógica debe producir la misma idempotency key.
- No ejecutar una prueba autorizada contra Preview si puede apuntar a datos o destinatarios reales.

## Inventario de efectos

| Job                   | Lecturas                                            | Escrituras                              | Efecto externo                        | Idempotencia implementada               |
| --------------------- | --------------------------------------------------- | --------------------------------------- | ------------------------------------- | --------------------------------------- |
| `postventa-followups` | Follow-ups vencidos, garantía, vehículo y comprador | Estado `FALLIDO` / `ENVIADO` y `sentAt` | Email día 7/30 mediante Resend        | `postventa-followup/<followupId>`       |
| `calendar-reminders`  | Agenda de mañana y usuarios responsables activos    | Ninguna                                 | Un digest por usuario mediante Resend | `calendar-digest/<YYYY-MM-DD>/<userId>` |

Los updates del follow-up convergen a `ENVIADO`: un fallo concurrente solo puede cambiar
`PENDIENTE → FALLIDO`, mientras una confirmación puede cambiar `PENDIENTE|FALLIDO → ENVIADO`. Así,
una respuesta tardía de error no sobrescribe un envío confirmado.

La garantía de Resend dura 24 horas. Es suficiente para reintentos del mismo job diario, pero no es
una garantía de exactly-once indefinida. Si el negocio exige replay manual después de 24 horas,
hará falta un outbox o ledger persistente en una spec separada.

## Decisiones resueltas

| Decisión                  | Resolución                                                                 |
| ------------------------- | -------------------------------------------------------------------------- |
| Boundary de routing       | Bypass exacto en middleware; Bearer validado dentro de cada handler.       |
| Comparación del secreto   | `timingSafeEqual`; secreto ausente implica 401.                            |
| Idempotencia de email     | Claves estables de Resend, sin migración ni proveedor adicional.           |
| Señal operativa           | JSON estructurado con job, conteos y duración; sin PII.                    |
| Ruta desconocida          | Sigue pasando por Supabase Auth y, sin sesión, redirige a login.           |
| Cambio de contrato digest | Añade `failed` y solo incrementa `sent` cuando Resend confirma aceptación. |

## Implementación

1. `lib/cron/routes.ts` mantiene la allowlist exacta y un test la compara con `vercel.json`.
2. `middleware.ts` evita Supabase Auth únicamente para esas rutas exactas.
3. `lib/cron/auth.ts` valida el Bearer de forma fail-closed y timing-safe.
4. Ambos handlers validan antes de consultar Prisma o enviar email.
5. Postventa usa idempotencia por follow-up y updates condicionales convergentes.
6. Calendario usa idempotencia por fecha/usuario y reporta fallos reales de Resend.
7. Los logs de finalización contienen solo nombre del job, conteos y duración.

No se modifica `schema.prisma`, no hay migración y no se añade ninguna dependencia.

## Criterios de aceptación

- [x] Las dos rutas configuradas atraviesan middleware sin sesión Supabase.
- [x] Sin Bearer, con Bearer inválido o sin `CRON_SECRET`, el handler responde 401 sin efectos.
- [x] `/api/cron/cualquier-otra-ruta` y los sufijos no obtienen bypass.
- [x] Dos invocaciones equivalentes entregan la misma idempotency key a Resend.
- [x] El response del handler es JSON, nunca redirect a `/login`.
- [x] Los fallos de Resend no se contabilizan como envíos correctos.
- [ ] Vercel Production tiene un `CRON_SECRET` verificado y de al menos 16 caracteres.
- [ ] Staging/Preview aislado registra una ejecución controlada sin datos reales.
- [x] Production no se ha modificado durante la implementación.

## Evidencia ejecutada

| Check                           | Resultado                                        |
| ------------------------------- | ------------------------------------------------ |
| Reproducción previa             | 10 fallos / 13 tests específicos                 |
| Tests CRON-01 posteriores       | 18 / 18 PASS                                     |
| Suite unitaria completa         | 1.409 / 1.409 PASS en 108 archivos               |
| TypeScript                      | PASS                                             |
| ESLint                          | PASS, sin warnings                               |
| Build Next.js con acceso real   | PASS, 60 páginas generadas                       |
| Migraciones                     | N/A, sin cambios de schema                       |
| Ejecución autorizada en Preview | BLOQUEADA hasta aislar datos y verificar secreto |

## Rollout, rollback y stop conditions

- **Rollout:** tests locales → CI de PR apilada → verificar `CRON_SECRET` en Vercel → Preview
  aislado/controlado → PR contra `main` → aprobación independiente → Production supervisada.
- **Rollback:** revertir el commit de CRON-01. Los handlers anteriores seguirían fail-closed en
  Production, aunque el cron volvería a quedar bloqueado por middleware.
- **Detener si:** falta `CRON_SECRET`, una ruta desconocida obtiene bypass, aparece un redirect 3xx,
  Preview comparte destinatarios reales, una clave se expone o CI no queda completamente verde.
- **Validación post-despliegue:** confirmar status, duración, conteos, ausencia de 3xx/401 y ausencia
  de duplicados durante dos ventanas programadas.

## Estado de autorización

`IMPLEMENTED LOCALLY — DEPLOYMENT BLOCKED`

El código y sus pruebas están implementados. No se autoriza merge ni Production hasta obtener
acceso administrativo a Vercel, verificar que `CRON_SECRET` existe en Production y disponer de un
entorno Preview/Staging cuyos datos y destinatarios estén aislados.
