# OPS-1 — Documentos operativos y entregas manuales para Taller

| Campo               | Valor                                                  |
| ------------------- | ------------------------------------------------------ |
| **Estado**          | APPROVED                                               |
| **Owner**           | Engineering / Operaciones                              |
| **Ticket**          | OPS-1; seguimiento externo no creado                   |
| **Rama / PR**       | `codex/ops-1-taller-documentos-entregas`; sin PR       |
| **Categorías**      | C0, C1, C2, C3, C4, C5, C6, C7                         |
| **Riesgo**          | Alto: documentos privados, permisos y efectos de venta |
| **Ruta SDD**        | Reforzada                                              |
| **Última revisión** | 2026-09-29                                             |

## Problema y evidencia — A. Objetivo / B. Baseline

> **Estado vivo (2026-09-29): implementación funcional local, no publicada.** La excepción
> documental fue autorizada expresamente en este chat (respuesta «claro que acepto»): sólo código
> y QA locales, conservando históricos. No cierra el gate operativo Fase 0 ni autoriza remoto.
> Ahora existen adjuntos por vehículo/comprador/vendedor y entregas independientes para TALLER.
> APPROVED se mantiene hasta verificar Storage real y UI autenticada. Las notas iniciales de §U
> se conservan como historial; ya no son el estado de implementación.
> Publicación autorizada posteriormente: commit, push, PR, CI y generación de Vercel Preview.
> No autoriza migraciones remotas, cambios de configuración, merge ni producción.

Operaciones necesita adjuntar presupuestos/documentos a cualquier vehículo o cliente concreto y
gestionar entregas físicas sin tener que construir antes un match, oferta o reserva. El usuario
confirmó que debe aplicarse a **todos los usuarios activos con rol TALLER**, no a un email concreto,
y delegó elegir la solución recomendada. No se debe confundir retirar requisitos de flujo con
retirar autorización, integridad referencial o protección de archivos privados.

Baseline local: `origin/main` obtenido mediante fetch, commit `72dbc47`. El trabajo se prepara en
un worktree aislado, sin modificar el trabajo de E2E ni SEARCH-3. El commit local no demuestra qué
commit sirve actualmente cada despliegue remoto.

| Clasificación         | Evidencia                                                                                                        | Conclusión                                                                                                                                                                                       |
| --------------------- | ---------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| VERIFICADO EN CÓDIGO  | `lib/auth.ts`, helpers de Entregas y `requireAgente`                                                             | TALLER no puede gestionar entregas ni usar las acciones comerciales de documentos.                                                                                                               |
| VERIFICADO EN CÓDIGO  | `app/(backoffice)/vendedores/[id]/legal-actions.ts`, `lib/storage/versioned-documents.ts`                        | Los documentos de vehículo tienen subida privada, versiones, compensación y descarga autorizada. No deben sustituirse por URLs públicas.                                                         |
| VERIFICADO EN CÓDIGO  | `app/(backoffice)/compradores/[id]/page.tsx`, pestaña documentos                                                 | La UI de documentos de comprador es un placeholder. No basta con añadir un rol a un botón.                                                                                                       |
| VERIFICADO EN CÓDIGO  | `prisma/schema.prisma`, modelos `Delivery`, `Document`, `VehicleDocument`, `DeliveryDocument`, `DocumentVersion` | Delivery exige comprador y oferta. El Document legacy no equivale al modelo privado versionado. DocumentVersion tiene dos tipos de raíz y constraints manuales.                                  |
| VERIFICADO EN CÓDIGO  | `lib/delivery-creation.ts`, `lib/delivery-completion.ts`                                                         | Se exige oferta CONVERTIDA, vehículo RESERVADO, checklist y firma; completar provoca venta y garantía.                                                                                           |
| DECISIÓN DOCUMENTADA  | `docs/governance/engineering-change-process.md`, §15; `docs/operations/fase-0-operational-closeout.md`           | Las tablas documentales constan congeladas hasta cierre operativo; no se autoriza saltar ese gate.                                                                                               |
| VERIFICADO EN ENTORNO | Consulta agregada de sólo lectura mediante conector Supabase; project ref confirmado `bbmglaatlyilxutzomxd`      | 227 VehicleDocument, ninguno sin currentVersionId; 227 DocumentVersion, todas en vehicle-documents; 0 DeliveryDocument y 0 Document legacy. Sin consultar nombres, contenido o URLs de clientes. |
| SUPOSICIÓN            | Los conteos anteriores contrastan con el cierre operativo PENDING de julio                                       | Puede faltar actualizar el cierre documental. Los conteos NO prueban objetos existentes, políticas, backups, staging ni cierre operativo. No se levanta el freeze por inferencia.                |
| DECISIÓN REQUERIDA    | Gate documental y alcance de su desbloqueo                                                                       | Registrar evidencia del cierre o autorización dirigida para el cambio documental; no ampliar tablas congeladas mientras siga sin resolver.                                                       |

