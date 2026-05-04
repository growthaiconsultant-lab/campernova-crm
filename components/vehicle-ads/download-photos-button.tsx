'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Download, Loader2 } from 'lucide-react'

type Props = {
  sellerLeadId: string
  photoCount: number
}

export function DownloadPhotosButton({ sellerLeadId, photoCount }: Props) {
  const [downloading, setDownloading] = useState(false)

  async function handleClick() {
    if (photoCount === 0) return
    setDownloading(true)
    // Trigger browser download via navigation — works for any file size
    window.location.href = `/api/vendedores/${sellerLeadId}/photos.zip`
    // Reset after a short delay (browser handles the download)
    setTimeout(() => setDownloading(false), 3000)
  }

  return (
    <Button
      variant="outline"
      size="sm"
      onClick={handleClick}
      disabled={downloading || photoCount === 0}
      className="gap-1.5"
    >
      {downloading ? (
        <>
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
          Descargando…
        </>
      ) : (
        <>
          <Download className="h-3.5 w-3.5" />
          Descargar fotos ({photoCount})
        </>
      )}
    </Button>
  )
}
