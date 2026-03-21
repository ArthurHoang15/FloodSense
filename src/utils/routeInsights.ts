import { haversineMeters } from '@/utils/geo'
import type { FloodEvent, SavedRoute } from '../../shared/types'

export function floodHitsRoute(flood: FloodEvent, route: SavedRoute) {
  const floodPoint = { lat: flood.coordinates.lat, lng: flood.coordinates.lng }
  for (const coordinate of route.route_coords) {
    if (haversineMeters(floodPoint, coordinate) <= 200) {
      return true
    }
  }
  return false
}

export function getImpactedRouteIds(floods: FloodEvent[], routes: SavedRoute[]) {
  const impacted = new Set<string>()

  for (const route of routes) {
    if (!route.notify_enabled) continue
    for (const flood of floods) {
      if (floodHitsRoute(flood, route)) {
        impacted.add(route.id)
        break
      }
    }
  }

  return [...impacted]
}

export function estimateRouteMinutes(route: SavedRoute) {
  if (route.route_coords.length < 2) return 0

  let meters = 0
  for (let index = 1; index < route.route_coords.length; index += 1) {
    meters += haversineMeters(route.route_coords[index - 1], route.route_coords[index])
  }

  const averageCitySpeedMetersPerMinute = 450
  return Math.max(8, Math.round(meters / averageCitySpeedMetersPerMinute))
}