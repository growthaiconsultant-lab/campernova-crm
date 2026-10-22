# COM-13 — Unificar compradores y conservar el primer responsable

| Campo               | Valor                       |
| ------------------- | --------------------------- |
| **Estado**          | APPROVED                    |
| **Owner**           | Engineering / Comercial     |
| **Ticket**          | Petición en chat 2026-10-22 |
| **Rama / PR**       | codex/unifica-compradores   |
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

- [ ] Las dos parejas autorizadas quedan en una ficha canónica con dueño verificado.
- [ ] Todas las notas conservan contenido, ID, autor y fecha; conversaciones originales accesibles.
- [ ] Altas repetidas de diferentes canales, incluso concurrentes, no crean otro cliente/responsable.
- [ ] Idempotencia de payload/requestId y cuotas se mantienen.
- [ ] Otra persona con identidad ambigua no se fusiona automáticamente.
- [ ] Acceso no admin, versiones obsoletas y dependencias complejas no mutan datos.

## Verificación

| Criterio           | Evidencia prevista                                         | Resultado |
| ------------------ | ---------------------------------------------------------- | --------- |
| Fusión y rollback  | PostgreSQL real: notas/chats/CAS/idempotencia              | Pendiente |
| Altas concurrentes | PostgreSQL real: web/cuestionario/manual y lock compartido | Pendiente |
| Migración          | Replay completo, parity, RLS, constraints                  | Pendiente |
| Código             | Typecheck, lint, unitarios y CI                            | Pendiente |
| Producción         | Preflight, operación de parejas autorizadas y postflight   | Pendiente |

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

- **Commit:** pendiente.
- **PR:** pendiente.
- **CI:** pendiente.
- **Deployment:** pendiente.
- **Validación:** pendiente.
- **Deuda restante:** observación de nuevas captaciones reales tras desplegar.
