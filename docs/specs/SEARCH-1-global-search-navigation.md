# SEARCH-1 — Navegación fiable y autorizada desde el buscador global

| Campo               | Valor                                                                                                                    |
| ------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| **Estado**          | IMPLEMENTED                                                                                                              |
| **Owner**           | Engineering                                                                                                              |
| **Ticket**          | [GitHub #170](https://github.com/growthaiconsultant-lab/campernova-crm/issues/170)                                       |
| **Rama / PR**       | `codex/search-1-global-search-navigation` / [PR #171](https://github.com/growthaiconsultant-lab/campernova-crm/pull/171) |
| **Categorías**      | C1 · C3 · C5                                                                                                             |
| **Riesgo**          | Alto, acotado a navegación y visibilidad por rol                                                                         |
| **Ruta SDD**        | Reforzada                                                                                                                |
| **Última revisión** | 2026-08-07                                                                                                               |

## Problema y evidencia (A. Objetivo)

Corregir el buscador global para que cada resultado navegable lleve de forma determinista al
recurso que el usuario puede consultar. La señal de éxito es que comprador, vendedor, vehículo y
captación abran su destino verificable, y que ningún rol reciba resultados cuyo destino le esté
prohibido.

## Resultado esperado

Cada clic abre el recurso exacto y autorizado: fichas comerciales para comprador, vendedor y
vehículo; ficha de vendedor para una captación convertida; y tarjeta enfocada para una captación que
aún vive en el tablero. Los roles sin acceso comercial no reciben esos resultados.

## B. Baseline verificado

- **VERIFICADO EN ENTORNO:** en producción, un resultado de comprador abre `/compradores/:id` y un
  vehículo abre `/vendedores/:sellerLeadId` para ADMIN, sin errores de consola (smoke 2026-08-07).
- **VERIFICADO EN ENTORNO:** una captación abre únicamente `/captaciones`; no identifica ni enfoca la
  tarjeta seleccionada.
- **VERIFICADO EN CÓDIGO:** `globalSearch` permite resultados de vehículo a ADMIN, AGENTE, TALLER y
  MARKETING, pero el destino construido es una ficha de vendedor.
- **VERIFICADO EN CÓDIGO:** las fichas de vendedor y comprador y el inventario `/vehiculos` exigen
  `requireAgente()` o `requireCanViewVehiculos()`, ambos limitados a ADMIN y AGENTE.
- **VERIFICADO EN CÓDIGO:** no existe `/vehiculos/[id]` ni `/captaciones/[id]`; la captación se opera
  como tarjeta dentro del tablero.
- **VERIFICADO EN CÓDIGO:** los resultados son botones que ejecutan `router.push`; no hay tests
  específicos de rutas o autorización del buscador.
- **DECISIÓN DOCUMENTADA:** la autorización debe aplicarse server-side; ocultar sólo en UI no es una
  frontera de seguridad (`engineering-change-process.md`, sección 7).

## C. Alcance

- Resultados del buscador global y construcción de destinos.
- Visibilidad server-side de vehículos por rol, alineada con las rutas existentes.
- Enlace profundo y foco visual de una captación dentro del tablero.
- Tests unitarios de regresión y autorización.

## D. Exclusiones

- Crear fichas nuevas `/vehiculos/[id]` o `/captaciones/[id]`.
- Cambiar los permisos generales de vendedores, compradores, vehículos o captaciones.
- Cambiar schema, datos, RLS, migraciones, PostHog o Sentry.
- Commit, push, PR, merge, deploy o mutaciones remotas sin autorización posterior.

## E. Decisiones

| Decisión             | Alternativas                                         | Resolución y motivo                                                                                                         |
| -------------------- | ---------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| Destino de vehículo  | Ficha nueva; inventario filtrado; ficha del vendedor | Mantener ficha del vendedor, única ficha operativa existente, y limitar los resultados a ADMIN/AGENTE.                      |
| Destino de captación | Listado genérico; modal; ruta nueva; foco en tablero | Usar `?focus=<id>`, abrir rechazadas cuando corresponda, desplazar y resaltar la tarjeta. Evita una ficha nueva sin driver. |
| Elemento interactivo | Botón + `router.push`; enlace nativo                 | Usar `Link` con `href`, conservando cierre del diálogo. Mejora semántica, accesibilidad y navegación determinista.          |

No existe una decisión material de negocio abierta: se conserva la matriz de permisos ya
implementada y no se amplía acceso.

## F. Flujo funcional

1. Un usuario autenticado abre el buscador y escribe al menos dos caracteres.
2. El servidor devuelve únicamente grupos compatibles con su rol.
3. Cada resultado se renderiza como enlace real.
4. Comprador y vendedor abren su ficha; vehículo abre la ficha del vendedor propietario.
5. Una captación convertida abre su ficha de vendedor; una no convertida abre el tablero con su
   tarjeta enfocada y resaltada.
6. Una consulta corta no ejecuta queries y una búsqueda sin resultados mantiene el estado vacío.

Errores: una excepción de búsqueda conserva el comportamiento actual (sin resultados); una entidad
eliminada entre búsqueda y clic cae en el `notFound` o estado normal de la ruta destino.

## G. Estados e invariantes

- El cambio no escribe ni transforma estados de negocio.
- Un resultado nunca debe apuntar a una ruta que el mismo rol no pueda leer.
- El identificador de foco sólo selecciona una captación ya presente en el conjunto autorizado.
- El buscador no crea una fuente de verdad nueva para vehículos ni captaciones.

## H. Permisos

| Actor               | Compradores/vendedores/captaciones | Vehículos                    | Destino permitido            |
| ------------------- | ---------------------------------- | ---------------------------- | ---------------------------- |
| ADMIN               | Sí                                 | Sí                           | Fichas comerciales y tablero |
| AGENTE              | Sí                                 | Sí                           | Fichas comerciales y tablero |
| TALLER              | No                                 | No                           | Ningún resultado comercial   |
| ENTREGAS            | No                                 | No                           | Ningún resultado comercial   |
| MARKETING           | No                                 | No                           | Ningún resultado comercial   |
| Sin sesión/inactivo | Redirección de `requireAuth`       | Redirección de `requireAuth` | Login                        |

El enforcement permanece en la Server Action mediante el usuario autenticado; el cliente no decide
qué grupos puede recibir.

## I. Modelo de datos y migraciones

No aplica: no cambia Prisma, SQL, datos existentes, constraints, índices, RLS ni backfill.

## J. Writers y readers

| Componente             | Comportamiento actual                  | Cambio previsto                       | Riesgo                                   | Validación               |
| ---------------------- | -------------------------------------- | ------------------------------------- | ---------------------------------------- | ------------------------ |
| `search-actions.ts`    | Lee cuatro entidades y construye rutas | Alinear roles y destinos de captación | Resultado autorizado con enlace inválido | Tests de matriz y href   |
| `global-search.tsx`    | Botones + `router.push`                | `Link` nativo y cierre del diálogo    | Regresión de overlay                     | Typecheck, build y smoke |
| `captaciones/page.tsx` | Ignora query de foco                   | Validar `focus` contra cards leídas   | ID arbitrario                            | Caso inexistente         |
| `capture-board.tsx`    | Renderiza tarjetas                     | Desplazar una vez al objetivo válido  | Scroll inesperado                        | Test helper + smoke      |
| `capture-card.tsx`     | Tarjeta sin ancla/foco                 | ID estable y resaltado opcional       | Colisión DOM                             | ID prefijado             |

No hay writers, webhooks, cron, SQL raw, cachés o integraciones afectadas.

## K. Concurrencia e idempotencia

No aplica: todo el flujo es de lectura y navegación. Si una entidad cambia o se elimina entre la
búsqueda y el clic, la ruta destino resuelve el estado más reciente sin writes ni retry.

## L. Efectos secundarios e integraciones

No aplica: no se emiten Activities, emails, eventos, uploads, notificaciones ni llamadas externas.
No se añade instrumentación de PostHog porque no hay una pregunta de producto que la justifique.

## M. UX y errores

- Mantener loading, consulta mínima y vacío existentes.
- Enlaces utilizables con ratón y teclado, con semántica de navegación.
- Captación enfocada visible mediante scroll y ring temporal/estable mientras `focus` esté presente.
- Un `focus` desconocido no resalta nada ni revela información adicional.

## N. Tests

- Unitarios de `globalSearch`: consulta corta, ADMIN/AGENTE autorizados, roles no comerciales sin
  queries ni resultados, rutas de comprador/vendedor/vehículo, captación convertida y no convertida.
- Unitario del helper de foco: ID presente frente a inexistente.
- `pnpm check:sdd`, test puntual, `pnpm typecheck`, `pnpm lint`, `pnpm test` y `pnpm build`.
- Smoke posterior al despliegue, sólo tras autorización: un ejemplo por grupo y un caso negativo de
  rol disponible; sin mutar datos.

No se requiere integración PostgreSQL: las queries no cambian predicados de datos y la garantía de
autorización se decide antes de invocar Prisma; los mocks verifican que roles denegados no consultan.

## Rollout (O)

Código cliente/servidor en un único deploy, sin orden de DB. Antes de desplegar: CI completa y
Preview que no se use para mutar datos. Después: smoke autenticado de navegación y revisión breve de
errores de aplicación.

## P. Rollback y stop conditions

- Rollback: revertir el commit de SEARCH-1; no existe rollback de datos.
- Detener si un rol recibe un destino prohibido, una búsqueda ejecuta writes, el foco revela una
  captación fuera de la query autorizada, falla un caso negativo o aparecen archivos ajenos.
- No desplegar si CI, build o tests de autorización no están verdes.

## Q. Observabilidad

No se añade señal nueva. Tras un eventual deploy, revisar errores de navegación/runtime en Sentry y
logs durante el smoke, sin registrar consultas, nombres, teléfonos, emails ni otros datos personales.

## R. Documentación

Este change brief es la única fuente nueva. No cambia arquitectura, schema ni runbooks. Su estado se
actualizará sólo con evidencia real de implementación, PR, deploy y validación.

## S. Riesgos y deuda explícita

| Riesgo                                          | Probabilidad / impacto | Mitigación                                                        | Deuda                                   |
| ----------------------------------------------- | ---------------------- | ----------------------------------------------------------------- | --------------------------------------- |
| Enlace a ruta prohibida                         | Media / alta           | Matriz server-side y tests negativos                              | Ninguna tras el cambio                  |
| Captación rechazada dentro de `details` cerrado | Media / media          | Abrir el bloque si contiene el foco                               | Validar en smoke                        |
| Percepción de “ficha de vehículo”               | Media / baja           | Mantener destino vigente y excluir ruta nueva                     | Ficha dedicada queda fuera de alcance   |
| Carrera de respuestas del debounce              | Existente / baja       | Fuera de la regresión reportada; no ampliar alcance sin evidencia | Evaluar si aparece evidencia específica |

## Criterios de aceptación (T)

- [ ] Comprador y vendedor abren su ficha exacta.
- [ ] Vehículo abre su ficha operativa asociada sólo para ADMIN/AGENTE.
- [ ] TALLER, ENTREGAS y MARKETING no reciben resultados comerciales inaccesibles.
- [ ] Captación convertida abre vendedor; captación activa/rechazada abre y enfoca su tarjeta.
- [ ] Un foco inexistente no falla ni revela datos.
- [ ] No hay cambios de schema, datos, permisos generales ni dependencias.
- [ ] Tests, typecheck, lint y build proporcionalmente verdes.

## U. Estado de autorización

`PLAN READY FOR INDEPENDENT REVIEW`

La instrucción posterior “dale” autoriza crear el ticket, commit, push y PR de SEARCH-1 en la rama
indicada. Continúan prohibidos merge, deploy y mutaciones de datos o infraestructura. El siguiente
gate será revisar la CI y solicitar autorización para fusionar.

## Revisión adversarial

| Hallazgo adversarial                                                  | Materialidad | Corrección incorporada                        |
| --------------------------------------------------------------------- | ------------ | --------------------------------------------- |
| TALLER/MARKETING reciben vehículos que sólo abren una ficha comercial | Alta         | Alinear búsqueda con ADMIN/AGENTE server-side |
| Captación convertida tendría dos destinos canónicos                   | Media        | Priorizar la ficha de vendedor ya creada      |
| Un hash no abre de forma fiable las rechazadas colapsadas             | Media        | Query validada + `open` + scroll explícito    |
| Un ID arbitrario podría intentar enfocar contenido no cargado         | Baja         | Validar contra las captaciones ya autorizadas |
| Crear `/vehiculos/[id]` ampliaría alcance y permisos                  | Media        | Mantener la ficha operativa existente         |

## Matriz de completitud

| Área                               | Revisada | Evidencia                  | Riesgo pendiente                |
| ---------------------------------- | -------- | -------------------------- | ------------------------------- |
| Dominio/estados                    | Sí       | G                          | Sin writes                      |
| Permisos                           | Sí       | B, H, revisión adversarial | Smoke de rol posterior          |
| Concurrencia/idempotencia          | Sí       | K                          | No aplica a lectura             |
| Datos/legacy/migración             | Sí       | I                          | Ninguno                         |
| Compatibilidad/readers             | Sí       | J, M                       | Navegación de navegador         |
| Efectos/caché/superficies públicas | Sí       | L                          | Ninguno                         |
| Observabilidad                     | Sí       | Q                          | Revisión post-deploy pendiente  |
| Rollout/rollback                   | Sí       | O, P                       | Requiere autorización           |
| Documentación                      | Sí       | R                          | Actualizar estado con evidencia |

## Verificación

| Criterio                 | Evidencia prevista                  | Resultado                       |
| ------------------------ | ----------------------------------- | ------------------------------- |
| Destinos y matriz de rol | Unitarios de `globalSearch`         | 8 casos verdes                  |
| Foco válido/inexistente  | Unitarios del helper                | 2 casos verdes                  |
| Integridad estática      | `pnpm check:sdd`, typecheck, lint   | PASS                            |
| Regresión de runtime     | `pnpm test`, `pnpm build`           | PASS: 1.441 tests; build exit 0 |
| Producción               | Smoke posterior a deploy autorizado | No ejecutado                    |

## Cierre

- **Commit:** `31730f1` (implementación)
- **PR:** [#171](https://github.com/growthaiconsultant-lab/campernova-crm/pull/171)
- **CI:** pendiente sobre la PR; validación local completa
- **Deployment:** no realizado
- **Validación:** implementación local verificada; el build omitió la consulta remota de migraciones. Sentry devolvió 401 al intentar subir sourcemaps sin credenciales, sin bloquear el build.
- **Deuda restante:** ficha dedicada de vehículo fuera de alcance
