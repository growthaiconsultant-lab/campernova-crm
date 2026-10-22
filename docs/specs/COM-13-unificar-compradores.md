# COM-13 — Unificar compradores y conservar el primer responsable

| Campo               | Valor                       |
| ------------------- | --------------------------- |
| **Estado**          | VALIDATED                   |
| **Owner**           | Engineering / Comercial     |
| **Ticket**          | Petición en chat 2026-10-22 |
| **Rama / PR**       | PR #211 y #212              |
| **Categorías**      | C1, C2, C3, C4, C6          |
| **Riesgo**          | Alto                        |
| **Ruta SDD**        | Reforzada                   |
| **Última revisión** | 2026-10-22                  |

## Problema y evidencia

La revisión autorizada de producción encontró dos parejas activas de compradores duplicados.
Las entradas públicas deduplican payload o requestId, pero no la identidad del contacto.
El alta manual admite forzar duplicados y el chat consulta antes de la transacción.
Una lectura previa sin lock permite carreras entre canales.

## Resultado esperado

Una ficha operativa y un responsable por cliente conocido, con notas, autores, fechas y
conversaciones conservados. Los enlaces antiguos abren la ficha canónica. Las nuevas solicitudes
por teléfono o correo conocido se anexan al cliente existente sin consumir turno ni cambiar dueño.

## Reglas e invariantes

- Primera atención humana registrada determina responsable. Las asignaciones automáticas no cuentan.
- Sin atención registrada, la decisión concreta del usuario fija el responsable de la pareja.
- El usuario autoriza unificar las dos parejas activas, migración aditiva, despliegue y operación.
  Los identificadores y nombres reales sólo viven en la UI y evidencias locales privadas, fuera de Git.
- La pareja cerrada con nombres diferentes y teléfono compartido queda fuera del alcance de fusión.
- No se eliminan fichas, conversaciones, notas ni documentos. Se archiva la ficha absorbida con FK
  canónica y se conservan sus datos originales. Notas conservan ID, autor y timestamp.
- Las fichas con contratos, entregas, garantías, documentos privados o conflictos de matching se
  bloquean para revisión especializada; no hay fusión financiera implícita.
- Si ambas asociaciones al mismo vehículo son sugerencias automáticas sin agenda ni ofertas,
  se conserva la canónica y la otra permanece íntegra en el original archivado. Las asociaciones
  sin coincidencia se trasladan. Estados avanzados o asociaciones manuales siguen bloqueados.
- Las cinco altas, el cambio de contacto y la fusión coordinan identidad en transacción.
- Si teléfono y correo identifican canónicas distintas, se rechaza el alta sin crear otra ficha.
- No se envían datos de un cliente existente a formularios públicos.
- El administrador revisa preflight y versiones antes de aplicar. Cambios concurrentes abortan.

## Fuera de alcance

Fusiones masivas, reabrir leads perdidos, reasignar otras carteras, alterar contratos o eliminar datos.

## Decisiones

| Decisión         | Alternativas                             | Resolución y motivo                                                               |
| ---------------- | ---------------------------------------- | --------------------------------------------------------------------------------- |
| Persistencia     | Borrar o conservar originales            | FK de fusión nullable + archivado reversible                                      |
| Identidad        | Sólo requestId o contacto                | Teléfono normalizado y correo, incluidos alias históricos                         |
| Concurrencia     | Lectura previa o transacción             | Lock común para todos los escritores de identidad                                 |
| Conflictos       | Elegir una ficha al azar o bloquear      | Bloquear ambigüedades para revisión humana                                        |
| Migración remota | Credenciales locales o operador servidor | Operador explícito limitado a una migración, con identidad, checksum y postflight |

## Plan técnico

1. Expandir BuyerLead con mergedIntoId/mergedAt, FK e invariantes. Replay y parity en PostgreSQL efímero.
2. Unificar identidad de altas web, Meta, cuestionario, chat, manual y entregas; impedir override manual.
3. Fusión administrativa con preflight, CAS y locks; mover notas y acciones, conservar conversaciones.
4. Excluir absorbidas de bandejas operativas y redirigir fichas antiguas. Mostrar chats históricos juntos.
5. Pasar CI, aplicar únicamente la migración autorizada, desplegar, operar las dos parejas y verificar
   responsables, IDs/timestamps de notas, conversaciones y ausencia de duplicados activos.

### Impacto

- **Código y consumidores:** intake, altas internas, ficha, listados, pipeline, agenda y dashboard.
- **Datos/migraciones:** dos columnas opcionales, índice y FK; no backfill masivo ni borrado.
- **Permisos/seguridad:** requireAdmin en fusión; PII en servidor; sin secretos o contactos en logs/Git.
- **Concurrencia/idempotencia:** lock común, filas ordenadas, versiones preflight, transacción atómica.
- **Integraciones/efectos externos:** no notificar al equipo entero una captación repetida.
- **Observabilidad/KPIs:** una creación por cliente nuevo; nuevas entradas se registran como actividades.

## Criterios de aceptación

