import { Bell, BellOff, Trash2 } from 'lucide-react'
import { useSavedRoutesStore } from '@/stores/savedRoutesStore'

export default function SavedRoutesPanel() {
  const { routes, removeRoute, toggleNotify } = useSavedRoutesStore()

  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-950 p-4">
      <div className="text-sm font-medium text-zinc-100">Saved Routes</div>
      {routes.length === 0 ? (
        <div className="mt-3 text-xs text-zinc-400">No saved routes yet. Save one after route check.</div>
      ) : (
        <div className="mt-3 grid gap-2">
          {routes.slice(0, 10).map((r) => (
            <div key={r.id} className="rounded-lg border border-zinc-800 bg-zinc-900 p-3">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="truncate text-sm text-zinc-100">{r.name}</div>
                  <div className="mt-0.5 truncate text-xs text-zinc-400">
                    {r.origin.address ?? 'Origin'} → {r.destination.address ?? 'Destination'}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => toggleNotify(r.id)}
                    className="inline-flex items-center gap-2 rounded-lg border border-zinc-800 bg-zinc-950 px-2.5 py-1.5 text-xs text-zinc-200 hover:bg-zinc-800"
                    title={r.notify_enabled ? 'Disable notifications' : 'Enable notifications'}
                  >
                    {r.notify_enabled ? <Bell className="h-4 w-4" /> : <BellOff className="h-4 w-4" />}
                  </button>
                  <button
                    type="button"
                    onClick={() => removeRoute(r.id)}
                    className="inline-flex items-center gap-2 rounded-lg border border-zinc-800 bg-zinc-950 px-2.5 py-1.5 text-xs text-zinc-200 hover:bg-zinc-800"
                    title="Remove"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
