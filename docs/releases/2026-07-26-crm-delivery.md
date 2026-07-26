# Entrega CRM — 2026-07-26

> Handoff de entrega. Registra **exactamente** lo entregado, lo validado y lo **no** validado.
> No sustituye al Project Brief: la consolidación del estado definitivo se hará tras la revisión
> de consistencia y seguridad prevista para el día siguiente.

## 1. Resumen

|                              |                                                                           |
| ---------------------------- | ------------------------------------------------------------------------- |
| **Fecha de entrega**         | 2026-07-26                                                                |
| **Objetivo**                 | Reducir el riesgo visible de la demo sin ampliar alcance ni tocar dominio |
| **Versión entregada**        | `main` tras el squash del PR #134                                         |
| **Commit**                   | `62074adb07f3a723625a2e5c16cd85041d828b41`                                |
| **Deployment de Production** | `dpl_8viUyh8kXA6zZd3syLjFpKBrzdf9` · `target=production` · `state=READY`  |
| **Dominio validado**         | `https://campersnova.com`                                                 |

El deployment de producción ejecuta **exactamente** el commit de `main`.

## 2. Cambios incluidos

**Único cambio funcional: error boundary general del backoffice.**

- Archivo: `app/(backoffice)/error.tsx` (nuevo, 41 líneas).
- **Propósito:** las rutas del grupo que no definen su propio boundary (calendario, los 7 dashboards
  de analytics, usuarios) escalaban a `app/global-error.tsx`, que reemplaza el documento entero y
  hace perder el shell del CRM. Era el fallo más visible posible durante una demo.
- Reutiliza `ErrorState` y `ButtonLink` del kit existente; registra en Sentry con el mismo patrón
  que `global-error.tsx`. Acciones: **Reintentar** y **Volver al dashboard**.

**Confirmado ausente en esta entrega:** migraciones · cambios de schema · cambios de datos ·
backfill · cambios de permisos o capacidades · lógica de negocio · cambios de rutas · dependencias
nuevas.

> El bloque **A1** (fundamentos de entrada oficial) **no forma parte de esta entrega**. Ver §8.

## 3. Evidencia técnica

Se distinguen explícitamente los cuatro niveles de validación.

### 3.1 Validación local (rama de entrega, antes del merge)

| Comprobación              | Resultado                                                     |
| ------------------------- | ------------------------------------------------------------- |
| `npx prisma generate`     | OK — cliente byte-idéntico al `schema.prisma` de `main`       |
| `pnpm typecheck`          | exit 0                                                        |
| `pnpm lint`               | exit 0, sin warnings                                          |
| `pnpm test`               | exit 0 — **1215 tests / 90 archivos**                         |
| `pnpm build` (producción) | exit 0 — incluye el guard `check-remote-migrations`, que pasó |
| `git diff --check`        | exit 0                                                        |

### 3.2 CI (PR #134)

**4/4 jobs verdes:** `quality`, `integration`, `migration-replay`, `supabase-storage`.
Checks de Vercel: pass.

### 3.3 Deployment

Deployment `dpl_8viUyh8kXA6zZd3syLjFpKBrzdf9`, `target=production`, `state=READY`, commit
`62074ad`. Sin migraciones pendientes introducidas por este PR. Ningún secreto modificado.

### 3.4 Validación de producción (post-deployment)

- **Rutas públicas** → HTTP 200: `/`, `/login`, `/comprar/vehiculos`, `/vender`.
- **Protección de rutas sin sesión** → HTTP **307 → `/login`**: `/dashboard`, `/vendedores`,
  `/compradores`, `/ofertas`, `/entregas`.
- **Smoke test autenticado** con sesión real de administrador: sin errores (§4).
- **Observabilidad inmediata:** 0 errores de runtime en Vercel tras el despliegue. Sin 500, sin
  `P2022`. El nuevo error boundary **no llegó a activarse** porque no falló nada.

### 3.5 Variable de entorno

`SUPABASE_SERVICE_ROLE_KEY`: **CONFIGURED** en el entorno **Production** (marcada como _Sensitive_).
Verificada **únicamente su presencia y ámbito**; su valor no ha sido revelado, copiado ni registrado.

## 4. Flujos comprobados

Verificados **tras el despliegue**, con sesión autenticada real y **sin modificar datos**.

| Flujo                          | Resultado                                                          |
| ------------------------------ | ------------------------------------------------------------------ |
| Dashboard                      | OK — KPIs, "Tu día priorizado", "Agenda de hoy"                    |
| Vendedores (listado)           | OK — 47 registros, vistas y filtros                                |
| Ficha de vendedor              | OK — hero, KPIs, 6 pestañas, rail                                  |
| Vehículo (pestaña Preparación) | OK — datos del vendedor y del vehículo                             |
| Documentos / expediente legal  | OK — datos legales, 11 categorías documentales, estado técnico     |
| Compradores (listado)          | OK — 113 registros, vistas y filtros                               |
| Matching desde ficha           | OK — matches con score, explicación (motivos y riesgos) y acciones |
| Ofertas y reservas             | OK — 4 KPIs y estados vacíos correctos                             |
| Calendario                     | OK — vista semana, filtros por origen, leyenda                     |
| Taller (+ agenda)              | OK                                                                 |
| Entregas                       | OK — estado vacío correcto                                         |
| Postventa                      | OK — estado vacío correcto                                         |
| Protección de rutas privadas   | OK — 307 → `/login` sin sesión                                     |

