export function TrustStrip() {
  return (
    <div className="relative z-10 -mt-14 px-8 pb-4 max-[640px]:px-5">
      <div
        className="mx-auto max-w-[1280px] rounded-[24px] px-8 py-2 lg:grid lg:grid-cols-4 lg:gap-x-8 lg:py-7"
        style={{
          background: '#fff',
          boxShadow: '0 4px 32px rgba(61,47,36,0.10)',
        }}
      >
        {ITEMS.map(({ icon, title, text }) => (
          <div
            key={title}
            className="flex items-start gap-3.5 border-b py-5 last:border-0 lg:border-0 lg:py-0"
            style={{ borderColor: 'rgba(88,71,56,0.10)' }}
          >
            <span
              className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl"
              style={{ background: 'rgba(88,71,56,0.08)', color: 'var(--cn-teal-500)' }}
            >
              {icon}
            </span>
            <div>
              <h4
                className="mb-1 text-[14px] font-semibold leading-snug"
                style={{ color: 'var(--cn-teal-900)' }}
              >
                {title}
              </h4>
              <p className="text-[13px] leading-relaxed" style={{ color: 'var(--cn-ink-500)' }}>
                {text}
              </p>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

const ITEMS = [
  {
    icon: (
      <svg
        width="18"
        height="18"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <path d="M12 3l8 3v6c0 5-3.5 8.5-8 9-4.5-.5-8-4-8-9V6l8-3z" />
      </svg>
    ),
    title: 'Vehículos revisados',
    text: 'Cada camper o autocaravana pasa por revisión técnica antes de publicarse.',
  },
  {
    icon: (
      <svg
        width="18"
        height="18"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <path d="M12 4l1.5 4 4 1.5-4 1.5L12 15l-1.5-4-4-1.5 4-1.5L12 4z" />
        <path d="M19 14l.7 1.8L21.5 16.5 19.7 17.2 19 19l-.7-1.8L16.5 16.5l1.8-.7L19 14z" />
      </svg>
    ),
    title: 'Asesoramiento experto',
    text: 'Te ayudamos a elegir según tu forma de viajar, no solo a vender.',
  },
  {
    icon: (
      <svg
        width="18"
        height="18"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <path d="M12 11l-2-2-3 3 5 5 5-5-3-3-2 2z" />
        <path d="M3 12l4-4 5 5" />
        <path d="M21 12l-4-4" />
      </svg>
    ),
    title: 'Gestión profesional',
    text: 'Nos ocupamos de papeleo, transferencias y trámites.',
  },
  {
    icon: (
      <svg
        width="18"
        height="18"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <path d="M11 20A8 8 0 014 12c0-3.3 2.5-7 7.5-9 1 5 4 7 7.5 7v3a8 8 0 01-8 7z" />
        <path d="M11 20c0-5 2-8 6-9" />
      </svg>
    ),
    title: 'Proceso transparente',
    text: 'Sin letra pequeña, sin presión. Información clara desde el primer contacto.',
  },
]
