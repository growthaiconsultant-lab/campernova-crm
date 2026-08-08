# REL-1 — Relación bidireccional comprador–vehículo y compra verificable

| Campo               | Valor                                                   |
| ------------------- | ------------------------------------------------------- |
| **Estado**          | IMPLEMENTED                                             |
| **Owner**           | Product / Engineering                                   |
| **Ticket**          | Pendiente de crear                                      |
| **Rama / PR**       | `codex/sale-rel-1-buyer-vehicle-links` / sin PR         |
| **Categorías**      | C0 · C1 · C2 · C3 · C4 · C5 · C6                        |
| **Riesgo**          | Alto: venta, permisos, schema, auditoría y concurrencia |
| **Ruta SDD**        | Reforzada                                               |
| **Última revisión** | 2026-08-08                                              |

## Problema y evidencia (A. Objetivo)

El equipo necesita consultar desde la ficha operativa del vehículo qué compradores están
relacionados con él y, desde la ficha del comprador, qué vehículos están relacionados con esa
persona. La relación debe poder crearse manualmente por un motivo comercial sin afirmar que exista
una venta. Cuando sí exista una compra, ambas fichas deben mostrarla de forma destacada y enlazada.

La señal de éxito es que un usuario ADMIN o AGENTE pueda vincular una pareja una sola vez desde
cualquiera de las dos fichas, verla inmediatamente en ambos sentidos y distinguir sin ambigüedad
entre «relación comercial» y «comprado».

## Resultado esperado

- Las fichas muestran una sección bidireccional de relaciones comprador–vehículo.
- ADMIN y AGENTE pueden crear una relación manual con motivo obligatorio y una única nota opcional.
- Una relación manual no depende de una oferta, reserva ni venta y no cambia ningún estado comercial.
- La etiqueta y el resumen «Comprado» aparecen únicamente cuando existe una `Delivery` de la pareja
  con estado `COMPLETADA`.
- La compra se enlaza a la ficha contraria y las relaciones manuales permanecen visibles como
  historial aunque la pareja deje de ser elegible para el matching automático.

## B. Baseline verificado

- **VERIFICADO EN CÓDIGO:** `Match` ya representa la pareja `vehicleId` + `buyerLeadId`, conserva un
  origen `generatedBy` (`auto` o `manual`) y tiene una restricción única por pareja
  (`prisma/schema.prisma:968-987`).
- **VERIFICADO EN CÓDIGO:** el ciclo de `MatchStatus` contiene `SUGERIDO`, `PROPUESTO_CLIENTE`,
  `VISITA`, `OFERTA`, `CERRADO` y `RECHAZADO` (`prisma/schema.prisma:114-122`).
- **VERIFICADO EN CÓDIGO:** no existe una acción para crear un match manual; la única mutación pública
  del módulo cambia su estado (`app/(backoffice)/matches/actions.ts:26-79`).
- **VERIFICADO EN CÓDIGO:** el recalculador actual actualiza o elimina cualquier match `SUGERIDO` sin
  distinguir si fue creado o fijado manualmente (`lib/matching/recalculate.ts:7-50` y
  `lib/matching/recalculate.ts:72-108`).
- **VERIFICADO EN CÓDIGO:** las fichas filtran los matches persistidos por elegibilidad automática;
  al venderse/cerrarse o archivarse una parte, la relación desaparece de esas vistas
  (`app/(backoffice)/vendedores/[id]/page.tsx:210-225` y
  `app/(backoffice)/compradores/[id]/page.tsx:175-191`).
- **VERIFICADO EN CÓDIGO:** la ficha del vehículo infiere su comprador desde el primer match
  `CERRADO`, no desde una entrega completada (`app/(backoffice)/vendedores/[id]/page.tsx:279-280` y
  `app/(backoffice)/vendedores/[id]/page.tsx:1445-1469`).
- **VERIFICADO EN CÓDIGO:** la ficha del comprador toma su entrega más reciente sin filtrar estado y
  la presenta como «Operación» (`app/(backoffice)/compradores/[id]/page.tsx:108-123` y
  `app/(backoffice)/compradores/[id]/page.tsx:910-963`). Una entrega programada o cancelada puede,
  por tanto, parecer una compra.
- **VERIFICADO EN CÓDIGO:** `Delivery` es la entidad que liga vehículo y comprador y contiene
  `status` y `completedAt` (`prisma/schema.prisma:1197-1235`).
- **VERIFICADO EN CÓDIGO:** completar una entrega cambia atómicamente la entrega a `COMPLETADA`, el
  vehículo a `VENDIDO`, el match de la pareja a `CERRADO` cuando estaba en `OFERTA` y el comprador a
  `CERRADO` (`lib/delivery-completion.ts:187-211`).
- **VERIFICADO EN CÓDIGO:** el cambio manual a `CERRADO` comprueba una entrega completada del vehículo,
  pero no exige que pertenezca al mismo comprador (`app/(backoffice)/matches/actions.ts:43-50`).
