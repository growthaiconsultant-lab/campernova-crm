'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Search, Loader2 } from 'lucide-react'
import { globalSearch, type SearchResults } from '@/app/(backoffice)/search-actions'

/**
 * Buscador global del header (ESPEC §5): overlay con resultados agrupados por
 * entidad. Se abre con clic o ⌘K / Ctrl+K; Escape cierra. Busca server-side
 * (RBAC en la action) con debounce.
 */
const GROUPS: { key: keyof SearchResults; label: string }[] = [
  { key: 'compradores', label: 'Compradores' },
  { key: 'vendedores', label: 'Vendedores' },
  { key: 'vehiculos', label: 'Vehículos' },
  { key: 'captaciones', label: 'Captaciones' },
]

export function GlobalSearch() {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<SearchResults | null>(null)
  const [loading, setLoading] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Atajo ⌘K / Ctrl+K + Escape
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        setOpen(true)
      }
      if (e.key === 'Escape') setOpen(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  // Foco al abrir + reset al cerrar
  useEffect(() => {
    if (open) {
      inputRef.current?.focus()
    } else {
      setQuery('')
      setResults(null)
    }
  }, [open])

  const search = useCallback((value: string) => {
    if (timer.current) clearTimeout(timer.current)
    if (value.trim().length < 2) {
      setResults(null)
      setLoading(false)
      return
    }
    setLoading(true)
    timer.current = setTimeout(async () => {
      try {
        const res = await globalSearch(value)
        setResults(res)
      } catch {
        setResults(null)
      } finally {
        setLoading(false)
      }
    }, 250)
  }, [])

  function go(href: string) {
    setOpen(false)
    router.push(href)
  }

  const total = results ? GROUPS.reduce((s, g) => s + results[g.key].length, 0) : 0

  return (
    <>
      {/* Trigger — el input fantasma del header */}
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="hover:border-ink3/40 hidden max-w-[420px] flex-1 items-center gap-[9px] rounded-[10px] border border-line bg-canvas px-[13px] py-[9px] text-left transition-colors lg:flex"
      >
        <Search size={16} strokeWidth={2} className="shrink-0 text-ink3" />
        <span className="flex-1 truncate font-hanken text-[13px] text-ink3">Buscar…</span>
        <kbd className="rounded-[5px] border border-line bg-card px-1.5 py-0.5 font-mono text-[10px] font-semibold text-ink3">
          ⌘K
        </kbd>
      </button>
      {/* Trigger móvil — icono */}
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Buscar"
        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[10px] border border-line bg-card text-ink2 transition-colors hover:bg-canvas lg:hidden"
      >
        <Search size={16} strokeWidth={2} />
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-start justify-center p-4 pt-[10vh]"
          style={{ background: 'rgba(8,10,14,0.45)' }}
          role="dialog"
          aria-modal="true"
          aria-label="Buscador global"
          onClick={() => setOpen(false)}
        >
          <div
            className="w-full max-w-[560px] overflow-hidden rounded-[14px] border border-line bg-card"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Input */}
            <div className="flex items-center gap-[9px] border-b border-line px-4 py-3">
              {loading ? (
                <Loader2 size={16} strokeWidth={2} className="shrink-0 animate-spin text-ink3" />
              ) : (
                <Search size={16} strokeWidth={2} className="shrink-0 text-ink3" />
              )}
              <input
                ref={inputRef}
                value={query}
                onChange={(e) => {
                  setQuery(e.target.value)
                  search(e.target.value)
                }}
                placeholder="Buscar compradores, vendedores, vehículos, matrículas…"
                className="flex-1 bg-transparent font-hanken text-[14px] text-ink outline-none placeholder:text-ink3"
              />
              <kbd className="rounded-[5px] border border-line bg-canvas px-1.5 py-0.5 font-mono text-[10px] font-semibold text-ink3">
                ESC
              </kbd>
            </div>

            {/* Resultados */}
            <div className="max-h-[52vh] overflow-y-auto">
              {query.trim().length < 2 ? (
                <p className="px-4 py-6 text-center font-hanken text-[13px] text-ink3">
                  Escribe al menos 2 caracteres para buscar.
                </p>
              ) : results && total === 0 && !loading ? (
                <p className="px-4 py-6 text-center font-hanken text-[13px] text-ink3">
                  Sin resultados para «{query}».
                </p>
              ) : (
                results &&
                GROUPS.map(({ key, label }) => {
                  const hits = results[key]
                  if (hits.length === 0) return null
                  return (
                    <div key={key} className="py-1.5">
                      <div className="px-4 pb-1 pt-2 font-mono text-[10px] font-semibold uppercase tracking-[0.1em] text-ink3">
                        {label}
                      </div>
                      {hits.map((h) => (
                        <button
                          key={h.id}
                          type="button"
                          onClick={() => go(h.href)}
                          className="flex w-full items-center justify-between gap-3 px-4 py-2 text-left transition-colors hover:bg-line2"
                        >
                          <span className="truncate font-hanken text-[13px] font-semibold text-ink">
                            {h.label}
                          </span>
                          <span className="shrink-0 font-mono text-[11px] text-ink3">{h.sub}</span>
                        </button>
                      ))}
                    </div>
                  )
                })
              )}
            </div>
          </div>
        </div>
      )}
    </>
  )
}