Durante la comprobación **no** se aceptaron ofertas, **no** se completaron entregas, **no** se
archivó nada y **no** se crearon operaciones económicas.

## 5. No validado

Se registra explícitamente como **no validado**, no como completado:

1. **Login nuevo mediante enlace mágico: no ejercitado.** El smoke test usó una sesión ya activa.
   La protección de rutas sí se verificó de forma independiente (307 → `/login`).
2. **Detalle de una entrega con documentos: no ejercitado.** Existen **0 entregas** en producción,
   así que la ruta que firma URLs de documentos de entrega nunca se ha ejecutado. La variable
   necesaria está `CONFIGURED`, lo que mitiga el riesgo pero **no** lo prueba.
3. **Observación de 24 horas: pendiente.** Lo comprobado es una observación **inmediata** posterior
   al despliegue, no una ventana de 24 h.
4. **Exactitud operativa de analytics: no validada.** Las pantallas cargan; la corrección de las
   métricas como reflejo del negocio no se ha verificado.

## 6. Exclusiones de la demo

- **No abrir `/matches`** — es un stub ("próximamente"), no enlazado en el menú.
- **No abrir `/ajustes`** — es un stub sin contenido real.
- **No presentar "N compradores esperando" como demanda validada** (ver §7).
- **No presentar analytics como métricas consolidadas**; son información disponible, no cifras
  operativas verificadas.
- **No crear ni aceptar operaciones económicas reales** durante la demo.

## 7. Riesgos conocidos

1. **Candidatos en `NUEVO` pueden mostrar matches incorrectos.** El recálculo iniciado desde un
   vehículo no comprueba la elegibilidad del propio vehículo, de modo que un candidato sin tasar
   aparece con compradores compatibles. **Es visible en la interfaz** (p. ej. "10 compradores
   esperando" en un vehículo sin tasar y con expediente al 13 %). No presentarlo como señal
   comercial fiable.
2. **`/vehiculos` requiere revisión de permisos por rol**: no aplica guard de rol, por lo que roles
   no comerciales podrían ver stock y márgenes. Pendiente de auditoría con roles reales.
3. **Ausencia de `loading.tsx`/`error.tsx` específicos** en algunas páginas (los 7 analytics,
   usuarios). El boundary general entregado hoy mitiga el impacto visual, no la causa.
4. **Los datos de producción no son una muestra válida** para medir adopción, rendimiento ni
   cumplimiento del proceso: el CRM está desplegado técnicamente pero aún no en uso operativo
   completo.
5. **Entrega con documentos sin prueba real** (ver §5.2).

## 8. Estado de PRs

### PR #134 — `fix(ui): add backoffice error boundary`

- **Fusionado** en `main` por squash (`62074ad`).
- **Desplegado** en Production (`dpl_8viUyh8kXA6zZd3syLjFpKBrzdf9`, READY).
- **Validado inmediatamente** tras el despliegue.

### PR #133 — `feat(vehicle): add official entry schema foundations` (A1)

- **Draft**, abierto.
- **No fusionado.**
- **No desplegado** (sus deployments son _preview_, nunca producción).
- **Su migración no está aplicada** en ninguna base de datos remota.
- **Fuera de esta entrega.**
- Integración pendiente por un test estructural de migraciones: su `beforeAll` asume que la
  migración de _contract_ es la última, y una séptima migración posterior rompe esa suposición.
  `migration-replay`, `quality` y `supabase-storage` sí quedaron verdes.

## 9. Deuda y revisión del día siguiente

1. Revisión integral de lo desarrollado bajo urgencia.
2. Tests de integración, concurrencia y migraciones.
3. RLS y permisos.
4. Locks, CAS, atomicidad e idempotencia.
5. Elegibilidad de matching: separación candidato / stock.
6. A1 (PR #133) y su test estructural de migraciones.
7. A2 y A3 (entrada oficial funcional, valoración preliminar vs tasación oficial).
8. B1A **antes** de aceptar señales económicas reales en el CRM.
9. Revisión de permisos de `/vehiculos`.
10. Observación de producción y Sentry durante 24 h.
11. Actualización posterior del Project Brief con el estado consolidado.

## 10. Estado final

| Dimensión                     | Estado                                                                                            |
| ----------------------------- | ------------------------------------------------------------------------------------------------- |
| **Implementado**              | Error boundary general del backoffice                                                             |
| **Fusionado**                 | Sí — `62074ad` en `main`                                                                          |
| **Desplegado**                | Sí — Production READY con ese commit                                                              |
| **Validado inmediatamente**   | Sí — rutas públicas, protección de rutas, 12 flujos autenticados, 0 errores                       |
| **No observado durante 24 h** | Correcto: la observación es inmediata, no de 24 h                                                 |
| **Pendientes**                | Login por enlace mágico · entrega con documentos · exactitud de analytics · riesgos §7 · deuda §9 |

**Este documento no afirma** que el CRM completo esté exhaustivamente auditado, que sea seguro en
todos los escenarios, ni que esté operativamente adoptado. Registra lo entregado y verificado el
2026-07-26, y lo que queda explícitamente fuera.
