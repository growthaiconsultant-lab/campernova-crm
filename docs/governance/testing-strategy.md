# Estrategia de testing y validación

| Campo                            | Valor                                                                                                                        |
| -------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| **Título**                       | Estrategia de testing y validación                                                                                           |
| **Estado**                       | ACTIVE                                                                                                                       |
| **Owner**                        | Engineering                                                                                                                  |
| **Co-owners**                    | Security · Architecture · Data                                                                                               |
| **Última revisión**              | 2026-07-13                                                                                                                   |
| **Fuente de verdad relacionada** | Proceso: [`engineering-change-process.md`](engineering-change-process.md). CI: [`ci-quality-gates.md`](ci-quality-gates.md). |
| **Alcance**                      | Qué probar, con qué capa, antes/después del merge y tras el despliegue.                                                      |
| **Fuera de alcance**             | Implementación de tests concretos; configuración real de Sentry/PostHog.                                                     |

> Las cifras de esta página son **estado de referencia** (verificado en `main`); actualízalas cuando
> cambien legítimamente. **Sentry y PostHog no son tests automatizados** — son validación
> post-despliegue.

---

## 1. Tres momentos de verificación

### 1.1 Verificación pre-merge

Tests unitarios · integración PostgreSQL · migration replay · Supabase local · typecheck · lint ·
build · revisión del diff. Gate de merge: el job `quality` es **required** (ver
[`ci-quality-gates.md`](ci-quality-gates.md)).

### 1.2 Verificación post-merge

Workflows sobre `main` · integridad del squash · `main` local actualizado · ausencia de cambios no
autorizados.

### 1.3 Validación post-despliegue

Sentry · PostHog · logs · métricas · feature flags · funnels · reconciliación · feedback operativo.
**No** son tests automatizados; **no** sustituyen la verificación pre-merge.

---

## 2. Pirámide de tests real del repositorio

| Capa                               | Estado de referencia                                                                                                                                                                                        | Uso                                                                         | Comando                                                    |
| ---------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------- | ---------------------------------------------------------- |
| **Unitarios**                      | lógica pura, validaciones, reglas, helpers, servicios con deps inyectadas (conteo vivo en CI)                                                                                                               | reglas deterministas, casos límite, errores de dominio, regresiones rápidas | `pnpm test`                                                |
| **Integración PostgreSQL**         | PostgreSQL 17 efímero; transacciones, CAS, constraints, concurrencia, operaciones críticas — **garantías** (no conteos) en [`../quality/delivery-test-matrix.md`](../quality/delivery-test-matrix.md)       | garantías que dependen de la DB                                             | `pnpm test:integration` (prep: `test:integration:prepare`) |
| **Migration replay**               | baseline + migraciones; catálogo/parity/RLS/idempotencia. Los **conteos autoritativos y vigentes** los fija CI ([`.github/workflows/ci.yml`](../../.github/workflows/ci.yml), paso _Catalog verifications_) | reproducibilidad del esquema desde vacío                                    | job CI `migration-replay`                                  |
| **Supabase local**                 | buckets, policies, RLS, Storage, guard anti-remoto                                                                                                                                                          | Storage real                                                                | `pnpm test:supabase`                                       |
| **Typecheck / lint**               | integridad estática, convenciones, tipos                                                                                                                                                                    | —                                                                           | `pnpm typecheck` · `pnpm lint`                             |
| **Build / Vercel**                 | compilación, boundaries de runtime, imports, env de build                                                                                                                                                   | —                                                                           | `pnpm build` (o Preview de Vercel)                         |
| **Observabilidad post-despliegue** | Sentry, PostHog, logs, funnels, métricas                                                                                                                                                                    | detección de regresiones en runtime                                         | UI de Sentry/PostHog + logs                                |

---

## 3. Matriz cambio → tests (mínimo, no máximo)