## Resultado esperado — C. Alcance

1. Un miembro de TALLER encuentra un vehículo, comprador o vendedor y adjunta un presupuesto o
   documento operativo sin necesitar una orden de trabajo, oferta, match o entrega previa.
2. Los archivos quedan vinculados a la entidad elegida, visibles desde su contexto operativo y,
   para usuarios con acceso comercial, desde la ficha correspondiente.
3. TALLER puede programar, iniciar y completar entregas. No se le concede administración de usuarios,
   modificación comercial general ni acceso automático a DNI/contratos históricos.
4. Cada entrega declara su naturaleza: VENTA, DEVOLUCION_VENDEDOR o ENTREGA_TALLER.
5. Checklist y firma son herramientas opcionales. No se exige oferta, match, reserva, publicación,
   admisión comercial o lead activo para gestionar la entrega física.

### D. Fuera de alcance

- Producción, migraciones y cambios de configuración remotos, merge y activación funcional remota.
  Se autorizan commit, push, PR, CI y generación de Preview; no levantar sus gates de base de datos.
- SEARCH-3, E2E-1, configuración SMTP, fotos públicas y ajustes de Sentry no relacionados.
- Facturación, cobros, devoluciones de depósitos, cancelación automática de ofertas o garantías.
- Borrado, conversión masiva o reclasificación inferida de documentos/entregas históricos.
- Hacer públicos archivos privados o reutilizar el bucket legacy lead-documents.
- Unificación general de BuyerLead/SellerLead en una nueva entidad Party.

## Decisiones — E. Reglas de negocio

| Decisión                 | Resolución                                                                                                                                                                            |
| ------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Alcance de personas      | Todos los usuarios activos TALLER; nunca una excepción por email.                                                                                                                     |
| Acceso comercial         | Mantener `requireAgente` intacto. Nueva superficie operativa limitada a los datos necesarios para localizar entidades y gestionar sus adjuntos.                                       |
| Presupuesto              | Categoría operativa explícita, no un tipo inferido del nombre del archivo. Otros documentos operativos se etiquetan separadamente.                                                    |
| Tipos de entrega         | VENTA, DEVOLUCION_VENDEDOR y ENTREGA_TALLER. El selector obliga a elegir conscientemente; no preseleccionar venta en una entrega de taller.                                           |
| Datos mínimos            | Vehículo existente, tipo y fecha válida. VENTA identifica comprador; devolución identifica vendedor; taller permite destinatario comprador o vendedor, sin inventar un lead ficticio. |
| Requisitos retirados     | Oferta, match, reserva, publicación, orden de taller, checklist completo y firma. Los leads archivados no se reactivan automáticamente.                                               |
| Efectos de venta         | Sólo completar VENTA puede marcar VENDIDO/soldAt, cerrar comprador/match y crear garantía/seguimientos. Devolución y taller nunca lo hacen.                                           |
| Cancelación              | Conservar motivo y auditoría. Cancelar entrega no cancela oferta, reembolsa pagos ni libera reservas por sí solo.                                                                     |
| Conflictos de integridad | No duplicar entrega activa, venta o garantía. Un compromiso económico incompatible se informa para resolución; no se oculta ni se cancela silenciosamente.                            |
| Documentos existentes    | Conservar permisos, versiones y objetos. Ampliar capacidad operativa no hace accesibles a TALLER todos los documentos comerciales anteriores.                                         |

### F. Flujo funcional

**Adjuntos:** sección operativa de documentos → buscar por nombre/matrícula → elegir entidad exacta
→ elegir presupuesto/otro documento operativo → seleccionar archivo → subir → confirmar persistencia
→ ver en la ficha. La búsqueda es paginada y devuelve una proyección mínima, no fichas comerciales
completas. No se exige vínculo previo entre comprador y vehículo para adjuntar a uno de ellos.

**Entregas:** nueva entrega → vehículo → tipo → destinatario → fecha/responsable opcional/notas →
guardar PROGRAMADA. Permitir PROGRAMADA → COMPLETADA directamente, además de EN_CURSO. Antes de
completar VENTA explicar expresamente sus efectos; para los otros tipos indicar que no registra una
venta ni crea garantía. No fabricar una oferta para satisfacer el esquema antiguo.

**Recuperación:** el rechazo conserva los datos introducidos. Doble clic no duplica nada. Un timeout
no se interpreta como éxito; reconciliar por clave de operación antes de reintentar. Mostrar el
error del servidor también en los botones de iniciar/completar (evitar forms que descarten el resultado).

