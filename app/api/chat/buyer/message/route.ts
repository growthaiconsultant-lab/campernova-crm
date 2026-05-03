import { NextRequest } from 'next/server'
import { anthropic } from '@ai-sdk/anthropic'
import { streamText } from 'ai'
import { db } from '@/lib/db'
import { BUYER_SYSTEM_PROMPT } from '@/lib/chat/system-prompt'

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
      onFinish: async ({ text, usage }) => {
        try {
          const assistantMessage = {
            role: 'assistant',
            content: text,
            timestamp: new Date().toISOString(),
          }
          const finalMessages = [...updatedMessages, assistantMessage]

          const hasIntentVenta = text.includes('[INTENT_VENTA]')
          const isComplete = text.includes('[CONVERSATION_COMPLETE]')

          await db.buyerChatSession.update({
            where: { sessionToken: body.sessionToken! },
            data: {
              messages: finalMessages,
              lastMessageAt: new Date(),
              totalTokens: { increment: usage?.totalTokens ?? 0 },
              ...(hasIntentVenta && { status: 'REDIRECTED_SELLER' }),
              ...(isComplete && { status: 'COMPLETED', completedAt: new Date() }),
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
