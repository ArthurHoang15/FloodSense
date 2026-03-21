import { useEffect, useMemo, useState } from 'react'
import { useFloodStore } from '@/stores/floodStore'
import { useSavedRoutesStore } from '@/stores/savedRoutesStore'
import { useSettingsStore } from '@/stores/settingsStore'
import { useInterval } from '@/hooks/useInterval'
import { compareFloodPriority, formatDepth } from '@/utils/floodPresentation'
import { estimateRouteMinutes, getImpactedRouteIds } from '@/utils/routeInsights'
import { apiGet } from '@/utils/api'
import type { FloodEvent, SavedRoute, Severity } from '../../shared/types'

type WeatherAlert = {
  probability: number
  time: string | null
  message: string
}

type WeatherHourly = {
  time: string
  precipitation_probability: number
  rain_mm: number
}

type WeatherResponse = {
  success: boolean
  hourly: WeatherHourly[]
  alert: WeatherAlert | null
}

type Hotspot = {
  id: string
  name: string
  depthLabel: string
  depthCm: number
  severity: Severity
  widthPercent: number
}

type SavedRouteInsight = {
  id: string
  name: string
  subtitle: string
  status: 'clear' | 'clogged'
  etaLabel: string
  kind: 'home' | 'school' | 'route'
}

type HistoryBar = {
  day: string
  heightPercent: number
  tone: 'muted' | 'primary' | 'secondary'
  highlighted: boolean
}

function toHotspots(floods: FloodEvent[]): Hotspot[] {
  const prioritized = [...floods].sort(compareFloodPriority).slice(0, 5)
  const maxDepth = Math.max(...prioritized.map((flood) => flood.depth_cm ?? 12), 12)

  return prioritized.map((flood) => {
    const depth = flood.depth_cm ?? 12
    return {
      id: flood.id,
      name: flood.street_name,
      depthLabel: `${depth}cm depth`,
      depthCm: depth,
      severity: flood.severity,
      widthPercent: Math.max(28, Math.round((depth / maxDepth) * 92)),
    }
  })
}

function toSavedRouteInsights(routes: SavedRoute[], impactedRouteIds: string[]): SavedRouteInsight[] {
  return routes.slice(0, 3).map((route, index) => {
    const impacted = impactedRouteIds.includes(route.id)
    const eta = estimateRouteMinutes(route)
    const lowerName = route.name.toLowerCase()
    const kind: SavedRouteInsight['kind'] = lowerName.includes('school') ? 'school' : lowerName.includes('home') ? 'home' : 'route'

    return {
      id: route.id,
      name: route.name,
      subtitle: `${route.origin.address ?? 'Origin'} to ${route.destination.address ?? 'Destination'}`,
      status: impacted ? 'clogged' : 'clear',
      etaLabel: impacted ? `${eta + 12} mins` : `${eta} mins`,
      kind: index === 0 ? 'home' : kind,
    }
  })
}

function toHistoryBars(floods: FloodEvent[]): HistoryBar[] {
  const total = floods.length
  const heavy = floods.filter((flood) => flood.severity === 'heavy').length
  const moderate = floods.filter((flood) => flood.severity === 'moderate').length
  const pattern = [
    Math.max(18, total * 4),
    Math.max(32, moderate * 14),
    Math.max(52, heavy * 20 + 24),
    Math.max(14, Math.round(total * 2.5)),
    Math.max(26, Math.round(moderate * 8)),
    Math.max(40, Math.round((heavy + moderate) * 10)),
    Math.max(24, Math.round(total * 3)),
  ]

  return ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN'].map((day, index) => ({
    day,
    heightPercent: Math.min(88, pattern[index]),
    tone: index === 2 ? 'primary' : index === 5 ? 'secondary' : 'muted',
    highlighted: index === 2,
  }))
}

function buildWeatherMetrics(hourly: WeatherHourly[]) {
  const highestProbability = hourly.reduce((current, item) => Math.max(current, item.precipitation_probability), 0)
  const peakRain = hourly.reduce((current, item) => Math.max(current, item.rain_mm), 0)

  return {
    humidityLabel: `${Math.min(98, highestProbability + 12)}%`,
    windLabel: `${Math.max(8, Math.round(peakRain * 3 + 8))}km/h`,
  }
}

export function useIntelligenceController() {
  const { fetchFloods, startSimulateRain } = useFloodStore()
  const floods = useFloodStore((state) => state.displayFloods())
  const simulating = useFloodStore((state) => state.simulating)
  const { routes, loadRoutes } = useSavedRoutesStore()
  const voiceEnabled = useSettingsStore((state) => state.voiceEnabled)

  const [weatherAlert, setWeatherAlert] = useState<WeatherAlert | null>(null)
  const [weatherHourly, setWeatherHourly] = useState<WeatherHourly[]>([])

  useEffect(() => {
    fetchFloods().catch(() => {})
    loadRoutes().catch(() => {})
    apiGet<WeatherResponse>('/api/weather/forecast')
      .then((response) => {
        setWeatherAlert(response.alert)
        setWeatherHourly(response.hourly ?? [])
      })
      .catch(() => {})
  }, [fetchFloods, loadRoutes])

  useInterval(() => {
    fetchFloods().catch(() => {})
  }, 60_000)

  const impactedRouteIds = useMemo(() => getImpactedRouteIds(floods, routes), [floods, routes])
  const hotspots = useMemo(() => toHotspots(floods), [floods])
  const savedRouteInsights = useMemo(() => toSavedRouteInsights(routes, impactedRouteIds), [impactedRouteIds, routes])
  const historyBars = useMemo(() => toHistoryBars(floods), [floods])
  const weatherMetrics = useMemo(() => buildWeatherMetrics(weatherHourly), [weatherHourly])
  const maxRainStart = weatherAlert?.time
    ? new Date(weatherAlert.time).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
    : '18:00'

  return {
    floods,
    simulating,
    weatherAlert,
    weatherMetrics,
    maxRainStart,
    hotspots,
    savedRouteInsights,
    historyBars,
    savedRouteCount: routes.length,
    voiceEnabled,
    refreshFloods: () => fetchFloods(),
    runSimulation: () => startSimulateRain(),
  }
}

export type IntelligenceController = ReturnType<typeof useIntelligenceController>