# ENT-1 — Añadir comprador desde una entrega y explicar los datos pendientes

| Campo               | Valor                                                |
| ------------------- | ---------------------------------------------------- |
| **Estado**          | IMPLEMENTED                                          |
| **Owner**           | Engineering / Operaciones                            |
| **Ticket**          | ENT-1; petición del usuario de 2026-10-07            |
| **Rama / PR**       | codex/delivery-validation-feedback; PR pendiente     |
| **Categorías**      | C0, C1, C2, C3, C5, C6                               |
| **Riesgo**          | Alto: contacto personal, persistencia y concurrencia |
| **Ruta SDD**        | Reforzada                                            |
| **Última revisión** | 2026-10-07                                           |

## Problema y evidencia

- VERIFICADO EN CÓDIGO: main remoto `3539717`; el formulario de nueva entrega interpreta el
  texto de TargetPicker como búsqueda y sólo admite destinatarios con ficha. Su aviso agrupa
  vehículo, tipo, destinatario y fecha, aunque sólo falte un dato.
- VERIFICADO EN CÓDIGO: BuyerLead exige nombre, email y teléfono. La creación comercial requiere
  agente; las entregas operativas admiten ADMIN, TALLER y ENTREGAS activos.
- DECISIÓN DOCUMENTADA: el usuario pide mensajes claros y confirma que quiere añadir un comprador
  nuevo desde la entrega. El 2026-10-07 autoriza expresamente publicarlo: commit, push, PR, CI,
  merge y despliegue de este alcance. No requiere migraciones ni cambios de configuración.
- VERIFICADO EN CÓDIGO: creación operativa con locks de vehículo/destinatarios, clave de operación
  y fingerprint. Programar y cancelar no registran ventas ni revierten reservas.
- DESCONOCIDO EN ENTORNO: comportamiento autenticado en producción; no se realizan escrituras allí.

## Resultado esperado

El usuario elige comprador existente o nuevo. Para nuevo introduce los mismos contactos obligatorios
del CRM; al crear la entrega se guarda una ficha real vinculada a ella. Los errores identifican el
campo pendiente. El buscador explica que escribir no selecciona ni crea una ficha.

## Reglas e invariantes

- Mantener permisos de entregas, pausa operativa y reglas de venta/cancelación vigentes.
- Nuevo comprador sólo para destinatario comprador (venta o entrega de taller), nunca devolución.
- Contactos validados y acotados en servidor; ficha y entrega se guardan en una transacción.
- Replay idéntico no crea otra ficha; misma clave con otros datos se rechaza.
- Serializar altas de este flujo por email y teléfono normalizados. Si ya hay ficha con ese contacto,
  rechazar y pedir seleccionar la existente; no unir personas silenciosamente.
- Conservar ficha al cancelar: es un contacto real y no un dato temporal de entrega.
- No modificar schema, políticas globales ni el alta comercial. La deduplicación concurrente de ese
  writer comercial es deuda previa; no se presenta el lock de este flujo como garantía global.
- No crear matches especulativos sin preferencias. Registrar alta en KPI y auditoría transaccionales,
  con IDs y sin contactos en logs/metadata. Defaults de estado NUEVO y próxima acción canónicos.

## Decisiones

Nombre, email y teléfono siguen siendo obligatorios conforme al modelo y formulario comercial.
No admitir un nombre suelto ni fabricar email/teléfono. No forzar duplicados desde Taller.
El comprador nuevo no necesita lock de fila antes del insert: aún no es visible a otras transacciones.
Los locks de contacto se adquieren ordenados después de las raíces existentes; no adquieren otras
raíces después y se liberan con commit/rollback.

## Plan técnico e impacto

1. Extender sólo destinatario de entrega manual con una variante de comprador nuevo y mensajes
   compartidos de validación Zod para cliente/servidor.
2. Resolver el destinatario dentro del núcleo transaccional; insertar ficha, KPI, entrega y auditoría
   bajo la clave existente. Conservar los callers anteriores.
