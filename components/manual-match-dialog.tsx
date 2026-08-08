'use client'

import { FormEvent, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Link2, Search } from 'lucide-react'
import {
  createManualMatch,
  searchBuyerCandidates,
  searchVehicleCandidates,
  type MatchCandidate,
} from '@/app/(backoffice)/matches/actions'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  MANUAL_MATCH_LINK_NOTES_MAX_LENGTH,
  MANUAL_MATCH_LINK_REASON_LABELS,
  MANUAL_MATCH_LINK_REASONS,
} from '@/lib/matching/manual-link-constants'

type ManualMatchDialogProps = {
  side: 'vehicle' | 'buyer'
  fixedId: string
}

export function ManualMatchDialog({ side, fixedId }: ManualMatchDialogProps) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [candidates, setCandidates] = useState<MatchCandidate[]>([])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [reason, setReason] = useState('')
  const [notes, setNotes] = useState('')
  const [message, setMessage] = useState<string | null>(null)
  const [isSearching, startSearch] = useTransition()
  const [isSaving, startSave] = useTransition()

  const counterpart = side === 'vehicle' ? 'comprador' : 'vehículo'

  function reset() {
    setQuery('')
    setCandidates([])
    setSelectedId(null)
    setReason('')
    setNotes('')
    setMessage(null)
  }

  function handleOpenChange(next: boolean) {
    setOpen(next)
    if (!next) reset()
  }

  function handleSearch(event: FormEvent) {
    event.preventDefault()
    setMessage(null)
    setSelectedId(null)
    if (query.trim().length < 2) {
      setCandidates([])
      setMessage('Escribe al menos dos caracteres.')
      return
    }

    startSearch(async () => {
      const result =
        side === 'vehicle'
          ? await searchBuyerCandidates({ fixedId, query })
          : await searchVehicleCandidates({ fixedId, query })
      if (result.error) {
        setCandidates([])
        setMessage(result.error)
        return
      }
      setCandidates(result.candidates ?? [])
      if ((result.candidates ?? []).length === 0) {
        setMessage(`No se han encontrado ${counterpart}s disponibles.`)
      }
    })
  }

  function handleSave() {
    setMessage(null)
    if (!selectedId || !reason) {
      setMessage(`Selecciona un ${counterpart} y un motivo.`)
      return
    }

    startSave(async () => {
      const result = await createManualMatch({
        vehicleId: side === 'vehicle' ? fixedId : selectedId,
        buyerLeadId: side === 'buyer' ? fixedId : selectedId,
        reason,
        notes,
      })
      if (!result.ok) {
        setMessage(result.error)
        return
      }
      setOpen(false)
      reset()
      router.refresh()
    })
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button
          size="sm"
          variant="outline"
          className="gap-1.5"
          onClick={(event) => event.stopPropagation()}
        >
          <Link2 className="h-3.5 w-3.5" />
          Vincular {counterpart}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Vincular {counterpart}</DialogTitle>
          <DialogDescription>
            Crea una relación comercial visible en ambas fichas. Esto no registra una venta.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <form onSubmit={handleSearch} className="space-y-2">
            <Label htmlFor={`manual-link-search-${side}`}>Buscar {counterpart}</Label>
            <div className="flex gap-2">
              <Input
                id={`manual-link-search-${side}`}
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder={
                  side === 'vehicle'
                    ? 'Nombre del comprador'
                    : 'Marca, modelo, matrícula o vendedor'
                }
                maxLength={80}
                autoComplete="off"
              />
              <Button type="submit" variant="secondary" disabled={isSearching} aria-label="Buscar">
                <Search className="h-4 w-4" />
              </Button>
            </div>
          </form>

          {candidates.length > 0 && (
            <div
              className="max-h-48 space-y-1 overflow-y-auto rounded-md border p-1"
              role="listbox"
            >
              {candidates.map((candidate) => {
                const selected = selectedId === candidate.id
                return (
                  <button
                    key={candidate.id}
                    type="button"
                    role="option"
                    aria-selected={selected}
                    onClick={() => setSelectedId(candidate.id)}
                    className={`w-full rounded px-3 py-2 text-left transition-colors ${
                      selected ? 'bg-primary text-primary-foreground' : 'hover:bg-muted'
                    }`}
                  >
                    <span className="block text-sm font-medium">{candidate.label}</span>
                    <span
                      className={`block text-xs ${selected ? 'text-primary-foreground/80' : 'text-muted-foreground'}`}
                    >
                      {candidate.description}
                      {candidate.hasAutomaticMatch ? ' · Match automático existente' : ''}
                    </span>
                  </button>
                )
              })}
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor={`manual-link-reason-${side}`}>Motivo</Label>
            <select
              id={`manual-link-reason-${side}`}
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <option value="">Selecciona un motivo</option>
              {MANUAL_MATCH_LINK_REASONS.map((value) => (
                <option key={value} value={value}>
                  {MANUAL_MATCH_LINK_REASON_LABELS[value]}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between gap-2">
              <Label htmlFor={`manual-link-notes-${side}`}>Nota opcional</Label>
              <span className="text-xs text-muted-foreground">
                {notes.length}/{MANUAL_MATCH_LINK_NOTES_MAX_LENGTH}
              </span>
            </div>
            <Textarea
              id={`manual-link-notes-${side}`}
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
              maxLength={MANUAL_MATCH_LINK_NOTES_MAX_LENGTH}
              rows={3}
              placeholder="Contexto útil para el equipo"
            />
            <p className="text-xs text-muted-foreground">
              No incluyas DNI, datos bancarios ni información sensible.
            </p>
          </div>

          {message && (
            <p role="alert" className="text-sm text-destructive">
              {message}
            </p>
          )}
        </div>

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => setOpen(false)}
            disabled={isSaving}
          >
            Cancelar
          </Button>
          <Button type="button" onClick={handleSave} disabled={isSaving || !selectedId || !reason}>
            {isSaving ? 'Vinculando…' : 'Vincular'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
