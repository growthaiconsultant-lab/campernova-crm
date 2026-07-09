import { requireAuth } from '@/lib/auth'
import { AnalyticsTabs } from './analytics-tabs'

/**
 * Shell del producto Analytics (mockup CampersNova Dashboards): un único
 * contenedor con conmutador de dashboards (tabs). Cada dashboard conserva su
 * guard de rol y sus filtros propios; los cálculos son server-side (B21).
 */
export default async function AnalyticsLayout({ children }: { children: React.ReactNode }) {
  const user = await requireAuth()
  return (
    <div className="mx-auto max-w-[1200px]">
      <AnalyticsTabs userRole={user.role} />
      {/* Fade entre dashboards (~0.28s, equivalente al keyframe cnfade) */}
      <div className="duration-300 animate-in fade-in">{children}</div>
    </div>
  )
}
