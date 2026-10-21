# COM-11 — Guardado automático de la ficha del comprador

| Campo           | Valor                                             |
| --------------- | ------------------------------------------------- |
| **Estado**      | IMPLEMENTED                                       |
| Owner           | Engineering                                       |
| Ticket          | Petición del propietario en este chat, 2026-10-21 |
| Rama / PR       | `codex/compradores-autoguardado`; local           |
| Categorías      | UI, persistencia parcial                          |
| Riesgo          | Medio                                             |
| Ruta SDD        | Reforzada para concurrencia de guardados          |
| Última revisión | 2026-10-21                                        |

## Problema y evidencia

HECHO: el formulario único de datos y preferencias depende de «Guardar cambios».
Los comerciales olvidan pulsarlo. La petición muestra las preferencias de búsqueda.
INFERENCIA de alcance: los dos bloques del mismo formulario deben guardarse de igual modo.

## Resultado esperado

Guardar automáticamente 800 ms después de dejar de editar, con estado visible y persistente.
Los errores mantienen lo escrito y permiten reintentar. Enlaces de navegación esperan al
guardado; cerrar o recargar con cambios pendientes activa el aviso del navegador.

## Reglas e invariantes

- Una petición en vuelo por ficha; los cambios posteriores se envían al terminar.
- Sólo se escriben campos modificados; no sobrescribir otro campo editado por otro comercial.
- Validación y permisos del servidor existentes, incluidas restricciones de cierre/asignación.
- No guardar al cargar, ni repetir guardados fallidos indefinidamente.
- No indicar Guardado antes de confirmación; conservar datos ante fallo y validación incorrecta.
- Sin nuevos almacenes de PII, secretos, migraciones ni dependencias.

## Decisiones y plan técnico

1. Controlador de debounce, cola serial y estado, reutilizando la Server Action de actualización.
2. Lista opcional de campos validada en servidor: clientes anteriores conservan envío completo.
3. Integrar en el formulario; barra persistente, reintento y protección de navegación por enlaces.
4. Tests unitarios de carreras/errores, integración de escritura parcial y UI escritorio/móvil.

### Impacto

- Código: formulario comprador y acción existente; sin cambios en notas, eventos ni trade-in.
- Datos: mismos campos, sin schema/migración. Campo coincidente entre pestañas: último guardado gana.
- Seguridad: requireAgente y Zod existentes; nombres de campos validados contra el schema.
- Concurrencia: serialización cliente y escrituras parciales; no cambia el protocolo de estados.
- Efectos: matching y revalidación existentes por guardado agrupado. Sin mensajes externos.
- Observabilidad: estado accesible en UI; no logs de valores del formulario.

## Fuera de alcance

Autoguardar notas nuevas o acciones sin confirmar, otros formularios, edición colaborativa en vivo,
recuperación tras cierre forzado del proceso y funcionamiento offline. El historial Atrás/Adelante
del navegador no puede bloquearse de forma fiable desde App Router; usar enlaces internos protegidos.

## Criterios de aceptación

- [x] Texto, números, desplegables y casillas persisten sin pulsar Guardar.
- [x] Cambios rápidos se agrupan; ediciones durante una petición no se pierden.
- [x] Error de red/servidor o validación conserva entrada y permite reintentar/corregir.
- [x] Guardado parcial no revierte estado, agente ni otros campos no modificados.
- [x] Navegación por enlaces espera y no sale si el guardado falla; handler de aviso al cerrar con pendientes.
- [x] Estados accesibles en escritorio y móvil; validaciones y autorización conservadas.

## Verificación

- Typecheck, lint, SDD y diff: PASS.
- Suite unitaria completa: 1.883 tests / 146 archivos PASS. Tras reforzar el test de nombres de campo,
  nueva ejecución focalizada de acciones y controlador: 38 PASS.
- PostgreSQL local aislado (127.0.0.1:55441): 4 tests PASS. Escrituras simultáneas sobre campos
  distintos conservan ambas ediciones; persisten null/casillas; rechazan validación, cierre y falta de autorización.
- Playwright: 22 casos PASS (12 autoguardado y 10 regresión de notas/acciones), Chrome escritorio
  y WebKit móvil. Incluye errores, edición durante petición, salida por enlace, handler beforeunload y ancho móvil.
- Primera ejecución UI detectó etiquetas de presupuesto/cuota vinculadas al contenedor; corregidas
  para vincular al input. Revisión visual con datos ficticios completada.
- `pnpm build`: PASS con configuración local y placeholders de Supabase. Compilación, lint/tipos y
  generación de páginas correctos; guard remoto omitido correctamente por entorno local, sin conexión
  a producción. Advertencias preexistentes de Prisma config, Sentry y Browserslist, no bloqueantes.

## Rollout, rollback y stop conditions

- El propietario autoriza expresamente publicar COM-11 en el CRM en este chat (2026-10-21).
- Publicar mediante PR con CI correcto, squash merge y deployment del SHA fusionado.
- Preflight: verificar main, checks y proyecto Vercel de campernova-crm. Sin migraciones ni cambios de configuración.
- Smoke autenticado de lectura en campersnova.com: indicador de autoguardado y formulario operativo,
  sin crear datos ficticios ni modificar preferencias de clientes reales.
- Rollback: revertir código; conserva datos ya guardados. Sin operación de base de datos.
- Detener ante pérdida de edición, envío repetido, campo ajeno modificado o checks fallidos.

## Revisión adversarial

- Respuesta lenta: cola serial; snapshot confirmado separado del texto actual.
- Revertir un campo mientras se guarda: se vuelve a enviar el valor revertido.
- Dos fichas abiertas: actualizar sólo campos cambiados; un mismo campo sigue último guardado gana.
- Error: no borrar valores ni afirmar éxito; reintento manual o siguiente edición.
- Cierre inmediato/forzado: aviso best effort; no prometer persistencia sin respuesta del servidor.

## Cierre

Implementado y probado localmente. Sin commit, PR, CI ni deployment de COM-11 todavía.
Publicación autorizada; pendiente CI, deployment y comprobación autenticada. Registrar sus identificadores en PR.
