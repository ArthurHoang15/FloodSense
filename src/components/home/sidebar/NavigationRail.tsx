import { BarChart3, CloudRain, Radar, Route, Waves } from 'lucide-react'
import SurfaceCard from '@/components/ui/SurfaceCard'
import SeverityBadge from '@/components/ui/SeverityBadge'
import { formatDepth, formatTimestamp } from '@/utils/floodPresentation'
import type { FloodEvent } from '../../../../shared/types'

type Props = {
  telemetry: FloodEvent[]
  onSimulate: () => void
  onRefresh: () => void
  simulating: boolean
}

const railItems = [
  { label: 'Flood Feed', icon: Waves, active: true },
  { label: 'Route Results', icon: Route, active: false },
  { label: 'Analytics', icon: BarChart3, active: false },
  { label: 'Simulate', icon: CloudRain, active: false },
]

export default function NavigationRail({ telemetry, onSimulate, onRefresh, simulating }: Props) {
  return (
    <aside className="hidden w-[320px] flex-col gap-4 px-4 pb-6 pt-24 xl:flex">
      <SurfaceCard className="flex h-full flex-col p-4">
        <div className="flex items-center gap-3 px-2 pb-2">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-primary-container/15 text-primary-container">
            <Radar className="h-5 w-5" />
          </div>
          <div>
            <div className="font-headline text-base font-bold uppercase tracking-[-0.06em] text-primary">Intelligence</div>
            <div className="fs-kicker mt-1">HCM live telemetry</div>
          </div>
        </div>

        <div className="mt-3 grid gap-2">
          {railItems.map((item) => (
            <div
              key={item.label}
              className={item.active ? 'flex items-center gap-3 rounded-2xl bg-surface-container-highest px-4 py-3 text-primary shadow-ambient' : 'flex items-center gap-3 rounded-2xl px-4 py-3 text-on-surface-variant transition hover:bg-surface-container-lowest hover:text-on-surface'}
            >
              <item.icon className="h-4 w-4" />
              <span className="text-sm font-medium">{item.label}</span>
            </div>
          ))}
        </div>

        <div className="mt-8 flex-1 border-t border-outline-variant/10 pt-4">
          <div className="fs-label px-2">Active telemetry</div>
          <div className="fs-scrollbar mt-4 grid max-h-[360px] gap-3 overflow-y-auto pr-1">
            {telemetry.map((event) => (
              <div key={event.id} className="rounded-3xl border border-outline-variant/10 bg-surface-container p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="text-xs font-semibold text-on-surface">{event.street_name}</div>
                    <div className="mt-1 text-xs text-on-surface-variant">{event.district}</div>
                  </div>
                  <SeverityBadge severity={event.severity} />
                </div>
                <div className="mt-4 flex items-end gap-2">
                  <span className="font-headline text-3xl font-black tracking-[-0.08em] text-primary">{formatDepth(event.depth_cm)}</span>
                </div>
                <div className="mt-2 text-[11px] text-on-surface-variant">Updated {formatTimestamp(event.last_confirmed_at)}</div>
              </div>
            ))}
          </div>
        </div>

        <div className="mt-4 space-y-3 border-t border-outline-variant/10 pt-4">
          <button type="button" onClick={onSimulate} disabled={simulating} className="fs-button-primary w-full">
            <CloudRain className="h-4 w-4" />
            <span>{simulating ? 'Simulating Rain' : 'Simulate Rain'}</span>
          </button>
          <button type="button" onClick={onRefresh} className="fs-button-secondary w-full">
            Refresh live floods
          </button>
        </div>
      </SurfaceCard>
    </aside>
  )
}