- [x] Las dos parejas autorizadas quedan en una ficha canónica con dueño verificado.
- [x] Todas las notas conservan contenido, ID, autor y fecha; conversaciones originales accesibles.
- [x] Altas repetidas de diferentes canales, incluso concurrentes, no crean otro cliente/responsable.
- [x] Idempotencia de payload/requestId y cuotas se mantienen.
- [x] Otra persona con identidad ambigua no se fusiona automáticamente.
- [x] Acceso no admin, versiones obsoletas y dependencias complejas no mutan datos.

## Verificación

| Criterio           | Evidencia prevista                                                                     | Resultado                            |
| ------------------ | -------------------------------------------------------------------------------------- | ------------------------------------ |
| Fusión y rollback  | PostgreSQL real: notas/chats/CAS/idempotencia y matches equivalentes                   | PASS en CI 39818819287 / 39821232855 |
| Altas concurrentes | PostgreSQL real: web/cuestionario/manual y lock compartido                             | PASS en CI 39818819287               |
| Migración          | Replay completo, parity, RLS, constraints                                              | PASS en ambos runs                   |
| Código             | Typecheck, lint, unitarios y UI quality                                                | PASS en ambos runs                   |
| Producción         | Preflight, operación de parejas autorizadas y comparación de IDs/hashes/autores/fechas | PASS, 2026-10-22 17:26 UTC           |

El E2E público (desktop/Android/iPhone) pasó en 39818819287. En 39821232855 el paso
PostgreSQL terminó correctamente y la instalación de navegadores seguía pendiente al registrar
la operación. El job Storage no pudo iniciar las pruebas por GHCR 429 al descargar imágenes,
también tras reintentos en el primer run; no se presenta como validado. No hubo cambios de Storage
y la fusión bloquea documentos privados.

## Rollout, rollback y stop conditions

- **Rollout:** CI primero; operador opt-in de migración expand con identidad de producción verificada,
  un único pendiente permitido y postflight; después código y fusión administrativa de las parejas.
- **Rollback/mitigación:** suspender fusiones. No retirar columnas; conservar originales y relaciones.
  La auditoría almacena IDs de notas trasladadas y versiones originales para reversión controlada.
- **Detener si:** identidad de entorno distinta, historial de migraciones inesperado, pruebas fallidas,
  responsable no válido, versiones cambiadas o dependencias bloqueantes.
- **Validación post-despliegue:** responsables, notas y chats de ambas parejas y navegación de alias;
  pruebas sintéticas de captación sólo en base efímera, sin crear clientes falsos en producción.

## Revisión adversarial

| Riesgo intentado                     | Mitigación o riesgo pendiente                                       |
| ------------------------------------ | ------------------------------------------------------------------- |
| Dos canales crean a la vez           | Misma exclusión transaccional para todas las altas                  |
| Shared phone de familiares           | Identidad ambigua se bloquea; sólo fusión administrativa verificada |
| Segunda conversación pisa la primera | Se conservan sesiones originales y se muestran desde la canónica    |
| Nota añadida durante fusión          | Bloqueo de raíz y resolución canónica en escritor de notas          |
| Operador aplica otra migración       | Historial y checksum exactos; otro pendiente aborta                 |
| Pérdida de notas/contratos           | Sin borrados y bloqueo de relaciones complejas                      |

## Cierre

- **Commits:** `12bd32b1d83f5fc551e7e0ac8a0650d28097d9c7` (identidad/fusión) y
  `35e54ef8eb7a026f9662d4b3e7f89c07bd27225a` (sugerencias equivalentes).
- **PR:** [#211](https://github.com/growthaiconsultant-lab/campernova-crm/pull/211) y
  [#212](https://github.com/growthaiconsultant-lab/campernova-crm/pull/212).
- **CI:** [39818819287](https://github.com/growthaiconsultant-lab/campernova-crm/actions/runs/39818819287)
  y [39821232855](https://github.com/growthaiconsultant-lab/campernova-crm/actions/runs/39821232855),
  con los límites descritos arriba.
- **Deployment:** `dpl_7CzqTNwDCakDq4SK17XRxbqttRhN` aplicó la migración mediante Prisma;
  después se retiró el flag opt-in. `dpl_23eWUKQmV1BMPxF5JbgA5hfviu29` READY y alias
  campersnova.com, desde checkout limpio de `35e54ef` con árbol idéntico al head probado `c772250`.
  El despliegue CLI no aporta SHA Git remoto; la procedencia se verificó en el checkout local.
- **Validación:** ambas parejas unificadas con responsables verificados; diez actividades originales
  conservan ID, hash del contenido, autor y fecha; tres conversaciones conservan ID y hash.
  Quince asociaciones de vehículos permanecen intactas, incluidas tres sugerencias redundantes
  en el original archivado. Las fichas fuente están archivadas y enlazadas a sus canónicas.
  El informe revisa 480 compradores y 155 vendedores: sólo permanece un grupo de teléfono
  compartido con nombres diferentes, todos PERDIDO, expresamente excluido de fusión.
  Evidencia privada y capturas fuera de Git; no se crearon leads sintéticos en producción.
- **Deuda restante:** observación de nuevas captaciones reales tras desplegar.
