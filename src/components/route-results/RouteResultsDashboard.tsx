import { Compass, Route } from 'lucide-react'
import MapStage from '@/components/home/map/MapStage'
import MobileBottomNav from '@/components/home/mobile/MobileBottomNav'
import RoutePlannerPanel from '@/components/home/operations/RoutePlannerPanel'
import SavedRoutesPanel from '@/components/home/operations/SavedRoutesPanel'
import NavigationRail from '@/components/home/sidebar/NavigationRail'
import SurfaceCard from '@/components/ui/SurfaceCard'
import RouteFloodZonesCard from '@/components/route-results/RouteFloodZonesCard'
import RouteResultOverviewCard from '@/components/route-results/RouteResultOverviewCard'
import RouteWarningsCard from '@/components/route-results/RouteWarningsCard'
import type { RouteResultsController } from '@/hooks/useRouteResultsController'

type Props = {
  controller: RouteResultsController
}

export default function RouteResultsDashboard({ controller }: Props) {
  const {
    floods,
    headlineFlood,
    heavyCount,
    routeData,
    routeCoords,
    setRouteCoords,
    impactedRouteIds,
    telemetry,
    simulating,
    refreshFloods,
    runSimulation,
    resultSummary,
  } = controller

  return (
    <div className="fs-shell">
      <div className="mx-auto flex max-w-[1720px] gap-0 xl:gap-2">
        <NavigationRail telemetry={telemetry} onSimulate={runSimulation} onRefresh={() => refreshFloods()} simulating={simulating} activeItem="route-results" />

        <main className="min-w-0 flex-1 px-3 pb-24 pt-4 md:px-6 md:pt-6 xl:pb-10">
          <div className="space-y-6">
            <RouteResultOverviewCard {...resultSummary} />

            <div className="grid gap-6 2xl:grid-cols-[minmax(0,1.25fr)_400px] 2xl:items-start">
              <div className="min-w-0 space-y-6">
                <RoutePlannerPanel onRouteReady={setRouteCoords} mode="page" />

                <MapStage floods={floods} routeCoords={routeCoords} headlineFlood={headlineFlood} heavyCount={heavyCount} />

                <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px] xl:items-stretch">
                  <RouteWarningsCard warnings={routeData?.warnings ?? []} />
                  <RouteFloodZonesCard zones={routeData?.floodZones ?? []} />
                </div>
              </div>

              <div className="space-y-6 2xl:sticky 2xl:top-4">
                <SurfaceCard className="p-5 md:p-6">
                  <div className="flex items-center gap-3">
                    <div className="rounded-2xl bg-primary-container/14 p-3 text-primary-container">
                      <Compass className="h-5 w-5" />
                    </div>
                    <div>
                      <div className="fs-label">Workspace rationale</div>
                      <div className="mt-1 font-headline text-xl font-bold tracking-[-0.05em] text-on-surface">Room for route decisions</div>
                    </div>
                  </div>
                  <p className="mt-4 text-sm leading-6 text-on-surface-variant">
                    The route workflow now lives on its own page so the shared sidebar keeps its full utility while the map, results, and warnings remain readable on desktop.
                  </p>
                  <div className="mt-5 rounded-3xl bg-surface-container-low px-4 py-4 text-sm leading-6 text-on-surface-variant">
                    <div className="flex items-center gap-2 font-semibold text-on-surface">
                      <Route className="h-4 w-4 text-primary" />
                      Current state
                    </div>
                    <div className="mt-3">{routeData ? 'Latest route analysis is pinned on the map and mirrored in the cards below.' : 'No route analysis yet. Start with origin and destination to populate the full result canvas.'}</div>
                  </div>
                </SurfaceCard>

                <SavedRoutesPanel impactedRouteIds={impactedRouteIds} />
              </div>
            </div>
          </div>
        </main>
      </div>

      <MobileBottomNav activeItem="routes" />
    </div>
  )
}