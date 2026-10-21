# COM-9 — Reparto automático de compradores

| Campo               | Valor                                          |
| ------------------- | ---------------------------------------------- |
| **Estado**          | APPROVED                                       |
| **Owner**           | Engineering / Comercial                        |
| **Ticket**          | COM-9; petición del usuario en chat 2026-10-21 |
| **Rama / PR**       | codex/reparto-compradores                      |
| **Categorías**      | C2, C3, C4, C6                                 |
| **Riesgo**          | Alto                                           |
| **Ruta SDD**        | Reforzada                                      |
| **Última revisión** | 2026-10-21                                     |

## Problema y evidencia

VERIFICADO EN CÓDIGO: main 3e37b98 crea compradores con agentId null en
`lib/landing/buyer-intake.ts`, `app/(backoffice)/compradores/actions.ts` y
`app/api/chat/buyer/message/route.ts`. Meta usa el intake compartido.
VERIFICADO EN ENTORNO: consulta de producción del 21 de octubre: 461 sin comercial,
11 con comercial, ningún comprador archivado sin comercial. Cuatro usuarios activos
confirmados: Agustina, David, Esteban y Desireé (administradora; confirmación expresa
del usuario frente a la otra cuenta Desiree Gimenez).

## Resultado esperado

Repartir sólo compradores sin comercial en orden de antigüedad; rotación equitativa
Agustina → David → Esteban → Desireé. Continuar el turno para cada alta posterior.
Conservar todos los responsables existentes, incluidos los ajenos al grupo.

## Reglas e invariantes

- La petición autoriza implementar, activar en producción y repartir los pendientes.
- No reasignar compradores con responsable ni modificar sus otros datos.
- Asignación explícita al crear prevalece y no consume turno.
- Sólo INSERT activa la rotación; editar o desasignar manualmente no reasigna.
- Usuarios inactivos se saltan. Si no queda ninguno disponible, se conserva el lead
  sin asignar para no perder la captación; comprobar el contador de pendientes.
- El cursor participa en la misma transacción: rollback no consume turnos.
- Operación inicial idempotente: activación y backfill transaccionales, pre/postflight.

## Fuera de alcance

Vendedores, cambios de permisos, estados comerciales, avisos a comerciales,
envíos de correo/WhatsApp, compensar las cargas históricas ya asignadas.

## Decisiones

| Decisión        | Alternativas                         | Resolución y motivo                                         |
| --------------- | ------------------------------------ | ----------------------------------------------------------- |
| Cobertura       | helpers por writer / trigger         | Trigger INSERT cubre manual, web, Meta, chat e imports      |
| Reparto         | igualar históricos / turno           | Turno equitativo de los pendientes, conserva históricos     |
| Configuración   | nombres en trigger / IDs persistidos | IDs verificados por operador; configuración vacía al migrar |
| Fallo de equipo | rechazar entrada / dejar sin asignar | No perder leads; consulta operativa detecta pendientes      |

## Plan técnico

1. Migración aditiva: configuración singleton RLS deny-all y trigger BEFORE INSERT.
2. Validar con PostgreSQL real: replay, parity, concurrencia, rollback, asignación
   explícita, usuarios inactivos, configuración desactivada e idempotencia del backfill.
3. Operador protegido: identidad exacta de producción, historial verificado,
   usuarios activos, transacción con lock de compradores/configuración, snapshot
   de asignaciones, reparto sólo null, auditoría sin PII y verificación antes del commit.
4. Versionar, CI, merge; migrar exclusivamente la migración esperada; activar y verificar.

### Impacto

