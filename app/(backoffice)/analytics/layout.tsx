import { Suspense } from 'react'
import { requireAuth } from '@/lib/auth'
import { AnalyticsTabs } from './analytics-tabs'
import { RangeFilter } from './range-filter'

/**
 * Shell del producto Analytics (mockup CampersNova Dashboards): un único
 * contenedor con conmutador de dashboards (tabs) y filtro global de rango de
 * fechas (?range=, preservado entre tabs). Cada dashboard conserva su guard
 * de rol y sus filtros propios; los cálculos son server-side (B21).
 */
export default async function AnalyticsLayout({ children }: { children: React.ReactNode }) {
  const user = await requireAuth()
  return (
    <div className="mx-auto max-w-[1200px]">
      <Suspense>
        <AnalyticsTabs userRole={user.role} />
      </Suspense>
      <div className="mb-5">
        <Suspense>
          <RangeFilter />
        </Suspense>
      </div>
      {/* Fade entre dashboards (~0.28s, equivalente al keyframe cnfade) */}
      <div className="duration-300 animate-in fade-in">{children}</div>
    </div>
  )
}
