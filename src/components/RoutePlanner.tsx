import { useMemo, useState } from 'react'
import { AlertTriangle, Route, Save, Volume2, VolumeX } from 'lucide-react'
import { useRouteCheckStore } from '@/stores/routeCheckStore'
import { useSettingsStore, type VoiceVariant } from '@/stores/settingsStore'
import { useSavedRoutesStore } from '@/stores/savedRoutesStore'
import { speak } from '@/utils/voice'
import type { SavedRoute } from '../../shared/types'

type Props = {
  onRouteReady: (coords: { lat: number; lng: number }[]) => void
}

function severityBadge(severity: string) {
  const base = 'inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium'
  if (severity === 'heavy') return `${base} bg-red-500/15 text-red-300 border border-red-500/30`
  if (severity === 'moderate') return `${base} bg-orange-500/15 text-orange-300 border border-orange-500/30`
  if (severity === 'light') return `${base} bg-yellow-500/15 text-yellow-200 border border-yellow-500/30`
  return `${base} bg-zinc-700/30 text-zinc-200 border border-zinc-700`
}

export default function RoutePlanner({ onRouteReady }: Props) {
  const [origin, setOrigin] = useState('Q7')
  const [destination, setDestination] = useState('Tân Bình')
  const [routeName, setRouteName] = useState('Home → Work')

  const { loading, error, data, checkRoute } = useRouteCheckStore()
  const { voiceEnabled, voiceVariant, setVoiceEnabled, setVoiceVariant } = useSettingsStore()
  const { addRoute } = useSavedRoutesStore()

  const affectedCount = data?.floodZones.length ?? 0
  const canSave = !!data && data.route.coords.length > 1

  const primaryBanner = useMemo(() => {
    if (!data) return null
    if (affectedCount === 0) return { tone: 'ok' as const, text: 'No flood zones detected (mock check).' }
    return { tone: 'warn' as const, text: `Route intersects ${affectedCount} flood zone(s).` }
  }, [data, affectedCount])

  async function onSubmit() {
    const res = await checkRoute(origin, destination)
    if (!res) return
    onRouteReady(res.route.coords)
    if (voiceEnabled && res.alertText) {
      speak(res.alertText, voiceVariant)
    }
  }

  function onSave() {
    if (!data) return
    const now = new Date().toISOString()
    const r: SavedRoute = {
      id: crypto.randomUUID(),
      name: routeName.trim() || 'Saved route',
      origin: { ...data.route.coords[0], address: origin },
      destination: { ...data.route.coords[data.route.coords.length - 1], address: destination },
      route_coords: data.route.coords,
      bounding_box: data.route.bounding_box,
      notify_enabled: true,
      created_at: now,
    }
    addRoute(r)
  }

  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-950 p-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Route className="h-4 w-4 text-zinc-300" />
          <div className="text-sm font-medium text-zinc-100">Route Check</div>
        </div>
        <button
          type="button"
          onClick={() => setVoiceEnabled(!voiceEnabled)}
          className="inline-flex items-center gap-2 rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-1.5 text-xs text-zinc-200 hover:bg-zinc-800"
        >
          {voiceEnabled ? <Volume2 className="h-4 w-4" /> : <VolumeX className="h-4 w-4" />}
          <span>Voice</span>
        </button>
      </div>

      <div className="mt-4 grid gap-3">
        <div className="flex items-center justify-between rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-2">
          <div className="text-xs text-zinc-300">Voice variant</div>
          <select
            value={voiceVariant}
            onChange={(e) => setVoiceVariant(e.target.value as VoiceVariant)}
            className="rounded-md border border-zinc-800 bg-zinc-950 px-2 py-1 text-xs text-zinc-200 focus:outline-none"
            disabled={!voiceEnabled}
          >
            <option value="female_south">Female (South)</option>
            <option value="male_north">Male (North)</option>
          </select>
        </div>
        <div>
          <div className="text-xs text-zinc-400">Origin</div>
          <input
            value={origin}
            onChange={(e) => setOrigin(e.target.value)}
            placeholder="e.g. Q7"
            className="mt-1 w-full rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-sky-500/30"
          />
        </div>
        <div>
          <div className="text-xs text-zinc-400">Destination</div>
          <input
            value={destination}
            onChange={(e) => setDestination(e.target.value)}
            placeholder="e.g. Tân Bình"
            className="mt-1 w-full rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-sky-500/30"
          />
        </div>
        <button
          type="button"
          onClick={onSubmit}
          disabled={loading}
          className="inline-flex items-center justify-center gap-2 rounded-lg bg-sky-500 px-3 py-2 text-sm font-medium text-zinc-950 hover:bg-sky-400 disabled:cursor-not-allowed disabled:opacity-70"
        >
          <AlertTriangle className="h-4 w-4" />
          <span>{loading ? 'Checking…' : 'Check Flood Risk'}</span>
        </button>

        {error ? <div className="text-xs text-red-300">{error}</div> : null}

        {primaryBanner ? (
          <div
            className={
              primaryBanner.tone === 'ok'
                ? 'rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-xs text-emerald-200'
                : 'rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-200'
            }
          >
            {primaryBanner.text}
          </div>
        ) : null}

        {data?.warnings?.length ? (
          <div className="grid gap-1 text-xs text-zinc-300">
            {data.warnings.map((w) => (
              <div key={w} className="opacity-90">
                {w}
              </div>
            ))}
          </div>
        ) : null}

        {affectedCount > 0 ? (
          <div className="rounded-lg border border-zinc-800 bg-zinc-900 p-3">
            <div className="text-xs font-medium text-zinc-200">Flood zones</div>
            <div className="mt-2 grid gap-2">
              {data?.floodZones.slice(0, 6).map((z) => (
                <div key={z.id} className="flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <div className="truncate text-xs text-zinc-100">{z.street_name}</div>
                    <div className="truncate text-[11px] text-zinc-400">{z.district}</div>
                  </div>
                  <span className={severityBadge(z.severity)}>{z.severity}</span>
                </div>
              ))}
            </div>
          </div>
        ) : null}

        <div className="border-t border-zinc-800 pt-3">
          <div className="text-xs text-zinc-400">Save route</div>
          <div className="mt-2 flex gap-2">
            <input
              value={routeName}
              onChange={(e) => setRouteName(e.target.value)}
              placeholder="Route name"
              className="w-full rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-sky-500/30"
            />
            <button
              type="button"
              onClick={onSave}
              disabled={!canSave}
              className="inline-flex items-center gap-2 rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-2 text-sm text-zinc-200 hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <Save className="h-4 w-4" />
              <span>Save</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