- **VERIFICADO EN CÓDIGO:** las dos fichas y las acciones de matches usan `requireAgente`; este guard
  limita acceso a ADMIN y AGENTE (`lib/auth.ts:27-43`,
  `app/(backoffice)/vendedores/[id]/page.tsx:98-100` y
  `app/(backoffice)/matches/actions.ts:26-29`).
- **VERIFICADO EN CÓDIGO:** la garantía tiene `buyerLeadId` único, lo que hoy impide completar una
  segunda compra para el mismo comprador (`prisma/schema.prisma:1325-1349`).
- **INFERENCIA:** la petición de «unir comprador y vehículo por cualquier razón» describe una
  relación comercial manual, no una nueva clase de venta ni una relación comprador–vendedor.
- **RECOMENDACIÓN:** ampliar `Match`, que ya anticipa origen manual, en vez de crear otra tabla que
  duplique la misma pareja.
- **DESCONOCIDO:** no se ha consultado ningún entorno remoto para contar matches legacy con
  `generatedBy = 'manual'`, valores de origen no canónicos o entregas completadas inconsistentes.
  Ese preflight agregado, sin PII, es obligatorio antes de autorizar una migración remota.

## C. Alcance

- Modelo y migración aditiva para que `Match` soporte una vinculación manual auditable y score
  opcional.
- Creación manual desde la ficha de comprador y desde la ficha operativa del vehículo, actualmente
  alojada en `/vendedores/[sellerLeadId]`.
- Lectura bidireccional y persistente de relaciones manuales.
- Resumen de compra derivado exclusivamente de la entrega completada de la pareja.
- Corrección del guard de cierre manual para exigir esa misma pareja.
- Protección del vínculo manual frente al recalculador automático.
- Auditoría interna mediante Activity en los dos historiales.
- Adaptación de lectores, KPIs y listados que hoy asumen que todo `Match.score` es obligatorio.

Entornos incluidos ahora: implementación y validación local. CI, Preview/staging y producción
requieren gates y autorizaciones separadas.

## D. Exclusiones

- Relacionar directamente `SellerLead` con `BuyerLead`: la relación canónica es comprador–vehículo.
- Crear una nueva ficha `/vehiculos/[id]`; se conserva la ficha operativa existente del vendedor.
- Crear, aceptar o convertir ofertas; reservar, entregar o marcar como vendido desde este diálogo.
- Inferir o fabricar compras a partir de matches, ofertas, notas o estados del lead.
- Firma digital, contrato, PDF o notificación externa de la vinculación.
- Borrado físico de relaciones; se conserva el historial y se usa `RECHAZADO` cuando deja de aplicar.
- Resolver en este cambio la restricción legacy que impide varias garantías/compras por comprador.
- Cambiar permisos de TALLER, ENTREGAS o MARKETING.
- Backfill manual de compradores históricos sin evidencia de una `Delivery COMPLETADA`.
- Commit, push, PR, migración remota, deploy, merge o cambio de producción sin autorización posterior.

## E. Decisiones de negocio

| Decisión                   | Alternativas                                                         | Resolución y motivo                                                                                                                                              |
| -------------------------- | -------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Hecho de compra            | Match cerrado; oferta aceptada; vehículo vendido; entrega completada | Sólo `Delivery(status=COMPLETADA)` para la pareja exacta. Es el cierre transaccional que ya actualiza vehículo, match y comprador.                               |
| Relación manual            | Tabla nueva; texto en Activity; ampliar `Match`                      | Ampliar `Match`. Ya modela la pareja, tiene lifecycle, origen manual previsto y unique compuesto. Activity no es fuente canónica.                                |
| Cardinalidad               | Una relación total; una por estado; una por pareja                   | Muchos vehículos por comprador y muchos compradores por vehículo, con una fila `Match` única por pareja.                                                         |
| Motivo                     | Texto libre; reutilizar estado; catálogo cerrado + nota              | Catálogo cerrado obligatorio y una nota opcional. El motivo explica por qué se vinculó; `MatchStatus` explica la fase actual.                                    |
| Catálogo de motivo         | Duplicar estados; catálogo comercial                                 | `INTERES_COMPRADOR`, `RECOMENDACION_EQUIPO`, `SEGUIMIENTO_COMERCIAL`, `VISITA_RELACIONADA`, `OTRO`.                                                              |
| Score manual               | Fabricar 0; calcular siempre; hacerlo nullable                       | `score` nullable. Un vínculo sin compatibilidad algorítmica no debe inventar una puntuación. Los matches automáticos conservan score obligatorio por writer.     |
| Match automático existente | Duplicar; sustituir; fijar la misma fila                             | Fijar/enriquecer la misma fila con metadatos manuales; conservar su score y `generatedBy='auto'`.                                                                |
| Visibilidad histórica      | Aplicar elegibilidad a todo; mostrar manual siempre                  | Los manuales fijados y las compras completadas permanecen visibles; la elegibilidad sigue filtrando sólo sugerencias automáticas.                                |
| Entidades terminales       | Prohibir todo; permitir cualquier registro                           | Permitir vincular estados terminales no archivados para reconstrucción/seguimiento histórico. Bloquear nuevos vínculos si comprador o vendedor están archivados. |
| Desvinculación             | Hard delete; borrar metadata; estado                                 | No hard delete. Cambiar a `RECHAZADO` conserva motivo, actor y timeline; una compra completada no desaparece.                                                    |
| Roles                      | ADMIN; ADMIN/AGENTE; todos                                           | ADMIN y AGENTE, con enforcement server-side existente.                                                                                                           |

