'use client'

import { useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import { sendSurveyEmail } from '@/app/(backoffice)/encuestas/actions'
import { surveyEmailSubject } from '@/lib/surveys/message'

export function EmailInvitation({
  token,
  recipient,
  message,
}: {
  token: string
  recipient: string
  message: string
}) {
  const [reviewing, setReviewing] = useState(false)
  const [sending, setSending] = useState(false)
  const [result, setResult] = useState<{ ok: boolean; message: string }>()
  const pending = useRef(false)

  async function send() {
    if (pending.current || result?.ok) return
    pending.current = true
    setSending(true)
    try {
      setResult(await sendSurveyEmail({ token, recipient }))
    } catch {
      setResult({
        ok: false,
        message: 'No se ha podido confirmar el envío. Puedes reintentar desde aquí.',
      })
    } finally {
      pending.current = false
      setSending(false)
    }
  }

  return (
    <div className="ph-no-capture min-w-0 space-y-3">
      <Button
        type="button"
        variant="outline"
        aria-expanded={reviewing}
        onClick={() => setReviewing(!reviewing)}
        disabled={sending}
      >
        {reviewing ? 'Cerrar correo' : 'Preparar email'}
      </Button>
      {reviewing && (
        <div className="space-y-3 rounded-md border p-3 text-sm">
          <dl className="grid gap-1 sm:grid-cols-[max-content_1fr] sm:gap-x-3">
            <dt className="font-medium">Destinatario</dt>
            <dd className="break-words">{recipient}</dd>
            <dt className="font-medium">Asunto</dt>
            <dd>{surveyEmailSubject}</dd>
          </dl>
          <p className="whitespace-pre-wrap break-words rounded bg-muted p-3">{message}</p>
          <Button type="button" onClick={send} disabled={sending || result?.ok}>
            {sending ? 'Enviando…' : 'Confirmar y enviar email'}
          </Button>
          {result && <p role={result.ok ? 'status' : 'alert'}>{result.message}</p>}
        </div>
      )}
      {!reviewing && result?.ok && (
        <p role="status" className="text-sm">
          {result.message}
        </p>
      )}
    </div>
  )
}