### G. Estados e invariantes

- PROGRAMADA → EN_CURSO / COMPLETADA / CANCELADA; EN_CURSO → COMPLETADA / CANCELADA.
- Terminales no se reabren por este cambio. Ediciones de checklist/firma siguen coordinadas con cierre.
- Máximo una entrega activa por vehículo, independientemente del tipo. Conservar índice parcial.
- Varias entregas de taller/devolución históricas son legítimas; no equivalen a varias ventas.
- Para VENTA, no sobrescribir soldAt ni producir una segunda garantía de una venta ya registrada.
- Oferta opcional; si se aporta, debe pertenecer al mismo vehículo/comprador. No hace falta que exista
  ni que su estado sea CONVERTIDA, pero no se altera su estado de forma implícita.
- El destinatario se expresa por FK real y tipo, no por texto en Activity. No inventar comprador para
  una devolución. Las Activities son auditoría, no la fuente de verdad del tipo o la venta.
- Todo cierre y sus efectos DB son atómicos, incluidos garantía y seguimientos cuando procedan.

### H. Permisos

| Operación                                                 | ADMIN           | AGENTE         | TALLER         | ENTREGAS                                      | MARKETING / sin sesión |
| --------------------------------------------------------- | --------------- | -------------- | -------------- | --------------------------------------------- | ---------------------- |
| Buscar entidades mínimas y subir/leer adjuntos operativos | Sí              | Sí             | Sí             | Sin ampliación en OPS-1                       | No                     |
| Leer documentos comerciales históricos                    | Conservar       | Conservar      | No por defecto | Conservar sólo los ya permitidos en su módulo | No                     |
| Ver entregas                                              | Sí              | Sí             | Sí             | Sí                                            | No                     |
| Crear/iniciar/completar/cancelar entregas                 | Sí              | Sin ampliación | Sí             | Sí                                            | No                     |
| Reemplazar/borrar documentos existentes                   | Conservar ADMIN | No ampliación  | No ampliación  | No ampliación                                 | No                     |
| Administrar usuarios, precios, ofertas o publicación      | Sin cambio      | Sin cambio     | No             | No                                            | No                     |

Guards server-side antes de leer PII o construir service_role. La UI refleja los mismos permisos,
pero no es la barrera de seguridad. Usuario inactivo/sesión ausente siempre denegados. Paths, actor,
bucket y claves de archivo se generan en servidor. No aceptar un path o una URL aportados por cliente
como autorización. RLS/Storage privados deny-all para acceso directo anon/authenticated.

## Plan técnico — I. Datos y migraciones

### Decisión de implementación local autorizada (2026-09-29)

El usuario confirmó expresamente la excepción a la congelación para implementar y probar OPS-1
localmente, conservando archivos/permisos históricos y sin publicar ni mutar entornos remotos.
No se declara cerrado el rollout documental de Fase 0. Esta autorización sustituye el bloqueo local
documentado más abajo, no los gates de despliegue.

- Reutilizar la raíz versionada `VehicleDocument`: destino exactamente uno entre vehículo,
  comprador o vendedor; categorías nuevas PRESUPUESTO y OPERATIVO. DocumentVersion, versiones,
  FK compuesta y bucket privado existentes se conservan. No tabla/bucket paralelo ni backfill.
- Añadir claves de operación y fingerprint nullable en entregas y documentos; únicamente nuevos
  writers las exigen. Clave ligada al actor; replay idéntico devuelve el registro, payload diferente
  se rechaza. Cada intento Storage tiene path aleatorio propio; nunca compensar el objeto ganador.
- Separar acciones operativas de las comerciales históricas; TALLER no entra en requireAgente ni
  descarga contratos/DNI/firmas existentes. Selector mínimo paginado reutilizado en ambos flujos.
- Entregas manuales usan locks de vehículo y destinatarios, CAS y efectos por tipo. Venta desde
  cualquier estado no vendido, sin firma/checklist/oferta, preservando conflictos económicos y
  unicidad de garantía. No comerciales no alteran venta/garantía. No nuevos correos automáticos.
