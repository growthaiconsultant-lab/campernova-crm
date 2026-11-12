'use client'

import { useId, useRef, useState } from 'react'
import { X } from 'lucide-react'
import { BUSINESS } from '@/lib/seo'
import { formatEur } from '@/lib/format/currency'

export function VehicleFinanceButton({ subject, label }: { subject: string; label: string }) {
  const titleId = useId()
  const dialog = useRef<HTMLDialogElement>(null)
  const [deposit, setDeposit] = useState('')
  const [term, setTerm] = useState('')
  const financeMessage = [
    'Hola, me gustaría una propuesta de financiación para ' + subject + '.',
    deposit !== '' ? 'Entrada prevista: ' + formatEur(Number(deposit), 'cents') + '.' : '',
    term ? 'Plazo: ' + term + ' años.' : '',
    '¿Me podéis indicar cuota mensual, TAE y total a pagar?',
  ]
    .filter(Boolean)
    .join(' ')
  return (
    <>
      <button
        type="button"
        className="cn-stock-finance"
        aria-haspopup="dialog"
        onClick={() => dialog.current?.showModal()}
      >
        {label} <span aria-hidden="true">↗</span>
      </button>
      <dialog
        ref={dialog}
        className="cn-stock-dialog"
        aria-labelledby={titleId}
        onClose={() => {
          setDeposit('')
          setTerm('')
        }}
      >
        <button
          type="button"
          className="close-finance"
          aria-label="Cerrar"
          onClick={() => dialog.current?.close()}
        >
          <X />
        </button>
        <h2 id={titleId}>Tu cuota mensual</h2>
        <p>
          Pide una propuesta para {subject}. Puedes indicarnos qué entrada y plazo tienes en mente.
        </p>
        <form action={BUSINESS.whatsapp} target="_blank" rel="noopener noreferrer" method="get">
          <label>
            Entrada prevista en euros (opcional)
            <input
              type="number"
              inputMode="decimal"
              min="0"
              step="0.01"
              value={deposit}
              onChange={(e) => setDeposit(e.target.value)}
            />
          </label>
          <label>
            Plazo que te interesa
            <select value={term} onChange={(e) => setTerm(e.target.value)}>
              <option value="">Prefiero que me asesoréis</option>
              {[3, 5, 7].map((y) => (
                <option key={y} value={y}>
                  {y} años
                </option>
              ))}
            </select>
          </label>
          <input type="hidden" name="text" value={financeMessage} />
          <button type="submit">Pedir propuesta por WhatsApp ↗</button>
        </form>
      </dialog>
    </>
  )
}
