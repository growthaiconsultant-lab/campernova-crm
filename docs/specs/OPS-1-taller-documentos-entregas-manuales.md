# OPS-1 — Documentos operativos y entregas manuales para Taller

| Campo               | Valor                                                                                                                              |
| ------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| **Estado**          | IMPLEMENTED                                                                                                                        |
| **Owner**           | Engineering / Operaciones                                                                                                          |
| **Ticket**          | OPS-1; seguimiento técnico en PR #185; Linear pendiente                                                                            |
| **Rama / PR**       | `codex/ops-1-taller-documentos-entregas`; [PR #185](https://github.com/growthaiconsultant-lab/campernova-crm/pull/185) en borrador |
| **Categorías**      | C0, C1, C2, C3, C4, C5, C6, C7                                                                                                     |
| **Riesgo**          | Alto: documentos privados, permisos y efectos de venta                                                                             |
| **Ruta SDD**        | Reforzada                                                                                                                          |
| **Última revisión** | 2026-10-05                                                                                                                         |

## Problema y evidencia — A. Objetivo / B. Baseline

> **Estado vivo (2026-10-05): implementado, CI y pruebas funcionales en Preview/staging realizadas;
> producción en rollout autorizado, todavía no declarada desplegada.** Evidencia y límites en §U.
> El usuario autorizó continuar hasta aplicar las tres migraciones OPS-1, fusionar PR #185,
> desplegar y comprobar producción. Las restricciones anteriores de las notas históricas quedan
> sustituidas únicamente para este alcance. No autoriza backfills, borrados ni cambios ajenos.
> Las pruebas remotas MARKETING/inactivo quedan PENDIENTES / NO EJECUTADAS por decisión del usuario.
> No se presenta esa excepción como una prueba superada ni se cierra todo el programa documental.

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

### Rollout producción autorizado (2026-10-05)

- Autorización expresa: «sigue hasta que esté todo y los cambios en produccion». Alcance:
  tres expansiones OPS-1, postflight, documentación, merge PR #185, despliegue y smoke.
- Preflight de sólo lectura: identidad `bbmglaatlyilxutzomxd`, 239 documentos, cero entregas,
  cero referencias actuales incoherentes; RLS activa y bucket documental privado. Historial
  completado sin fallos activos; faltaban exclusivamente las tres migraciones OPS-1.
- Respaldo cifrado del schema public y datos, run privado `37358877723`, descargado y verificado
  mediante descifrado, SHA-256 y lectura completa de pg_restore. No incluye Auth ni archivos
  Storage; no se ha probado restauración de filas reales. Clave de recuperación protegida por
  Windows DPAPI del usuario. Copia y clave locales fuera de Git; cero artefactos y secretos
  remotos tras limpieza; workflow de backup desactivado. No publicar datos ni secretos.
- Conectividad local falló antes de autenticación. No se restablecieron contraseñas ni se
  redujeron protecciones; el respaldo se ejecutó en repositorio privado dedicado autorizado.
- Comparación local **sólo de estructura** del respaldo contra replay: baseline y resultado
  posterior OPS-1 PASS, objetos ajenos preservados. Se mantienen explícitamente los órdenes
  históricos de CalendarEventType y UserRole, respaldados por las migraciones originales
  conservadas en `5ce93d6`. No se corrige ese orden en producción.
- CI de `f135d96` PASS: quality, integration, migration-replay, supabase-storage. Preview
  `Gt8QqEzKaCrWje8vCbN1YJSsv9XG` READY y comprobado en staging; evidencias detalladas debajo.
- Ejecutor de producción preparado con commit fuente fijo, identidad exacta, conjunto pendiente
  exacto, checksums, paridad antes/después, cuatro CHECKs validados y conteos conservados.
  En curso: run privado `37360263055`. No inferir migración completada de su mero inicio.
- Rollback: conservar schema y datos; ante incidencia usar `OPS1_PAUSE_WRITES=true` con este
  build compatible. No volver al cliente antiguo después de crear destinos documentales cliente.
- Pendientes al registrar: resultado de migración, merge/deploy, smoke de producción y ventana
  de observación. MARKETING/inactivo remotos siguen diferidos; Linear sigue pendiente.

### Operación staging autorizada (2026-10-05; sustituye los límites históricos de remoto)

- El usuario autoriza copia cifrada de staging `iatuhydsfwoeprpbklod`, descarga local,
  las tres migraciones OPS-1 mediante Prisma y postflight; secreto temporal de GitHub Actions
  y eliminación posterior del secreto y artefacto remoto. Este paso no toca producción.
- CI del commit `f135d96f649c64c561fb1043070e1508135da99b`: cuatro jobs SUCCESS,
  run `36604835402`. Lectura autenticada de staging PASS en run `37319825478` del
  repositorio `growthaiconsultant-lab/campernova-crm`; secreto temporal eliminado.
- Historial contrastado con SQL local: exactamente tres pendientes OPS-1, cero diferencias
  de checksum y cero intentos fallidos activos. Esto no sustituye el preflight de esquema/datos.
- Desde el equipo, el puerto 5432 no negocia PostgreSQL; GitHub sí responde en 5432/6543.
  La causa local concreta sigue sin determinarse. No se cambian controles de red.
- Rama operativa aislada `codex/ops-1-staging-connectivity-check`, despliegues desactivados;
  no fusionar esta rama. Flujo corregido preparado `ff9d1bd90b1c1c1bd6152fcd3a0155d1dac53901`:
  exportar sólo schema/datos `public`, cifrar AES-GCM con clave envuelta RSA-OAEP,
  descargar, verificar descifrado/checksum y archivo con pg_restore; sólo entonces
  disparar la fase de migraciones contra el commit de OPS-1 fijado.
- Clave de recuperación privada protegida con DPAPI del usuario de Windows. Copia en
  almacenamiento local fuera del repositorio. No incluye objetos de Storage ni un backup
  completo de Auth/plataforma; esas superficies no se modifican en estas migraciones.
- Stop por identidad incorrecta, backup inválido, drift, pendientes inesperadas, fallo de
  migración o postflight. No resolve, backfill, borrado de datos ni rollback automático.
- Preparación verificada: sintaxis YAML/JS/PowerShell, roundtrip de cifrado con datos sintéticos,
  protección/recuperación de clave local y guardas de historial. **Todavía no ejecutado**:
  backup real, migración remota, postflight, redeploy y smoke autenticado de OPS-1.
- Ensayo remoto **exclusivamente sintético** `37324604687` SUCCESS: PostgreSQL 17,
  exportación, cifrado y descarga. Restauración local a una base QA nueva PASS, con
  comprobación exacta de las dos filas originales; copia alterada rechazada. Protección
  DPAPI comprobada tres veces por ejecución. Artefacto remoto sintético eliminado;
  copia cifrada local conservada, clúster QA detenido y secreto temporal ausente.
- El intento real `37323597783` falló antes de migrar. Se elimina la dependencia de una
  ruta de pg_dump supuestamente instalada: se usa PostgreSQL 17 en contenedor del runner,
  probado por el ensayo anterior. La restauración sintética no certifica el backup real
  de staging ni sustituye su preflight y validación funcional pendientes.
- Actualización posterior: backup real `37333580066` SUCCESS, cifrado descargado y
  descifrado/checksum/archive verificados localmente; artefacto remoto y secreto temporal
  eliminados y ausencia verificada. No se han restaurado filas de staging en QA local.
- Preflight `37333721440` detenido antes de `prisma migrate deploy`. Reproducción local
  usando únicamente el esquema del backup: Prisma diff devuelve 2 frente al baseline
  `72dbc47`; staging conserva `vehicle_reception_questionnaires`, enums de recepción,
  `vehicles.camperization_state` y campos de vínculo manual en `matches` que el baseline
  no contiene. Es drift real, no contraseña incorrecta. No borrar esos objetos ni ignorar
  el diff: reconciliar explícitamente el baseline antes de reintentar. Las tres migraciones
  OPS-1 siguen sin aplicar; producción intacta. El indicador local `migrationStarted`
  significa job despachado, no que se ejecutara SQL de migración.
- Reconciliación autorizada por el usuario: preservación, sin borrar datos ni incorporar
  funcionalidades de otras ramas a producción. Reconstrucción local desde migraciones base
  más `20260807170000_add_vehicle_reception_questionnaire` (`e21b23e`) y
  `20260808120000_add_manual_buyer_vehicle_links` (`14db084`). Comparación de tablas,
  columnas, defaults, nullability, FKs/CHECKs, índices, enums y RLS/policies PASS con una
  diferencia histórica explícita: CalendarEventType conserva en staging el orden
  LIMPIEZA/SEGUIMIENTO/OTRO/LLAMADA, distinto al del squash. OPS-1 no lo modifica.
- Aplicación local de los tres SQL originales sobre una restauración **sólo de esquema**
  y sobre la reconstrucción independiente: catálogo final equivalente PASS; todos los
  objetos fuera de deliveries/vehicle_documents y los enums OPS permanecen iguales.
  No se han copiado filas reales a la base QA. Esto no sustituye Prisma deploy remoto.
- Pre/postflight preparado con hashes del catálogo reconciliado y checksums de las dos
  migraciones históricas; cualquier diferencia adicional falla. Se conserva el guard de
  exactamente tres pendientes, identidad, backup, filas, constraints y postflight. No se
  suprime la verificación: se reemplaza la comparación contra main incompleto para este
  staging por su contrato explícito. No reutilizar este contrato para producción.
- **Staging aplicado y postflight PASS (2026-10-05):** backup `37338076381` SUCCESS;
  migraciones `37338217619` SUCCESS, workflow `b826e299e4e7858acf842e86b659018b8c39e865`.
  Preflight de identidad/historial/catálogo PASS, exactamente las tres migraciones OPS-1
  aplicadas mediante Prisma, catálogo final reconciliado PASS, cuatro CHECKs validados y
  recuentos de entregas/documentos/versiones sin cambios. Backup cifrado local conservado;
  artefacto remoto y secreto temporal eliminados, ausencia comprobada. Esta evidencia
  sustituye las notas anteriores de migraciones pendientes, no las pruebas funcionales:
  Preview autenticado con TALLER y permisos negativos todavía pendiente. Sin merge ni
  modificación de producción.
- Con autorización posterior del usuario, configurado `SUPABASE_SERVICE_ROLE_KEY` como
  secreto únicamente en Vercel Preview. Ref y rol del JWT de origen comprobados en memoria:
  staging `iatuhydsfwoeprpbklod`, `service_role`; valor no impreso ni persistido localmente.
  Confirmación UI y listado CLI del ámbito Preview. Variable de producción sin cambios.
  Redespliegue Preview `dpl_3P4T3kosSyBg1aCLDoNB2e5ccbaJ` confirmado READY; ruta privada
  redirige al login sin sesión. No es todavía smoke autenticado. Bucket staging vehicle-documents privado existente, cero policies
  directas; no se han cambiado sus permisos ni contenido. Las variables sensibles de Vercel
  no devuelven valores al endpoint de lectura: identidad/conectividad efectiva de DB y smoke
  autenticado siguen pendientes; no confundir presencia de variables con configuración válida.
- Login Preview del 2026-10-05 16:25 UTC: error Prisma de autenticación de base de datos
  antes de solicitar el magic link. Corrección operativa autorizada: DATABASE_URL y DIRECT_URL
  exclusivamente Preview actualizadas mediante entrada privada de la contraseña vigente;
  endpoints fijados a staging, secreto sólo en memoria/almacenamiento cifrado de Vercel.
  Tests de alcance exclusivo y codificación de contraseña PASS. Nuevo Preview solicitado:
  `dpl_Gt8QqEzKaCrWje8vCbN1YJSsv9XG`; no repite migraciones ni altera producción.
  Aprendizaje: tras cambiar credenciales, actualizar sus consumidores y verificar una consulta
  real antes de pedir al usuario probar el correo. Un build READY no demuestra conexión a DB.
- `dpl_Gt8QqEzKaCrWje8vCbN1YJSsv9XG` confirmado READY. Tras recargar el alias de rama,
  un único intento con la cuenta QA TALLER muestra «Revisa tu correo / Hemos enviado un
  enlace de acceso». La consulta inicial a la base y la petición de envío ya no fallan.
  Recepción/apertura del correo, callback, sesión y pruebas de entregas/adjuntos pendientes;
  no considerar esta respuesta de envío como prueba completa de autenticación.
- Smoke autenticado Chrome/Preview con QA TALLER (2026-10-05): dashboard y documentos
  operativos accesibles; presupuesto PNG sintético asociado al vehículo QA, guardado/listado
  PASS; descarga autorizada PASS y SHA-256 idéntico al fixture original. Sólo datos QA.
  Creación de salida de taller QA sin oferta/match/reserva/responsable, checklist 0/2 y
  sin firma PASS, estado Programada confirmado al leer la ficha en una pestaña nueva.
  La confirmación nativa tuvo un timeout del control del navegador. Tras intervención del
  usuario y recarga posterior, cierre persistido PASS: Completada, checklist 0/2 y garantía
  ausente en la ficha. No sustituye la reconciliación de efectos comerciales en DB.
  Subida de presupuesto sintético al vendedor QA PASS: guardado y listado; cambiar a
  Comprador elimina la selección y la lista anterior. Búsqueda QA de compradores sin
  resultados: pendiente preparar un comprador QA, sin usar clientes existentes.
  Prueba negativa TALLER sobre /compradores PASS: redirección a /dashboard?error=forbidden.
  Pendientes: otros tipos/destinos, resto de permisos negativos remotos y logs.
- Sesión ADMIN del usuario confirmada en el mismo Preview (2026-10-05). Creado comprador
  sintético `cmuvi8pk20001js04rj4z4q9r`, identificado QA OPS-1, sin asignación ni matches.
  Presupuesto PNG sintético guardado/listado desde su ficha: PASS con ADMIN. No equivale
  a validación TALLER para este destino; pendiente volver a esa sesión y comprobarlo.
- Devolución QA `cmuvil0x00006jy04bzk4i8cx`: creación y cierre directo con ADMIN PASS;
  después de confirmación manual del usuario y recarga aparece Completada, checklist 0/2
  y garantía ausente en ficha. Pendiente reconciliación independiente de efectos en DB.
  Entrega VENTA QA `cmuvini6j0001k10419jknocs` creada sin oferta/match, comprador sintético,
  responsable vacío y checklist 0/2. Tras confirmación del usuario, recarga confirma Completada
  y garantía Activa. Ficha de garantía `cmuvip8yh0007k104tnjyjd22`: comprador y vehículo QA
  correctos, vigencia 2026-10-05 a 2027-10-05, seguimientos pendientes día 7 y día 30.
  PASS funcional con ADMIN; no certifica por sí solo unicidad/concurrencia remota ni rol TALLER.
- Sesión QA TALLER restablecida y rol visible confirmado en Preview: búsqueda y selección
  del comprador sintético PASS, lectura del presupuesto creado por ADMIN PASS y nueva
  subida PNG «QA OPS-1 adjunto comprador desde TALLER» PASS (Documento guardado y ambos
  documentos listados). Con esto hay subida real con TALLER a los tres destinos QA.
  No sustituye pruebas pendientes de descarga por destino, otros formatos, permisos
  negativos completos, reconciliación DB y revisión de logs; producción sin cambios.
- Reconciliación SQL de sólo lectura en panel staging (2026-10-05): las tres entregas QA
  COMPLETADA, offer_id y signature_url nulos, cero ítems de checklist resueltos. VENTA:
  exactamente una garantía y dos seguimientos; DEVOLUCION_VENDEDOR y ENTREGA_TALLER:
  cero garantías y cero seguimientos. No se repitieron mutaciones para obtener esta evidencia.
  Panel staging Healthy: última hora observada 248 peticiones, 100% success, cero errores
  indicados en Auth/Postgres/Storage/API Gateway. No equivale a revisión de Vercel/Sentry.
  Consulta de integridad documental pendiente: editor concatenó texto y devolvió syntax error
  antes de ejecutar; recuperación de selección del editor agotó el control del navegador.
  CLI Vercel anterior no disponible; conector Supabase identificado como producción y no
  utilizado para consultar QA. No reutilizar credenciales ni entorno de producción.
- Recuperación posterior de la consulta documental PASS: comprador 2 documentos, vehículo 1,
  vendedor 1; los cuatro tienen versión ACTIVE vinculada, objeto presente en Storage,
  bucket privado y checksum presente. Consulta agregada sin descargar contenido ni mostrar paths.
  RLS activa comprobada en deliveries, vehicle_documents, document_versions y storage.objects.
  Cero policies en las tres tablas públicas revisadas; las cuatro policies de storage.objects
  se limitan expresamente a vehicle-photos, sin concesión para vehicle-documents.
  Es revisión de configuración efectiva, no un test HTTP con cada rol.
  Checks PR #185 consultados de nuevo: quality, integration, migration-replay,
  supabase-storage y Vercel PASS (run 36604835402 / deployment Gt8QqEzKaCrWje8vCbN1YJSsv9XG).
- Observabilidad Preview: Vercel filtrado por deployment Gt8QqEzKaCrWje8vCbN1YJSsv9XG,
  ventana aproximada 18:53–19:53 Europe/Madrid del 2026-10-05, Warning/Error/Fatal = 0.
  Sentry proyecto campernova-crm (4511315528581200), environment preview, últimos 14 días,
  sin filtro de estado: ninguna incidencia encontrada. No prueba entrega de telemetría ni
  sustituye observación 24 h. No se cerraron ni silenciaron incidencias.
  Acceso anónimo de la app: /operaciones/documentos y /entregas/nueva en dominio único
  del mismo deployment redirigen a /login, sin mostrar contenido privado. Las peticiones
  externas sin cookies al alias devuelven SSO de Vercel: barrera independiente, no authz CRM.
  MARKETING/inactivo no comprobados remotamente: no hay sesión QA de esos perfiles disponible;
  conservar la distinción frente a su cobertura automatizada, sin cambiar roles de usuarios reales.
- Decisión explícita del usuario (2026-10-05): no crear las cuentas QA MARKETING/inactivo;
  dejar sus pruebas negativas remotas **PENDIENTES / NO EJECUTADAS**. La cobertura automatizada
  no sustituye esta evidencia remota. No marcar este gate como PASS ni modificar cuentas
  existentes. Esta decisión no autoriza por sí sola merge, despliegue ni cambios en producción.

Aprendizajes operativos: seleccionar explícitamente la cuenta GitHub antes del uso; especificar
la URI mediante `psql --dbname` (no asumir expansión de URI en PGDATABASE); separar conectividad,
autenticación, historial, paridad y prueba funcional. Ninguna fase verde certifica las siguientes.

### Implementación funcional y evidencia local vigente (2026-09-29)

- Rama `codex/ops-1-taller-documentos-entregas`, base `72dbc47`; implementación `cf90235`, subida
  a GitHub y PR #185 en borrador. Hooks completos PASS (sin omitir): lint-staged, tipos y 1.570 tests.
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
- **En curso al registrar esta evidencia:** CI y generación de Preview de PR #185; resultados vivos
  en sus checks de GitHub. No equivalen a validación funcional remota.
- **No ejecutados localmente:** Supabase Storage real (sin Docker/Supabase local), E2E autenticado,
  pruebas en staging, producción y observación. Tests con Storage simulado no sustituyen ese gate.
- **Autorizados posteriormente:** commit/push/PR, CI y generación de Vercel Preview, mediante
  confirmación expresa «si autorizo» del usuario. PR en borrador hasta cerrar los gates pendientes.
- **No autorizados:** migraciones o configuración remotas, merge ni despliegue de producción.
- **Siguiente gate:** confirmar CI (incluye job Storage local del runner) y resultado de Preview;
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
