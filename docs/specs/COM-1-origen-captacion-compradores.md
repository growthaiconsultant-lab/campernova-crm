# COM-1 — Seleccionar y consultar el origen de captación del comprador

| Campo               | Valor                                                                    |
| ------------------- | ------------------------------------------------------------------------ |
| **Estado**          | IMPLEMENTED                                                              |
| **Owner**           | Engineering / Joel                                                       |
| **Ticket**          | COM-1 — petición directa «pues créalo»                                   |
| **Rama / PR**       | codex/buyer-capture-source / pendiente                                   |
| **Categorías**      | C0, C1, C2, C3, C6                                                       |
| **Riesgo**          | Medio; extensión aditiva sobre fichas y entrega existente                |
| **Ruta SDD**        | Reforzada por boundary de contacto y entrega; sin nuevas reglas de venta |
| **Última revisión** | 2026-10-07                                                               |

## Problema y evidencia

VERIFICADO EN CÓDIGO sobre main `62f5e66b757dce4d26d39773e80c98c8864eb3c6`: BuyerLead.source es String nullable; alta, edición y alta desde entrega no permiten seleccionarlo. El chat escribe CHAT, el filtro existente contempla CHAT/CHAT_WEB, PRO, LLAMADA y null como Backoffice. La ficha muestra códigos sin traducir. Evidencia: prisma/schema.prisma, compradores/actions.ts, compradores/[id]/actions.ts, lib/operational-deliveries.ts, api/chat/buyer/message/route.ts y compradores/buyer-list-filters.tsx.

## Resultado esperado

Crear o editar un comprador permite elegir Instagram, Coches.net, Wallapop, Web, Presencial / físico, Llamada, Otros o Sin especificar. Aplica también a comprador nuevo desde entrega. La ficha muestra una etiqueta legible y el listado permite filtrar. Chat web y Formulario web siguen disponibles para conservar compatibilidad.

## Reglas e invariantes

- Origen comercial canónico en BuyerLead.source; no confundir con KpiEvent.source técnico (ui/chat/system).
- No adivinar el origen histórico: null sigue null; no backfill.
- Fuente omitida al editar conserva el valor actual; null explícito lo elimina.
- Fuentes legacy no reconocidas se muestran y pueden conservarse sin bloquear la edición; no aceptar códigos arbitrarios nuevos.
- Alta sin fuente, incluido cliente anterior, sigue permitida.
- Mismos permisos y guards server-side existentes; no ampliación de roles.
- Alta desde entrega guarda source en la misma transacción y fingerprint; replay idéntico no duplica y cambiar source bajo la misma clave es conflicto.
- No alterar estado comercial, asignación, deduplicación, matching, ventas, garantía ni cancelación.

## Fuera de alcance

Integraciones de captación, atribución multicanal, métricas nuevas, migraciones, backfill, cambios de permisos o datos reales de prueba.

## Decisiones

| Decisión           | Alternativas                         | Resolución y motivo                                                                    |
| ------------------ | ------------------------------------ | -------------------------------------------------------------------------------------- |
| Persistencia       | Nuevo enum/columna o campo existente | Reutilizar source; evita migración y conserva históricos                               |
| Obligatorio        | Exigir fuente o nullable             | Opcional, Sin especificar; no inventar datos                                           |
| Web                | Sólo WEB o agregado                  | Web incluye WEB, PRO, CHAT y CHAT_WEB; filtros específicos conservados                 |
| Legacy desconocido | Rechazar edición o conservar         | Omitir campo al guardar y opción conservar; sólo códigos catalogados pueden escribirse |

## Plan técnico

1. Catálogo, validación y etiquetas compartidas en lib/buyer-source.ts.
2. Selector accesible reutilizado en alta, edición y nuevo comprador desde entrega; persistir source validado.
3. Filtros compartidos y etiquetas legibles en ficha. Cambiar subtítulo incorrecto de captación en oficina.
4. Tests de schemas, acciones, filtros y persistencia real; replay de entrega y compatibilidad legacy. Verificación visual local con acciones simuladas, typecheck/lint/SDD.

### Impacto

| Componente               | Actual                      | Cambio                                    | Riesgo                   | Validación           |
| ------------------------ | --------------------------- | ----------------------------------------- | ------------------------ | -------------------- |
| Validadores y catálogo   | Sin input source            | Enum nullable opcional                    | Mass assignment / legacy | Unit                 |
| Alta y edición comercial | No escriben source          | Alta nullable, patch sólo si presente     | Borrado accidental       | Unit + PostgreSQL    |
| Entrega manual           | Contacto sin source         | Persistencia en transacción y fingerprint | Replay divergente        | Integración real     |
| Formularios              | Sin selector                | Selector y conservación legacy            | Pérdida en error         | Componente navegador |
| Ficha y listado          | Códigos y filtros parciales | Etiquetas y filtros completos             | Lectura histórica        | Unit + revisión      |
| Chat público             | CHAT automático             | Sin cambios                               | Regresión de origen      | Tests existentes     |

