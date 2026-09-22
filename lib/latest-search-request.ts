export type LatestSearchRequest = {
  begin: () => number
  invalidate: () => void
  isCurrent: (requestId: number) => boolean
}

/**
 * Ordena búsquedas asíncronas que no se pueden cancelar (por ejemplo, Server Actions).
 * Sólo la solicitud iniciada más recientemente puede publicar su resultado en la UI.
 */
export function createLatestSearchRequest(): LatestSearchRequest {
  let currentRequestId = 0

  return {
    begin() {
      currentRequestId += 1
      return currentRequestId
    },
    invalidate() {
      currentRequestId += 1
    },
    isCurrent(requestId) {
      return requestId === currentRequestId
    },
  }
}
