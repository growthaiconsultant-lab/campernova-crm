/**
 * Inyecta un bloque de datos estructurados (JSON-LD) en el <head>/DOM.
 * Server Component — sin JS de cliente.
 */
export function JsonLd({ data }: { data: Record<string, unknown> }) {
  return (
    <script
      type="application/ld+json"
      // El contenido es generado por nosotros (no input de usuario) → seguro.
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }}
    />
  )
}