No queda una decisión material de negocio abierta para implementar el núcleo descrito. La capacidad
de varias compras completadas por un mismo comprador queda explícitamente fuera de alcance y deberá
tener su propia decisión de garantía/postventa.

## F. Flujo funcional

1. ADMIN o AGENTE abre una ficha de comprador o la ficha operativa de un vehículo.
2. Pulsa «Vincular vehículo» o «Vincular comprador».
3. Un buscador server-side, limitado y paginable, devuelve sólo contrapartes no archivadas y omite la
   pareja ya vinculada. No se descarga la base completa al cliente.
4. El usuario elige contraparte, motivo obligatorio y una nota opcional de hasta 500 caracteres.
5. El servidor revalida permiso, IDs y archivado dentro del protocolo de locks.
6. Si no existe `Match`, crea uno manual con `status=SUGERIDO`, `score=null` y metadatos de auditoría.
7. Si existe un match automático no fijado, lo fija manualmente sin perder score ni estado.
8. Si ya estaba fijado manualmente, responde éxito idempotente y no duplica Activity.
9. La transacción crea una Activity en el comprador y otra en el vendedor propietario del vehículo;
   después del commit se revalidan ambas fichas.
10. Ambas vistas muestran origen «Vinculado manualmente», motivo, nota ajustada en varias líneas y enlace a la ficha
    contraria. Si hay score real también puede mostrarse; `null` se presenta como «Sin score».
11. Si existe una entrega completada de la pareja, un bloque superior independiente muestra
    «Comprado», fecha de finalización y enlace a la contraparte.

Alternativas y errores:

- Contraparte inexistente o borrada: error estable «No se ha encontrado» y cero escrituras.
- Lead archivado entre búsqueda y confirmación: conflicto de dominio y petición de recarga.
- Doble clic/retry: una relación, dos Activities totales (una por timeline), respuesta idempotente.
- Conflicto de lock o timeout: mensaje recuperable; no hay escritura parcial.
- Relación automática incompatible con el top posterior: al estar fijada manualmente no se elimina.
- Entrega programada, en curso o cancelada: puede mostrarse en su módulo operativo, pero nunca bajo
  la etiqueta «Comprado».

## G. Estados e invariantes

- `MatchStatus` no cambia por crear/fijar una relación manual; una fila nueva comienza en `SUGERIDO`.
- Motivo de vínculo, estado del match y estado de compra son tres hechos distintos.
- `Match.manualLinkedAt != null` identifica una decisión humana persistente.
- Todo nuevo vínculo manual debe tener `manualLinkReason`, `manualLinkedById` y `manualLinkedAt`.
- Un match automático fijado conserva `generatedBy='auto'`; la presencia de `manualLinkedAt` expresa
  la doble procedencia sin destruir auditoría.
- `score=null` es válido sólo para relaciones sin puntuación calculada; los writers automáticos nunca
  crean score nulo.
- Sólo una fila `Match` puede existir por `(vehicleId, buyerLeadId)`.
- El recalculador nunca elimina una fila con `manualLinkedAt != null` y sólo actualiza su score si la
  pareja vuelve a estar en el top; nunca borra los metadatos manuales.
- «Comprado» equivale a una `Delivery COMPLETADA` de la pareja exacta, no a `Match.CERRADO`,
  `Offer.ACEPTADA`, `BuyerLead.CERRADO` ni `Vehicle.VENDIDO` por separado.
- Cambiar manualmente un match a `CERRADO` exige una entrega completada de ese mismo vehículo y ese
  mismo comprador.
- Rechazar una relación no borra ni oculta una compra completada.
- Archivar no borra relaciones ya existentes; únicamente bloquea crear/fijar otras nuevas.

## H. Permisos

| Actor               | Ver relaciones en fichas permitidas | Buscar contraparte | Crear/fijar vínculo | Cambiar estado | Ver «Comprado» |
| ------------------- | ----------------------------------- | ------------------ | ------------------- | -------------- | -------------- |
| ADMIN               | Sí                                  | Sí                 | Sí                  | Sí             | Sí             |
| AGENTE              | Sí                                  | Sí                 | Sí                  | Sí             | Sí             |
| TALLER              | No                                  | No                 | No                  | No             | No             |
| ENTREGAS            | No                                  | No                 | No                  | No             | No             |
| MARKETING           | No                                  | No                 | No                  | No             | No             |
| Sin sesión/inactivo | Redirección/login                   | No                 | No                  | No             | No             |

