import { Clock3, Route } from 'lucide-react'
import SurfaceCard from '@/components/ui/SurfaceCard'
import type { RouteCheckHistoryEntry } from '../../../shared/types'

type Props = {
  items: RouteCheckHistoryEntry[]
}

function riskTone(risk: RouteCheckHistoryEntry['risk_level']) {
  if (risk === 'high') return 'text-error'
  if (risk === 'medium') return 'text-secondary'
  if (risk === 'low') return 'text-primary'
  return 'text-on-surface-variant'
}

export default function RouteCheckHistoryCard({ items }: Props) {
  return (
    <SurfaceCard className="min-w-0 max-w-full overflow-x-hidden p-5 md:p-6">
      <div className="flex items-center gap-3">
        <div className="rounded-2xl bg-primary-container/14 p-3 text-primary">
          <Clock3 className="h-5 w-5" />
        </div>
        <div>
          <div className="fs-label">Route history</div>
          <div className="mt-1 font-headline text-xl font-bold tracking-[-0.05em] text-on-surface">Recent route checks</div>
        </div>
      </div>

      {items.length === 0 ? (
        <div className="mt-5 rounded-3xl bg-surface-container-low px-5 py-8 text-sm leading-6 text-on-surface-variant">
          Recent route checks will appear here after you preview or validate a route.
        </div>
      ) : (
        <div className="mt-5 grid min-w-0 gap-3">
          {items.slice(0, 6).map((item) => (
            <div key={item.id} className="min-w-0 rounded-3xl bg-surface-container-low px-4 py-4">
              <div className="flex min-w-0 flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex min-w-0 items-start gap-2 text-sm text-on-surface">
                    <Route className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                    <div className="min-w-0">
                      <div className="break-words">{item.origin_label}</div>
                      <div className="mt-1 text-xs uppercase tracking-[0.16em] text-on-surface-variant">to</div>
                      <div className="mt-1 break-words">{item.destination_label}</div>
                    </div>
                  </div>
                  <div className="mt-2 text-xs text-on-surface-variant">
                    {new Date(item.checked_at).toLocaleString('en-GB', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
                  </div>
                </div>
                <div className={`shrink-0 text-xs font-semibold uppercase tracking-[0.16em] ${riskTone(item.risk_level)}`}>{item.risk_level}</div>
              </div>

              <div className="mt-3 flex flex-wrap gap-2 text-xs text-on-surface-variant">
                <div className="rounded-full bg-surface px-3 py-1">{item.confirmed_flood_count} confirmed</div>
                <div className="rounded-full bg-surface px-3 py-1">{item.forecast_flood_count} forecast</div>
                <div className="rounded-full bg-surface px-3 py-1">{item.has_alternative_route ? 'safe route found' : 'no detour'}</div>
              </div>
            </div>
          ))}
        </div>
      )}
    </SurfaceCard>
  )
}
