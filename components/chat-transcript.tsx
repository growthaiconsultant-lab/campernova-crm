import { Bot, User as UserIcon } from 'lucide-react'

// ── Types ────────────────────────────────────────────────────────────────────

export type ChatMessage = {
  role: 'user' | 'assistant' | string
  content: string
}

type Props = {
  messages: ChatMessage[]
  startedAt?: Date | null
  lastMessageAt?: Date | null
  completedAt?: Date | null
  status?: string | null
  totalTokens?: number | null
  llmModel?: string | null
}

// ── Helpers ──────────────────────────────────────────────────────────────────

const CHAT_STATUS_LABELS: Record<string, string> = {
  IN_PROGRESS: 'En curso',
  COMPLETED: 'Completada',
  REDIRECTED_SELLER: 'Redirigido a venta',
  ABANDONED: 'Abandonada',
}

const CHAT_STATUS_CLASSES: Record<string, string> = {
  IN_PROGRESS: 'bg-blue-50 text-blue-700',
  COMPLETED: 'bg-[#e6f4f0] text-[#1a9d5f]',
  REDIRECTED_SELLER: 'bg-amber-50 text-amber-700',
  ABANDONED: 'bg-[#eef1f5] text-[#586173]',
}

function formatDateTime(date: Date): string {
  return new Date(date).toLocaleString('es-ES', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

// ── Component ────────────────────────────────────────────────────────────────

export function ChatTranscript({
  messages,
  startedAt,
  lastMessageAt,
  completedAt,
  status,
  totalTokens,
  llmModel,
}: Props) {
  const visible = messages.filter((m) => m.role === 'user' || m.role === 'assistant')
  const userCount = visible.filter((m) => m.role === 'user').length
  const statusLabel = status ? (CHAT_STATUS_LABELS[status] ?? status) : null
  const statusClass = status ? (CHAT_STATUS_CLASSES[status] ?? 'bg-[#eef1f5] text-[#586173]') : ''

  return (
    <div className="overflow-hidden rounded-xl border border-[#e6e9ee] bg-white">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#e6e9ee] px-6 py-4">
        <div className="flex items-center gap-2">
          <Bot className="h-4 w-4 text-[#0e7d6b]" />
          <h2 className="text-[14px] font-semibold text-[#141922]">
            Conversación
            <span className="ml-2 font-mono text-[11px] font-normal text-[#8b94a3]">
              {userCount} mensaje{userCount !== 1 ? 's' : ''} del cliente
            </span>
          </h2>
        </div>
        {statusLabel && (
          <span
            className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-medium ${statusClass}`}
          >
            {statusLabel}
          </span>
        )}
      </div>

      {/* Meta strip */}
      {(startedAt || lastMessageAt || completedAt) && (
        <div className="flex flex-wrap gap-x-6 gap-y-1 border-b border-[#eef1f5] bg-[#fafbfc] px-6 py-3 text-[11px] text-[#586173]">
          {startedAt && (
            <span>
              <span className="font-mono uppercase tracking-[0.08em] text-[#8b94a3]">Inicio</span>{' '}
              {formatDateTime(startedAt)}
            </span>
          )}
          {lastMessageAt && (
            <span>
              <span className="font-mono uppercase tracking-[0.08em] text-[#8b94a3]">
                Último mensaje
              </span>{' '}
              {formatDateTime(lastMessageAt)}
            </span>
          )}
          {completedAt && (
            <span>
              <span className="font-mono uppercase tracking-[0.08em] text-[#8b94a3]">
                Completada
              </span>{' '}
              {formatDateTime(completedAt)}
            </span>
          )}
        </div>
      )}

      {/* Messages */}
      <div className="space-y-4 p-6">
        {visible.length === 0 ? (
          <p className="text-center text-[13px] text-[#8b94a3]">
            La conversación no contiene mensajes
          </p>
        ) : (
          visible.map((m, i) => {
            const isUser = m.role === 'user'
            return (
              <div key={i} className={`flex items-start gap-3 ${isUser ? 'flex-row-reverse' : ''}`}>
                <div
                  className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${
                    isUser ? 'bg-[#0e7d6b] text-white' : 'bg-[#e6f4f0] text-[#0e7d6b]'
                  }`}
                >
                  {isUser ? <UserIcon className="h-4 w-4" /> : <Bot className="h-4 w-4" />}
                </div>
                <div
                  className={`flex max-w-[78%] flex-col ${isUser ? 'items-end' : 'items-start'}`}
                >
                  <span className="mb-1 font-mono text-[10px] uppercase tracking-[0.08em] text-[#8b94a3]">
                    {isUser ? 'Cliente' : 'Nova Assistant'}
                  </span>
                  <div
                    className={`whitespace-pre-wrap rounded-2xl px-4 py-2.5 text-[13.5px] leading-relaxed ${
                      isUser
                        ? 'rounded-tr-sm bg-[#0e7d6b] text-white'
                        : 'rounded-tl-sm bg-[#eef1f5] text-[#141922]'
                    }`}
                  >
                    {m.content}
                  </div>
                </div>
              </div>
            )
          })
        )}
      </div>

      {/* Footer — technical meta */}
      {(totalTokens || llmModel) && (
        <div className="flex flex-wrap items-center gap-x-4 border-t border-[#eef1f5] px-6 py-3 text-[10px] text-[#8b94a3]">
          {llmModel && <span className="font-mono">{llmModel}</span>}
          {totalTokens ? (
            <span className="font-mono">{totalTokens.toLocaleString('es-ES')} tokens</span>
          ) : null}
        </div>
      )}
    </div>
  )
}
