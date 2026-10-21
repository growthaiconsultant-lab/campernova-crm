import { z } from 'zod'
import { QUESTIONS, type Question } from './questions'

function fieldSchema(question: Question): z.ZodType {
  if (question.kind === 'multi') {
    return z
      .array(z.enum(question.options as [string, ...string[]]))
      .max(question.options!.length)
      .refine((items) => new Set(items).size === items.length)
      .optional()
  }
  let value: z.ZodType = z
    .string()
    .trim()
    .max(question.kind === 'textarea' ? 2000 : 300)
  if (question.kind === 'single') value = z.enum(question.options as [string, ...string[]])
  if (question.kind === 'email') value = z.string().trim().email().max(254)
  if (question.kind === 'tel')
    value = z
      .string()
      .trim()
      .max(32)
      .regex(/^\+?[\d\s().-]+$/, 'Indica un teléfono válido.')
      .refine((v) => /^\d{9,15}$/.test(v.replace(/\D/g, '')), 'Indica un teléfono válido.')
  if (question.kind === 'date') value = z.iso.date()
  if (question.kind === 'number')
    value = z
      .string()
      .max(20)
      .regex(/^\d+(\.\d{1,2})?$/)
      .refine((v) => {
        const n = Number(v)
        return (
          n >= question.min! && n <= question.max! && (question.step !== 1 || Number.isInteger(n))
        )
      }, 'Revisa el importe o la medida indicada.')
  if (question.required)
    return value.refine((v) => typeof v === 'string' && v.trim().length > 0, 'Completa este campo.')
  return z.union([value, z.literal('')]).optional()
}

export const searchAnswersSchema = z
  .object(Object.fromEntries(QUESTIONS.map((q) => [q.key, fieldSchema(q)])))
  .strict()
  .superRefine((answers, ctx) => {
    if (
      answers.budget &&
      answers.budgetLimit &&
      Number(answers.budget) > Number(answers.budgetLimit)
    ) {
      ctx.addIssue({
        code: 'custom',
        path: ['budgetLimit'],
        message: 'El límite total no puede ser inferior al presupuesto deseado.',
      })
    }
    if (
      answers.deliveryDate &&
      answers.deadline &&
      String(answers.deliveryDate) > String(answers.deadline)
    ) {
      ctx.addIssue({
        code: 'custom',
        path: ['deadline'],
        message: 'La fecha límite no puede ser anterior a la entrega deseada.',
      })
    }
  })

export const searchRequestSchema = z
  .object({
    requestId: z.uuid(),
    version: z.literal('2026-10-21'),
    answers: searchAnswersSchema,
    consent: z.literal(true),
    website: z.literal(''),
  })
  .strict()
export type SearchRequestInput = z.infer<typeof searchRequestSchema>
