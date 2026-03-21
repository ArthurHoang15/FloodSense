import SurfaceCard from '@/components/ui/SurfaceCard'
import SeverityBadge from '@/components/ui/SeverityBadge'
import type { FloodEvent } from '../../../shared/types'

type Props = {
  zones: FloodEvent[]
}

export default function RouteFloodZonesCard({ zones }: Props) {
  return (
    <SurfaceCard className="p-5 md:p-6">
      <div className="flex items-center justify-between gap-3">
        <div>
          <div className="fs-label">On-route flood zones</div>
          <div className="mt-2 font-headline text-xl font-bold tracking-[-0.05em] text-on-surface">Impact corridor</div>
        </div>
        <div className="rounded-full bg-error-container/18 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-error">
          {zones.length} zones
        </div>
      </div>

      {zones.length === 0 ? (
        <div className="mt-5 rounded-3xl bg-surface-container-low px-5 py-10 text-center text-sm leading-6 text-on-surface-variant">
          No flooded segments intersect the current route. The map and summaries will update after the next route check.
        </div>
      ) : (
        <div className="fs-scrollbar mt-5 grid max-h-[420px] gap-3 overflow-y-auto pr-1">
          {zones.slice(0, 8).map((zone) => (
            <div key={zone.id} className="rounded-3xl bg-surface-container-low px-4 py-4">
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <div className="truncate text-sm font-semibold text-on-surface">{zone.street_name}</div>
                  <div className="mt-1 text-xs text-on-surface-variant">{zone.district}</div>
                  <div className="mt-3 text-xs leading-5 text-on-surface-variant">
                    Confidence {zone.confidence} • {zone.depth_cm ? `${zone.depth_cm} cm` : 'Depth pending'}
                  </div>
                </div>
                <SeverityBadge severity={zone.severity} />
              </div>
            </div>
          ))}
        </div>
      )}
    </SurfaceCard>
  )
}