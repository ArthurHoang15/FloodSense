import { Bell, BellOff, Trash2 } from 'lucide-react'
import SurfaceCard from '@/components/ui/SurfaceCard'
import { useSavedRoutesStore } from '@/stores/savedRoutesStore'

type Props = {
  impactedRouteIds: string[]
}

export default function SavedRoutesPanel({ impactedRouteIds }: Props) {
  const { routes, removeRoute, toggleNotify } = useSavedRoutesStore()

  return (
    <SurfaceCard className="p-5">
      <div className="flex items-center justify-between gap-3">
        <div>
          <div className="fs-label">Saved routes</div>
          <div className="mt-2 font-headline text-xl font-bold tracking-[-0.05em] text-on-surface">Proactive alerts</div>
        </div>
        <div className="rounded-full bg-primary-container/12 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-primary">
          {routes.length} routes
        </div>
      </div>

      {routes.length === 0 ? (
        <div className="mt-4 rounded-2xl border border-outline-variant/15 bg-surface-container p-4 text-sm text-on-surface-variant">
          No saved routes yet. Check a route first, then save it for proactive flood alerts.
        </div>
      ) : (
        <div className="fs-scrollbar mt-5 grid max-h-[260px] gap-3 overflow-y-auto pr-1">
          {routes.slice(0, 8).map((route) => {
            const impacted = impactedRouteIds.includes(route.id)
            return (
              <div key={route.id} className={impacted ? 'rounded-2xl border border-error/20 bg-error-container/18 p-4' : 'rounded-2xl border border-outline-variant/15 bg-surface-container p-4'}>
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="truncate text-sm font-semibold text-on-surface">{route.name}</div>
                    <div className="mt-1 truncate text-xs text-on-surface-variant">
                      {route.origin.address ?? 'Origin'} to {route.destination.address ?? 'Destination'}
                    </div>
                    {impacted ? <div className="mt-2 text-xs text-error">Active flood overlap detected</div> : null}
                  </div>
                  <div className="flex items-center gap-2">
                    <button type="button" onClick={() => toggleNotify(route.id)} className="fs-icon-button h-9 w-9">
                      {route.notify_enabled ? <Bell className="h-4 w-4" /> : <BellOff className="h-4 w-4" />}
                    </button>
                    <button type="button" onClick={() => removeRoute(route.id)} className="fs-icon-button h-9 w-9">
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </SurfaceCard>
  )
}