- Todas las búsquedas y mutaciones llaman a `requireAgente()` antes de leer contrapartes o aceptar
  IDs; ocultar el botón no es control de acceso.
- La action no acepta `actorId`, `sellerLeadId`, score, estado ni timestamps del cliente.
- El `sellerLeadId` para la Activity se resuelve desde el vehículo dentro de la transacción.
- No se modifica RLS ni se expone una API pública; Prisma server-side conserva el boundary actual.
- Tests negativos invocan directamente actions con TALLER, ENTREGAS, MARKETING, usuario inactivo,
  IDs cruzados y payload manipulado.

## I. Modelo de datos y migraciones

Cambio previsto en `Match`:

```prisma
enum MatchLinkReason {
  INTERES_COMPRADOR
  RECOMENDACION_EQUIPO
  SEGUIMIENTO_COMERCIAL
  VISITA_RELACIONADA
  OTRO
}

model Match {
  score              Int?
  manualLinkReason   MatchLinkReason? @map("manual_link_reason")
  manualLinkNotes    String?          @map("manual_link_notes")
  manualLinkedAt     DateTime?        @map("manual_linked_at")
  manualLinkedById   String?          @map("manual_linked_by_id")
  manualLinkedBy     User?            @relation("ManualMatchLinks", fields: [manualLinkedById], references: [id], onDelete: SetNull)
}
```

`User` añade la relación inversa con nombre explícito. La migración es expand-only:

1. Crear enum y columnas nullable.
2. Permitir `score NULL` y añadir `CHECK (score IS NULL OR score BETWEEN 0 AND 100)`.
3. Crear FK de actor con `ON DELETE SET NULL` y el índice necesario para esa FK si el plan de query
   lo justifica.
4. No modificar ni borrar la unique `(vehicle_id, buyer_lead_id)` existente.
5. No hacer backfill inferido. Matches legacy manuales sin metadatos se muestran como
   «Manual legado · motivo no registrado» hasta una reconciliación separada y autorizada.

Preflight agregado obligatorio antes de cualquier migración remota:

- distribución de `generated_by`, cantidad de manuales y scores fuera de 0–100;
- duplicados por pareja (deberían ser imposibles por unique) y huérfanos;
- entregas `COMPLETADA` por vehículo y parejas cuyo match cerrado no coincide;
- historial de migraciones y drift/paridad.

No se leen ni exportan nombres, emails, teléfonos, notas ni otros datos personales. La migración debe
replayar desde cero. El cliente anterior tolera las columnas nuevas y los datos existentes conservan
score no nulo, pero no es un rollback suficiente después de crear la primera fila con score nulo.
Por ello se entrega primero un lector compatible con `score=null`, sin habilitar el writer manual;
ese commit de compatibilidad pasa a ser el rollback mínimo seguro de la fase funcional.

## J. Writers y readers

| Superficie                            | Conducta actual                                                     | Cambio previsto                                                                                           | Validación                      |
| ------------------------------------- | ------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------- | ------------------------------- |
| `app/(backoffice)/matches/actions.ts` | Sólo cambia estado; cierre comprueba cualquier entrega del vehículo | Añadir búsqueda/creación manual y exigir entrega completada de la pareja exacta; lock, CAS e idempotencia | Unitarios + PostgreSQL          |
| `lib/matching/recalculate.ts`         | Actualiza/borra todo `SUGERIDO`                                     | Seleccionar metadatos manuales; no borrar fijados y aceptar score nullable en existentes                  | Unitarios de diff + integración |
| `components/matches-section.tsx`      | Asume score numérico y no crea relaciones                           | Botón, diálogo, origen, motivo, nota, `Sin score`, loading/error/empty                                    | Componentes + smoke             |
| Ficha vendedor/vehículo               | Filtra todo por elegibilidad y usa match cerrado como comprador     | Unir automáticos elegibles + manuales fijados; resumen de compra por Delivery exacta                      | Tests de reader/UI              |
| Ficha comprador                       | Filtra todo por elegibilidad y usa la última Delivery sin estado    | Unir relaciones persistentes; compras sólo `COMPLETADA`, ordenadas por `completedAt`                      | Regresión programada/cancelada  |
| Pipeline comprador                    | Toma el primer match por score                                      | Excluir score nulo del «mejor match»                                                                      | Query/test                      |
| Inventario/KPIs matching              | Algunos conteos asumen que toda fila es sugerencia puntuable        | Los KPIs de compatibilidad/demanda exigen score no nulo; la relación manual no infla matching             | Tests KPI                       |
| Delivery completion                   | Cierra el match OFERTA de la pareja                                 | Sin cambio de contrato; continúa siendo writer canónico de compra                                         | Regresión existente             |
| Activity                              | Registra cambios de estado                                          | Dos trazas atómicas de creación/fijación, sin PII en logs externos                                        | Test de exactamente una vez     |

