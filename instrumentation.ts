export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    // Vercel corre en UTC y reserva el nombre de env var `TZ`, así que fijamos la
    // zona horaria del servidor aquí para que las fechas/horas se rendericen en
    // hora de España (Europe/Madrid) en todo el CRM. Node relee process.env.TZ.
    if (!process.env.TZ) process.env.TZ = 'Europe/Madrid'
    await import('./sentry.server.config')
  }

  if (process.env.NEXT_RUNTIME === 'edge') {
    await import('./sentry.edge.config')
  }
}
