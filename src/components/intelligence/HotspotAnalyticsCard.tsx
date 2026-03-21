import { BarChart3 } from 'lucide-react'
import SurfaceCard from '@/components/ui/SurfaceCard'
import { cn } from '@/lib/utils'
import type { Severity } from '../../../shared/types'

type Hotspot = {
  id: string
  name: string
  depthLabel: string
  depthCm: number
  severity: Severity
  widthPercent: number
}

type Props = {
  hotspots: Hotspot[]
  className?: string
}

function fillClass(severity: Severity) {
  if (severity === 'heavy') return 'from-tertiary-container/60 to-tertiary-container text-tertiary-container'
  if (severity === 'moderate') return 'from-secondary-container/60 to-secondary-container text-secondary-container'
  return 'from-primary-container/70 to-primary-container text-primary'
}

export default function HotspotAnalyticsCard({ hotspots, className }: Props) {
  return (
    <SurfaceCard className={cn('flex h-full flex-col p-8', className)}>
      <div className="flex items-center justify-between gap-4">
        <div>
          <h3 className="font-headline text-2xl font-bold tracking-[-0.05em] text-primary">Top 5 Critical Hotspots</h3>
          <p className="mt-1 text-sm text-on-surface-variant">Based on current telemetry intensity and verified flood depth.</p>
        </div>
        <button type="button" className="inline-flex items-center gap-1 text-sm font-medium text-primary-fixed-dim transition hover:text-primary">
          Full report
        </button>
      </div>

      {hotspots.length === 0 ? (
        <div className="flex flex-1 items-center justify-center">
          <div className="flex max-w-sm flex-col items-center rounded-3xl bg-surface-container-low px-8 py-10 text-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary-container/12 text-primary">
              <BarChart3 className="h-7 w-7" />
            </div>
            <div className="mt-5 font-headline text-2xl font-bold tracking-[-0.05em] text-on-surface">Awaiting hotspot signals</div>
            <p className="mt-3 text-sm leading-6 text-on-surface-variant">
              Once live telemetry or confirmed flood reports arrive, the highest-risk streets will surface here automatically.
            </p>
          </div>
        </div>
      ) : (
        <div className="mt-8 space-y-6">
          {hotspots.map((hotspot) => (
            <div key={hotspot.id} className="group">
              <div className="mb-2 flex items-center justify-between gap-4">
                <span className="text-sm font-medium text-on-surface">{hotspot.name}</span>
                <span className={`text-sm font-bold ${fillClass(hotspot.severity).split(' ').at(-1)}`}>{hotspot.depthLabel}</span>
              </div>
              <div className="h-3 w-full overflow-hidden rounded-full bg-surface-container-highest">
                <div className={`h-full rounded-full bg-gradient-to-r transition group-hover:brightness-110 ${fillClass(hotspot.severity)}`} style={{ width: `${hotspot.widthPercent}%` }} />
              </div>
            </div>
          ))}
        </div>
      )}
    </SurfaceCard>
  )
}