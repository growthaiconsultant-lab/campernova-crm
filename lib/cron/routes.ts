/** Rutas registradas en `vercel.json`; la coincidencia es deliberadamente exacta. */
export const CONFIGURED_CRON_PATHS = [
  '/api/cron/postventa-followups',
  '/api/cron/calendar-reminders',
] as const

export function isConfiguredCronPath(pathname: string): boolean {
  return CONFIGURED_CRON_PATHS.some((path) => pathname === path)
}