| Tipo de cambio      | Unit             | Integration DB           | Migration replay | Supabase local  | Build        | Manual          | Post-deploy                      |
| ------------------- | ---------------- | ------------------------ | ---------------- | --------------- | ------------ | --------------- | -------------------------------- |
| Documentación       | según impacto    | no                       | no               | no              | opcional     | enlaces         | no                               |
| UI                  | sí si hay lógica | según datos              | no               | no              | sí           | flujo visual    | errores/adopción según impacto   |
| Regla de dominio    | sí               | si persiste/transacciona | no               | no              | sí           | casos límite    | reconciliación si afecta negocio |
| Query               | sí si es pura    | sí                       | no               | no              | sí           | reconciliación  | errores/latencia                 |
| Transacción/CAS     | sí               | **obligatorio**          | no               | no              | sí           | carrera         | conflictos/fallos                |
| Schema/migración    | según lógica     | **obligatorio**          | **obligatorio**  | según alcance   | sí           | revisión SQL    | errores/reconciliación           |
| Autorización        | sí               | obligatorio si usa DB    | no               | según Storage   | sí           | casos negativos | accesos denegados anómalos       |
| Storage             | sí               | según metadata DB        | según schema     | **obligatorio** | sí           | límites         | errores/huérfanos                |
| KPI                 | sí               | obligatorio si lee DB    | no               | no              | sí           | antes/después   | reconciliación                   |
| Integración externa | sí               | según persistencia       | no               | no              | sí           | fallo/retry     | success/failure rate             |
| CI/tooling          | según script     | según job                | según job        | según job       | según cambio | logs            | salud del pipeline               |
| Sentry/PostHog      | según lógica     | según persistencia       | no               | no              | sí           | payload/PII     | recepción y calidad              |

---

## 4. Qué probar por característica

- **Happy path** — el flujo esperado.
- **Validación** — datos inválidos, límites, nulos, enums, formato.
- **Autorización** — permitido, denegado, sesión ausente.
- **No encontrado** — entidad inexistente, referencias inválidas.
- **Concurrencia** — doble envío, dos actores, retry, carrera.
- **Idempotencia** — misma operación dos veces, misma key, reintento tras timeout.
- **Integridad** — FK, unique, CHECK, relación entre agregados.
- **Efectos externos** — éxito, timeout, fallo, retry, compensación.
- **Regresión** — caso que reproduce el defecto original.
- **Instrumentación** (cuando aplique) — error capturado una sola vez, contexto correcto, sin PII;
  evento emitido una sola vez, nombre estable, propiedades válidas; feature flag con default seguro y
  comportamiento con flag activo/inactivo; reset de identidad cuando corresponda.

---

## 5. Regla de test de regresión

Toda corrección de bug debe incluir, cuando sea técnicamente posible: (1) test que reproduzca el
defecto; (2) evidencia de que falla con el comportamiento anterior; (3) corrección mínima; (4) test
verde; (5) casos límite relacionados; (6) señal post-despliegue cuando el fallo pudiera reaparecer
silenciosamente. No es obligatorio alterar temporalmente el repo para demostrar el fallo, pero el
test debe **describir con claridad** la regresión cubierta.

---

## 6. Testing por dominio

### 6.1 Migraciones

Aplicar desde base vacía; aplicar sobre baseline; ejecutar la migración completa; segundo deploy;
parity; catálogo; constraints; RLS; backfill separado; datos legacy representativos; compatibilidad
de lectura; **rollback lógico** cuando el SQL no sea reversible; plan de observación; queries/métricas
de reconciliación. _(Prisma no usa `down migration`; no se exige ese mecanismo — el "rollback" es
lógico/additivo o restore.)_

### 6.2 Concurrencia

Patrones: dos operaciones simultáneas; sólo una gana; el perdedor recibe **error de dominio**; sin
duplicados; sin efectos externos duplicados; estado final consistente; retry seguro. Usar
**PostgreSQL real**, no mocks, cuando la garantía depende de la DB. Post-despliegue puede revisar
conflictos inesperados, errores CAS, retries, latencia y duplicados detectados por reconciliación.

### 6.3 Storage

Enlaza a [`supabase-storage.md`](supabase-storage.md). Comprobar: bucket correcto; private/public
esperado; MIME; extensión; tamaño; traversal; UUID path; `upsert:false`; signed URL; TTL (300s);
ausencia de public URL en privados; **authz previa**; compensación; delete; políticas deny-all; guard
anti-remoto; ausencia de datos sensibles en Sentry/PostHog; ausencia de URLs firmadas en logs.

### 6.4 KPIs y PostHog

**KPIs:** definición matemática; fuente canónica; timezone (Europe/Madrid); fecha
inclusiva/exclusiva; estados incluidos; cancelaciones; datos incompletos; reconciliación; comparación
con la fuente anterior durante la migración.
**Eventos PostHog:** pregunta que responde; nombre estable; momento exacto de emisión; **una emisión
por hecho**; propiedades mínimas; cardinalidad; sin PII; identidad; reset; compatibilidad con feature
flags; validación en entorno real cuando proceda.