- **Datos/migraciones:** String nullable existente; sin migración/backfill, compatible con cliente anterior.
- **Permisos/seguridad:** requireAgente y guard operativo existentes; validar en servidor antes de escritura; sin nuevos logs de contacto.
- **Concurrencia/idempotencia:** patch de source no cambia protocolo existente de edición; último guardado explícito prevalece. Fuente omitida no toca columna. Entrega mantiene locks y fingerprint de payload completo.
- **Integraciones/efectos externos:** ninguna nueva. Matching y KPI siguen existentes; invalidación compradores y ficha.
- **Observabilidad/KPIs:** no nuevas propiedades/eventos, sin modificar source técnico de KPI. Señal local: persistencia correcta y filtros que recuperan fuente elegida.

## Criterios de aceptación

- [x] Selección en alta, edición y alta desde entrega; ficha legible y filtros por plataforma.
- [x] Source inválido rechazado en servidor; null/omitido y legacy compatibles.
- [x] Persistencia real, replay/conflicto y guards existentes sin regresión.
- [x] Typecheck, lint, SDD, tests proporcionales y revisión visual local aprobados.

## Verificación

| Criterio            | Evidencia prevista                                                                                                          | Resultado                                      |
| ------------------- | --------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------- |
| Catálogo y boundary | Suite completa Vitest: 1613 tests / 124 archivos                                                                            | PASS local                                     |
| Datos y replay      | 44 tests PostgreSQL 17.11: buyer-source y operational-flows                                                                 | PASS local                                     |
| UI y errores        | Chrome: alta con error conserva source, edición, legacy omitido/null, CHAT_WEB, entrega y replay idéntico, filtro Instagram | PASS componentes reales con acciones simuladas |
| Calidad             | tsc --noEmit, ESLint archivos afectados, check-sdd (15 briefs), diff check                                                  | PASS local                                     |
| Build               | next build con DB exclusiva de localhost y Supabase de prueba local                                                         | PASS local                                     |

La primera compilación falló porque el sandbox bloqueaba Google Fonts; la repetición con acceso de red aprobado compiló y generó todas las páginas. No se ejecutó el guard de migraciones remoto ni generación Prisma: schema y cliente existentes, sin cambios. Persistencia comercial probada mediante Server Actions reales con Prisma real; sesión, matching, KPI emitter y caché simulados. Flujo de entrega probado con núcleo transaccional real, locks, races y KPI real. No es E2E autenticado del CRM completo. Captura local: `.artifacts/com1-source-local.jpg` (ignorada por Git).

## Rollout, rollback y stop conditions

- **Rollout:** el usuario autoriza publicar con «publicalo no?». Commit y PR del alcance COM-1; merge sólo tras CI completo y Preview aprobados. Vercel desde main sin migración ni variables nuevas. Estado remoto y evidencia final en la PR.
- **Rollback/mitigación:** revertir código conserva source válidos en columna existente; cliente anterior ignora nuevos códigos pero no los borra.
- **Detener si:** fuente histórica se pierde al editar, guard de rol se elude, replay duplica, o tests alcanzan remoto.
- **Validación post-despliegue:** confirmar SHA de producción, selector y filtros en smoke de lectura; no crear compradores ni entregas reales de prueba.

## Revisión adversarial

| Riesgo intentado                 | Mitigación o riesgo pendiente                               |
| -------------------------------- | ----------------------------------------------------------- |
| Edición sin source borra CHAT    | Spread condicionado a presencia; test de regresión          |
| Legacy desconocido impide editar | Selector conserva mediante omisión, reader fallback legible |
| Confundir captación con KPI ui   | Campos separados, KPI intacto                               |
| Reintento modifica source        | Fingerprint existente de payload completo; integración      |
| Web excluye chat antiguo         | Filtro agrupa WEB/PRO/CHAT/CHAT_WEB                         |
| Acceso sólo restringido en UI    | Guards existentes antes de parsing/DB; pruebas negativas    |

## Cierre

- **Commit / PR:** publicación autorizada; identificadores definitivos en la PR asociada a COM-1.
- **CI / Deployment:** pendientes al preparar el commit; registrar estado remoto real en la PR antes de declarar publicado.
- **Validación:** local completada; smoke remoto pendiente. Rama codex/buyer-capture-source. Sin compradores/entregas de prueba en producción.
- **Deuda restante:** no inferir plataformas históricas ni medir ventas por origen en este cambio.