La implementación debe repetir búsquedas de `match`/`matches`, score, `generatedBy`, Delivery y
contadores antes del diff para no omitir SQL raw, seeds, emails, crons o consumidores indirectos.
No se han encontrado webhooks, Storage ni APIs públicas que escriban Match.

## K. Concurrencia e idempotencia

- Raíces de coordinación: `SellerLead` propietario, `Vehicle` y `BuyerLead`, bloqueadas en el orden
  global de `withLockedRoots`.
- Bajo lock se releen vehículo, vendedor, comprador, archivado y match existente. Un pre-read para
  poblar el diálogo no decide negocio.
- Pareja inexistente: `create`; la unique compuesta es la segunda barrera frente a carreras.
- Pareja automática existente: CAS `updateMany` condicionado por `manualLinkedAt = null`; sólo quien
  obtiene `count=1` crea las Activities.
- Pareja ya fijada: éxito idempotente sin sobrescribir motivo/nota/actor ni repetir Activities.
- La creación/fijación y ambas Activities viven en una sola transacción. Las invalidaciones ocurren
  después del commit.
- `updateMatchStatus` se relee bajo las mismas raíces, usa CAS por estado esperado y exige Delivery
  completada de la pareja exacta al cerrar. Retry al mismo target es no-op exitoso.
- Tests PostgreSQL sincronizan dos creaciones de la misma pareja, creación contra archivado y cambio
  de estado concurrente; debe quedar una fila y exactamente dos Activities de vinculación.

## L. Efectos secundarios e integraciones

- Revalidar tras commit las fichas `/vendedores/:sellerLeadId` y `/compradores/:buyerLeadId`.
- Una relación manual no crea oferta, reserva, entrega, garantía, coste, evento ni email.
- No se envía notificación de high-score si `score` es nulo o la creación es manual.
- Los recalculadores de vehículo/comprador conservan filas fijadas y no degradan su metadata.
- KPIs de matching y demanda continúan midiendo compatibilidad puntuada; el número de relaciones
  manuales puede añadirse en otra métrica sólo con una pregunta de producto explícita.
- Sentry/Vercel reciben únicamente código de operación/error e IDs técnicos permitidos; nunca motivo
  libre, nota, nombres, email o teléfono. PostHog no se añade en esta fase.
- No hay efectos en Storage, Supabase Auth, Resend, hCaptcha, sitemap ni superficies públicas.

## M. UX y errores

- En comprador: «Vincular vehículo». En vehículo: «Vincular comprador».
- Diálogo con búsqueda remota a partir de dos caracteres, máximo 20 resultados por página, selección
  única, motivo obligatorio y una nota opcional.
- Aviso bajo la nota: no incluir DNI, datos bancarios ni información sensible.
- Botón deshabilitado mientras guarda; foco vuelve al disparador; labels y errores se asocian al
  campo; operación completa con teclado.
- Estado vacío explica que una relación no equivale a una compra.
- Tarjetas distinguen `Automático`, `Vinculado manualmente` y `Automático + fijado manualmente`.
- `score=null` se muestra como «Sin score», nunca como cero. Motivo y nota completa visibles; la nota
  se ajusta en varias líneas y no depende de hover.
- Una compra completada usa jerarquía visual superior y texto «Comprado», no «Operación» ambiguo.
- Loading, sin resultados, error recuperable, ya vinculado y registro archivado tienen mensajes
  diferenciados.
- Verificar desktop y móvil de 360/390 px sin desbordamiento ni acciones inaccesibles.

## N. Tests

1. Unitarios de Zod: IDs, catálogo de motivo, trimming, nota vacía y máximo 500.
2. Unitarios de action: auth positiva/negativa; no encontrado; archivado; nueva fila; promoción de
   auto existente; ya fijado; score no manipulable; Activities e invalidaciones.
3. Unitarios del recalculador: manual fuera del top no se borra; manual dentro del top puede recibir
   score sin perder metadata; auto sugerido mantiene conducta actual.
4. Regresión de cierre: una Delivery completada de otro comprador no permite cerrar el match; la
   pareja exacta sí; retry no duplica Activity.
5. PostgreSQL real: doble creación concurrente, promoción concurrente, creación frente a archivado,
   unique compuesta, FK de actor, check de score y rollback si falla la segunda Activity.
6. Readers: una entrega programada/cancelada no aparece como compra; una completada antigua no queda
   oculta por otra reciente no completada; un match cerrado sin Delivery exacta no muestra comprado.
7. KPIs/pipeline: score nulo no es mejor match ni demanda puntuada y no rompe promedios.
8. Componentes: diálogo desde ambos lados, loading/error/empty, `Sin score`, origen, motivo, enlace y
   responsive.
9. Migración: Prisma validate/generate, replay completo, history/parity, constraints y compatibilidad
   del cliente anterior.
10. Verificación proporcional: `pnpm check:sdd`, `pnpm prisma validate`, `pnpm prisma generate`, tests
    focales, `pnpm typecheck`, `pnpm lint`, `pnpm test`, integración PostgreSQL, migration replay y
    `pnpm build`.
