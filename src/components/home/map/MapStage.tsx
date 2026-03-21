import FloodMap from '@/components/FloodMap'
import SurfaceCard from '@/components/ui/SurfaceCard'
import SeverityBadge from '@/components/ui/SeverityBadge'
import { formatDepth } from '@/utils/floodPresentation'
import type { AddressSuggestion, FloodEvent, LatLng } from '../../../../shared/types'

type Props = {
  floods: FloodEvent[]
  routeCoords: LatLng[] | null
  altRouteCoords?: LatLng[] | null
  focusLocation?: AddressSuggestion | null
  headlineFlood: FloodEvent | null
  heavyCount: number
}

export default function MapStage({ floods, routeCoords, altRouteCoords = null, focusLocation = null, headlineFlood, heavyCount }: Props) {
  const showRouteLegend = !!routeCoords || !!altRouteCoords

  return (
    <div className="relative h-[72vh] min-h-[640px] overflow-hidden rounded-[2rem] border border-outline-variant/15 bg-surface-container-lowest shadow-ambient md:h-[calc(100vh-140px)]">
      <FloodMap floods={floods} routeCoords={routeCoords} altRouteCoords={altRouteCoords} focusLocation={focusLocation} />
      <div className="pointer-events-none absolute left-4 top-4 z-20 md:left-6 md:top-6">
        <SurfaceCard tone="glass" className="p-4">
          <div className="fs-label">Live flood map</div>
          <div className="mt-3 flex items-end gap-3">
            <div>
              <div className="font-headline text-4xl font-black tracking-[-0.08em] text-primary md:text-5xl">{floods.length}</div>
              <div className="text-sm text-on-surface-variant">active flooded segments</div>
            </div>
            <div className="rounded-2xl bg-surface-container-high/80 px-3 py-2 text-xs text-on-surface-variant">
              {heavyCount} critical
            </div>
          </div>
        </SurfaceCard>
      </div>

      {showRouteLegend ? (
        <div className="pointer-events-none absolute right-4 top-4 z-20 md:right-6 md:top-6">
          <SurfaceCard tone="glass" className="max-w-[280px] p-4">
            <div className="fs-label">Route legend</div>
            <div className="mt-3 grid gap-2 text-sm text-on-surface-variant">
              <div className="flex items-center gap-3">
                <span className="h-[3px] w-8 rounded-full bg-[#ff6b35]" />
                <span>Current or previous route</span>
              </div>
              <div className="flex items-center gap-3">
                <span className="h-[3px] w-8 rounded-full bg-[#4ade80]" />
                <span>Safe route recommendation</span>
              </div>
            </div>
          </SurfaceCard>
        </div>
      ) : null}

      {headlineFlood ? (
        <div className="pointer-events-none absolute bottom-5 left-4 z-20 md:bottom-6 md:left-6">
          <SurfaceCard tone="glass" className="max-w-[320px] p-4">
            <div className="flex items-center gap-2">
              <SeverityBadge severity={headlineFlood.severity} />
              <span className="fs-kicker">Primary zone</span>
            </div>
            <div className="mt-3 font-headline text-xl font-bold tracking-[-0.05em] text-on-surface">{headlineFlood.street_name}</div>
            <div className="mt-1 text-sm text-on-surface-variant">{headlineFlood.district}</div>
            <div className="mt-4 text-sm text-primary">Estimated depth {formatDepth(headlineFlood.depth_cm)}</div>
          </SurfaceCard>
        </div>
      ) : null}
    </div>
  )
}
