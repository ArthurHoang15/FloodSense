import { useEffect, useMemo, useState } from 'react'
import { useFloodStore } from '@/stores/floodStore'
import { useSavedRoutesStore } from '@/stores/savedRoutesStore'
import { useSettingsStore } from '@/stores/settingsStore'
import { useInterval } from '@/hooks/useInterval'
import { compareFloodPriority } from '@/utils/floodPresentation'
import { estimateRouteMinutes, floodHitsRoute, getImpactedRouteIds } from '@/utils/routeInsights'
import { apiGet } from '@/utils/api'
import type { FloodEvent, FloodSourceType, SavedRoute, Severity } from '../../shared/types'

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

type IntelligenceMetric = {
  label: string
  value: string
}

type CrowdsourceInsight = {
  title: string
  description: string
  primaryMetric: IntelligenceMetric
  secondaryMetric: IntelligenceMetric
  districtLabel: string
  overviewItems: Array<{
    label: string
    value: string
    emphasis: 'primary' | 'secondary' | 'muted'
  }>
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
    const lowerOrigin = route.origin.address?.toLowerCase() ?? ''
    const lowerDestination = route.destination.address?.toLowerCase() ?? ''
    const kind: SavedRouteInsight['kind'] =
      lowerName.includes('school') || lowerOrigin.includes('school') || lowerDestination.includes('school')
        ? 'school'
        : lowerName.includes('home') || lowerOrigin.includes('home') || lowerDestination.includes('home')
          ? 'home'
          : 'route'
    const dynamicDelay = impacted ? Math.min(18, Math.max(4, (index + 1) * 4)) : 0

    return {
      id: route.id,
      name: route.name,
      subtitle: `${route.origin.address ?? 'Origin'} to ${route.destination.address ?? 'Destination'}`,
      status: impacted ? 'clogged' : 'clear',
      etaLabel: impacted ? `${eta + dynamicDelay} mins` : `${eta} mins`,
      kind,
    }
  })
}

function toHistoryBars(floods: FloodEvent[]): HistoryBar[] {
  const now = new Date()
  const dayBuckets = Array.from({ length: 7 }, (_, offset) => {
    const date = new Date(now)
    date.setHours(0, 0, 0, 0)
    date.setDate(date.getDate() - (6 - offset))
    return {
      key: date.toISOString().slice(0, 10),
      date,
      count: 0,
    }
  })

  const byDay = new Map(dayBuckets.map((bucket) => [bucket.key, bucket]))

  for (const flood of floods) {
    const key = new Date(flood.last_confirmed_at).toISOString().slice(0, 10)
    const bucket = byDay.get(key)
    if (bucket) {
      bucket.count += 1
    }
  }

  const maxCount = Math.max(...dayBuckets.map((bucket) => bucket.count), 0)
  const peakIndex = dayBuckets.findIndex((bucket) => bucket.count === maxCount && maxCount > 0)
  const todayKey = new Date(now).toISOString().slice(0, 10)

  return dayBuckets.map((bucket, index) => ({
    day: bucket.date.toLocaleDateString('en-GB', { weekday: 'short' }).toUpperCase(),
    heightPercent: maxCount === 0 ? 16 : Math.max(16, Math.round((bucket.count / maxCount) * 88)),
    tone: bucket.key === todayKey ? 'secondary' : index === peakIndex ? 'primary' : 'muted',
    highlighted: index === peakIndex,
  }))
}

function buildWeatherMetrics(hourly: WeatherHourly[]) {
  const highestProbability = hourly.reduce((current, item) => Math.max(current, item.precipitation_probability), 0)
  const peakRain = hourly.reduce((current, item) => Math.max(current, item.rain_mm), 0)

  return {
    highestProbability,
    peakRain,
    primaryMetric: {
      label: 'Rain chance',
      value: `${highestProbability}%`,
    },
    secondaryMetric: {
      label: 'Peak rain',
      value: `${peakRain.toFixed(1)} mm`,
    },
  }
}

function getTopDistricts(floods: FloodEvent[], limit = 2): string[] {
  const counts = new Map<string, number>()
  for (const flood of floods) {
    counts.set(flood.district, (counts.get(flood.district) ?? 0) + 1)
  }
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([district]) => district)
}

function buildWeatherCopy(hourly: WeatherHourly[], floods: FloodEvent[], weatherAlert: WeatherAlert | null) {
  const topDistricts = getTopDistricts(floods)
  const peakSlot = [...hourly].sort((a, b) => b.precipitation_probability - a.precipitation_probability)[0]
  const formattedPeakTime = peakSlot
    ? new Date(peakSlot.time).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
    : null

  if (weatherAlert) {
    const focusedArea = topDistricts.length > 0 ? topDistricts.join(' and ') : 'HCMC-wide monitoring'
    return {
      title: weatherAlert.probability >= 70 ? `Heavy Precipitation Near ${focusedArea}` : `Rain Watch Near ${focusedArea}`,
      description:
        topDistricts.length > 0
          ? `${weatherAlert.message} Priority monitoring is currently centered on ${focusedArea}.`
          : weatherAlert.message,
    }
  }

  if (peakSlot && peakSlot.precipitation_probability >= 40) {
    return {
      title: 'Rain Watch Active',
      description:
        topDistricts.length > 0
          ? `Rain probability peaks around ${formattedPeakTime}. Monitoring ${topDistricts.join(' and ')} where active flood signals remain concentrated.`
          : `Rain probability peaks around ${formattedPeakTime}. The next six hours remain under active monitoring.`,
    }
  }

  if (floods.length > 0) {
    return {
      title: 'Flood Signals Stabilising',
      description:
        topDistricts.length > 0
          ? `${floods.length} active flood events remain visible, led by ${topDistricts.join(' and ')}. No major rain spike is forecast in the immediate window.`
          : `${floods.length} active flood events remain visible. No major rain spike is forecast in the immediate window.`,
    }
  }

  return {
    title: 'Conditions Stable',
    description: 'No critical precipitation spike is forecast in the next six hours, and no active flood hotspots are currently being tracked.',
  }
}

