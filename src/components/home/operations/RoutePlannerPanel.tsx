import { useMemo, useState } from 'react'
import { AlertTriangle, Route, Save, Volume2, VolumeX } from 'lucide-react'
import SurfaceCard from '@/components/ui/SurfaceCard'
import SeverityBadge from '@/components/ui/SeverityBadge'
import { useRouteCheckStore } from '@/stores/routeCheckStore'
import { useSettingsStore, type VoiceVariant } from '@/stores/settingsStore'
import { useSavedRoutesStore } from '@/stores/savedRoutesStore'
import { speak } from '@/utils/voice'
import type { SavedRoute } from '../../../../shared/types'

type Props = {
  onRouteReady: (coords: { lat: number; lng: number }[]) => void
}

export default function RoutePlannerPanel({ onRouteReady }: Props) {
  const [origin, setOrigin] = useState('Q7')
  const [destination, setDestination] = useState('Tân Bình')
  const [routeName, setRouteName] = useState('Home → Work')

  const { loading, error, data, checkRoute } = useRouteCheckStore()
  const { voiceEnabled, voiceVariant, setVoiceEnabled, setVoiceVariant } = useSettingsStore()
  const { addRoute } = useSavedRoutesStore()

  const affectedCount = data?.floodZones.length ?? 0
  const canSave = !!data && data.route.coords.length > 1

  const banner = useMemo(() => {
    if (!data) return null
    if (affectedCount === 0) {
      return {
        tone: 'safe' as const,
        text: 'No active flood intersection detected for this route.',
      }
    }
    return {
      tone: 'risk' as const,
      text: `Route intersects ${affectedCount} active flood zone(s).`,
    }
  }, [data, affectedCount])

  async function onSubmit() {
    const response = await checkRoute(origin, destination)
    if (!response) return
    onRouteReady(response.route.coords)

    if (voiceEnabled && response.alertText) {
      void speak(response.alertText, voiceVariant)
    }
  }

  function onSave() {
    if (!data) return

    const route: SavedRoute = {
      id: crypto.randomUUID(),
      name: routeName.trim() || 'Saved route',
      origin: { ...data.route.coords[0], address: origin },
      destination: {
        ...data.route.coords[data.route.coords.length - 1],
        address: destination,
      },
      route_coords: data.route.coords,
      bounding_box: data.route.bounding_box,
      notify_enabled: true,
      created_at: new Date().toISOString(),
    }

    void addRoute(route)
  }

  return (
    <SurfaceCard className="p-5">
      <div className="flex items-center justify-between gap-3">
        <div>
          <div className="fs-label">Route intelligence</div>
          <div className="mt-2 flex items-center gap-2 font-headline text-xl font-bold tracking-[-0.05em] text-on-surface">
            <Route className="h-5 w-5 text-primary" />
            Route Check
          </div>
        </div>
        <button type="button" onClick={() => setVoiceEnabled(!voiceEnabled)} className="fs-button-secondary px-3 py-2 text-xs">
          {voiceEnabled ? <Volume2 className="h-4 w-4" /> : <VolumeX className="h-4 w-4" />}
          Voice
        </button>
      </div>

      <div className="mt-5 grid gap-4">
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-1 2xl:grid-cols-2">
          <div>
            <label className="fs-label">Origin</label>
            <input value={origin} onChange={(event) => setOrigin(event.target.value)} className="fs-input mt-2" placeholder="e.g. Q7" />
          </div>
          <div>
            <label className="fs-label">Destination</label>
            <input value={destination} onChange={(event) => setDestination(event.target.value)} className="fs-input mt-2" placeholder="e.g. Tân Bình" />
          </div>
        </div>

        <div className="rounded-2xl border border-outline-variant/15 bg-surface-container px-4 py-3">
          <div className="flex items-center justify-between gap-3">
            <span className="text-xs text-on-surface-variant">Voice variant</span>
            <select
              value={voiceVariant}
              onChange={(event) => setVoiceVariant(event.target.value as VoiceVariant)}
              className="rounded-xl border border-outline-variant/20 bg-surface-container-low px-3 py-2 text-xs text-on-surface focus:border-primary-container focus:outline-none"
              disabled={!voiceEnabled}
            >
              <option value="female_south">Female (South)</option>
              <option value="male_north">Male (North)</option>
            </select>
          </div>
        </div>

        <button type="button" onClick={onSubmit} disabled={loading} className="fs-button-primary w-full">
          <AlertTriangle className="h-4 w-4" />
          <span>{loading ? 'Checking route' : 'Check flood risk'}</span>
        </button>

        {error ? <div className="rounded-2xl border border-error/20 bg-error-container/20 px-4 py-3 text-sm text-error">{error}</div> : null}

        {banner ? (
          <div className={banner.tone === 'safe' ? 'rounded-2xl border border-primary-container/20 bg-primary-container/10 px-4 py-3 text-sm text-primary' : 'rounded-2xl border border-secondary-container/25 bg-secondary-container/12 px-4 py-3 text-sm text-secondary'}>
            {banner.text}
          </div>
        ) : null}

        {data?.warnings?.length ? (
          <div className="grid gap-2 rounded-2xl border border-outline-variant/15 bg-surface-container p-4 text-sm text-on-surface-variant">
            {data.warnings.map((warning) => (
              <div key={warning}>{warning}</div>
            ))}
          </div>
        ) : null}

        {affectedCount > 0 ? (
          <div className="rounded-2xl border border-outline-variant/15 bg-surface-container p-4">
            <div className="text-sm font-semibold text-on-surface">Flood zones on route</div>
            <div className="mt-3 grid gap-3">
              {data?.floodZones.slice(0, 5).map((zone) => (
                <div key={zone.id} className="flex items-center justify-between gap-3 rounded-2xl bg-surface-container-low px-3 py-3">
                  <div className="min-w-0">
                    <div className="truncate text-sm text-on-surface">{zone.street_name}</div>
                    <div className="mt-1 truncate text-xs text-on-surface-variant">{zone.district}</div>
                  </div>
                  <SeverityBadge severity={zone.severity} />
                </div>
              ))}
            </div>
          </div>
        ) : null}

        <div className="rounded-2xl border border-outline-variant/15 bg-surface-container p-4">
          <div className="fs-label">Save route</div>
          <div className="mt-3 flex flex-col gap-3 2xl:flex-row">
            <input value={routeName} onChange={(event) => setRouteName(event.target.value)} className="fs-input" placeholder="Route name" />
            <button type="button" onClick={onSave} disabled={!canSave} className="fs-button-secondary whitespace-nowrap">
              <Save className="h-4 w-4" />
              Save route
            </button>
          </div>
        </div>
      </div>
    </SurfaceCard>
  )
}