11. E2E/smoke posterior y autorizado: ADMIN crea desde comprador, AGENTE desde vehículo, TALLER no
    accede, relación visible en ambos lados y compra real separada.

Un comando omitido queda registrado como no ejecutado; compilar o desplegar no equivale a validar.

## Rollout (O. Orden de despliegue)

1. Revisar y aprobar esta spec; crear/enlazar ticket antes de implementar.
2. Implementar localmente en la rama corta sólo tras autorización explícita, con migración nueva y
   sin tocar migraciones ya desplegadas.
3. Ejecutar suite local y PostgreSQL efímero; revisar diff, secretos y archivos ajenos.
4. Commit/push/PR únicamente con autorización; exigir CI completa y Preview contra staging.
5. Antes de cualquier migración remota, ejecutar preflight agregado read-only y comparar history con
   el repo. Detener ante drift o datos legacy no contemplados.
6. Separar dos releases: (A) migración + lectores/KPIs compatibles con `score=null`, sin controles de
   creación; (B) writer y UX manuales. El release A es el rollback mínimo seguro del B.
7. Aplicar A primero en staging; postflight de columnas, FK, check, unique y conteos; desplegar su
   Preview y demostrar que no crea scores nulos ni cambia el comportamiento existente.
8. Desplegar B sólo después; smoke de ADMIN/AGENTE y negativos de roles en staging, incluida
   carrera/retry controlado.
9. Producción requiere autorización separada para cada release: preflight repetido, backup/PITR
   confirmado, A, smoke/observación; después B, smoke no destructivo y observación de 24 horas.
10. Actualizar estados `IMPLEMENTED`, `DEPLOYED` y `VALIDATED` sólo con evidencia real.

Owner técnico: Engineering. Owner de validación operativa: Product/Joel o persona expresamente
delegada. Aprobar la spec no autoriza modificar Supabase, Vercel ni producción.

## P. Rollback y stop conditions

- Rollback de B: volver al release A, que sabe leer `score=null`; nunca volver a un lector anterior a
  A después de que exista una relación manual sin score. El schema aditivo permanece compatible.
- Rollback de A antes de activar B: volver al cliente previo y conservar el schema expandido, ya que
  aún no existen scores nulos creados por REL-1.
- Una migración aplicada no se revierte borrando columnas o datos. Se mantiene expandida y se prepara
  un contract posterior si fuese necesario.
- Los vínculos creados por usuarios durante una ventana no se borran automáticamente al revertir UI;
  cualquier corrección de datos exige inventario y autorización específica.
- Detener implementación si aparece otro writer canónico de compra o una ruta de vehículo distinta
  que cambie el alcance.
- Detener migración ante drift, `generatedBy` desconocido, score fuera de rango, duplicados,
  huérfanos, replay/parity fallido o imposibilidad de confirmar backup/PITR.
- Detener deploy si falla auth negativa, doble ejecución, rollback transaccional, exactitud de la
  pareja de compra, preservación del vínculo manual o cualquier job requerido de CI.
- Rollback del cliente si aparece una compra sin Delivery exacta, se elimina un vínculo manual por
  recálculo, un rol no autorizado puede mutar, o el error rate de estas actions supera 1 %.

## Q. Observabilidad

- Auditoría canónica: campos manuales de `Match` más las dos Activities transaccionales.
- Métricas técnicas: intentos, creados, promovidos, idempotentes, conflictos unique/CAS, lock timeout
  y errores inesperados; sin motivos/notas ni PII.
- Validaciones esperadas y permisos denegados no se reportan como excepciones.
- En staging y producción autorizados: revisar logs/Sentry inmediatamente tras smoke y a las 24 h;
  comparar conteos agregados de relaciones manuales y compras por Delivery.
- Alerta/stop si hay Activity sin Match fijado, Match fijado sin actor/motivo nuevo, divergencia entre
  vistas o compras mostradas sin Delivery exacta.

## R. Documentación

- Esta spec será la fuente de verdad de REL-1 y debe enlazarse desde el ticket y PR.
- Si se implementa, actualizar el catálogo/modelo de datos y la documentación de migraciones sólo en
  las secciones afectadas.
- No actualizar backlog ni estado volátil en `AGENTS.md` o `CLAUDE.md`.
- El documento local no versionado `docs/Integraciones-Telefonia-WhatsApp-Plan.md` y los adjuntos
  `.codex-remote-attachments/` quedan fuera de todo diff, stage y commit.
- Los resultados reales de tests, CI, deployment y observación se incorporan al cierre; no se
  anticipan como verdes.

## S. Riesgos y deuda explícita