> **Ejemplo (fact de venta canónico, implementado en PR #111):** la venta se valida contra la
> **base de datos** (`Vehicle.status=VENDIDO`/`soldAt`); PostHog puede medir la interacción del
> usuario con el flujo, pero **no** define si una venta ocurrió. Su batería incluyó unitarios,
> integración PostgreSQL, límites temporales `[inicio, fin)`, aislamiento por agente, preservación de
> `soldAt` y ausencia de _parsing_ de `Activity`.

### 6.5 Sentry

Definir: errores esperados que no deben generar ruido; excepciones inesperadas que sí deben
capturarse; boundaries server/client; captura duplicada; tags; context; breadcrumbs; redacción de
datos; filtros de PII; performance si está habilitado; source maps (parte de la integración vía
`SENTRY_AUTH_TOKEN`); validación posterior al despliegue. **No** exigir generar errores reales en
producción; usar entornos seguros o los mecanismos de prueba existentes.

---

## 7. Tests que NO deben escribirse (anti-patrones)

Tests que sólo reflejan la implementación; mocks que eliminan la garantía de DB; snapshots masivos
sin intención; tests duplicados sin valor; assertions triviales; tests dependientes del orden; tests
con tiempo real no controlado; tests que acceden a remoto; tests con secretos; tests de concurrencia
**simulados** que no usan PostgreSQL cuando la garantía depende de CAS/constraints; tests que sólo
verifican que `capture()` fue llamado sin validar el contexto; tests que fijan nombres de eventos sin
validar su semántica; instrumentación considerada válida sólo porque no rompe el build.

---

## 8. Datos de test

Factories; valores deterministas; UUIDs no sensibles; sin PII real; aislamiento; cleanup;
transacciones; timezone fijo; no depender de staging; no usar producción; no incluir URLs firmadas
reales; no compartir `service_role` real; no usar emails/teléfonos reales; **no** enviar eventos de
test a proyectos reales de Sentry/PostHog; marcar/aislar eventos de entornos no productivos cuando la
integración lo permita.

---

## 9. Protocolo de flakes

1. revisar logs; 2. identificar si falló **antes** de ejecutar código (infra); 3. distinguir
   infraestructura de defecto; 4. permitir **un único** re-run normal cuando haya evidencia; 5. **no**
   ocultar un fallo real; 6. registrar flakes recurrentes; 7. corregir tests no deterministas; 8. no
   bajar exigencias para hacer verde el pipeline; 9. no ignorar errores recurrentes de Sentry como
   "flake" sin análisis; 10. no considerar duplicados de eventos PostHog como ruido inevitable.

> Precedente real: en un PR documental el job `supabase-storage` falló en _"Set up job"_ con
> `Failed to resolve action download info · Service Unavailable` (infra de GitHub, antes de ejecutar
> pasos); se resolvió con re-run sin cambios. Ése es el patrón "flake de infraestructura".

---

## 10. Batería local estándar

```bash
pnpm install --frozen-lockfile
pnpm prisma validate
pnpm prisma generate
pnpm typecheck
pnpm lint
pnpm test
pnpm check:migration-history
```

Según el cambio, añadir: `pnpm test:integration` (+ `test:integration:prepare`), migration replay
(job CI), `pnpm test:supabase` (+ `assert:local-supabase`), `pnpm build`, pruebas específicas,
comprobación de instrumentación (tipos/payloads de eventos). _(Todos los comandos existen en
`package.json`; no inventar nombres.)_

---

## 11. Validación post-despliegue

Para cambios que la requieran, definir **antes del merge**: entorno; responsable; fecha/ventana;
métricas; errores esperados; errores no aceptables; dashboard o consulta; feature flag; porcentaje de
exposición; duración de observación; criterio de éxito; criterio de rollback.

Checklist conceptual (no marcar antes del despliegue real):

- [ ] No existen nuevos errores críticos en Sentry.
- [ ] No aumenta de forma anómala la tasa de errores.
- [ ] No se detecta PII en errores o eventos.
- [ ] Los eventos de PostHog llegan una sola vez.
- [ ] Las propiedades son correctas.
- [ ] La adopción o conversión se puede medir.
- [ ] Los datos de producto cuadran con la fuente transaccional cuando aplica.
- [ ] El feature flag funciona en ambos estados.
- [ ] Se ha definido retirar el feature flag.
- [ ] La funcionalidad puede mantenerse o debe revertirse.
