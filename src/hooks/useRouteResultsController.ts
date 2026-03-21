import { useEffect, useMemo, useState } from 'react'
import { useFloodStore } from '@/stores/floodStore'
import { useRouteCheckStore } from '@/stores/routeCheckStore'
import { useSavedRoutesStore } from '@/stores/savedRoutesStore'
import { compareFloodPriority } from '@/utils/floodPresentation'
import { estimateRouteMinutes, getImpactedRouteIds } from '@/utils/routeInsights'
import type { LatLng } from '../../shared/types'

export function useRouteResultsController() {
  const { fetchFloods, simulating, startSimulateRain } = useFloodStore()
  const floods = useFloodStore((state) => state.displayFloods())
  const routeData = useRouteCheckStore((state) => state.data)
  const routeLoading = useRouteCheckStore((state) => state.loading)
  const routes = useSavedRoutesStore((state) => state.routes)
  const loadRoutes = useSavedRoutesStore((state) => state.loadRoutes)

  const [routeCoords, setRouteCoords] = useState<LatLng[] | null>(routeData?.route.coords ?? null)

  useEffect(() => {
    fetchFloods().catch(() => {})
    loadRoutes().catch(() => {})
  }, [fetchFloods, loadRoutes])

  useEffect(() => {
    if (routeData?.route.coords?.length) {
      setRouteCoords(routeData.route.coords)
    }
  }, [routeData])

  const prioritizedFloods = useMemo(() => [...floods].sort(compareFloodPriority), [floods])
  const headlineFlood = prioritizedFloods[0] ?? null
  const telemetry = prioritizedFloods.slice(0, 3)
  const impactedRouteIds = useMemo(() => getImpactedRouteIds(floods, routes), [floods, routes])

  const resultSummary = useMemo(() => {
    if (!routeData) {
      return {
        overlapCount: 0,
        warningCount: 0,
        routePoints: 0,
        etaMinutes: 0,
      }
    }

    return {
      overlapCount: routeData.floodZones.length,
      warningCount: routeData.warnings.length,
      routePoints: routeData.route.coords.length,
      etaMinutes: estimateRouteMinutes({
        id: 'preview',
        name: 'Preview route',
        origin: routeData.route.coords[0] ?? { lat: 0, lng: 0 },
        destination: routeData.route.coords[routeData.route.coords.length - 1] ?? { lat: 0, lng: 0 },
        route_coords: routeData.route.coords,
        bounding_box: routeData.route.bounding_box,
        notify_enabled: false,
        created_at: new Date(0).toISOString(),
      }),
    }
  }, [routeData])

  return {
    floods,
    headlineFlood,
    heavyCount: floods.filter((flood) => flood.severity === 'heavy').length,
    routeData,
    routeCoords,
    routeLoading,
    setRouteCoords,
    routes,
    impactedRouteIds,
    telemetry,
    simulating,
    refreshFloods: fetchFloods,
    runSimulation: startSimulateRain,
    resultSummary,
  }
}

export type RouteResultsController = ReturnType<typeof useRouteResultsController>