| Riesgo/deuda                                                | Probabilidad    | Impacto | Mitigación                                                 | Owner / cierre                          |
| ----------------------------------------------------------- | --------------- | ------- | ---------------------------------------------------------- | --------------------------------------- |
| Confundir relación con compra                               | Media           | Alto    | Delivery exacta como única fuente y tests negativos        | Engineering / REL-1                     |
| Recalculador borra vínculo humano                           | Alta sin cambio | Alto    | `manualLinkedAt`, filtro de diff y regresión               | Engineering / REL-1                     |
| Doble clic duplica auditoría                                | Media           | Medio   | Locks + CAS + unique + transacción                         | Engineering / REL-1                     |
| Score nulo rompe readers                                    | Media           | Alto    | Inventario completo, tipos explícitos y tests KPI/UI       | Engineering / REL-1                     |
| Relación manual infla demanda algorítmica                   | Media           | Medio   | KPIs exigen score real                                     | Product Analytics / REL-1               |
| Nota contiene PII                                           | Media           | Medio   | Límite, aviso y exclusión de logs/Sentry/PostHog           | Engineering / permanente                |
| Legacy manual sin motivo/actor                              | Desconocida     | Medio   | Preflight y etiqueta legacy, sin backfill inferido         | Product / antes de producción           |
| Varias compras por comprador bloqueadas por Warranty unique | Cierta          | Medio   | Fuera de alcance; spec específica de garantía/postventa    | Product / cuando se requiera repetición |
| «Ficha de vehículo» vive bajo vendedor                      | Cierta          | Bajo    | Enlaces canónicos actuales; ruta dedicada fuera de alcance | Product / futura arquitectura           |

## Criterios de aceptación (T. Resultados verificables)

- [x] ADMIN y AGENTE disponen de la creación desde cualquiera de las dos fichas en la implementación
      local; queda pendiente el smoke por rol.
- [x] TALLER, ENTREGAS, MARKETING, usuario inactivo y anónimo quedan bloqueados por el guard
      server-side cubierto por unitarios; queda pendiente el smoke real.
- [x] Motivo es obligatorio, nota es única/opcional y el cliente no puede fijar actor, score o estado.
- [x] Una pareja tiene una sola fila; retry/doble clic no duplica fila ni Activities.
- [x] Un match automático existente se fija sin perder score ni estado.
- [x] El recalculador no elimina relaciones fijadas manualmente.
- [x] Relaciones manuales permanecen visibles con entidades terminales y tras archivado, pero no se
      pueden crear nuevas con leads archivados.
- [x] Score nulo se muestra como «Sin score» y no contamina mejor match, demanda ni KPIs puntuados.
- [x] «Comprado» se deriva sólo de `Delivery COMPLETADA` de la pareja exacta en los readers locales;
      queda pendiente el smoke con datos reales.
- [ ] Programada, en curso, cancelada, match cerrado de otra pareja, oferta aceptada o vehículo
      vendido aislado no aparecen como compra.
- [x] Cerrar manualmente exige una Delivery completada del mismo vehículo y comprador.
- [x] No se crean ofertas, reservas, entregas, garantías, emails, costes ni cambios de estado al
      vincular.
- [x] La migración replaya desde cero, mantiene paridad, unique/FK/check e idempotencia en CI.
- [ ] Unitarios, PostgreSQL concurrente, auth negativa, UI, typecheck, lint, suite y build terminan con
      resultado conocido y documentado.
- [ ] Smoke autorizado confirma ambos sentidos, responsive y separación relación/compra.

## U. Estado de autorización

**PLAN READY FOR INDEPENDENT REVIEW**

- Ejecutado con autorización: implementación local, commits, push y PR borrador #174; CI efímera con
  PostgreSQL y Supabase local. La integración Git de Vercel creó un Preview automático, no abierto ni
  probado por el agente.
- No autorizado: conectar o mutar Supabase remoto, modificar variables Vercel, usar Preview/staging,
  marcar el PR listo, merge o producción.
- Siguiente gate: revisión independiente del PR y autorización separada para verificar que Preview
  apunta a staging, aplicar la migración sólo allí y ejecutar el smoke por rol.

## Revisión adversarial

| Hallazgo adversarial                                                              | Materialidad | Corrección incorporada                                             |
| --------------------------------------------------------------------------------- | ------------ | ------------------------------------------------------------------ |
| Un match cerrado de comprador A se muestra como compra aunque la entrega sea de B | Crítica      | Delivery completada de la pareja exacta en writer y reader         |
| La última entrega del comprador está cancelada y oculta una compra anterior       | Alta         | Filtrar `COMPLETADA` antes de ordenar/tomar                        |
| El recálculo borra una relación humana `SUGERIDO` fuera del top                   | Alta         | Metadato de fijación y regla explícita de preservación             |
| Se inventa score 0 para una relación no algorítmica                               | Media        | `score` nullable y «Sin score»                                     |
| Dos agentes vinculan a la vez y crean cuatro Activities                           | Alta         | Root locks, CAS/unique y Activities dentro de la tx ganadora       |
| La UI oculta el botón, pero TALLER llama la action                                | Alta         | `requireAgente` antes de leer/mutar y tests directos negativos     |
| Archivar compite con vincular y deja un vínculo nuevo a un lead archivado         | Alta         | Mismas raíces de lock y relectura de `archivedAt` bajo lock        |
| Manuales aumentan demanda/KPI aunque no tengan compatibilidad                     | Media        | Readers analíticos exigen score real                               |
| Una nota comercial termina en Sentry                                              | Alta         | Observabilidad estructurada sin texto/PII                          |
| Un hard delete borra historia o una compra                                        | Alta         | Sin acción de borrado; rechazo conserva auditoría y Delivery manda |