function countSourcesByType(floods: FloodEvent[]) {
  const counts = new Map<FloodSourceType, number>()
  for (const flood of floods) {
    for (const source of flood.sources) {
      counts.set(source.source_type, (counts.get(source.source_type) ?? 0) + 1)
    }
  }
  return counts
}

function buildCrowdsourceInsight(
  floods: FloodEvent[],
  routes: SavedRoute[],
  impactedRouteIds: string[],
  weatherAlert: WeatherAlert | null,
): CrowdsourceInsight {
  const sourceCounts = countSourcesByType(floods)
  const fieldSignals = (sourceCounts.get('user_report') ?? 0) + (sourceCounts.get('social') ?? 0)
  const verifiedEvents = floods.filter((flood) => flood.confidence === 'high' || flood.sources.length > 0).length
  const strongestDistrict = getTopDistricts(floods, 1)[0] ?? 'Citywide monitoring'
  const telemetrySignals = (sourceCounts.get('vetc_mock') ?? 0) + (sourceCounts.get('government') ?? 0) + (sourceCounts.get('news') ?? 0)
  const routeExposure = routes.length === 0 ? 'No saved routes' : `${impactedRouteIds.length}/${routes.length} routes`
  const signalCoverage = `${fieldSignals + telemetrySignals} live sources`
  const watchState = weatherAlert ? `${weatherAlert.probability}% rain watch` : 'No active watch'

  if (floods.length === 0) {
    return {
      title: 'Signal Intake Idle',
      description: 'No active flood events are currently in rotation, so intelligence signals are standing by for the next telemetry or field update.',
      primaryMetric: { label: 'Verified events', value: '0' },
      secondaryMetric: { label: 'Source signals', value: '0' },
      districtLabel: 'Citywide monitoring',
      overviewItems: [
        { label: 'Focus area', value: 'Standby', emphasis: 'muted' },
        { label: 'Route exposure', value: routeExposure, emphasis: 'muted' },
        { label: 'Weather watch', value: watchState, emphasis: 'secondary' },
      ],
    }
  }

  return {
    title: fieldSignals > 0 ? 'Crowd Signals In Flow' : 'Confidence Signals In Flow',
    description:
      fieldSignals > 0
        ? `${fieldSignals} field-origin signals are reinforcing active flood tracking. ${strongestDistrict} currently carries the densest concentration of incidents.`
        : `${verifiedEvents} active events are being tracked from telemetry and published sources. ${strongestDistrict} currently shows the heaviest concentration.`,
    primaryMetric: { label: 'Verified events', value: String(verifiedEvents) },
    secondaryMetric: { label: 'Source signals', value: String(fieldSignals + telemetrySignals) },
    districtLabel: `${strongestDistrict} focus`,
    overviewItems: [
      { label: 'Focus area', value: strongestDistrict, emphasis: 'primary' },
      { label: 'Route exposure', value: routeExposure, emphasis: impactedRouteIds.length > 0 ? 'secondary' : 'muted' },
      { label: 'Signal coverage', value: signalCoverage, emphasis: 'muted' },
    ],
  }
}

function buildHistorySummary(floods: FloodEvent[]) {
  if (floods.length === 0) {
    return 'No flood confirmations have been logged in the visible seven-day window.'
  }

  const counts = new Map<string, number>()
  for (const flood of floods) {
    const day = new Date(flood.last_confirmed_at).toLocaleDateString('en-GB', { weekday: 'short' }).toUpperCase()
    counts.set(day, (counts.get(day) ?? 0) + 1)
  }

  const [peakDay, peakCount] = [...counts.entries()].sort((a, b) => b[1] - a[1])[0]
  return `${floods.length} active events remain visible. The busiest confirmation window landed on ${peakDay} with ${peakCount} tracked updates.`
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
  const weatherCopy = useMemo(() => buildWeatherCopy(weatherHourly, floods, weatherAlert), [floods, weatherAlert, weatherHourly])
  const crowdsourceInsight = useMemo(
    () => buildCrowdsourceInsight(floods, routes, impactedRouteIds, weatherAlert),
    [floods, impactedRouteIds, routes, weatherAlert],
  )
  const historySummary = useMemo(() => buildHistorySummary(floods), [floods])

  return {
    floods,
    simulating,
    weatherAlert,
    weatherTitle: weatherCopy.title,
    weatherDescription: weatherCopy.description,
    weatherPrimaryMetric: weatherMetrics.primaryMetric,
    weatherSecondaryMetric: weatherMetrics.secondaryMetric,
    hotspots,
    crowdsourceInsight,
    savedRouteInsights,
    historyBars,
    historySummary,
    savedRouteCount: routes.length,
    voiceEnabled,
    refreshFloods: () => fetchFloods(),
    runSimulation: () => startSimulateRain(),
  }
}

export type IntelligenceController = ReturnType<typeof useIntelligenceController>