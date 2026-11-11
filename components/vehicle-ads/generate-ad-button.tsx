'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { Textarea } from '@/components/ui/textarea'
import {
  generateVehicleAd,
  saveVehicleAdText,
} from '@/app/(backoffice)/vendedores/[id]/ads-actions'
import { offerDateLabel } from '@/lib/buyer-offers'
import { portalLabels, type SalePortal } from '@/lib/portal-listings'

type Draft = { id: string; content: string; canEdit: boolean }
type Props = {
  vehicleId: string
  channel: SalePortal
  lastAd: (Draft & { createdAt: Date; author: string | null }) | null
}

export function GenerateAdButton({ vehicleId, channel, lastAd }: Props) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [original, setOriginal] = useState<Draft | null>(lastAd)
  const [text, setText] = useState('')
  const [busy, setBusy] = useState<'generate' | 'save' | null>(null)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const label = portalLabels[channel]
  const limit = channel === 'WALLAPOP' ? 620 : 4500
  const dirty = text !== (original?.content ?? '')
  function toggle(next: boolean) {
    if (busy) return
    if (next) {
      setOriginal(lastAd)
      setText(lastAd?.content ?? '')
      setError('')
      setNotice('')
    } else if (dirty && !window.confirm('¿Cerrar sin guardar los cambios del texto?')) return
    setOpen(next)
  }
  async function generate() {
    if (
      dirty &&
      !window.confirm('¿Sustituir los cambios sin guardar por un texto generado con IA?')
    )
      return
    setBusy('generate')
    setError('')
    setNotice('')
    try {
      const result = await generateVehicleAd(vehicleId, channel)
      if (!result.adId || result.content == null) {
        setError(result.error ?? 'No se pudo generar el texto.')
        return
      }
      setOriginal({ id: result.adId, content: result.content, canEdit: true })
      setText(result.content)
      setNotice('Texto generado y guardado.')
      router.refresh()
    } catch {
      setError('No se pudo confirmar la generación. Vuelve a abrir el texto para comprobarlo.')
    } finally {
      setBusy(null)
    }
  }
  async function save() {
    setBusy('save')
    setError('')
    setNotice('')
    try {
      const result = await saveVehicleAdText({
        vehicleId,
        channel,
        original: original && { id: original.id, content: original.content },
        content: text,
      })
      if (!result.id) {
        setError(result.error ?? 'No se pudo guardar el texto.')
        router.refresh()
        return
      }
      const saved = text.trim()
      setOriginal({
        id: result.id,
        content: saved,
        canEdit: true,
      })
      setText(saved)
      setNotice('Texto guardado.')
      router.refresh()
    } catch {
      setError('No se pudo confirmar el guardado. Puedes volver a intentarlo.')
    } finally {
      setBusy(null)
    }
  }
  async function copy() {
    try {
      await navigator.clipboard.writeText(text)
      setNotice('Texto copiado.')
    } catch {
      const field = document.getElementById('texto-' + channel) as HTMLTextAreaElement | null
      field?.focus()
      field?.select()
      setNotice('Texto seleccionado. Usa la opción Copiar de tu dispositivo.')
    }
  }
  return (
    <>
      <Button type="button" variant="outline" size="sm" onClick={() => toggle(true)}>
        {lastAd?.content.trim() ? 'Ver texto' : 'Preparar texto'}
      </Button>
      <Dialog open={open} onOpenChange={toggle}>
        <DialogContent className="max-h-[90dvh] max-w-2xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Texto del anuncio en {label}</DialogTitle>
          </DialogHeader>
          <label htmlFor={'texto-' + channel} className="sr-only">
            Texto para {label}
          </label>
          <Textarea
            id={'texto-' + channel}
            value={text}
            onChange={(e) => {
              setText(e.target.value)
              setNotice('')
              setError('')
            }}
            readOnly={!!busy || original?.canEdit === false}
            rows={8}
            placeholder="Escribe el anuncio o genera un borrador con IA."
          />
          <div className="flex flex-wrap justify-between gap-2 text-xs text-muted-foreground">
            <span>
              {text.length} / {limit} caracteres
              {text.length > limit ? ' · Supera el límite del portal' : ''}
            </span>
            {lastAd && original?.id === lastAd.id && (
              <span>
                Creado el {offerDateLabel(lastAd.createdAt.toISOString())}
                {lastAd.author ? ' · ' + lastAd.author : ''}
              </span>
            )}
          </div>
          {original?.canEdit === false && (
            <p className="text-sm text-muted-foreground">
              El autor y administración pueden editar este texto.
            </p>
          )}
          {error && (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          )}
          <p role="status" className="text-sm">
            {notice}
          </p>
          <DialogFooter className="flex-wrap gap-2">
            <Button variant="outline" size="sm" onClick={generate} disabled={!!busy}>
              {busy === 'generate'
                ? 'Generando…'
                : original
                  ? 'Regenerar con IA'
                  : 'Generar con IA'}
            </Button>
            <Button variant="outline" size="sm" onClick={copy} disabled={!!busy || !text.trim()}>
              Copiar texto
            </Button>
            {original?.canEdit !== false && (
              <Button size="sm" onClick={save} disabled={!!busy || !dirty || !text.trim()}>
                {busy === 'save' ? 'Guardando…' : 'Guardar texto'}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
