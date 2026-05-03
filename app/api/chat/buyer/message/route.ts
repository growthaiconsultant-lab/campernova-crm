import { NextRequest } from 'next/server'
import { anthropic } from '@ai-sdk/anthropic'
import { streamText, tool, stepCountIs } from 'ai'
import { db } from '@/lib/db'
import { BUYER_SYSTEM_PROMPT } from '@/lib/chat/system-prompt'
import { registerBuyerLeadSchema } from '@/lib/chat/tools'
import { sendBuyerChatLeadNotification } from '@/lib/email/send'

const MAX_TURNS = 10

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as { sessionToken?: string; message?: string }

    if (!body.sessionToken || !body.message?.trim()) {
      return new Response(JSON.stringify({ error: 'invalid_request' }), { status: 400 })
    }

    const session = await db.buyerChatSession.findUnique({
      where: { sessionToken: body.sessionToken },
    })

    if (!session) {
      return new Response(JSON.stringify({ error: 'session_not_found' }), { status: 404 })
    }

    if (session.status !== 'IN_PROGRESS') {
      return new Response(JSON.stringify({ error: 'session_closed' }), { status: 409 })
    }

    const existingMessages = session.messages as Array<{
      role: string
      content: string
      timestamp: string
    }>
    const userTurns = existingMessages.filter((m) => m.role === 'user').length

    if (userTurns >= MAX_TURNS) {
      return new Response(JSON.stringify({ error: 'turn_limit_reached' }), { status: 409 })
    }

    const ip =
      req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ??
      req.headers.get('x-real-ip') ??
      null

    const userMessage = {
      role: 'user' as const,
      content: body.message.trim(),
      timestamp: new Date().toISOString(),
    }
    const updatedMessages = [...existingMessages, userMessage]

    // Persist user message immediately
    await db.buyerChatSession.update({
      where: { sessionToken: body.sessionToken },
      data: {
        messages: updatedMessages,
        lastMessageAt: new Date(),
      },
    })

    // Build message history for Claude (exclude system messages)
    const chatHistory = updatedMessages
      .filter((m) => m.role === 'user' || m.role === 'assistant')
      .map((m) => ({ role: m.role as 'user' | 'assistant', content: m.content }))

    const result = streamText({
      model: anthropic('claude-haiku-4-5-20251001'),
      system: BUYER_SYSTEM_PROMPT,
      messages: chatHistory,
      maxOutputTokens: 500,
      stopWhen: stepCountIs(2),
      tools: {
        register_buyer_lead: tool({
          description:
            'Registra al comprador interesado y sus preferencias de vehículo. Invocar cuando se hayan capturado nombre, email, teléfono y la necesidad principal.',
          inputSchema: registerBuyerLeadSchema,
          execute: async (d) => {
            const dbResult = await db.$transaction(async (tx) => {
              const lead = await tx.buyerLead.create({
                data: {
                  name: d.nombre,
                  email: d.email,
                  phone: d.telefono,
                  source: 'CHAT',
                  vehicleType: d.tipo ?? undefined,
                  minSeats: d.plazas ?? undefined,
                  maxBudget: d.presupuestoMax ?? undefined,
                  useZone: d.zona ?? undefined,
                  purchaseTimeline: d.plazos ?? undefined,
                  criticalEquipment: d.equipamiento ?? {},
                },
              })

              await tx.buyerChatSession.update({
                where: { sessionToken: body.sessionToken! },
                data: {
                  status: 'COMPLETED',
                  completedAt: new Date(),
                  buyerLeadId: lead.id,
                  gdprConsentAt: new Date(),
                  gdprConsentIp: ip,
                  capturedNombre: d.nombre,
                  capturedEmail: d.email,
                  capturedTelefono: d.telefono,
                  capturedNecesidad: d.necesidad,
                  capturedPlazas: d.plazas,
                  capturedPresupuestoMin: d.presupuestoMin,
                  capturedPresupuestoMax: d.presupuestoMax,
                  capturedPlazos: d.plazos,
                  capturedEquipamiento: d.equipamiento ?? {},
                  capturedZona: d.zona,
                },
              })

              await tx.activity.create({
                data: {
                  type: 'LEAD_CREADO_CHAT',
                  content: `Lead creado desde chat. Necesidad: ${d.necesidad}`,
                  buyerLeadId: lead.id,
                },
              })

              return lead
            })

            // Non-blocking agent notification
            db.user
              .findMany({ where: { active: true } })
              .then(async (agents) => {
                if (agents.length > 0) {
                  await sendBuyerChatLeadNotification(
                    dbResult,
                    d,
                    agents.map((a) => a.email)
                  )
                }
              })
              .catch(console.error)

            return { ok: true }
          },
        }),
      },
      onFinish: async (event) => {
        try {
          const assistantMessage = {
            role: 'assistant',
            content: event.text,
            timestamp: new Date().toISOString(),
          }
          const finalMessages = [...updatedMessages, assistantMessage]

          const hasIntentVenta = event.text.includes('[INTENT_VENTA]')

          // Detect if register_buyer_lead was called across all steps (execute already created lead)
          const hasRegisterCall = event.steps.some((step) =>
            step.toolCalls.some((tc) => 'toolName' in tc && tc.toolName === 'register_buyer_lead')
          )

          await db.buyerChatSession.update({
            where: { sessionToken: body.sessionToken! },
            data: {
              messages: finalMessages,
              lastMessageAt: new Date(),
              totalTokens: { increment: event.totalUsage.totalTokens },
              // Only set status if execute didn't already mark COMPLETED
              ...(!hasRegisterCall && hasIntentVenta && { status: 'REDIRECTED_SELLER' }),
            },
          })
        } catch (err) {
          console.error('[chat/buyer/message] onFinish error', err)
        }
      },
    })

    return result.toTextStreamResponse()
  } catch (err) {
    console.error('[chat/buyer/message]', err)
    return new Response(JSON.stringify({ error: 'internal_error' }), { status: 500 })
  }
}
