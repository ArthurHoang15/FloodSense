import { Clock3, Map, TriangleAlert } from 'lucide-react'
import SurfaceCard from '@/components/ui/SurfaceCard'

type Props = {
  overlapCount: number
  warningCount: number
  routePoints: number
  etaMinutes: number
}

const metrics = [
  { key: 'overlap', label: 'Flood overlaps', icon: TriangleAlert, tone: 'text-error' },
  { key: 'warnings', label: 'Warnings', icon: TriangleAlert, tone: 'text-secondary' },
  { key: 'points', label: 'Route points', icon: Map, tone: 'text-primary' },
  { key: 'eta', label: 'Estimated ETA', icon: Clock3, tone: 'text-primary-container' },
] as const

export default function RouteResultOverviewCard({ overlapCount, warningCount, routePoints, etaMinutes }: Props) {
  const values = {
    overlap: overlapCount,
    warnings: warningCount,
    points: routePoints,
    eta: etaMinutes > 0 ? `${etaMinutes} min` : 'Pending',
  }

  return (
    <SurfaceCard className="p-5 md:p-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="fs-label">Route snapshot</div>
          <h2 className="mt-2 font-headline text-2xl font-black tracking-[-0.06em] text-on-surface">Route Results</h2>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-on-surface-variant">
            Keep the route workflow on a dedicated canvas so the shared sidebar remains usable and the decision area has enough space.
          </p>
        </div>
        <div className="rounded-full bg-surface-container-low px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-primary">Expanded layout</div>
      </div>

      <div className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {metrics.map((metric) => (
          <div key={metric.key} className="rounded-3xl bg-surface-container-low px-4 py-4">
            <div className="flex items-center justify-between gap-3">
              <span className="text-xs uppercase tracking-[0.18em] text-on-surface-variant">{metric.label}</span>
              <metric.icon className={`h-4 w-4 ${metric.tone}`} />
            </div>
            <div className={`mt-4 font-headline text-3xl font-black tracking-[-0.08em] ${metric.tone}`}>{values[metric.key]}</div>
          </div>
        ))}
      </div>
    </SurfaceCard>
  )
}