3. Añadir elección explícita en UI, datos de contacto y ayudas de búsqueda. Conservar datos tras error.
4. Validar tipos, lint, unitarios de schema/acciones, integración real de atomicidad/replay/carreras
   y revisión del formulario. No ejecutar pruebas contra staging/producción.

Datos/migraciones: sin migraciones. Permisos: sólo alta mínima dentro de una entrega para roles ya
autorizados. Integraciones: sin correos ni llamadas externas. Observabilidad: KPI existente y Activity.

## Criterios de aceptación

- [x] Error específico para cada campo; existente sin seleccionar no se interpreta como alta.
- [x] Alta válida crea una ficha y una entrega vinculadas; contactos inválidos no escriben.
- [x] Reintento/doble ejecución no duplica; concurrencia con mismo contacto falla de forma clara.
- [x] Error de entrega revierte ficha y KPI; roles no permitidos no pueden crear ficha.
- [x] Cancelar conserva ficha y permite otra entrega; completar conserva las reglas de venta.

## Verificación

Validación local del 2026-10-07:

| Criterio                                                       | Evidencia                                                                                                                                                                             | Resultado                                   |
| -------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------- |
| Contactos y errores por campo; autorización previa             | Vitest `lib/operations-input.test.ts` y `app/(backoffice)/operaciones/actions.test.ts`                                                                                                | 43 tests pasan                              |
| Atomicidad, rollback, replay, cancelación, garantía y permisos | PostgreSQL 17.11 efímero en localhost, 17 migraciones canónicas aplicadas; `tests/integration/operational-flows.test.ts`                                                              | 32 tests pasan                              |
| Carrera por email/teléfono en vehículos diferentes             | Insert ganador retenido dentro de la transacción; `pg_stat_activity` prueba que el rival espera por lock antes de liberar                                                             | Pasa: una ficha/entrega y rechazo del rival |
| Formulario interactivo                                         | Chrome aislado, componente real y acciones simuladas; selección pendiente, alta nueva, email inválido, conservación de campos y clave en retry, ficha existente y cambio a devolución | Pasa; no es E2E autenticado                 |
| Tipos, lint, formato y gobierno                                | `tsc --noEmit`, ESLint sobre archivos cambiados, Prettier y `check-sdd`                                                                                                               | Pasan                                       |

El 2026-10-07, antes de publicación, la suite unitaria completa pasa: 123 archivos y 1588 tests.
CI, Preview, staging y producción pendientes al preparar este commit. Sin schema nuevo ni migraciones nuevas.
Los artefactos del harness y de PostgreSQL viven en `.artifacts/` (ignorados por Git); sólo hay datos
sintéticos. Copia aislada en el workspace actual; no se modifica el checkout de otras tareas.

## Rollout, rollback y stop conditions

Publicación autorizada por el usuario el 2026-10-07: PR con CI, squash-merge a main y despliegue
automático de Vercel. Verificar SHA y estado Production y realizar smoke de sólo lectura.
No crear compradores, entregas ni ventas reales para probar producción. Sin cambio de DB.
Rollback de código: las fichas ya creadas siguen siendo válidas y las entregas usan las FK existentes.
Detener por duplicación, datos parciales, cambios en venta o ampliación del acceso comercial.
Validación funcional de escritura: pruebas locales anteriores. Smoke post-despliegue de lectura;
el E2E autenticado de escritura no se presenta como ejecutado en producción.

## Revisión adversarial

Cubrir payload incompatible, campo vacío, contactos duplicados/formateados, usuario inactivo,
doble envío, rollback por fallo final y petición con clave reutilizada y payload distinto.

## Cierre

Commit/PR/CI/deployment: pendientes al preparar este commit; publicación autorizada para ENT-1.
La PR y el informe de publicación registrarán las URLs, SHA y resultado real del despliegue.
