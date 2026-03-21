import { BarChart3, CloudRain, Route, Waves } from 'lucide-react'
import { Link } from 'react-router-dom'
import SurfaceCard from '@/components/ui/SurfaceCard'
import SeverityBadge from '@/components/ui/SeverityBadge'
import { formatDepth, formatTimestamp } from '@/utils/floodPresentation'
import type { FloodEvent } from '../../../../shared/types'

type RailItemId = 'flood-feed' | 'route-results' | 'analytics' | 'simulate'

type Props = {
  telemetry: FloodEvent[]
  onSimulate: () => void
  onRefresh: () => void
  simulating: boolean
  activeItem?: RailItemId
}

const railItems = [
  { id: 'flood-feed' as const, label: 'Flood Feed', icon: Waves, to: '/' },
  { id: 'route-results' as const, label: 'Route Results', icon: Route, to: '/route-results' },
  { id: 'analytics' as const, label: 'Analytics', icon: BarChart3, to: '/intelligence' },
  { id: 'simulate' as const, label: 'Simulate', icon: CloudRain },
]

export default function NavigationRail({ telemetry, onSimulate, onRefresh, simulating, activeItem = 'flood-feed' }: Props) {
  return (
    <aside className="hidden h-screen w-[320px] shrink-0 px-4 py-4 xl:sticky xl:top-0 xl:flex">
      <SurfaceCard className="flex h-full flex-col p-4">
        <Link to="/" className="rounded-3xl bg-surface-container-low px-4 py-4 transition hover:bg-surface-container">
          <div className="font-headline text-2xl font-black tracking-[-0.08em] text-primary-container">FloodSense HCM</div>
          <div className="fs-kicker mt-2">Luminous flood intelligence for Ho Chi Minh City</div>
        </Link>

        <div className="mt-6 grid gap-2">
          {railItems.map((item) => (
            item.to ? (
            <Link
              key={item.label}
              to={item.to}
              className={item.id === activeItem ? 'flex items-center gap-3 rounded-2xl bg-surface-container-highest px-4 py-3 text-primary shadow-ambient' : 'flex items-center gap-3 rounded-2xl px-4 py-3 text-on-surface-variant transition hover:bg-surface-container-lowest hover:text-on-surface'}
            >
              <item.icon className="h-4 w-4" />
              <span className="text-sm font-medium">{item.label}</span>
            </Link>
            ) : (
            <div
              key={item.label}
              className={item.id === activeItem ? 'flex items-center gap-3 rounded-2xl bg-surface-container-highest px-4 py-3 text-primary shadow-ambient' : 'flex items-center gap-3 rounded-2xl px-4 py-3 text-on-surface-variant transition hover:bg-surface-container-lowest hover:text-on-surface'}
            >
              <item.icon className="h-4 w-4" />
              <span className="text-sm font-medium">{item.label}</span>
            </div>
            )
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