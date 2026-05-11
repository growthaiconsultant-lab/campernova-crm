import { z } from 'zod'

export const USER_ROLES = ['ADMIN', 'AGENTE', 'TALLER', 'ENTREGAS', 'MARKETING'] as const
export type UserRoleValue = (typeof USER_ROLES)[number]

export const createUserSchema = z.object({
  name: z.string().min(2, 'El nombre debe tener al menos 2 caracteres').trim(),
  email: z.string().email('Email no válido').toLowerCase().trim(),
  role: z.enum(USER_ROLES),
  active: z.boolean().default(true),
  notifyOnNewLead: z.boolean().default(true),
})

export const updateUserSchema = z.object({
  name: z.string().min(2, 'El nombre debe tener al menos 2 caracteres').trim(),
  role: z.enum(USER_ROLES),
  active: z.boolean(),
  notifyOnNewLead: z.boolean(),
})

export type CreateUserValues = z.input<typeof createUserSchema>
export type UpdateUserValues = z.input<typeof updateUserSchema>