## Matriz de completitud

| Área                       | Revisada (Sí/No) | Evidencia                                                 | Riesgo pendiente                           |
| -------------------------- | ---------------- | --------------------------------------------------------- | ------------------------------------------ |
| Dominio                    | Sí               | E–G: relación, motivo y compra son hechos separados       | Validación operativa pendiente             |
| Estados                    | Sí               | G y baseline de Match/Delivery                            | No se rediseña toda la matriz MatchStatus  |
| Permisos                   | Sí               | H y `lib/auth.ts:27-43`                                   | Smoke real por rol posterior               |
| Concurrencia               | Sí               | Doble creación/promoción con PostgreSQL real en CI        | Carrera contra archivado no automatizada   |
| Idempotencia               | Sí               | Retry concurrente y rollback transaccional verdes en CI   | Smoke UI de doble clic pendiente           |
| Datos                      | Sí               | I: columnas nullable, FK y check                          | Preflight remoto no autorizado             |
| Legacy                     | Sí               | B/I: manuales legacy desconocidos y sin backfill inferido | Recuento agregado pendiente                |
| Migración                  | Sí               | Replay, paridad, catálogo e idempotencia verdes en CI     | Preflight remoto no autorizado             |
| Compatibilidad             | Sí               | I/J + build/readers compatibles con score nullable        | Release A aún no desplegado                |
| Readers                    | Sí               | J: fichas, pipeline, inventario, KPIs, recálculo          | Smoke con datos reales pendiente           |
| Efectos secundarios        | Sí               | L: Activity/revalidate; sin oferta/email/Storage          | Smoke posterior                            |
| Caché/superficies públicas | Sí               | L: sólo revalidate de backoffice                          | Ninguno identificado                       |
| Observabilidad             | Sí               | Q: métricas estructuradas sin PII                         | Instrumentación concreta pendiente         |
| Rollout                    | Sí               | O: review → local/CI → staging → producción               | Requiere autorizaciones separadas          |
| Rollback                   | Sí               | P: cliente reversible, schema expandido se conserva       | Datos creados requieren decisión explícita |
| Documentación              | Sí               | R: spec/ticket/PR/catálogo                                | Ticket aún no creado                       |

## Verificación de esta fase

| Criterio               | Evidencia prevista                                                              | Resultado                                                                                                                                                                                                |
| ---------------------- | ------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Baseline de código     | Schema, actions, readers, matching, permisos y entrega citados por línea        | Completado localmente                                                                                                                                                                                    |
| Decisiones de producto | Relación manual independiente; compra por Delivery; motivo + nota; pareja única | Incorporadas                                                                                                                                                                                             |
| SDD reforzado          | Secciones A–U, adversarial y matriz de completitud                              | PASS con `node scripts/check-sdd.mjs`; `git diff --check` PASS. El wrapper de `pnpm check:sdd` no ejecutó el check porque intentó reinstalar dependencias sin TTY; no se aceptó esa mutación incidental. |
| Implementación         | Código, schema y migración                                                      | Implementada en los commits enlazados por el PR borrador #174                                                                                                                                            |
| Prisma/migraciones     | Validate, generate e historial local                                            | PASS: Prisma 6.19.3; 13 migraciones activas sin colisiones                                                                                                                                               |
| Estática y unitarios   | Typecheck, lint, suite Vitest y build                                           | PASS: 1.453 tests, lint limpio, typecheck y build exit 0                                                                                                                                                 |
| PostgreSQL real        | Concurrencia, constraints, rollback y replay                                    | PASS en CI efímera: integración, migraciones, RLS, paridad, catálogo, guard remoto e idempotencia. Un primer rerun falló antes del checkout al descargar Docker; el rerun selectivo pasó.                |
| Supabase local         | Storage real, buckets, políticas y guard anti-remoto                            | PASS en CI con Supabase local efímero; sin enlace ni credenciales remotas.                                                                                                                               |
| Entornos remotos       | Preflight, staging, Preview, producción                                         | Vercel creó automáticamente un Preview por la integración Git; el agente no lo abrió ni probó. Supabase remoto, staging y producción no se conectaron ni mutaron.                                        |

## Cierre

- **Commits:** enlazados y revisables desde el PR #174.
- **PR:** borrador #174.
- **CI:** quality, integration PostgreSQL, migration-replay y Supabase local PASS.
- **Deployment:** Preview creado automáticamente por Vercel; no probado ni autorizado para staging.
- **Validación:** schema, estática, unitarios, build, PostgreSQL real y replay PASS; smoke UI pendiente.
- **Deuda restante:** ticket, métricas estructuradas adicionales, smoke UI y gates de staging/producción.
