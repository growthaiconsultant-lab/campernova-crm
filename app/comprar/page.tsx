'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import HCaptcha from '@hcaptcha/react-hcaptcha'
import Link from 'next/link'
import Image from 'next/image'
import { PublicNav } from '@/components/public-nav'
import { PublicFooter } from '@/components/public-footer'

type ChatMessage = { role: 'user' | 'assistant'; content: string; id: string }

const SUGGESTIONS = [
  'Soy primerizo, ayúdame a empezar',
  'Busco para escapadas de fin de semana',
  'Para familia con 2 niños',
  'Quiero estrenar antes del verano',
  'Tengo un vehículo que entregar',
]

function genId() {
  return Math.random().toString(36).slice(2)
}

export default function ComprarPage() {
  const captchaRef = useRef<HCaptcha>(null)
  const scrollerRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)

  const [sessionToken, setSessionToken] = useState<string | null>(null)
  const [sessionStatus, setSessionStatus] = useState<
    'IN_PROGRESS' | 'COMPLETED' | 'REDIRECTED_SELLER'
  >('IN_PROGRESS')
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [input, setInput] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [startError, setStartError] = useState<string | null>(null)
  const [chatError, setChatError] = useState<string | null>(null)

  const isComplete = sessionStatus === 'COMPLETED'
  const isRedirectedSeller = sessionStatus === 'REDIRECTED_SELLER'

  // Scroll on new messages
  useEffect(() => {
    if (scrollerRef.current) {
      scrollerRef.current.scrollTop = scrollerRef.current.scrollHeight
    }
  }, [messages, isLoading])

  // Auto-resize textarea
  useEffect(() => {
    if (inputRef.current) {
      inputRef.current.style.height = 'auto'
      inputRef.current.style.height = Math.min(inputRef.current.scrollHeight, 160) + 'px'
    }
  }, [input])

  const handleCaptchaVerify = useCallback(async (token: string) => {
    setStartError(null)
    try {
      const res = await fetch('/api/chat/buyer/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ captchaToken: token }),
      })
      const data = (await res.json()) as {
        sessionToken?: string
        greeting?: string
        error?: string
      }
      if (!res.ok || !data.sessionToken) throw new Error(data.error ?? 'start_failed')
      setSessionToken(data.sessionToken)
      if (data.greeting) {
        setMessages([{ role: 'assistant', content: data.greeting, id: genId() }])
      }
    } catch {
      setStartError('No hemos podido iniciar la sesión. Recarga la página e inténtalo de nuevo.')
    }
  }, [])

  // Dev: invisible hCaptcha doesn't fire onVerify on localhost — bypass automatically
  useEffect(() => {
    if (process.env.NODE_ENV !== 'production') {
      void handleCaptchaVerify('dev-bypass')
    }
  }, [handleCaptchaVerify])

  const sendMessage = useCallback(
    async (text?: string) => {
      const content = (text ?? input).trim()
      if (!content || isLoading || !sessionToken) return
      setInput('')
      setChatError(null)

      const userMsg: ChatMessage = { role: 'user', content, id: genId() }
      setMessages((prev) => [...prev, userMsg])
      setIsLoading(true)

      const assistantId = genId()
      // Add empty assistant bubble that we'll fill via streaming
      setMessages((prev) => [...prev, { role: 'assistant', content: '', id: assistantId }])

      try {
        const res = await fetch('/api/chat/buyer/message', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ sessionToken, message: content }),
        })

        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        if (!res.body) throw new Error('no_body')

        const reader = res.body.getReader()
        const decoder = new TextDecoder()
        let accumulated = ''

        while (true) {
          const { done, value } = await reader.read()
          if (done) break
          accumulated += decoder.decode(value, { stream: true })
          const current = accumulated
          setMessages((prev) =>
            prev.map((m) => (m.id === assistantId ? { ...m, content: current } : m))
          )
          // Scroll during streaming
          if (scrollerRef.current) {
            scrollerRef.current.scrollTop = scrollerRef.current.scrollHeight
          }
        }

        // Poll session status — server may have created a BuyerLead via tool use
        try {
          const statusRes = await fetch(
            `/api/chat/buyer/status?sessionToken=${encodeURIComponent(sessionToken ?? '')}`
          )
          if (statusRes.ok) {
            const statusData = (await statusRes.json()) as { status: string }
            if (statusData.status === 'COMPLETED' || statusData.status === 'REDIRECTED_SELLER') {
              setSessionStatus(statusData.status as 'COMPLETED' | 'REDIRECTED_SELLER')
            }
          }
        } catch {
          // Non-blocking — status display degrades gracefully
        }

        inputRef.current?.focus()
      } catch {
        setChatError('Vaya, algo ha fallado. ¿Volvemos a intentarlo?')
        setMessages((prev) => prev.filter((m) => m.id !== assistantId))
      } finally {
        setIsLoading(false)
      }
    },
    [input, isLoading, sessionToken]
  )

  const onKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      void sendMessage()
    }
  }

  const showSuggestions =
    sessionToken && messages.filter((m) => m.role === 'user').length === 0 && !isLoading

  const cleanContent = (text: string) => text.replace('[INTENT_VENTA]', '').trim()

  return (
    <>
      <PublicNav />
      <main className="min-h-screen" style={{ background: 'var(--cn-cream-100, #f5f2ec)' }}>
        <div className="mx-auto max-w-[1280px] px-6 py-10 max-[640px]:px-4">
          <div className="grid gap-10 lg:grid-cols-[1fr_320px]">
            {/* ── Main chat area ── */}
            <div>
              <div className="mb-8">
                <p
                  className="mb-2 font-mono text-[11px] font-semibold uppercase tracking-[0.14em]"
                  style={{ color: 'var(--cn-terra-500)' }}
                >
                  · Búsqueda guiada
                </p>
                <h1
                  className="mb-3 text-[2rem] font-bold leading-tight tracking-[-0.02em] lg:text-[2.4rem]"
                  style={{ color: 'var(--cn-teal-900)', fontFamily: 'var(--font-fraunces)' }}
                >
                  Cuéntanos qué buscas. Te ayudamos a encontrarlo.
                </h1>
                <p
                  className="max-w-[60ch] text-[15px] leading-relaxed"
                  style={{ color: 'var(--cn-ink-500)' }}
                >
                  No tenemos un catálogo plano. Tenemos un equipo que escucha lo que necesitas y te
                  propone vehículos reales que encajan contigo.
                </p>
              </div>

              {/* Chat window */}
              <div
                className="flex flex-col overflow-hidden rounded-[20px]"
                style={{ border: '1px solid var(--cn-line)', background: '#fff' }}
              >
                {/* Status bar */}
                <div
                  className="flex items-center gap-2 px-5 py-3 text-[12px]"
                  style={{
                    borderBottom: '1px solid var(--cn-line)',
                    color: 'var(--cn-ink-500)',
                    background: 'var(--cn-cream-50)',
                  }}
                >
                  <span
                    className="inline-block h-2 w-2 rounded-full"
                    style={{ background: '#22c55e' }}
                    aria-hidden="true"
                  />
                  Equipo conectado · normalmente responde el mismo día
                </div>

                {/* Messages */}
                <div
                  ref={scrollerRef}
                  className="flex flex-col gap-4 overflow-y-auto p-5"
                  style={{ minHeight: 320, maxHeight: 480 }}
                  aria-live="polite"
                  aria-label="Conversación"
                >
                  {messages.length === 0 && !startError && (
                    <p
                      className="text-center text-[14px]"
                      style={{ color: 'var(--cn-ink-500)', paddingTop: 40 }}
                    >
                      Cuéntale al asistente qué buscas. Tarda 2 minutos.
                    </p>
                  )}

                  {startError && (
                    <p className="text-center text-[14px] text-red-600" style={{ paddingTop: 40 }}>
                      {startError}
                    </p>
                  )}

                  {messages.map((m) => (
                    <div
                      key={m.id}
                      className={`flex gap-3 ${m.role === 'user' ? 'flex-row-reverse' : 'flex-row'}`}
                    >
                      {m.role === 'assistant' && (
                        <div
                          className="flex h-9 w-9 flex-shrink-0 items-center justify-center overflow-hidden rounded-full"
                          style={{
                            background: 'var(--cn-cream-50)',
                            border: '1px solid var(--cn-line)',
                          }}
                        >
                          <Image
                            src="/images/brand/Logo Campers Nova.png"
                            alt="CampersNova"
                            width={28}
                            height={28}
                            className="object-contain"
                          />
                        </div>
                      )}
                      <div
                        className="max-w-[75%] whitespace-pre-wrap rounded-[16px] px-4 py-3 text-[14px] leading-relaxed"
                        style={
                          m.role === 'user'
                            ? { background: 'var(--cn-teal-900)', color: '#fff' }
                            : {
                                background: 'var(--cn-cream-50)',
                                color: 'var(--cn-ink-700)',
                                border: '1px solid var(--cn-line)',
                              }
                        }
                      >
                        {m.content ? (
                          cleanContent(m.content)
                        ) : (
                          <span className="flex gap-1">
                            {[0, 1, 2].map((i) => (
                              <span
                                key={i}
                                className="inline-block h-2 w-2 animate-bounce rounded-full"
                                style={{
                                  background: 'var(--cn-ink-500)',
                                  animationDelay: `${i * 0.15}s`,
                                }}
                              />
                            ))}
                          </span>
                        )}
                      </div>
                    </div>
                  ))}

                  {chatError && <p className="text-center text-[13px] text-red-600">{chatError}</p>}

                  {isRedirectedSeller && (
                    <div className="mt-2 text-center">
                      <Link
                        href="/vender"
                        className="inline-flex items-center gap-2 rounded-full px-6 py-3 text-[14px] font-semibold text-white transition-opacity hover:opacity-90"
                        style={{ background: 'var(--cn-terra-500)' }}
                      >
                        Ir a vender mi camper →
                      </Link>
                    </div>
                  )}

                  {isComplete && !isRedirectedSeller && (
                    <div className="mt-2 text-center">
                      <p className="mb-3 text-[13px]" style={{ color: 'var(--cn-ink-500)' }}>
                        Listo. Te llamamos en 24h con propuestas. ¿Vuelves a la web?
                      </p>
                      <Link
                        href="/"
                        className="inline-flex items-center gap-2 rounded-full px-6 py-3 text-[14px] font-semibold text-white transition-opacity hover:opacity-90"
                        style={{ background: 'var(--cn-teal-900)' }}
                      >
                        Volver al inicio
                      </Link>
                    </div>
                  )}
                </div>

                {/* Suggestions */}
                {showSuggestions && (
                  <div
                    className="flex flex-wrap gap-2 px-5 py-3"
                    style={{ borderTop: '1px solid var(--cn-line)' }}
                  >
                    {SUGGESTIONS.map((s) => (
                      <button
                        key={s}
                        onClick={() => void sendMessage(s)}
                        className="rounded-full px-4 py-2 text-[13px] font-medium transition-opacity hover:opacity-80"
                        style={{
                          background: 'var(--cn-cream-50)',
                          border: '1px solid var(--cn-line)',
                          color: 'var(--cn-teal-900)',
                        }}
                      >
                        {s}
                      </button>
                    ))}
                  </div>
                )}

                {/* Input row */}
                {!isComplete && !isRedirectedSeller && (
                  <div
                    className="flex items-end gap-3 p-4"
                    style={{ borderTop: '1px solid var(--cn-line)' }}
                  >
                    <textarea
                      ref={inputRef}
                      rows={1}
                      placeholder={
                        sessionToken
                          ? 'Escribe lo que buscas — somos pareja, algo manejable, presupuesto sobre 45.000 €…'
                          : 'Iniciando sesión segura…'
                      }
                      value={input}
                      onChange={(e) => setInput(e.target.value)}
                      onKeyDown={onKeyDown}
                      disabled={isLoading || !sessionToken}
                      className="flex-1 resize-none rounded-[12px] px-4 py-3 text-[14px] leading-relaxed outline-none"
                      style={{
                        border: '1px solid var(--cn-line)',
                        background: 'var(--cn-cream-50)',
                        color: 'var(--cn-ink-700)',
                        maxHeight: 160,
                      }}
                    />
                    <button
                      onClick={() => void sendMessage()}
                      disabled={isLoading || !input.trim() || !sessionToken}
                      aria-label="Enviar"
                      className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-full transition-opacity disabled:opacity-40"
                      style={{ background: 'var(--cn-terra-500)' }}
                    >
                      <svg
                        width="18"
                        height="18"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="white"
                        strokeWidth="2.2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        aria-hidden="true"
                      >
                        <path d="M5 12h14" />
                        <path d="M13 5l7 7-7 7" />
                      </svg>
                    </button>
                  </div>
                )}

                <p
                  className="px-5 pb-4 text-center text-[11px]"
                  style={{ color: 'var(--cn-ink-500)' }}
                >
                  Al continuar, aceptas que el equipo de Campers Nova te contacte para guiarte. Tus
                  datos no se comparten con terceros.{' '}
                  <Link href="/privacidad" className="underline underline-offset-2">
                    Política de privacidad
                  </Link>
                </p>
              </div>
            </div>

            {/* ── Sidebar ── */}
            <aside className="flex flex-col gap-5">
              {/* Advisor card — dark teal background */}
              <div className="rounded-[20px] p-6" style={{ background: 'var(--cn-teal-900)' }}>
                <div className="mb-4 flex items-center gap-3">
                  <div
                    className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-full text-[16px] font-bold text-white"
                    style={{ background: 'var(--cn-terra-500)' }}
                  >
                    E
                  </div>
                  <div>
                    <p className="text-[13px] font-semibold text-white">Esteban · Campers Nova</p>
                    <p className="text-[12px]" style={{ color: 'rgba(255,255,255,0.6)' }}>
                      Asesor sénior · 6 años
                    </p>
                  </div>
                </div>
                <p
                  className="text-[13px] italic leading-relaxed"
                  style={{ color: 'rgba(255,255,255,0.85)', fontFamily: 'var(--font-fraunces)' }}
                >
                  &ldquo;Te leo en cuanto el asistente recoja lo importante. Mi trabajo es
                  proponerte solo lo que tiene sentido para ti.&rdquo;
                </p>
              </div>

              {/* Why here */}
              <div
                className="rounded-[20px] p-6"
                style={{ background: 'var(--cn-cream-50)', border: '1px solid var(--cn-line)' }}
              >
                <p
                  className="mb-4 font-mono text-[10px] font-semibold uppercase tracking-[0.14em]"
                  style={{ color: 'var(--cn-terra-500)' }}
                >
                  Por qué empezar por aquí
                </p>
                <ul className="flex flex-col gap-3">
                  {[
                    'Cero filtros que no entiendes',
                    'Stock real, no maquetado',
                    'Te llamamos solo cuando lo pidas',
                    'Garantía mecánica de 12 meses',
                  ].map((item) => (
                    <li
                      key={item}
                      className="flex items-start gap-3 text-[13px]"
                      style={{ color: 'var(--cn-ink-700)' }}
                    >
                      <span
                        className="mt-0.5 flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full"
                        style={{ background: 'var(--cn-teal-900)' }}
                        aria-hidden="true"
                      >
                        <svg
                          width="10"
                          height="10"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="white"
                          strokeWidth="3"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        >
                          <polyline points="5 12 10 17 19 8" />
                        </svg>
                      </span>
                      {item}
                    </li>
                  ))}
                </ul>
              </div>

              {/* Alt channels */}
              <div
                className="rounded-[20px] p-6"
                style={{ background: 'var(--cn-cream-50)', border: '1px solid var(--cn-line)' }}
              >
                <p
                  className="mb-4 font-mono text-[10px] font-semibold uppercase tracking-[0.14em]"
                  style={{ color: 'var(--cn-terra-500)' }}
                >
                  ¿Prefieres otro canal?
                </p>
                <div className="flex flex-col">
                  <a
                    href="https://wa.me/34629925821"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-3 py-3 text-[13px] transition-opacity hover:opacity-70"
                    style={{
                      color: 'var(--cn-teal-900)',
                      borderBottom: '1px solid var(--cn-line)',
                    }}
                  >
                    <svg
                      width="16"
                      height="16"
                      viewBox="0 0 24 24"
                      fill="currentColor"
                      aria-hidden="true"
                      className="flex-shrink-0"
                    >
                      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
                    </svg>
                    WhatsApp · 629 92 58 21
                  </a>
                  <a
                    href="tel:+34629925821"
                    className="flex items-center gap-3 py-3 text-[13px] transition-opacity hover:opacity-70"
                    style={{
                      color: 'var(--cn-teal-900)',
                      borderBottom: '1px solid var(--cn-line)',
                    }}
                  >
                    <svg
                      width="16"
                      height="16"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      aria-hidden="true"
                      className="flex-shrink-0"
                    >
                      <path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07A19.5 19.5 0 013.07 9.67 19.79 19.79 0 01.014 1.1 2 2 0 012 .82h3a2 2 0 012 1.72 12.84 12.84 0 00.7 2.81 2 2 0 01-.45 2.11L6.09 8.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45 12.84 12.84 0 002.81.7A2 2 0 0122 16.92z" />
                    </svg>
                    Llamar al equipo
                  </a>
                  <a
                    href="mailto:info@campersnova.com"
                    className="flex items-center gap-3 py-3 text-[13px] transition-opacity hover:opacity-70"
                    style={{ color: 'var(--cn-teal-900)' }}
                  >
                    <svg
                      width="16"
                      height="16"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      aria-hidden="true"
                      className="flex-shrink-0"
                    >
                      <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
                      <polyline points="22,6 12,13 2,6" />
                    </svg>
                    info@campersnova.com
                  </a>
                </div>
              </div>

              {/* Visit us */}
              <div
                className="rounded-[20px] p-6"
                style={{ background: 'var(--cn-cream-50)', border: '1px solid var(--cn-line)' }}
              >
                <h5
                  className="mb-3 text-[13px] font-semibold"
                  style={{ color: 'var(--cn-teal-900)' }}
                >
                  Visítanos en Barcelona
                </h5>
                <p className="text-[13px] leading-relaxed" style={{ color: 'var(--cn-ink-700)' }}>
                  <a
                    href="https://www.google.com/maps/dir//CAMPERS+NOVA,+SL,+Carrer+Torre+de+Cellers,+08150,+Barcelona/"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="underline underline-offset-2"
                    style={{ color: 'var(--cn-teal-900)' }}
                  >
                    Carrer Torre de Cellers · 08150 — Cómo llegar ↗
                  </a>
                  <br />
                  Lun–Vie 10:00–19:00 · Sáb 10:00–13:00
                </p>
              </div>
            </aside>
          </div>
        </div>
      </main>
      <PublicFooter />

      {/* hCaptcha — invisible, auto-executes on load. In dev: bypassed via useEffect. */}
      {process.env.NODE_ENV === 'production' && (
        <HCaptcha
          ref={captchaRef}
          sitekey={process.env.NEXT_PUBLIC_HCAPTCHA_SITE_KEY!}
          size="invisible"
          onVerify={handleCaptchaVerify}
          onLoad={() => captchaRef.current?.execute()}
        />
      )}
    </>
  )
}
