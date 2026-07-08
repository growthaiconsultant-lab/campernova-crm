import type { Prisma, PrismaClient } from '@prisma/client'
import { db } from '@/lib/db'
import type { KpiEventName, KpiEntityType, KpiSource } from './events'

type EmitInput = {
  event: KpiEventName
  entityType: KpiEntityType
  entityId: string
  relatedEntityType?: KpiEntityType
  relatedEntityId?: string | null
  actorUserId?: string | null
  source?: KpiSource
  metadata?: Prisma.InputJsonValue
  occurredAt?: Date
}

/** Cliente Prisma o cliente transaccional (para emitir dentro de un $transaction). */
type Db = PrismaClient | Prisma.TransactionClient

/**
 * Bloque F0 KPIs — emite un evento de negocio a `kpi_events`.
 * **No bloqueante**: cualquier fallo se captura y loguea, nunca rompe el flujo
 * principal (mismo patrón que las notificaciones/valoración). Pásale el cliente
 * `tx` cuando quieras que el evento entre en la misma transacción que el cambio.
 */
export async function emitKpiEvent(input: EmitInput, client: Db = db): Promise<void> {
  try {
    await client.kpiEvent.create({
      data: {
        eventName: input.event,
        entityType: input.entityType,
        entityId: input.entityId,
        relatedEntityType: input.relatedEntityType ?? null,
        relatedEntityId: input.relatedEntityId ?? null,
        actorUserId: input.actorUserId ?? null,
        source: input.source ?? 'ui',
        metadata: input.metadata ?? {},
        ...(input.occurredAt ? { occurredAt: input.occurredAt } : {}),
      },
    })
  } catch (err) {
    console.error('[kpi] emitKpiEvent failed', input.event, err)
  }
}
