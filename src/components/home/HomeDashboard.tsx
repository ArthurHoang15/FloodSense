import CriticalAlertBanner from '@/components/home/alerts/CriticalAlertBanner'
import VoiceToggle from '@/components/home/alerts/VoiceToggle'
import IntelligenceFeed from '@/components/home/feed/IntelligenceFeed'
import MapControlDock from '@/components/home/map/MapControlDock'
import MapStage from '@/components/home/map/MapStage'
import MobileBottomNav from '@/components/home/mobile/MobileBottomNav'
import OperationsDock from '@/components/home/operations/OperationsDock'
import NavigationRail from '@/components/home/sidebar/NavigationRail'
import { useFloodStore } from '@/stores/floodStore'
import type { DashboardController } from '@/hooks/useDashboardController'

type Props = {
  controller: DashboardController
}

export default function HomeDashboard({ controller }: Props) {
  const {
    floods,
    routeCoords,
    setRouteCoords,
    headlineFlood,
    telemetry,
    feedItems,
    stats,
    lastAlert,
    impactedRouteIds,
    routes,
    voiceEnabled,
    weatherAlert,
  } = controller

  return (
    <div className="fs-shell">
      <div className="mx-auto flex max-w-[1600px] gap-0 xl:gap-2">
        <NavigationRail telemetry={telemetry} activeItem="flood-feed" />

        <main className="min-w-0 flex-1 px-3 pb-24 pt-4 md:px-6 md:pt-6 xl:pb-10">
          {weatherAlert ? (
            <div className="mb-4 rounded-3xl border border-primary-container/20 bg-primary-container/12 px-4 py-4 text-sm text-primary shadow-ambient">
              {weatherAlert.message}
            </div>
          ) : null}

          <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_420px] xl:items-start">
            <div className="min-w-0">
              <section className="relative">
                <CriticalAlertBanner flood={headlineFlood} />
                <MapStage floods={floods} routeCoords={routeCoords} headlineFlood={headlineFlood} heavyCount={stats.heavyCount} />
                <MapControlDock />
                <VoiceToggle />
                <IntelligenceFeed items={feedItems} />
              </section>

              <div className="mt-6 grid gap-4 md:grid-cols-3 xl:hidden">
                <div className="fs-stat-card">
                  <div className="fs-label">Active floods</div>
                  <div className="mt-2 font-headline text-4xl font-black tracking-[-0.08em] text-primary">{stats.floodCount}</div>
                </div>
                <div className="fs-stat-card">
                  <div className="fs-label">Critical zones</div>
                  <div className="mt-2 font-headline text-4xl font-black tracking-[-0.08em] text-error">{stats.heavyCount}</div>
                </div>
                <div className="fs-stat-card">
                  <div className="fs-label">Saved routes</div>
                  <div className="mt-2 font-headline text-4xl font-black tracking-[-0.08em] text-primary-container">{stats.savedRouteCount}</div>
                </div>
              </div>
            </div>

            <div className="xl:sticky xl:top-4 xl:self-start">
              <OperationsDock onRouteReady={setRouteCoords} lastAlert={lastAlert} impactedRouteIds={impactedRouteIds} />
            </div>
          </div>
        </main>
      </div>

      <MobileBottomNav activeItem="map" />
    </div>
  )
}