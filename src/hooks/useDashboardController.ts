import { useEffect, useMemo, useState } from 'react'
import { useFloodStore } from '@/stores/floodStore'
import { useRouteCheckStore } from '@/stores/routeCheckStore'
import { useSavedRoutesStore } from '@/stores/savedRoutesStore'
import { useSettingsStore } from '@/stores/settingsStore'
import { useInterval } from '@/hooks/useInterval'
import { compareFloodPriority, buildFloodNarrative, formatTimestamp, severityHeadline } from '@/utils/floodPresentation'
import { useFloodAlerts } from '@/hooks/useFloodAlerts'
import { apiGet } from '@/utils/api'
import type { AddressSuggestion, FloodEvent, LatLng } from '../../shared/types'

export type SharedRouteSearchState = {
  originQuery: string
  setOriginQuery: (value: string) => void
  destinationQuery: string
  setDestinationQuery: (value: string) => void
  originSelection: AddressSuggestion | null
  setOriginSelection: (value: AddressSuggestion | null) => void
  destinationSelection: AddressSuggestion | null
  setDestinationSelection: (value: AddressSuggestion | null) => void
}

type WeatherAlert = {
  probability: number
  time: string | null
  severity?: 'low' | 'medium' | 'high'
  message: string
}

type FeedItem = {
  id: string
  time: string
  tone: string
  headline: string
  body: string
  severity: FloodEvent['severity']
  kind: 'flood' | 'forecast'
}

function getTopDistricts(floods: FloodEvent[], limit = 2): string[] {
  const counts = new Map<string, number>()
  for (const flood of floods) {
    counts.set(flood.district, (counts.get(flood.district) ?? 0) + 1)
  }

  return [...counts.entries()]
    .sort((left, right) => right[1] - left[1])
    .slice(0, limit)
    .map(([district]) => district)
}

function buildWeatherAreaLabel(floods: FloodEvent[]) {
  const districts = getTopDistricts(floods)
  if (districts.length === 0) {
    return 'HCMC-wide monitoring'
  }
  if (districts.length === 1) {
    return districts[0]
  }
  return `${districts[0]} + ${districts[1]}`
}

function buildFeedItems(floods: FloodEvent[], weatherAlert: WeatherAlert | null): FeedItem[] {
  const items: FeedItem[] = []

  const confirmedFloods = floods.filter((f) => !f.is_forecast)
  const forecastFloods = floods.filter((f) => f.is_forecast)

  const prioritized = [...confirmedFloods].sort((a, b) => {
    const sev = { heavy: 3, moderate: 2, light: 1 } as const
    return (sev[b.severity] ?? 0) - (sev[a.severity] ?? 0)
  })

  for (const flood of prioritized.slice(0, 2)) {
    items.push({
      id: flood.id,
      time: formatTimestamp(flood.last_confirmed_at),
      tone: severityHeadline(flood.severity),
      headline: `${flood.street_name} - ${flood.district}`,
      body: buildFloodNarrative(flood),
      severity: flood.severity,
      kind: 'flood',
    })
  }

  if (forecastFloods.length > 0) {
    const top = forecastFloods[0]
    items.push({
      id: `forecast-${top.id}`,
      time: formatTimestamp(top.forecast_valid_until ?? top.expires_at),
      tone: 'Forecast',
      headline: `Forecast - ${top.district}`,
      body: `Expected flood risk with forecast severity ${top.severity}.`,
      severity: top.severity,
      kind: 'forecast',
    })
  }

  if (weatherAlert) {
    const areaLabel = buildWeatherAreaLabel(confirmedFloods)
    items.push({
      id: 'weather-alert',
      time: weatherAlert.time ? formatTimestamp(weatherAlert.time) : 'Now',
      tone: 'Forecast',
      headline: `Heavy rain watch for ${areaLabel}`,
      body: areaLabel === 'HCMC-wide monitoring'
        ? weatherAlert.message
        : `${weatherAlert.message} Focus area: ${areaLabel}.`,
      severity: weatherAlert.severity === 'high' ? 'heavy' : weatherAlert.severity === 'medium' ? 'moderate' : 'light',
      kind: 'forecast',
    })
  }

  return items.slice(0, 4)
}

