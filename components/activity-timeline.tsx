import { ArrowRightLeft, Phone, Mail, MessageCircle, Zap, UserCheck, PenLine } from 'lucide-react'
import type { ActivityType } from '@prisma/client'
import { DeleteNoteButton } from './delete-note-button'

const ACTIVITY_LABELS: Record<ActivityType, string> = {
  CAMBIO_ESTADO: 'Cambio de estado',
  NOTA: 'Nota',
  LLAMADA: 'Llamada',
  EMAIL: 'Email',
  WHATSAPP_INICIADO: 'WhatsApp',
  MATCH_CREADO: 'Match creado',
  LEAD_ASIGNADO: 'Asignación',
  LEAD_CREADO_CHAT: 'Lead desde chat',
}

const ICON_CLASSES: Record<ActivityType, string> = {
  CAMBIO_ESTADO: 'bg-teal-100 text-teal-700 dark:bg-teal-900/40 dark:text-teal-300',
  NOTA: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300',
  LLAMADA: 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300',
  EMAIL: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300',
  WHATSAPP_INICIADO: 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300',
  MATCH_CREADO: 'bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-300',
  LEAD_ASIGNADO: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300',
  LEAD_CREADO_CHAT: 'bg-teal-100 text-teal-700 dark:bg-teal-900/40 dark:text-teal-300',
}

function ActivityIcon({ type }: { type: ActivityType }) {
  const cls = 'h-3.5 w-3.5'
  switch (type) {
    case 'CAMBIO_ESTADO':
      return <ArrowRightLeft className={cls} />
    case 'NOTA':
      return <PenLine className={cls} />
    case 'LLAMADA':
      return <Phone className={cls} />
    case 'EMAIL':
      return <Mail className={cls} />
    case 'WHATSAPP_INICIADO':
      return <MessageCircle className={cls} />
    case 'MATCH_CREADO':
      return <Zap className={cls} />
    case 'LEAD_ASIGNADO':
      return <UserCheck className={cls} />
    case 'LEAD_CREADO_CHAT':
      return <MessageCircle className={cls} />
  }
}

export type ActivityItem = {
  id: string
  type: ActivityType
  content: string | null
  createdAt: Date
  agentId: string | null
  agent: { name: string } | null
}

type Props = {
  activities: ActivityItem[]
  currentUserId?: string
}

export function ActivityTimeline({ activities, currentUserId }: Props) {
  if (activities.length === 0) {
    return <p className="text-sm text-muted-foreground">Sin actividad registrada todavía.</p>
  }

  return (
    <ol className="space-y-0">
      {activities.map((act, idx) => (
        <li key={act.id} className="flex gap-3">
          {/* Icono + línea vertical */}
          <div className="flex flex-col items-center pt-0.5">
            <div
              className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full ${ICON_CLASSES[act.type]}`}
            >
              <ActivityIcon type={act.type} />
            </div>
            {idx < activities.length - 1 && <div className="mt-1 w-px flex-1 bg-border" />}
          </div>

          {/* Contenido */}
          <div className="min-w-0 flex-1 pb-4 pt-0.5">
            <div className="flex items-start justify-between gap-2">
              <p className="whitespace-pre-wrap text-sm leading-snug">
                {act.content ?? ACTIVITY_LABELS[act.type]}
              </p>
              {act.type === 'NOTA' && currentUserId && act.agentId === currentUserId && (
                <DeleteNoteButton activityId={act.id} />
              )}
            </div>
            <p className="mt-0.5 text-xs text-muted-foreground">
              {act.agent?.name ?? 'Sistema'} ·{' '}
              {new Date(act.createdAt).toLocaleString('es-ES', {
                day: '2-digit',
                month: 'short',
                year: 'numeric',
                hour: '2-digit',
                minute: '2-digit',
              })}
            </p>
          </div>
        </li>
      ))}
    </ol>
  )
}
