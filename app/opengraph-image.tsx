import { ImageResponse } from 'next/og'
import { SITE_NAME } from '@/lib/seo'

// Imagen Open Graph por defecto (1200×630) generada dinámicamente.
// Next la asocia automáticamente como og:image (y fallback de twitter) de todo el sitio.
// runtime edge: ruta canónica de next/og; evita el fallo de prerender estático en build.
export const runtime = 'edge'
export const alt = `${SITE_NAME} — Autocaravanas y campers seminuevas con garantía`
export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'

export default function OpengraphImage() {
  return new ImageResponse(
    <div
      style={{
        height: '100%',
        width: '100%',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        padding: '80px',
        background: 'linear-gradient(135deg, #0a0a0a 0%, #2a221c 100%)',
        color: '#efe9d8',
        fontFamily: 'sans-serif',
      }}
    >
      <div
        style={{
          fontSize: 22,
          letterSpacing: 8,
          textTransform: 'uppercase',
          color: '#b59e7d',
        }}
      >
        Campers Nova
      </div>
      <div
        style={{
          marginTop: 24,
          fontSize: 68,
          fontWeight: 700,
          lineHeight: 1.05,
          maxWidth: 900,
          color: '#ffffff',
        }}
      >
        Autocaravanas y campers seminuevas con garantía
      </div>
      <div style={{ marginTop: 32, fontSize: 30, color: '#cbb89a' }}>
        Compra, vende y viaja con confianza · campersnova.com
      </div>
    </div>,
    { ...size }
  )
}
