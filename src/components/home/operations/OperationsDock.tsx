import { CloudRain, RefreshCw, RotateCcw } from 'lucide-react'
import SurfaceCard from '@/components/ui/SurfaceCard'
import { useFloodStore } from '@/stores/floodStore'
import NotificationsPanel from '@/components/home/operations/NotificationsPanel'
import RoutePlannerPanel from '@/components/home/operations/RoutePlannerPanel'
import SavedRoutesPanel from '@/components/home/operations/SavedRoutesPanel'

type Props = {
  onRouteReady: (coords: { lat: number; lng: number }[]) => void
  lastAlert: { title: string; body: string } | null
  impactedRouteIds: string[]
}

export default function OperationsDock({ onRouteReady, lastAlert, impactedRouteIds }: Props) {
  const { simulating, startSimulateRain, resetSimulated, fetchFloods } = useFloodStore()

  return (
    <div className="relative z-20 mt-6 grid gap-4 xl:absolute xl:right-6 xl:top-6 xl:mt-0 xl:max-h-[calc(100%-7rem)] xl:w-[420px] xl:overflow-y-auto xl:pr-1">
      <RoutePlannerPanel onRouteReady={onRouteReady} />
      <SurfaceCard className="p-5">
        <div className="fs-label">Demo controls</div>
        <div className="mt-2 font-headline text-xl font-bold tracking-[-0.05em] text-on-surface">Simulation</div>
        <div className="mt-5 grid gap-3">
          <button type="button" onClick={() => startSimulateRain()} disabled={simulating} className="fs-button-primary w-full">
            <CloudRain className="h-4 w-4" />
            <span>{simulating ? 'Simulating rain' : 'Simulate heavy rain'}</span>
          </button>
          <div className="grid gap-3 md:grid-cols-2">
            <button type="button" onClick={() => resetSimulated()} className="fs-button-secondary w-full">
              <RotateCcw className="h-4 w-4" />
              Reset
            </button>
            <button type="button" onClick={() => fetchFloods()} className="fs-button-secondary w-full">
              <RefreshCw className="h-4 w-4" />
              Refresh
            </button>
          </div>
        </div>
      </SurfaceCard>
      <NotificationsPanel lastAlert={lastAlert} />
      <SavedRoutesPanel impactedRouteIds={impactedRouteIds} />
    </div>
  )
}