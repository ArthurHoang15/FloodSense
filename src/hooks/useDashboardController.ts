import { useEffect, useMemo, useState } from 'react'
import { useFloodStore } from '@/stores/floodStore'
import { useRouteCheckStore } from '@/stores/routeCheckStore'
import { useSavedRoutesStore } from '@/stores/savedRoutesStore'
import { useSettingsStore } from '@/stores/settingsStore'
import { useInterval } from '@/hooks/useInterval'
import { compareFloodPriority, buildFloodNarrative, formatTimestamp, severityHeadline } from '@/utils/floodPresentation'
import { useFloodAlerts } from '@/hooks/useFloodAlerts'
import type { FloodEvent, LatLng } from '../../shared/types'

function buildFeedItems(floods: FloodEvent[]) {
  return floods.slice(0, 3).map((flood) => ({
    id: flood.id,
    time: formatTimestamp(flood.last_confirmed_at),
    tone: severityHeadline(flood.severity),
    headline: `${flood.street_name} in ${flood.district}`,
    body: buildFloodNarrative(flood),
    severity: flood.severity,
  }))
}

export function useDashboardController() {
  const { fetchFloods, simulating, stepSimulation } = useFloodStore()
  const floods = useFloodStore((state) => state.displayFloods())
  const { routes } = useSavedRoutesStore()
  const routeData = useRouteCheckStore((state) => state.data)
  const { voiceEnabled, voiceVariant, notificationsEnabled } = useSettingsStore()

  const [routeCoords, setRouteCoords] = useState<LatLng[] | null>(null)

  useEffect(() => {
    fetchFloods().catch(() => {})
  }, [fetchFloods])

  useEffect(() => {
    if (routeData?.route?.coords?.length) {
      setRouteCoords(routeData.route.coords)
    }
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
  const feedItems = useMemo(() => buildFeedItems(prioritizedFloods), [prioritizedFloods])
  const stats = useMemo(
    () => ({
      floodCount: floods.length,
      heavyCount: floods.filter((flood) => flood.severity === 'heavy').length,
      savedRouteCount: routes.length,
    }),
    [floods, routes],
  )

  const { lastAlert, impactedRouteIds } = useFloodAlerts(floods, routes, notificationsEnabled)

  return {
    floods,
    routeCoords,
    setRouteCoords,
    routeData,
    simulating,
    voiceEnabled,
    voiceVariant,
    notificationsEnabled,
    routes,
    headlineFlood,
    telemetry,
    feedItems,
    stats,
    lastAlert,
    impactedRouteIds,
  }
}

export type DashboardController = ReturnType<typeof useDashboardController>