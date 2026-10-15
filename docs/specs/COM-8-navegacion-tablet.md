# COM-8 — Abrir el comprador pulsado en iPad

| Campo               | Valor                                      |
| ------------------- | ------------------------------------------ |
| **Estado**          | IMPLEMENTED                                |
| **Owner**           | Engineering                                |
| **Ticket**          | COM-8; petición del usuario del 2026-10-15 |
| **Rama / PR**       | codex/com-8-navegacion-tablet; sin PR      |
| **Categorías**      | C0, C1, C9                                 |
| **Riesgo**          | Bajo                                       |
| **Ruta SDD**        | Estándar                                   |
| **Última revisión** | 2026-10-15                                 |

## Problema y evidencia

El usuario informa que iPad con Safari y Chrome abre siempre el mismo comprador.
Reproducción local con ActionableTable real, tres registros ficticios y WebKit 26.4:
a 1024 y 1180 px todas las filas abren el último registro; Chromium y tarjetas a
768 px abren el correcto. El pseudo-elemento absoluto se dimensiona al viewport
porque WebKit no usa el tr relativo como contenedor. Baseline origin/main
1326a90; no hay cambios en consultas ni selección del ID.

## Resultado esperado

Cada nombre, celda informativa y margen de celda abre exclusivamente su propia
ficha en WebKit y Chromium. Controles de edición y acciones mantienen su función.

## Reglas e invariantes

- Mantener enlaces nativos, teclado y navegación de tarjetas.
- No convertir toda la tabla a Client Component ni pasar callbacks del servidor.
- No superponer enlaces a selectores ni anidar enlaces en acciones existentes.
- Sin cambios de datos, permisos, estado, migraciones o dependencias.

## Fuera de alcance

Medición de rendimiento general y cambios de negocio. La publicación remota fue
autorizada posteriormente por el usuario el 2026-10-15.

## Decisiones

| Decisión         | Alternativas                                       | Resolución y motivo                                                                |
| ---------------- | -------------------------------------------------- | ---------------------------------------------------------------------------------- |
| Área pulsable    | Overlay de fila / manejador JS / enlaces por celda | Enlaces nativos contenidos por td, compatible con WebKit y render de servidor      |
| Celdas editables | Inferir del CSS / configuración explícita          | rowLink=false; \_\_cta mantiene su navegación independiente                        |
| Teclado          | Tab por cada celda / entrada principal             | Sólo el enlace principal entra al orden de tabulación, además de controles propios |

## Plan técnico

1. Prueba de navegador aislada del backend, HTML real del componente y Tailwind real.
2. Anclar overlays a cada celda informativa y excluir celdas editables del comprador.
3. Verificar fallo previo y éxito posterior, tipos, lint, SDD y compilación local.

### Impacto

- **Código y consumidores:** tabla compartida de compradores, vendedores, ofertas/reservas y taller.
- **Datos/migraciones:** ninguno.
- **Permisos/seguridad:** sin cambios; fixtures ficticios sin backend.
- **Concurrencia/idempotencia:** no hay escrituras nuevas.
- **Integraciones/efectos externos:** ninguno.
- **Observabilidad/KPIs:** sin cambios.

## Criterios de aceptación

- [x] WebKit y Chromium abren tres destinos distintos en orden normal e inverso.
- [x] Vistas de 768, 1024, 1180 y 1366 px; nombre, celda informativa y padding.
- [x] Selectores, enlaces CTA, teclado y botones fuera de tabla no son interceptados.
- [x] Tarjetas con/sin acciones y tablas sin rowHref mantienen su comportamiento.
- [x] Tipos, lint, SDD y compilación superados.

## Verificación

| Criterio             | Evidencia ejecutada                                                         | Resultado                                                                                                                                                                                |
| -------------------- | --------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Reproducción previa  | Playwright WebKit, caso de 1024 px, componente original                     | FALLA: tres pulsaciones de test-1 llegan a test-3                                                                                                                                        |
| Navegación corregida | `pnpm test:table-navigation`                                                | 12 casos superados en Chromium y WebKit; HTML del componente real y CSS Tailwind, sin backend                                                                                            |
| Controles reales     | `node .artifacts/com-6-ui/check.mjs`, fixture actualizado con rowLink=false | Superado: estados, origen, temperatura, responsable, próxima acción, errores y navegación; escritorio/móvil; backend simulado. Capturas revisadas                                        |
| Unitarios            | `pnpm test`                                                                 | 141 archivos / 1.835 tests superados. Test de vendedores actualizado para verificar destino de todas las celdas por fila, sin fijar un número de enlaces                                 |
| Checks estáticos     | `pnpm typecheck`, `pnpm lint`, `pnpm check:sdd`, `git diff --check`         | Superados                                                                                                                                                                                |
| Compilación          | `pnpm exec next build --experimental-build-mode compile`                    | Superada (exit 0), DB local ficticia y Sentry sin token; sin prerender ni comprobación remota de migraciones. Advertencias de Sentry sobre modo experimental/deprecación y caché webpack |

La suite queda incluida en el job quality de CI. Para ejecutarla en un entorno nuevo:
`pnpm exec playwright install --with-deps chromium webkit` y
`pnpm test:table-navigation`. En Windows se usó Chrome instalado mediante
`TABLE_TEST_CHROMIUM_PATH`; WebKit es el binario de Playwright.
No se ejecutaron integración DB ni migraciones: no cambian consultas o persistencia.

## Rollout, rollback y stop conditions

- **Rollout:** el usuario autorizó explícitamente commit, push, PR, merge y despliegue el 2026-10-15. Publicar por PR con todos los checks verdes, squash a main y despliegue automático de Vercel. Sin migración ni cambios de variables o datos.
- **Rollback/mitigación:** revertir el cambio de tabla y sus opciones; ninguna migración.
- **Detener si:** un control queda interceptado o una celda abre otra fila.
- **Validación post-despliegue:** abrir tres compradores en el iPad afectado, en ambas orientaciones, y comprobar nombre/URL sin escrituras.

## Revisión adversarial

| Riesgo intentado                               | Mitigación o riesgo pendiente                               |
| ---------------------------------------------- | ----------------------------------------------------------- |
| Overlay captura otra fila o botones externos   | Prueba con coordenadas reales en dos motores                |
| Selector o CTA abre ficha                      | Exclusión explícita, controles y rutas alternativas en test |
| Tests UI acceden a producción                  | setContent con registros ficticios, sin servidor ni DB      |
| Safari del dispositivo difiere de WebKit local | Validación pendiente en iPad real tras publicación          |

## Cierre

Verificación local documentada arriba. Publicación autorizada, pendiente de CI y
despliegue. La PR registrará commit fusionado, CI y deployment verificables.
Sigue pendiente la comprobación en el iPad del usuario tras publicación.
