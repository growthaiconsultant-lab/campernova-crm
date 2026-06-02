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
  COMPLETED: 'bg-[#f0f7f6] text-[#1f8a5b]',
  REDIRECTED_SELLER: 'bg-amber-50 text-amber-700',
  ABANDONED: 'bg-[#f1f5f9] text-[#64748b]',
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
  const statusClass = status ? (CHAT_STATUS_CLASSES[status] ?? 'bg-[#f1f5f9] text-[#64748b]') : ''

  return (
    <div className="overflow-hidden rounded-xl border border-[#e2e8f0] bg-white">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#e2e8f0] px-6 py-4">
        <div className="flex items-center gap-2">
          <Bot className="h-4 w-4 text-[#294e4c]" />
          <h2 className="text-[14px] font-semibold text-[#0a0a0a]">
            Conversación
            <span className="ml-2 font-mono text-[11px] font-normal text-[#94a3b8]">
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
        <div className="flex flex-wrap gap-x-6 gap-y-1 border-b border-[#f1f5f9] bg-[#fafbfc] px-6 py-3 text-[11px] text-[#64748b]">
          {startedAt && (
            <span>
              <span className="font-mono uppercase tracking-[0.08em] text-[#94a3b8]">Inicio</span>{' '}
              {formatDateTime(startedAt)}
            </span>
          )}
          {lastMessageAt && (
            <span>
              <span className="font-mono uppercase tracking-[0.08em] text-[#94a3b8]">
                Último mensaje
              </span>{' '}
              {formatDateTime(lastMessageAt)}
            </span>
          )}
          {completedAt && (
            <span>
              <span className="font-mono uppercase tracking-[0.08em] text-[#94a3b8]">
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
          <p className="text-center text-[13px] text-[#94a3b8]">
            La conversación no contiene mensajes
          </p>
        ) : (
          visible.map((m, i) => {
            const isUser = m.role === 'user'
            return (
              <div key={i} className={`flex items-start gap-3 ${isUser ? 'flex-row-reverse' : ''}`}>
                <div
                  className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${
                    isUser ? 'bg-[#294e4c] text-white' : 'bg-[#f0f7f6] text-[#294e4c]'
                  }`}
                >
                  {isUser ? <UserIcon className="h-4 w-4" /> : <Bot className="h-4 w-4" />}
                </div>
                <div
                  className={`flex max-w-[78%] flex-col ${isUser ? 'items-end' : 'items-start'}`}
                >
                  <span className="mb-1 font-mono text-[10px] uppercase tracking-[0.08em] text-[#94a3b8]">
                    {isUser ? 'Cliente' : 'Nova Assistant'}
                  </span>
                  <div
                    className={`whitespace-pre-wrap rounded-2xl px-4 py-2.5 text-[13.5px] leading-relaxed ${
                      isUser
                        ? 'rounded-tr-sm bg-[#294e4c] text-white'
                        : 'rounded-tl-sm bg-[#f1f5f9] text-[#0a0a0a]'
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
        <div className="flex flex-wrap items-center gap-x-4 border-t border-[#f1f5f9] px-6 py-3 text-[10px] text-[#94a3b8]">
          {llmModel && <span className="font-mono">{llmModel}</span>}
          {totalTokens ? (
            <span className="font-mono">{totalTokens.toLocaleString('es-ES')} tokens</span>
          ) : null}
        </div>
      )}
    </div>
  )
}
