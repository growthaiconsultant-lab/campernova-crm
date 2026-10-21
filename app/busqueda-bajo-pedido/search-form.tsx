'use client'

import { useRef, useState } from 'react'
import Link from 'next/link'
import {
  FORM_STEPS,
  QUESTION_SECTIONS,
  type Question,
  type SearchAnswers,
} from '@/lib/search-request/questions'
import { searchAnswersSchema } from '@/lib/search-request/schema'

export function SearchForm() {
  const [step, setStep] = useState(0)
  const [answers, setAnswers] = useState<SearchAnswers>({})
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [consent, setConsent] = useState(false)
  const [website, setWebsite] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [sent, setSent] = useState(false)
  const heading = useRef<HTMLHeadingElement>(null)
  const request = useRef<{ fingerprint: string; id: string } | null>(null)
  const sending = useRef(false)

  function move(next: number) {
    setStep(next)
    setError('')
    requestAnimationFrame(() => heading.current?.focus())
  }
  function update(key: string, value: string | string[]) {
    setAnswers((old) => ({ ...old, [key]: value }))
    setErrors((old) => ({ ...old, [key]: '' }))
    setError('')
  }
  function validate(onlyCurrent: boolean) {
    const result = searchAnswersSchema.safeParse(answers)
    const keys = new Set(
      FORM_STEPS[step].sections.flatMap((i) => QUESTION_SECTIONS[i].questions.map((q) => q.key))
    )
    const invalid = result.success
      ? []
      : result.error.issues.filter((issue) => !onlyCurrent || keys.has(String(issue.path[0])))
    const nextErrors = Object.fromEntries(
      invalid.map((issue) => [
        String(issue.path[0]),
        issue.code === 'custom' ? issue.message : 'Revisa este campo.',
      ])
    )
    setErrors(nextErrors)
    if (invalid.length) {
      const firstKey = String(invalid[0].path[0])
      const firstStep = FORM_STEPS.findIndex((s) =>
        s.sections.some((i) => QUESTION_SECTIONS[i].questions.some((q) => q.key === firstKey))
      )
      if (!onlyCurrent) setStep(firstStep)
      setError('Hay algún dato que revisar. Lo hemos señalado en el formulario.')
      requestAnimationFrame(() => document.getElementById(`field-${firstKey}`)?.focus())
      return false
    }
    return true
  }
  async function send() {
    if (sending.current || !validate(false)) return
    if (!consent) {
      setError('Acepta la política de privacidad para enviar tu solicitud.')
      document.getElementById('consent')?.focus()
      return
    }
    sending.current = true
    setBusy(true)
    setError('')
    const fingerprint = JSON.stringify({ answers, consent, website })
    if (!request.current || request.current.fingerprint !== fingerprint)
      request.current = { fingerprint, id: crypto.randomUUID() }
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 20000)
    try {
      const response = await fetch('/api/landing/busqueda-bajo-pedido', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: controller.signal,
        body: JSON.stringify({
          requestId: request.current.id,
          version: '2026-10-21',
          answers,
          consent,
          website,
        }),
      })
      const result = await response.json()
      if (!response.ok || result.ok !== true) {
        if (response.status === 429)
          throw new Error(
            'Has enviado varias solicitudes. Espera una hora antes de volver a intentarlo o contacta con nosotros.'
          )
        if (response.status === 400)
          throw new Error('Revisa los datos indicados y vuelve a enviar la ficha.')
        if (response.status === 409)
          throw new Error(
            'No hemos podido confirmar este envío. Contacta con nosotros antes de repetir la solicitud.'
          )
        throw new Error(
          'No hemos podido confirmar el envío. Tus respuestas siguen aquí: puedes volver a intentarlo.'
        )
      }
      setSent(true)
      setAnswers({})
      requestAnimationFrame(() => heading.current?.focus())
    } catch (err) {
      setError(
        err instanceof Error && err.name !== 'AbortError' && err.name !== 'TypeError'
          ? err.message
          : 'No hemos podido confirmar el envío. Comprueba tu conexión y vuelve a intentarlo; conservamos tus respuestas en esta página.'
      )
    } finally {
      clearTimeout(timeout)
      setBusy(false)
      sending.current = false
    }
  }

  function field(q: Question) {
    const value = answers[q.key] ?? (q.kind === 'multi' ? [] : '')
    const id = `field-${q.key}`
    const help =
      [q.hint ? `${id}-hint` : '', errors[q.key] ? `${id}-error` : ''].filter(Boolean).join(' ') ||
      undefined
    return (
      <div
        className={`cn-question ${['single', 'multi', 'textarea'].includes(q.kind) ? 'cn-question-wide' : ''}`}
        key={q.key}
      >
        {q.kind === 'single' || q.kind === 'multi' ? (
          <fieldset aria-describedby={help} aria-invalid={!!errors[q.key]}>
            <legend>{q.label}</legend>
            <div className="cn-options">
              {q.options!.map((option, index) => (
                <label className="cn-option" key={option}>
                  <input
                    id={index === 0 ? id : `${id}-${index}`}
                    type={q.kind === 'multi' ? 'checkbox' : 'radio'}
                    name={q.key}
                    value={option}
                    checked={
                      q.kind === 'multi' ? (value as string[]).includes(option) : value === option
                    }
                    onChange={(e) =>
                      update(
                        q.key,
                        q.kind === 'multi'
                          ? e.target.checked
                            ? [...(value as string[]), option]
                            : (value as string[]).filter((v) => v !== option)
                          : option
                      )
                    }
                  />
                  <span>{option}</span>
                </label>
              ))}
            </div>
            {q.kind === 'single' && value && (
              <button
                className="cn-clear"
                type="button"
                onClick={() => update(q.key, '')}
                aria-label={`Borrar respuesta: ${q.label}`}
              >
                Borrar respuesta
              </button>
            )}
          </fieldset>
        ) : (
          <>
            <label htmlFor={id}>
              {q.label}
              {q.required && <span aria-hidden="true"> *</span>}
            </label>
            {q.kind === 'textarea' ? (
              <textarea
                id={id}
                name={q.key}
                value={value as string}
                rows={4}
                maxLength={2000}
                aria-describedby={help}
                aria-invalid={!!errors[q.key]}
                onInput={(e) => update(q.key, e.currentTarget.value)}
              />
            ) : (
              <input
                id={id}
                name={q.key}
                type={q.kind}
                value={value as string}
                required={q.required}
                autoComplete={q.autocomplete ?? 'off'}
                min={q.min}
                max={q.max}
                step={q.step}
                maxLength={q.kind === 'tel' ? 32 : q.kind === 'email' ? 254 : 300}
                inputMode={q.kind === 'number' ? (q.step === 1 ? 'numeric' : 'decimal') : undefined}
                aria-describedby={help}
                aria-invalid={!!errors[q.key]}
                onInput={(e) => update(q.key, e.currentTarget.value)}
              />
            )}
          </>
        )}
        {q.hint && (
          <p id={`${id}-hint`} className="cn-hint">
            {q.hint}
          </p>
        )}
        {errors[q.key] && (
          <p id={`${id}-error`} className="cn-field-error">
            {errors[q.key]}
          </p>
        )}
      </div>
    )
  }

  if (sent)
    return (
      <section className="cn-form-shell cn-success" aria-live="polite">
        <span className="cn-success-icon" aria-hidden="true">
          ✓
        </span>
        <p className="cn-eyebrow">SOLICITUD RECIBIDA</p>
        <h2 ref={heading} tabIndex={-1}>
          Ya tenemos tu ficha.
        </h2>
        <p>
          El equipo de CampersNova revisará tus preferencias y te llamará al teléfono que has
          indicado para comentar tu búsqueda.
        </p>
        <p className="cn-hint">
          Esta solicitud no formaliza un encargo de búsqueda ni implica ningún pago.
        </p>
        <Link className="cn-primary" href="/comprar">
          Explorar vehículos disponibles <span aria-hidden="true">↗</span>
        </Link>
      </section>
    )

  return (
    <section
      className="cn-form-shell ph-no-capture ph-mask"
      data-ph-capture-attribute="false"
      data-sentry-mask
    >
      <nav className="cn-steps" aria-label="Pasos del formulario">
        <ol>
          {FORM_STEPS.map((item, index) => (
            <li
              key={item.title}
              aria-current={index === step ? 'step' : undefined}
              className={index <= step ? 'cn-step-active' : ''}
            >
              <span>{String(index + 1).padStart(2, '0')}</span>
              <span>{item.title}</span>
            </li>
          ))}
        </ol>
      </nav>
      <form
        noValidate
        onSubmit={(e) => {
          e.preventDefault()
          if (step < 4) {
            if (validate(true)) move(step + 1)
          } else void send()
        }}
        aria-busy={busy}
      >
        <div className="cn-step-heading">
          <p className="cn-eyebrow">PASO {step + 1} DE 5</p>
          <h2 ref={heading} tabIndex={-1}>
            {FORM_STEPS[step].title}
          </h2>
          <p>
            {step === 4
              ? 'Comprueba tus datos antes de enviarlos. Puedes volver a cualquier apartado para corregirlos.'
              : 'Solo el nombre y el teléfono son obligatorios. Si todavía no sabes alguna respuesta, puedes dejarla en blanco.'}
          </p>
        </div>
        <div className="cn-honeypot" aria-hidden="true">
          <label htmlFor="website">Deja este campo vacío</label>
          <input
            id="website"
            name="website"
            value={website}
            tabIndex={-1}
            autoComplete="off"
            onChange={(e) => setWebsite(e.target.value)}
          />
        </div>
        {FORM_STEPS[step].sections.map((index) => (
          <section className="cn-question-section" key={index} aria-labelledby={`section-${index}`}>
            <h3 id={`section-${index}`}>{QUESTION_SECTIONS[index].title}</h3>
            {QUESTION_SECTIONS[index].intro && (
              <p className="cn-section-intro">{QUESTION_SECTIONS[index].intro}</p>
            )}
            <div className="cn-question-grid">{QUESTION_SECTIONS[index].questions.map(field)}</div>
          </section>
        ))}
        {step === 4 && (
          <>
            <div className="cn-review">
              {QUESTION_SECTIONS.map((section, index) => {
                const filled = section.questions.filter((q) =>
                  Array.isArray(answers[q.key]) ? answers[q.key].length : !!answers[q.key]
                )
                return (
                  <section key={section.title}>
                    <div className="cn-review-heading">
                      <h3>{section.title}</h3>
                      <button
                        type="button"
                        onClick={() =>
                          move(FORM_STEPS.findIndex((s) => s.sections.includes(index)))
                        }
                        aria-label={`Editar: ${section.title}`}
                      >
                        Editar
                      </button>
                    </div>
                    {filled.length ? (
                      <dl>
                        {filled.map((q) => (
                          <div key={q.key}>
                            <dt>{q.label}</dt>
                            <dd>
                              {Array.isArray(answers[q.key])
                                ? (answers[q.key] as string[]).join(' · ')
                                : answers[q.key]}
                            </dd>
                          </div>
                        ))}
                      </dl>
                    ) : (
                      <p className="cn-hint">Sin preferencias indicadas.</p>
                    )}
                  </section>
                )
              })}
            </div>
            <div className="cn-consent">
              <label>
                <input
                  id="consent"
                  type="checkbox"
                  checked={consent}
                  onChange={(e) => {
                    setConsent(e.target.checked)
                    setError('')
                  }}
                />
                <span>
                  He leído la{' '}
                  <Link href="/privacidad" target="_blank" rel="noopener noreferrer">
                    política de privacidad
                  </Link>{' '}
                  y acepto el tratamiento de mis datos para que CampersNova atienda mi solicitud y
                  contacte conmigo. *
                </span>
              </label>
              <p>Enviar esta ficha no formaliza un encargo de búsqueda ni implica ningún pago.</p>
            </div>
          </>
        )}
        {error && (
          <p className="cn-submit-error" role="alert">
            {error}
          </p>
        )}
        <div className="cn-form-actions">
          {step > 0 ? (
            <button
              className="cn-secondary"
              type="button"
              disabled={busy}
              onClick={() => move(step - 1)}
            >
              ← Anterior
            </button>
          ) : (
            <span className="cn-hint">* Campos obligatorios</span>
          )}
          <button className="cn-primary" type="submit" disabled={busy}>
            {busy ? 'Enviando tu solicitud…' : step === 4 ? 'Enviar mi solicitud' : 'Continuar'}{' '}
            {!busy && <span aria-hidden="true">→</span>}
          </button>
        </div>
        <p className="cn-form-footnote">
          Tus respuestas se conservan al avanzar y retroceder. Completa el envío antes de cerrar
          esta página.
        </p>
      </form>
    </section>
  )
}
