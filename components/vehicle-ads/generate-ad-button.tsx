'use client'

import { useState } from 'react'
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
  updateVehicleAdContent,
} from '@/app/(backoffice)/vendedores/[id]/ads-actions'
import type { VehicleAd } from '@prisma/client'
import { Loader2, Copy, Check, RefreshCw } from 'lucide-react'

const CHAR_LIMITS = {
  WALLAPOP: 620,
  COCHESNET: 4500,
} as const

const CHANNEL_LABELS = {
  WALLAPOP: 'Wallapop',
  COCHESNET: 'Coches.net',
} as const

type Props = {
  vehicleId: string
  channel: 'WALLAPOP' | 'COCHESNET'
  lastAd?: Pick<VehicleAd, 'id' | 'content' | 'createdAt'> | null
  agentName?: string
}

export function GenerateAdButton({ vehicleId, channel, lastAd, agentName }: Props) {
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [content, setContent] = useState(lastAd?.content ?? '')
  const [adId, setAdId] = useState<string | null>(lastAd?.id ?? null)
  const [error, setError] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  const limit = CHAR_LIMITS[channel]
  const label = CHANNEL_LABELS[channel]
  const charCount = content.length
  const overLimit = charCount > limit

  async function generate() {
    setLoading(true)
    setError(null)
    const result = await generateVehicleAd(vehicleId, channel)
    setLoading(false)
    if ('error' in result && result.error) {
      setError(result.error)
      return
    }
    if ('content' in result && result.content !== undefined) {
      setContent(result.content)
      setAdId(result.adId ?? null)
    }
  }

  async function handleOpen() {
    setOpen(true)
    if (!content) await generate()
  }

  async function handleRegenerate() {
    await generate()
  }

  async function handleCopy() {
    await navigator.clipboard.writeText(content)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  async function handleContentChange(e: React.ChangeEvent<HTMLTextAreaElement>) {
    const text = e.target.value
    setContent(text)
    if (adId) await updateVehicleAdContent(adId, text)
  }

  const buttonLabel = lastAd
    ? `Ver último ${label} (${new Date(lastAd.createdAt).toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit' })})`
    : `Generar anuncio ${label}`

  return (
    <>
      <Button variant="outline" size="sm" onClick={handleOpen}>
        {buttonLabel}
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Anuncio {label}</DialogTitle>
          </DialogHeader>

          {loading ? (
            <div className="flex flex-col items-center gap-3 py-12">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              <p className="text-sm text-muted-foreground">Generando anuncio con IA…</p>
            </div>
          ) : error ? (
            <div className="space-y-4 py-4">
              <p className="text-sm text-destructive">{error}</p>
              <Button onClick={generate} variant="outline" size="sm">
                Reintentar
              </Button>
            </div>
          ) : (
            <div className="space-y-3">
              <Textarea
                value={content}
                onChange={handleContentChange}
                rows={channel === 'WALLAPOP' ? 8 : 18}
                className="font-mono text-sm"
              />
              <div className="flex items-center justify-between text-xs">
                <span
                  className={overLimit ? 'font-semibold text-destructive' : 'text-muted-foreground'}
                >
                  {charCount.toLocaleString()} / {limit.toLocaleString()} caracteres
                  {overLimit && ' — ¡supera el límite!'}
                </span>
                {agentName && (
                  <span className="text-muted-foreground">Generado por {agentName}</span>
                )}
              </div>
            </div>
          )}

          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              variant="outline"
              size="sm"
              onClick={handleRegenerate}
              disabled={loading}
              className="gap-1"
            >
              <RefreshCw className="h-3.5 w-3.5" />
              Regenerar
            </Button>
            <Button size="sm" onClick={handleCopy} disabled={loading || !content} className="gap-1">
              {copied ? (
                <>
                  <Check className="h-3.5 w-3.5" />
                  Copiado
                </>
              ) : (
                <>
                  <Copy className="h-3.5 w-3.5" />
                  Copiar al portapapeles
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
