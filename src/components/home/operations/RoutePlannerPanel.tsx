import { useMemo, useState } from 'react'
import { AlertTriangle, Route, Save, Shield, Volume2, VolumeX } from 'lucide-react'
import { Link } from 'react-router-dom'
import AddressAutocompleteInput from '@/components/ui/AddressAutocompleteInput'
import SurfaceCard from '@/components/ui/SurfaceCard'
import SeverityBadge from '@/components/ui/SeverityBadge'
import { cn } from '@/lib/utils'
import { useRouteCheckStore } from '@/stores/routeCheckStore'
import { useSettingsStore, type VoiceVariant } from '@/stores/settingsStore'
import { useSavedRoutesStore } from '@/stores/savedRoutesStore'
import { buildRouteVoiceMessage, speak } from '@/utils/voice'
import type { SharedRouteSearchState } from '@/hooks/useDashboardController'
import type { AddressSuggestion, SavedRoute } from '../../../../shared/types'

type Props = {
  onRouteReady: (coords: { lat: number; lng: number }[]) => void
  onUseSafeRoute?: () => void
  safeRouteSelected?: boolean
  mode?: 'compact' | 'page'
  className?: string
  sharedSearch?: SharedRouteSearchState
}

function isForecastWarning(warning: string) {
  return warning.startsWith('Forecast:') || warning.startsWith('Expected flood risk')
}

