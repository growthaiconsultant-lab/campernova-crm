# COM-9 — Operar el reparto de compradores

El trigger `buyer_lead_auto_assignment` asigna los INSERT sin `agent_id`. Los
UPDATE y las asignaciones explícitas se respetan. `buyer_lead_assignment` contiene
un singleton privado: pool ordenado, siguiente posición (base cero) y enabled.
No se publican nuevos endpoints. No se envían notificaciones desde este operador.

## Preflight y activación

Ejecutar `pnpm exec tsx scripts/operate-buyer-assignment.ts` en un entorno servidor
autorizado con credenciales privadas. Por defecto sólo consulta. No copiar secretos
a logs ni Git. `BUYER_ASSIGNMENT_ENV=production|staging` verifica la identidad del
proyecto y su correspondencia con `VERCEL_ENV`, Supabase y `DIRECT_URL`.

1. Revisar historial y usuarios devueltos por preflight; validar IDs/nombres activos.
2. Con CI verificado, `BUYER_ASSIGNMENT_APPLY=20261021120000_add_buyer_assignment`
   aplica exclusivamente el único pendiente permitido; otro drift bloquea.
3. Revisar de nuevo conteo y pool. `BUYER_ASSIGNMENT_POOL` es JSON con cuatro
   objetos `{ "id": "ID_VERIFICADO", "name": "NOMBRE_VERIFICADO" }`, en orden.
   `BUYER_ASSIGNMENT_EXPECT_UNASSIGNED` fija el conteo aprobado del preflight.
4. `BUYER_ASSIGNMENT_APPLY=activate` activa y reparte atómicamente. Un conteo
   cambiado aborta; revisar y repetir expresamente, nunca reintentar a ciegas.
5. Retirar APPLY y verificar configuración, trigger habilitado y conteos agregados.

La transacción bloquea brevemente escritores de compradores, actualiza sólo null,
registra una Activity por asignación y verifica que los responsables existentes y
sus timestamps permanezcan iguales. Repetir con el mismo pool conserva el cursor.
El operador nunca forma parte del build normal ni debe promocionarse al dominio CRM.

## Observación y recuperación

`SELECT count(*) FROM buyer_leads WHERE agent_id IS NULL` debe ser cero con equipo
activo, salvo desasignación manual posterior. Revisar esa excepción antes de repartir
otra vez. El trigger omite inactivos y deja sin responsable si no hay ninguno elegible.

Mitigación privilegiada: `UPDATE buyer_lead_assignment SET enabled=false WHERE id=1`.
Desactiva entradas futuras y conserva los responsables existentes. Revertir el reparto
inicial exige revisión humana de Activities COM-9 y CAS contra responsable/timestamp;
no ejecutar una desasignación masiva que pueda pisar trabajo comercial posterior.