| Componente                        | Actual               | Cambio                    | Riesgo                  | Validación                 |
| --------------------------------- | -------------------- | ------------------------- | ----------------------- | -------------------------- |
| Altas manual/web/Meta/chat/import | null permitido       | trigger asigna si null    | entrada simultánea      | carrera real               |
| Ficha/listado/KPI/matching        | leen agentId         | reflejan reparto canónico | cargas cambian          | consulta agregada          |
| Ediciones/archivo/desasignación   | UPDATE               | sin cambios               | reasignación accidental | test UPDATE                |
| Configuración                     | inexistente          | tabla deny-all            | acceso público          | RLS y sin SECURITY DEFINER |
| Despliegue                        | guard de migraciones | nueva migración           | drift                   | replay/parity/historial    |

No cambian APIs, validadores, formularios, contratos ni estados. El cliente anterior
es compatible: devuelve el agentId generado por INSERT. No añade servicios, librerías,
eventos analíticos, cachés ni efectos externos. Las páginas dinámicas leen Prisma.
Auditoría: Activity de backfill con texto fijo e IDs, sin datos personales.
Locks: operador bloquea escritores de buyer_leads antes del singleton; trigger sólo
toma singleton durante INSERT. Timeout aborta todo; no reintento automático de mutación.

## Criterios de aceptación

- [ ] Ninguna asignación previa cambia.
- [ ] Cero pendientes tras operación inicial y diferencias de reparto como máximo 1.
- [ ] Nuevos compradores sin responsable rotan; explícitos se preservan.
- [ ] Concurrencia y rollback conservan turno y datos.
- [ ] Usuarios ajenos al pool nunca reciben asignaciones automáticas.
- [ ] Historial de migraciones, RLS, parity y CI verificados.

## Verificación

Validación local 2026-10-21: PostgreSQL 17, replay completo de 21 migraciones,
segundo deploy sin pendientes, parity sin diferencias, RLS en 34 tablas,
typecheck y lint correctos. 8 tests específicos del reparto correctos, incluyendo
bulk import, desactivación, preflight alterado, carrera de 24 INSERT y rollback.
Suite general: 428 tests de integración correctos; los 9 restantes necesitaron
añadir psql a PATH y pasaron al repetir su archivo. 1853 unitarios correctos;
un timeout en import del parser Sentry pasó al repetir su archivo (24 tests).
No se considera producción validada por compilar.
Tests de integración específicos y suite existente; consulta postflight con conteos,
preservación de snapshot y trigger/configuración. No insertar leads ficticios en producción.

## Rollout, rollback y stop conditions

- Rollout: CI → migración aditiva desactivada → activación/backfill transaccionales → consulta.
- Rollback: enabled=false detiene futuras asignaciones sin alterar existentes.
  Revertir backfill requiere revisión de Activities y CAS contra asignación/updatedAt;
  nunca borrar responsables que hayan cambiado posteriormente.
- Detener si identidad, historial, usuarios, conteos o preservación no coinciden.
- Observación: verificar inmediatamente cero pendientes y configuración; entradas reales
  posteriores se podrán comprobar sin inventar una prueba de producción.
- Owner: Comercial mantiene disponibilidad de los cuatro usuarios; Engineering opera config.

## Revisión adversarial

| Riesgo intentado                         | Mitigación o riesgo pendiente                    |
| ---------------------------------------- | ------------------------------------------------ |
| Writer alternativo evita helper          | Trigger cubre todos los INSERT                   |
| Carreras duplican turno                  | Lock de fila con cursor transaccional            |
| Reejecución mueve responsables           | Sólo null, activación repetida no resetea cursor |
| Dos cuentas Desire                       | Usuario seleccionó administradora explícitamente |
| Pérdida de captación por equipo inactivo | Conservar null, contador operativo               |
| Trigger público eleva permisos           | Sin SECURITY DEFINER, RLS deny-all               |
| Operador cambia responsable ya asignado  | Snapshot y validación dentro de lock/transacción |

## Cierre

Implementación y verificación local terminadas; producción pendiente.
PLAN READY FOR INDEPENDENT REVIEW.
Autorización: petición explícita y aclaración del usuario cubren este alcance.
Sin autorización para otras mutaciones, comunicaciones externas ni otros despliegues.
