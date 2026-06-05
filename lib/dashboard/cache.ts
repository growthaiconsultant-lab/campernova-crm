import type { PrismaClient } from '@prisma/client'
import { unstable_cache } from 'next/cache'
import { db } from '@/lib/db'
import type { DashboardFilter } from './queries'

/**
 * Caché de datos para las métricas del dashboard.
 *
 * El dashboard es 100% dinámico (auth por cookies) y compone decenas de queries por carga.
 * Estas métricas son agregados que cambian lentamente, así que las cacheamos unos segundos
 * para que la navegación repetida no re-ejecute todas las queries contra la DB.
 *
 * - La clave incluye el `agentId` del filtro → cada agente/"todos" tiene su propia entrada.
 * - Solo se cachean funciones cuyo retorno es serializable (números/strings/objetos planos,
 *   **sin** objetos `Date` — `unstable_cache` los serializa a string y rompería `.getTime()`).
 * - TTL corto: el equipo ve los cambios reflejados como máximo en `DASHBOARD_CACHE_TTL` s.
 */
export const DASHBOARD_CACHE_TTL = 60

/** Envuelve una métrica pura `(db, filter)` en caché de datos, keyed por filtro. */
export function withDashboardCache<T>(
  key: string,
  fn: (database: PrismaClient, filter: DashboardFilter) => Promise<T>
) {
  return (filter: DashboardFilter): Promise<T> =>
    unstable_cache(() => fn(db, filter), [`dash:${key}`, filter.agentId ?? 'all'], {
      revalidate: DASHBOARD_CACHE_TTL,
    })()
}

/** Variante para métricas que no dependen del filtro (`(db)`). */
export function withDashboardCacheGlobal<T>(
  key: string,
  fn: (database: PrismaClient) => Promise<T>
) {
  return (): Promise<T> =>
    unstable_cache(() => fn(db), [`dash:${key}`], { revalidate: DASHBOARD_CACHE_TTL })()
}
