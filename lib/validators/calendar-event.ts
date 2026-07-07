import { z } from 'zod'

/** Validación de creación de evento de calendario (F2). */
export const createCalendarEventSchema = z.object({
  type: z.enum(['CITA', 'LIMPIEZA', 'SEGUIMIENTO', 'OTRO']),
  title: z.string().trim().min(1, 'El título es obligatorio').max(200),
  description: z.string().trim().max(2000).optional().nullable(),
  startAt: z.string().refine((v) => !Number.isNaN(new Date(v).getTime()), 'Fecha no válida'),
  durationMinutes: z
    .number()
    .int()
    .positive()
    .max(24 * 60)
    .optional()
    .nullable(),
  priority: z.enum(['BAJA', 'MEDIA', 'ALTA', 'URGENTE']).default('MEDIA'),
  assignedToId: z.string().optional().nullable(),
  buyerLeadId: z.string().optional().nullable(),
  sellerLeadId: z.string().optional().nullable(),
  vehicleId: z.string().optional().nullable(),
  matchId: z.string().optional().nullable(),
  location: z.string().trim().max(300).optional().nullable(),
  // Datos propios del tipo (cita: canal, teléfono, objetivo…)
  specificData: z.record(z.string(), z.unknown()).optional().nullable(),
})

export type CreateCalendarEventInput = z.input<typeof createCalendarEventSchema>