export function useDashboardController() {
  const { fetchFloods, simulating, stepSimulation } = useFloodStore()
  const floods = useFloodStore((state) => state.displayFloods())
  const { routes, loadRoutes } = useSavedRoutesStore()
  const routeData = useRouteCheckStore((state) => state.data)
  const { voiceEnabled, voiceVariant, notificationsEnabled } = useSettingsStore()

  const [routeCoords, setRouteCoords] = useState<LatLng[] | null>(null)
  const [altRouteCoords, setAltRouteCoords] = useState<LatLng[] | null>(null)
  const [mapSearchLocation, setMapSearchLocation] = useState<AddressSuggestion | null>(null)
  const [originQuery, setOriginQuery] = useState('')
  const [destinationQuery, setDestinationQuery] = useState('')
  const [originSelection, setOriginSelection] = useState<AddressSuggestion | null>(null)
  const [destinationSelection, setDestinationSelection] = useState<AddressSuggestion | null>(null)
  const [weatherAlert, setWeatherAlert] = useState<WeatherAlert | null>(null)

  useEffect(() => {
    fetchFloods().catch(() => {})
    loadRoutes().catch(() => {})

    apiGet<{ success: boolean; alert: WeatherAlert | null }>('/api/weather/forecast')
      .then((response) => {
        if (response.alert) {
          setWeatherAlert(response.alert)
        }
      })
      .catch(() => {})
  }, [fetchFloods, loadRoutes])

  useEffect(() => {
    if (routeData?.route?.coords?.length) {
      setRouteCoords(routeData.route.coords)
    }
    setAltRouteCoords(routeData?.alternativeRoute?.coords ?? null)
  }, [routeData])

  useInterval(() => {
    fetchFloods().catch(() => {})
  }, 60_000)

  useInterval(
    () => {
      stepSimulation()
    },
    simulating ? 1500 : null,
  )

  const prioritizedFloods = useMemo(() => [...floods].sort(compareFloodPriority), [floods])
  const headlineFlood = prioritizedFloods[0] ?? null
  const telemetry = prioritizedFloods.slice(0, 3)
  const feedItems = useMemo(() => buildFeedItems(prioritizedFloods, weatherAlert), [prioritizedFloods, weatherAlert])
  const weatherFocusLabel = useMemo(() => buildWeatherAreaLabel(prioritizedFloods.filter((f) => !f.is_forecast)), [prioritizedFloods])
  const stats = useMemo(
    () => ({
      floodCount: floods.length,
      heavyCount: floods.filter((flood) => flood.severity === 'heavy').length,
      savedRouteCount: routes.length,
    }),
    [floods, routes],
  )

  const { lastAlert, impactedRouteIds } = useFloodAlerts(floods, routes, notificationsEnabled)

  const routeSearch = useMemo<SharedRouteSearchState>(
    () => ({
      originQuery,
      setOriginQuery,
      destinationQuery,
      setDestinationQuery,
      originSelection,
      setOriginSelection,
      destinationSelection,
      setDestinationSelection,
    }),
    [destinationQuery, destinationSelection, originQuery, originSelection],
  )

  return {
    floods,
    routeCoords,
    setRouteCoords,
    altRouteCoords,
    setAltRouteCoords,
    mapSearchLocation,
    setMapSearchLocation,
    routeData,
    simulating,
    voiceEnabled,
    voiceVariant,
    notificationsEnabled,
    routes,
    routeSearch,
    headlineFlood,
    telemetry,
    feedItems,
    weatherFocusLabel,
    stats,
    lastAlert,
    impactedRouteIds,
    weatherAlert,
  }
}

export type DashboardController = ReturnType<typeof useDashboardController>
