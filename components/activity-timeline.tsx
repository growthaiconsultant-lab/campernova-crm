import {
  ArrowRightLeft,
  Phone,
  Mail,
  MessageCircle,
  Zap,
  UserCheck,
  PenLine,
  Megaphone,
  Download,
  Wrench,
  DollarSign,
  CalendarCheck,
  ShieldCheck,
  Ticket,
  FileText,
  Ban,
} from 'lucide-react'
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
  ANUNCIO_GENERADO: 'Anuncio generado',
  FOTOS_DESCARGADAS: 'Fotos descargadas',
  COSTE_IMPUTADO: 'Coste imputado',
  PRECIO_VENTA_AJUSTADO: 'Precio ajustado',
  ORDEN_TALLER_CREADA: 'Orden de taller',
  ORDEN_TALLER_COMPLETADA: 'Taller completado',
  ORDEN_TALLER_APROBADA: 'Taller aprobado',
  ORDEN_TALLER_RECHAZADA: 'Taller rechazado',
  ENTREGA_PROGRAMADA: 'Entrega programada',
  ENTREGA_COMPLETADA: 'Entrega completada',
  ENTREGA_CANCELADA: 'Entrega cancelada',
  GARANTIA_ACTIVADA: 'Garantía activada',
  GARANTIA_AMPLIADA: 'Garantía ampliada',
  TICKET_POSTVENTA_ABIERTO: 'Ticket abierto',
  TICKET_POSTVENTA_RESUELTO: 'Ticket resuelto',
  TICKET_POSTVENTA_CERRADO: 'Ticket cerrado',
  FOLLOWUP_ENVIADO: 'Follow-up enviado',
  FOLLOWUP_RESPONDIDO: 'Follow-up respondido',
  DOCUMENTO_SUBIDO: 'Documento subido',
  DOCUMENTO_ELIMINADO: 'Documento eliminado',
  MATRICULA_AÑADIDA: 'Matrícula añadida',
  ITV_ACTUALIZADA: 'ITV actualizada',
  CARGAS_VERIFICADAS: 'Cargas verificadas',
  TITULARIDAD_TRANSFERIDA: 'Titularidad transferida',
  PUBLICACION_BLOQUEADA: 'Publicación bloqueada',
  PROXIMA_ACCION_ACTUALIZADA: 'Próxima acción',
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
  ANUNCIO_GENERADO: 'bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300',
  FOTOS_DESCARGADAS: 'bg-sky-100 text-sky-700 dark:bg-sky-900/40 dark:text-sky-300',
  COSTE_IMPUTADO: 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300',
  PRECIO_VENTA_AJUSTADO: 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300',
  ORDEN_TALLER_CREADA: 'bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300',
  ORDEN_TALLER_COMPLETADA: 'bg-teal-100 text-teal-700 dark:bg-teal-900/40 dark:text-teal-300',
  ORDEN_TALLER_APROBADA: 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300',
  ORDEN_TALLER_RECHAZADA: 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300',
  ENTREGA_PROGRAMADA: 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300',
  ENTREGA_COMPLETADA: 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300',
  ENTREGA_CANCELADA: 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300',
  GARANTIA_ACTIVADA: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300',
  GARANTIA_AMPLIADA: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300',
  TICKET_POSTVENTA_ABIERTO:
    'bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300',
  TICKET_POSTVENTA_RESUELTO: 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300',
  TICKET_POSTVENTA_CERRADO: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300',
  FOLLOWUP_ENVIADO: 'bg-sky-100 text-sky-700 dark:bg-sky-900/40 dark:text-sky-300',
  FOLLOWUP_RESPONDIDO: 'bg-teal-100 text-teal-700 dark:bg-teal-900/40 dark:text-teal-300',
  DOCUMENTO_SUBIDO: 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300',
  DOCUMENTO_ELIMINADO: 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300',
  MATRICULA_AÑADIDA: 'bg-teal-100 text-teal-700 dark:bg-teal-900/40 dark:text-teal-300',
  ITV_ACTUALIZADA: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300',
  CARGAS_VERIFICADAS: 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300',
  TITULARIDAD_TRANSFERIDA:
    'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300',
  PUBLICACION_BLOQUEADA: 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300',
  PROXIMA_ACCION_ACTUALIZADA:
    'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300',
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
    case 'ANUNCIO_GENERADO':
      return <Megaphone className={cls} />
    case 'FOTOS_DESCARGADAS':
      return <Download className={cls} />
    case 'COSTE_IMPUTADO':
    case 'PRECIO_VENTA_AJUSTADO':
      return <DollarSign className={cls} />
    case 'ORDEN_TALLER_CREADA':
    case 'ORDEN_TALLER_COMPLETADA':
    case 'ORDEN_TALLER_APROBADA':
    case 'ORDEN_TALLER_RECHAZADA':
      return <Wrench className={cls} />
    case 'ENTREGA_PROGRAMADA':
    case 'ENTREGA_COMPLETADA':
    case 'ENTREGA_CANCELADA':
      return <CalendarCheck className={cls} />
    case 'GARANTIA_ACTIVADA':
    case 'GARANTIA_AMPLIADA':
      return <ShieldCheck className={cls} />
    case 'TICKET_POSTVENTA_ABIERTO':
    case 'TICKET_POSTVENTA_RESUELTO':
    case 'TICKET_POSTVENTA_CERRADO':
    case 'FOLLOWUP_ENVIADO':
    case 'FOLLOWUP_RESPONDIDO':
      return <Ticket className={cls} />
    case 'DOCUMENTO_SUBIDO':
    case 'DOCUMENTO_ELIMINADO':
    case 'MATRICULA_AÑADIDA':
    case 'ITV_ACTUALIZADA':
    case 'CARGAS_VERIFICADAS':
    case 'TITULARIDAD_TRANSFERIDA':
      return <FileText className={cls} />
    case 'PUBLICACION_BLOQUEADA':
      return <Ban className={cls} />
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