- Adjuntos v1: PDF/JPEG/PNG/WebP, hasta **3 MiB** por el transporte de Vercel (4,5 MB por petición).
  Server Actions permite 4 MiB, con margen multipart; la validación cliente y servidor fija 3 MiB.
  El bucket conserva su límite histórico de 10 MiB; no se modifica su configuración.
  Fuente: [límites de Vercel Functions](https://vercel.com/docs/functions/limitations).
  No prometer Word/Excel sin habilitación remota expresa. Descarga autorizada bajo demanda, 300 s.
- UI desde Operaciones y enlaces contextuales en fichas; errores visibles y reintento con misma
  clave, sin duplicar. No botones que descarten el resultado. Responsables activos autorizados.
- Verificar PostgreSQL local, unitarios, permisos positivos/negativos, build y UI; Storage real
  requiere Supabase local disponible (Docker no autorizado/instalado). No simularlo como aprobado.
- Mantener expansión documental y activación de entregas en migraciones distintas; despliegue
  futuro primero puente compatible, después writers. Stop por drift, acceso indebido, doble venta,
  compensación incierta o fallo de transacción; sin cambios automáticos en producción.

Separar dos incrementos revisables: **OPS-1A entregas** y **OPS-1B documentos**. No mezclar un backfill
documental histórico con la migración de entregas. No añadir dependencias.

**Entregas:** nueva migración para tipo con default VENTA de compatibilidad histórica; offerId y
buyerLeadId pasan a opcionales; FK específica para destinatario vendedor cuando corresponda. CHECK
de coherencia tipo/destinatario, FKs e índice de entrega activa permanecen como garantías DB. La
obligatoriedad del comprador en VENTA se valida también en servidor. No fabricar destinatarios para
datos históricos. Inventariar incoherencias antes de cualquier backfill; abortar, no adivinar.

**Compatibilidad:** primero desplegar readers compatibles con nulos y tipos, manteniendo deshabilitados
los nuevos writers; después habilitar creación manual en un incremento separado. Un cliente antiguo
que espera BuyerLead/Offer no nulos NO es un rollback seguro después de crear entregas manuales.
La versión puente debe mantener los writers anteriores y soportar las filas nuevas para servir de
destino de rollback. La migración no se ejecuta dentro del build.

**Documentos:** la excepción local explícita resuelve el gate para desarrollo/QA, no para remoto.
Se implementa una única raíz privada operativa
con destino discriminado vehículo/comprador/vendedor, FK y CHECK de exactamente un destino, autor,
fecha, categoría, metadata de archivo y clave de operación. Versionado y referencias deben seguir
el patrón existente: VehicleDocument acepta un destino nullable discriminado y DocumentVersion
mantiene su FK compuesta y versiones. No implementar una segunda tabla o bucket para rodear el freeze. El modelo legacy
Document no se promueve sin actor/metadata/path seguro. No reubicar los 227 documentos existentes.

### J. Writers y readers afectados

| Área                  | Inventario inicial verificado                                                                                              | Revisión exigida                                                                                |
| --------------------- | -------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| Entregas              | `lib/delivery-{creation,transitions,completion,precondition}.ts`; `app/(backoffice)/entregas/`                             | Tipo, nullable FKs, locks, validación, mensajes y acciones/UI.                                  |
| Venta/garantía        | `lib/postventa/create-warranty.ts`; `lib/kpi/operaciones.ts`; `app/api/cron/postventa-followups/route.ts`                  | No garantía ni ventas por devolución/taller; no follow-ups indebidos.                           |
| Calendario            | `lib/calendar/{prisma-deps,aggregate}.ts`                                                                                  | Etiqueta, destinatario nullable y navegación operativa.                                         |
| Archivo y matches     | `lib/lead-archiving/prisma-deps.ts`; `app/(backoffice)/matches/actions.ts`; `app/(backoffice)/compradores/[id]/actions.ts` | No tratar toda entrega histórica como venta; bloqueo concurrente consistente.                   |
| Permisos y navegación | `lib/auth.ts`; `components/layout/sidebar.tsx`                                                                             | Guards específicos, enlaces permitidos; no ampliar requireAgente.                               |
| Documentos            | acciones legales de vendedor, pestaña comprador, `lib/storage/`, `lib/documents/`                                          | Nuevos destinos, autorización por clase documental, compatibilidad de auditoría/versiones.      |
| DB/CI                 | schema, migraciones, `scripts/check-delivery-offer-nulls.ts`, `lib/deploy/delivery-offer-preflight.ts`, CI y fixtures      | Preflight antiguo NOT NULL no sirve para el contrato manual; crear verificador nuevo explícito. |

Este inventario no certifica todavía exhaustividad: antes de cambios de schema repetir búsquedas de
Delivery/DocumentVersion/SQL raw, tipar todos los consumidores y contrastar tests de contrato y seed.

### K. Concurrencia e idempotencia

- Conservar orden global de raíces: Vehicle → SellerLead → BuyerLead; incluir vendedor destinatario
  cuando sea distinto de la raíz del vehículo; deduplicar y ordenar mediante protocolo existente.
- Releer vehículo, entrega, destinatario y oferta opcional dentro de la transacción bloqueada.
- CAS de estado y efectos de venta en la misma transacción. Doble completar produce un único hecho.
- Persistir clave UUID de operación con unicidad para creación/subida; ligada al actor, destino y
  payload normalizado. Reintento con mismo payload devuelve resultado; payload distinto es conflicto.
- Carrera crear/crear: una activa; completar/cancelar: un terminal; archivar/crear: nunca pierde FK;
  cambio de raíz: aborta; venta/oferta incompatible: sin sobrescritura económica.
- Storage no participa en la transacción DB: upsert:false, UUID de servidor, compensación al fallar
  persistencia. Si la compensación falla, diagnóstico seguro y reconciliación; nunca éxito falso.

### L. Efectos secundarios

Subir no cambia estados comerciales, admisión, costes ni matching. Devolución y taller no modifican
Vehicle.status/soldAt, BuyerLead.status, Offer, Match, Warranty ni follow-ups. VENTA mantiene efectos
canónicos existentes, limitados a una ejecución. Invalidar listas/fichas/agenda y superficies públicas
afectadas sólo después del commit. Las entregas no comerciales no reciben emails que anuncien compra
o garantía; las nuevas acciones manuales no envían correos, tampoco al repetir una operación.
El writer histórico conserva su envío existente; no se amplía ni se reutiliza desde la nueva UI.
No registrar contenidos o URLs firmadas.

### M. UX y errores

Selector de entidad con matrícula/nombre y tipo de cliente, accesible con teclado y móvil. Mostrar
destino antes de confirmar archivo. Tipos de entrega con descripción de consecuencias; checklist
visible como opcional. Fecha inválida, entidad inexistente, falta de permiso, carga fallida y conflicto
de duplicado tienen mensajes distintos. Loading deshabilita doble envío, sin sustituir idempotencia.
No ocultar resultados detrás de un redirect genérico o un botón que simplemente no hace nada.

### N. Verificación prevista

| Capa                   | Casos obligatorios                                                                                                                | Resultado actual                   |
| ---------------------- | --------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------- |
| Unitarios              | Matriz de roles, esquema discriminado, ausencia de requisitos comerciales, límites y tipos, efectos sólo VENTA                    | PASS local (§U)                    |
| Integración PostgreSQL | Tres tipos, oferta nullable, destinatarios, rollback integral, entrega de taller tras venta, repetir cierre sin duplicar garantía | PASS local (§U)                    |
| Concurrencia real      | Crear/crear, completar/completar, cancelar/completar, cambio de raíz, oferta/venta incompatible                                   | PASS local (§U)                    |
| Migraciones            | Replay vacío y legacy, parity, RLS, CHECKs, segundo deploy, readers puente y datos nulos                                          | PASS local; smoke reader pendiente |
| Supabase local         | Privacidad, MIME/extensión/tamaño, path, signed URL 300s, compensación, denegación directa y cross-entity                         | Pendiente                          |
| E2E Preview/staging    | TALLER real: adjuntar a cada destino, descargar, crear y completar cada tipo sin oferta/firma/checklist                           | Pendiente                          |
| Regresión              | ADMIN/AGENTE/ENTREGAS conservan alcance; MARKETING/inactivo/anónimo denegados; documentos previos intactos                        | PASS local; remoto pendiente       |

## Rollout, rollback y stop conditions — O / P

1. Cerrar diseño y gate documental con evidencia; entregar piezas independientes.
2. Validación local con PostgreSQL y Supabase **locales**, nunca usar producción como sustituto.
3. Sólo con autorización: commit/push/PR y CI completa. No considerar skipped como verde.
4. Sólo con autorización por entorno: preflight de identidad, migraciones, constraints, datos y backup;
   migración de expansión → readers puente → postflight → smoke → activación de writers.
5. Staging `iatuhydsfwoeprpbklod` primero. Producción `bbmglaatlyilxutzomxd` exige permiso independiente,
   staging validado, rollback compatible y ventana de observación.

Detener ante acceso documental indebido, deriva de schema, archivo huérfano no diagnosticado, doble
venta/garantía/entrega activa, efecto de venta en devolución/taller o pérdida de evidencia histórica.
Cualquier violación de integridad o privacidad tiene tolerancia cero.

Rollback de código a readers puente, desactivando nuevos writers; conservar schema/filas/archivos.
La contingencia implementada es `OPS1_PAUSE_WRITES=true` sobre **este build compatible**: pausa
las tres mutaciones de entregas operativas y la subida nueva, manteniendo consultas/descargas.
No concede permisos y no altera escritores históricos. Owner: Engineering; usar durante el
rollout inicial y ante incidentes, retirar la pausa sólo tras postflight y autorización.
El puente OPS-2 anterior cubre entregas, **no** documentos con destino cliente: no basta como rollback
cuando existan esas filas. El cliente antiguo sólo se ha probado con datos legacy.
No restaurar NOT NULL ni borrar entregas manuales para que arranque el cliente antiguo. Una venta
ya registrada no se revierte deshaciendo código: corrección de datos requiere plan y permiso propios.

### Q. Observabilidad

Auditoría DB con actor, operación, destino y momento; el tipo/estado permanece en la entidad, no sólo
en Activity. Sentry sólo para fallos inesperados con códigos seguros; denegaciones/conflictos se
resuelven como dominio. Sin nombres, correos, documentos, paths privados ni URLs firmadas en logs.
Reconciliar conteos de entregas por tipo, ventas, garantías y follow-ups; distinguir entrega física
de venta en indicadores. Observar primeras 24h de cada activación autorizada y revisar feedback de
Operaciones. No dar por observada una versión al terminar el deploy.

### R. Documentación

Actualizar al implementar: esta spec, `docs/domain/delivery-lifecycle.md`, matriz de pruebas de
entregas, permisos, Storage y runbook de rollout específico. Reconciliar cierre Fase 0 conservando la
distinción entre evidencia agregada actual y tareas operativas no verificadas. No marcar casillas de
backups, políticas o staging basándose en conteos de producción. GitHub/Linear enlazarán spec, PR y
resultado real cuando exista autorización de publicación.

### S. Riesgos y deuda explícita

| Riesgo                                       | Impacto / mitigación                                                       | Owner / condición de cierre              |
| -------------------------------------------- | -------------------------------------------------------------------------- | ---------------------------------------- |
| Gate documental desactualizado o incompleto  | Excepción local autorizada; reconciliar evidencia antes de mutación remota | Engineering/Operations, antes de staging |
| Nuevo nullable rompe cliente antiguo         | Alto; readers puente y test de rollback antes de writers                   | Engineering, antes de activación         |
| Entrega operativa registra venta             | Alto; tipo explícito y tests de efectos negativos                          | Engineering/Operaciones, antes de merge  |
| Ampliación excesiva de TALLER                | Alto; proyecciones mínimas y guards por operación/documento                | Engineering, antes de merge              |
| Falta de entorno local de integración        | Alto; no sustituir por mocks o producción ni declarar validado             | Engineering, antes de CI/merge           |
| Inventario incompleto de lectores indirectos | Medio; búsqueda final, typecheck y regresión cruzada                       | Engineering, antes de editar schema      |

## Criterios de aceptación — T

- [ ] Todo usuario activo TALLER puede adjuntar presupuesto/documento a vehículo, comprador y vendedor.
- [ ] Ninguna de esas subidas requiere oferta, match, orden de trabajo ni estado comercial.
- [ ] TALLER no obtiene acceso general a documentos comerciales históricos ni a acciones de precios.
- [ ] Puede crear y completar los tres tipos con checklist pendiente y sin firma/oferta/reserva.
- [ ] Sólo VENTA produce venta y garantía, una sola vez y con rollback integral ante fallo.
- [ ] Devolución y taller conservan todos los hechos comerciales previos.
- [ ] Retry y carreras no duplican archivos, entregas activas ni efectos de venta.
- [ ] Errores visibles, navegación contextual, lector antiguo compatible y archivos privados intactos.
- [ ] Tests de DB/Storage reales, E2E y gates operativos ejecutados con evidencia por entorno.

## Revisión adversarial

| Intento                                                | Defensa / pendiente                                                            |
| ------------------------------------------------------ | ------------------------------------------------------------------------------ |
| Cambiar email o rol en el formulario                   | Rol/actor sólo de sesión y DB; no excepción por cuenta.                        |
| Adjuntar a otro ID mediante petición manipulada        | Autorizar destino existente y clase documental; no basta ocultar selector.     |
| Usar nuevo permiso para descargar DNI histórico        | Alcance operativo explícito, no ampliar legal-actions indiscriminadamente.     |
| Entrega de reparación tras venta activa otra garantía  | Rama no comercial sin efectos; guard adicional en creación de garantía.        |
| Crear dos entregas desde dos pestañas                  | Locks, índice parcial y clave de idempotencia persistida.                      |
| Corregir error de PostgreSQL eliminando datos viejos   | Prohibido; nueva migración y preflight, sin backfill inventado.                |
| Declarar cierre documental porque hay currentVersionId | Insuficiente: faltan verificación de objetos, políticas y evidencia operativa. |
| Retirar freeze creando un almacenamiento paralelo      | Prohibido; resolver gate, no eludirlo.                                         |

## Cierre y estado de autorización — U

### Implementación funcional y evidencia local vigente (2026-09-29)

- Rama `codex/ops-1-taller-documentos-entregas`, base `72dbc47`; cambios sin commit.
- Adjuntos: `/operaciones/documentos`, fichas de comprador/vendedor/vehículo y enlace desde Taller.
  Categorías PRESUPUESTO/OPERATIVO, destino exclusivo, archivo privado versionado, checksum,
  cabecera MIME, hasta 3 MiB, firma bajo demanda 300 s. TALLER no accede a DNI/contratos históricos.
- Entregas: creación por tipo, vehículo y destinatario, responsable opcional. Inicio, cierre directo
  y cancelación con motivo. Sin oferta/match, estado comercial previo, firma o checklist obligatorio.
  Sólo VENTA registra venta/garantía; se conservan identidad, conflicto económico, terminales,
  una entrega activa y unicidad de garantía. La restricción histórica de una garantía por comprador
  no se elimina: una segunda compra del mismo comprador requiere otro cambio de dominio.
- Reintentos con clave/fingerprint, locks, CAS, transacción y compensación del objeto propio.
  Timeout Storage 15 s; ante commit incierto se reconcilia antes de borrar. Si DB no permite
  reconciliar se conserva el objeto y se informa error; requiere auditoría, no limpieza a ciegas.
- Tres migraciones nuevas preparadas, aplicadas **sólo** a PostgreSQL QA loopback. Replay vacío de
  17 migraciones PASS, segundo deploy sin pendientes, parity sin diferencias, RLS en 33 tablas.
  Catálogo real: 493 columnas, 58 enums / 308 valores, 82 FKs, 132 índices. CI actualizado.
- `pnpm test`: 123 archivos / 1.570 tests PASS. Integración completa final: 35 archivos / **370 PASS**,
  sin exclusiones; incluye los 23 de OPS-1 (rollback tras garantía, raíz cambiada y compromiso
  económico), todos los históricos y compatibilidad de los dos clientes antiguos sobre datos legacy.
- Typecheck y lint PASS sin avisos nuevos; check:sdd e historial PASS. Build PASS con DB QA y
  credenciales ficticias locales, sin tocar remoto. Primera compilación falló en la lectura de una
  URL de Google Fonts; comprobación de las cinco familias y repetición normal PASS, sin parchear
  dependencias ni sustituir fuentes. Avisos existentes Prisma/Sentry/Webpack no bloqueantes.
- **No ejecutados:** Supabase Storage real (sin Docker/Supabase local), E2E autenticado, CI remoto,
  Preview, staging, producción y observación. Tests con Storage simulado no sustituyen ese gate.
- **Autorizados posteriormente:** commit/push/PR, CI y generación de Vercel Preview, mediante
  confirmación expresa «si autorizo» del usuario. PR en borrador hasta cerrar los gates pendientes.
- **No autorizados:** migraciones o configuración remotas, merge ni despliegue de producción.
- **Siguiente gate:** ejecutar publicación y CI (incluye job Storage local del runner);
  revisión del rollout documental antes de migrar staging; pruebas QA con TALLER y roles negativos.
  Producción necesita autorización independiente. No llamar terminado/desplegado al alcance remoto.

Aprendizajes: comprobar límites del alojamiento además del bucket; separar permisos operativos
de expedientes comerciales; claves persistidas además de deshabilitar botones; probar rollback
también después de insertar la garantía; remount por ID al cambiar de ficha para no conservar un
destino anterior; no inferir pruebas remotas a partir de build o conteos de base de datos.

Cierre del entorno local: build final PASS tras revisar el estado pendiente de las peticiones
en React 18; `git diff --check` PASS y búsqueda heurística de secretos sin coincidencias (no es
una auditoría completa). PostgreSQL QA detenido al finalizar, sin servicio ni cambio de PATH global.
Los tests limpiaron sus fixtures: cero entregas, garantías y documentos con clave OPS en QA;
cuatro CHECKs nuevos validados. Binarios y clúster se conservan para reproducir las pruebas.

Preparación de publicación: el hook pre-commit detectó imports CommonJS en el auxiliar de clientes
históricos que `next lint` no incluía. Corregidos con imports dinámicos, sin omitir hooks ni reglas;
ESLint del auxiliar y las cuatro pruebas PostgreSQL de los dos clientes históricos PASS de nuevo.
El clúster QA volvió a quedar detenido. Aprendizaje: incluir auxiliares de pruebas en el lint completo.

### Historial de preparación (superado por la autorización e implementación anteriores)

#### Avance inicial autorizado tras el plan (2026-09-29)

El usuario pidió continuar ("haz lo que tengas que hacer"). Se prepara primero el incremento
independiente [OPS-2 / OPS-1A](OPS-2-entregas-compatibilidad-tipos.md), de compatibilidad de entregas.
Su código local, SQL preparado y tests **no activan todavía la creación manual ni los permisos
TALLER**. No se amplían tablas documentales mientras siga pendiente su gate; tampoco se publica nada.

Con autorización explícita se preparó PostgreSQL 17.11 temporal, sólo QA local. El puente ya supera
1.522 tests unitarios, 347 de integración, replay/parity/RLS y build; evidencia y límites en OPS-2 §U.
Esto resuelve la carencia de PostgreSQL para las pruebas locales, no el gate de Storage ni la
implementación funcional pendiente de documentos/permisos/creación manual. No hay cambios remotos.

La revisión adicional de sólo lectura en producción encontró 227 raíces, cero referencias actuales
incoherentes y cero versiones sin objeto en el catálogo Storage. Las políticas de Storage consultadas
se limitan a lead-documents y vehicle-photos, sin acceso directo a vehicle-documents. No se descargó
contenido. Esto aclara el baseline, pero no certifica staging, backups ni cierre operativo completo.
Se detectó además que la allowlist de la aplicación permite Word/Excel y el bucket remoto no:
OPS-1B deberá alinear formatos admitidos y mensajes sin ampliar políticas remotas sin permiso.

Las siguientes notas describen la preparación inicial; el estado vivo de este incremento está en OPS-2.

Autorización de usuario: definir e implementar localmente la necesidad para todo TALLER, eligiendo
la solución recomendada. No incluye publicación ni mutaciones remotas. El alcance funcional queda
definido; el plan técnico documental todavía depende de resolver el gate. Esta spec no lo levanta.

Preparado: rama aislada desde main, dependencias del lockfile instaladas sin cambios de versión,
diagnóstico y diseño. No se ha modificado código de aplicación, schema, datos, buckets ni políticas.
Consultas remotas realizadas: sólo conteos agregados y metadata de Storage en el proyecto identificado
de producción. vehicle-documents y lead-documents figuran privados, con límite 10 MiB. No hay policies
que mencionen literalmente vehicle-documents; esto NO descarta policies genéricas ni constituye una
prueba de denegación end-to-end. No se han descargado credenciales ni archivos.

Validación documental local: `pnpm check:sdd` PASS (12 briefs y enlaces); `git diff --check` PASS;
formato Prettier aplicado únicamente a esta spec. `pnpm install --frozen-lockfile` terminó sin
modificar el lockfile. No se han ejecutado tests funcionales de una implementación inexistente.

- **Commit / PR / CI / Deployment:** ninguno para OPS-1.
- **Validación funcional:** pendiente; este plan no corrige todavía la aplicación.
- **Siguiente gate:** reconciliar congelación documental con evidencia operativa; completar inventario
  de consumers y revisar diseño antes de implementar cambios de schema/privacidad. Entregas puede
  prepararse por separado sin alterar tablas documentales.

### Matriz de completitud

| Área                       | Revisada | Evidencia                         | Riesgo pendiente                            |
| -------------------------- | -------- | --------------------------------- | ------------------------------------------- |
| Dominio                    | Sí       | E–G y núcleos actuales            | Tests de efectos por tipo                   |
| Estados                    | Sí       | G                                 | Compleción directa sin paso EN_CURSO        |
| Permisos                   | Sí       | H y auth.ts                       | Pruebas positivas y negativas               |
| Concurrencia               | Sí       | K y protocolo de raíces existente | Carreras PostgreSQL                         |
| Idempotencia               | Sí       | K                                 | Implementar clave persistida y compensación |
| Datos                      | Sí       | B/I                               | Modelo documental condicionado al gate      |
| Legacy                     | Sí       | B/I                               | Verificación de objetos y cierre operativo  |
| Migración                  | Sí       | I/O                               | SQL y replay pendientes                     |
| Compatibilidad             | Sí       | I/P                               | Readers puente por implementar              |
| Readers                    | No       | J contiene inventario inicial     | Revisión exhaustiva y fixtures pendientes   |
| Efectos secundarios        | Sí       | L/Q                               | Pruebas de cron, correo, matching y KPIs    |
| Caché/superficies públicas | Sí       | L                                 | Inventario final de revalidaciones          |
| Observabilidad             | Sí       | Q                                 | Evidencia futura por despliegue             |
| Rollout                    | Sí       | O                                 | Autorizaciones remotas pendientes           |
| Rollback                   | Sí       | P                                 | Prueba de versión puente                    |
| Documentación              | Sí       | B/R                               | Contradicción Fase 0 aún abierta            |

PLAN READY FOR INDEPENDENT REVIEW