export default function RoutePlannerPanel({ onRouteReady, onUseSafeRoute, safeRouteSelected = false, mode = 'compact', className, sharedSearch }: Props) {
  const [origin, setOrigin] = useState('')
  const [destination, setDestination] = useState('')
  const [originSelection, setOriginSelection] = useState<AddressSuggestion | null>(null)
  const [destinationSelection, setDestinationSelection] = useState<AddressSuggestion | null>(null)
  const [routeName, setRouteName] = useState('Home to Work')

  const { loading, error, data, checkRoute } = useRouteCheckStore()
  const { voiceEnabled, voiceVariant, setVoiceEnabled, setVoiceVariant } = useSettingsStore()
  const { addRoute } = useSavedRoutesStore()

  const affectedCount = data?.floodZones.length ?? 0
  const forecastAffectedCount = data?.forecast?.dataPoints.forecastFloodsOnRoute ?? 0
  const totalRiskCount = affectedCount + forecastAffectedCount
  const canSave = !!data && data.route.coords.length > 1
  const isPageMode = mode === 'page'
  const usesSharedSearch = !isPageMode && !!sharedSearch

  const activeOrigin = sharedSearch?.originQuery ?? origin
  const activeDestination = sharedSearch?.destinationQuery ?? destination
  const activeOriginSelection = sharedSearch?.originSelection ?? originSelection
  const activeDestinationSelection = sharedSearch?.destinationSelection ?? destinationSelection
  const routeStatusText = data
    ? affectedCount === 0
      ? 'Clear route'
      : `${affectedCount} flood zone${affectedCount > 1 ? 's' : ''} on route`
    : 'Awaiting check'

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
    const response = await checkRoute(
      activeOriginSelection
        ? { ...activeOriginSelection.coordinates, address: activeOriginSelection.label }
        : activeOrigin,
      activeDestinationSelection
        ? { ...activeDestinationSelection.coordinates, address: activeDestinationSelection.label }
        : activeDestination,
    )
    if (!response) return
    onRouteReady(response.route.coords)

    if (voiceEnabled) {
      void speak(buildRouteVoiceMessage(response), voiceVariant)
    }
  }

  function onSave() {
    if (!data) return

    const route: SavedRoute = {
      id: crypto.randomUUID(),
      name: routeName.trim() || 'Saved route',
      origin: { ...data.route.coords[0], address: activeOriginSelection?.label ?? activeOrigin },
      destination: {
        ...data.route.coords[data.route.coords.length - 1],
        address: activeDestinationSelection?.label ?? activeDestination,
      },
      route_coords: data.route.coords,
      bounding_box: data.route.bounding_box,
      notify_enabled: true,
      created_at: new Date().toISOString(),
    }

    void addRoute(route)
  }

  return (
    <SurfaceCard className={cn(isPageMode ? 'min-w-0 max-w-full overflow-x-hidden p-0' : 'min-w-0 max-w-full overflow-x-hidden p-5', className)}>
      <div className={cn(isPageMode ? 'border-b border-outline-variant/12 bg-surface-container-low px-5 py-5 md:px-6' : '')}>
        <div className="flex min-w-0 flex-wrap items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <div className="fs-label">Route intelligence</div>
            <div className="mt-2 flex flex-wrap items-center gap-3">
              <div className="min-w-0 flex items-center gap-2 font-headline text-xl font-bold tracking-[-0.05em] text-on-surface">
                <Route className="h-5 w-5 text-primary" />
                Route Check
              </div>
              <div className="max-w-full break-words rounded-full border border-outline-variant/15 bg-surface-container-high px-3 py-1 text-xs font-medium text-on-surface-variant">
                {routeStatusText}
              </div>
            </div>
            {isPageMode ? (
              <p className="mt-2 max-w-2xl break-words text-sm leading-6 text-on-surface-variant">
                Search an origin and destination, review risk on the map, then switch to the safer route if one is available.
              </p>
            ) : null}
          </div>
          <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto sm:justify-end">
            {!isPageMode ? (
              <Link to="/route-results" className="fs-button-secondary px-3 py-2 text-xs">
                Open page
              </Link>
            ) : null}
            <button
              type="button"
              onClick={() => setVoiceEnabled(!voiceEnabled)}
              className={cn(
                'rounded-2xl px-3 py-2 text-xs font-medium transition',
                voiceEnabled
                  ? 'border border-primary/20 bg-primary/12 text-primary hover:bg-primary/18'
                  : 'border border-outline-variant/15 bg-surface-container-highest/70 text-on-surface-variant hover:bg-surface-container-highest',
              )}
            >
              <span className="inline-flex items-center gap-2">
                {voiceEnabled ? <Volume2 className="h-4 w-4" /> : <VolumeX className="h-4 w-4" />}
                {voiceEnabled ? 'Voice on' : 'Voice off'}
              </span>
            </button>
          </div>
        </div>
      </div>

      <div className={cn('grid min-w-0 gap-4', isPageMode ? 'px-5 py-5 md:px-6' : 'mt-5')}>
        {usesSharedSearch ? (
          <div className="min-w-0 rounded-3xl border border-outline-variant/12 bg-surface-container-low p-4">
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <div className="fs-label">Using map search</div>
                <div className="mt-1 break-words text-sm text-on-surface-variant">Route intelligence is using the same origin and destination selected in the map search bar.</div>
              </div>
            </div>
            <div className="mt-4 grid gap-3">
              <div className="min-w-0 rounded-2xl border border-outline-variant/10 bg-surface px-4 py-3">
                <div className="fs-kicker">Origin</div>
                <div className="mt-1 break-words text-sm text-on-surface">{activeOrigin || 'Select an origin in the map search bar.'}</div>
              </div>
              <div className="min-w-0 rounded-2xl border border-outline-variant/10 bg-surface px-4 py-3">
                <div className="fs-kicker">Destination</div>
                <div className="mt-1 break-words text-sm text-on-surface">{activeDestination || 'Select a destination in the map search bar.'}</div>
              </div>
            </div>
          </div>
        ) : (
          <div className={isPageMode ? 'grid min-w-0 gap-4 rounded-3xl border border-outline-variant/12 bg-surface-container-low p-4 xl:grid-cols-2' : 'grid min-w-0 gap-4 md:grid-cols-2 xl:grid-cols-1 2xl:grid-cols-2'}>
            <AddressAutocompleteInput
              label="Origin"
              value={origin}
              selected={originSelection}
              onValueChange={setOrigin}
              onSelect={(suggestion) => {
                setOriginSelection(suggestion)
                setOrigin(suggestion.label)
              }}
              onClearSelection={() => setOriginSelection(null)}
              placeholder="Search a real origin address"
              className={isPageMode ? 'rounded-2xl bg-surface px-4 py-4' : undefined}
              panelClassName="border-outline-variant/10 bg-surface-container-high/95"
            />
            <AddressAutocompleteInput
              label="Destination"
              value={destination}
              selected={destinationSelection}
              onValueChange={setDestination}
              onSelect={(suggestion) => {
                setDestinationSelection(suggestion)
                setDestination(suggestion.label)
              }}
              onClearSelection={() => setDestinationSelection(null)}
              placeholder="Search a real destination address"
              className={isPageMode ? 'rounded-2xl bg-surface px-4 py-4' : undefined}
              panelClassName="border-outline-variant/10 bg-surface-container-high/95"
            />
          </div>
        )}

        <div className={cn('grid min-w-0 gap-3', isPageMode ? 'md:grid-cols-[minmax(0,1fr)_220px]' : '')}>
          <button type="button" onClick={onSubmit} disabled={loading || !activeOrigin.trim() || !activeDestination.trim()} className="fs-button-primary w-full">
            <AlertTriangle className="h-4 w-4" />
            <span className="min-w-0 break-words text-center">{loading ? 'Checking route' : 'Check flood risk'}</span>
          </button>

          <div className="min-w-0 rounded-2xl border border-outline-variant/12 bg-surface-container-low px-4 py-3">
            <div className="flex min-w-0 flex-wrap items-center justify-between gap-3">
              <span className="text-xs text-on-surface-variant">Voice variant</span>
              <select
                value={voiceVariant}
                onChange={(event) => setVoiceVariant(event.target.value as VoiceVariant)}
                className="rounded-xl border border-outline-variant/20 bg-surface px-3 py-2 text-xs text-on-surface focus:border-primary-container focus:outline-none"
                disabled={!voiceEnabled}
              >
                <option value="female_south">Female (South)</option>
                <option value="male_north">Male (North)</option>
              </select>
            </div>
          </div>
        </div>

        {error ? <div className="rounded-2xl border border-error/20 bg-error-container/20 px-4 py-3 text-sm text-error">{error}</div> : null}

        {banner ? (
          <div className={cn('break-words rounded-2xl px-4 py-3 text-sm font-medium', banner.tone === 'safe' ? 'border border-primary-container/20 bg-primary-container/10 text-primary' : 'border border-secondary-container/25 bg-secondary-container/12 text-secondary')}>
            {banner.text}
          </div>
        ) : null}

        {data?.warnings?.filter((w) => !isForecastWarning(w)).length ? (
          <div className="grid min-w-0 gap-2 rounded-2xl border border-outline-variant/12 bg-surface-container-low p-4 text-sm text-on-surface-variant">
            {data.warnings
              .filter((w) => !isForecastWarning(w))
              .map((w) => (
                <div key={w} className="break-words rounded-xl bg-surface px-3 py-2">
                  Warning: {w}
                </div>
              ))}
          </div>
        ) : null}

        {data?.warnings?.filter((w) => isForecastWarning(w)).length ? (
          <div className="rounded-2xl border border-amber-500/30 bg-amber-500/10 p-4">
            <div className="mb-2 text-xs font-semibold text-amber-400">Forecast alerts</div>
            {data.warnings
              .filter((w) => isForecastWarning(w))
              .map((w) => (
                <div key={w} className="break-words text-xs text-amber-300/90">{w}</div>
              ))}
          </div>
        ) : null}

        {data?.alternativeRoute ? (
          <div className="min-w-0 rounded-2xl border border-[#4ade80]/25 bg-[#4ade80]/8 p-4">
            <div className="flex items-center gap-2">
              <Shield className="h-4 w-4 text-[#4ade80]" />
              <span className="text-sm font-semibold text-[#4ade80]">{safeRouteSelected ? 'Safe route selected' : 'Safe alternative available'}</span>
            </div>
            <div className="mt-2 break-words text-sm text-on-surface-variant">
              Avoids {Math.max(0, totalRiskCount - (data.alternativeRoute.floodZones?.length ?? 0))} flood risk point(s). Orange shows the previous route and green shows the safer option on the map.
            </div>
            <button
              type="button"
              onClick={() => {
                if (onUseSafeRoute) {
                  onUseSafeRoute()
                  return
                }
                onRouteReady(data.alternativeRoute!.coords)
              }}
              disabled={safeRouteSelected}
              className="mt-3 w-full max-w-full rounded-xl border border-[#4ade80]/30 bg-[#4ade80]/15 px-4 py-2.5 text-sm font-medium text-[#4ade80] transition-colors hover:bg-[#4ade80]/25"
            >
              {safeRouteSelected ? 'Safe route active' : 'Switch to safe route'}
            </button>
          </div>
        ) : null}

        {affectedCount > 0 && !isPageMode ? (
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

        <div className="min-w-0 rounded-2xl border border-outline-variant/12 bg-surface-container-low p-4">
          <div className="fs-label">Save route</div>
          <div className="mt-1 break-words text-sm text-on-surface-variant">Store the checked path so it can be monitored from the saved routes list.</div>
          <div className={isPageMode ? 'mt-3 grid gap-3 xl:grid-cols-[minmax(0,1fr)_auto]' : 'mt-3 flex flex-col gap-3 2xl:flex-row'}>
            <input value={routeName} onChange={(event) => setRouteName(event.target.value)} className="min-w-0 fs-input" placeholder="Route name" />
            <button type="button" onClick={onSave} disabled={!canSave} className="fs-button-secondary max-w-full">
              <Save className="h-4 w-4" />
              Save route
            </button>
          </div>
        </div>
      </div>
    </SurfaceCard>
  )
}
