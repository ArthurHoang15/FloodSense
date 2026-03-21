import express, { type Request, type Response } from 'express'
import type { FloodStore } from '../_lib/mockData.js'
import { getFloods } from '../_lib/mockData.js'
import type { FloodEvent, LatLng, RouteCheckHistoryEntry, RouteCheckRequest, RouteCheckResponse, RouteForecastHistoryContext } from '../../shared/types.js'
import { bboxFromCoords, haversineMeters, interpolateLine, computeBearing } from '../_lib/geo.js'
import { getDrivingRoute, getRouteAlternatives } from '../_lib/directions.js'
import { geocode, mockGeocode } from '../_lib/geocode.js'
import supabase, { toFloodEvent } from '../_lib/supabase.js'
import { fetchEnrichedWeather } from '../_lib/weatherEnrich.js'
import { generateRouteForecast } from '../_lib/routeForecast.js'

const RADIUS_METERS = 200

function isLiveMode() {
  return process.env.DATA_MODE === 'live'
}

function getAnonId(req: Request): string | null {
  return (req.headers['x-anonymous-id'] as string) || null
}

function asLatLng(input: unknown): LatLng | null {
  if (!input || typeof input !== 'object') return null
  const v = input as { lat?: unknown; lng?: unknown }
  const lat = typeof v.lat === 'number' ? v.lat : Number(v.lat)
  const lng = typeof v.lng === 'number' ? v.lng : Number(v.lng)
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null
  return { lat, lng }
}

async function resolveLocation(input: RouteCheckRequest['origin']): Promise<LatLng | null> {
  if (typeof input === 'string') {
    return isLiveMode() ? geocode(input) : mockGeocode(input)
  }
  const ll = asLatLng(input)
  if (ll) return ll
  const addr = (input as { address?: unknown })?.address
  if (typeof addr === 'string') {
    return isLiveMode() ? geocode(addr) : mockGeocode(addr)
  }
  return null
}

function pickSeverityWord(count: number): string {
  if (count >= 3) return 'high'
  if (count >= 1) return 'medium'
  return 'low'
}

function formatLocationLabel(input: RouteCheckRequest['origin']): string {
  if (typeof input === 'string') return input
  if (typeof input.address === 'string' && input.address.trim()) return input.address
  return `${input.lat}, ${input.lng}`
}

async function buildRouteCoords(origin: LatLng, destination: LatLng): Promise<LatLng[]> {
  const mapboxRoute = await getDrivingRoute(origin, destination)
  if (mapboxRoute && mapboxRoute.length > 1) {
    return mapboxRoute
  }
  console.warn('[route-check] Directions API failed, falling back to straight-line interpolation')
  return interpolateLine(origin, destination, 40)
}

function buildHistoryContext(
  history: RouteCheckHistoryEntry[],
  originLabel: string,
  destinationLabel: string,
): RouteForecastHistoryContext {
  const normalizedOrigin = originLabel.trim().toLowerCase()
  const normalizedDestination = destinationLabel.trim().toLowerCase()
  const sameCorridor = history.filter(
    (entry) =>
      entry.origin_label.trim().toLowerCase() === normalizedOrigin &&
      entry.destination_label.trim().toLowerCase() === normalizedDestination,
  )
  const sameCorridorHighRiskCount = sameCorridor.filter((entry) => entry.risk_level === 'high').length
  const sameCorridorAlternativeCount = sameCorridor.filter((entry) => entry.has_alternative_route).length

  return {
    recentChecks: history.length,
    sameCorridorChecks: sameCorridor.length,
    sameCorridorHighRiskCount,
    sameCorridorAlternativeRate: sameCorridor.length > 0 ? sameCorridorAlternativeCount / sameCorridor.length : 0,
    recentRiskLevels: history.slice(0, 5).map((entry) => entry.risk_level ?? 'unknown'),
  }
}

function countFloodIntersections(coords: LatLng[], floods: FloodEvent[]): FloodEvent[] {
  return floods.filter((flood) => {
    for (const coord of coords) {
      if (haversineMeters(flood.coordinates, coord) <= RADIUS_METERS) return true
    }
    return false
  })
}

function rankRouteRisk(confirmedHits: FloodEvent[], forecastHits: FloodEvent[]) {
  return {
    confirmedHits,
    forecastHits,
    floodZones: [...confirmedHits, ...forecastHits],
    score: confirmedHits.length * 100 + forecastHits.length * 10,
  }
}

function computeFloodCentroid(floods: FloodEvent[]): LatLng {
  let totalLat = 0
  let totalLng = 0
  for (const flood of floods) {
    totalLat += flood.coordinates.lat
    totalLng += flood.coordinates.lng
  }
  return { lat: totalLat / floods.length, lng: totalLng / floods.length }
}

function offsetPoint(point: LatLng, bearingDeg: number, distanceMeters: number): LatLng {
  const R = 6371000
  const toRad = (deg: number) => (deg * Math.PI) / 180
  const toDeg = (rad: number) => (rad * 180) / Math.PI
  const lat1 = toRad(point.lat)
  const lng1 = toRad(point.lng)
  const bearing = toRad(bearingDeg)
  const d = distanceMeters / R

  const lat2 = Math.asin(Math.sin(lat1) * Math.cos(d) + Math.cos(lat1) * Math.sin(d) * Math.cos(bearing))
  const lng2 = lng1 + Math.atan2(Math.sin(bearing) * Math.sin(d) * Math.cos(lat1), Math.cos(d) - Math.sin(lat1) * Math.sin(lat2))

  return { lat: toDeg(lat2), lng: toDeg(lng2) }
}

async function findSafeAlternative(
  origin: LatLng,
  destination: LatLng,
  confirmedFloods: FloodEvent[],
  forecastFloods: FloodEvent[],
  currentRisk: ReturnType<typeof rankRouteRisk>,
): Promise<{ coords: LatLng[]; floodZones: FloodEvent[] } | null> {
  const alternatives = await getRouteAlternatives(origin, destination)
  if (alternatives && alternatives.length > 1) {
    let bestRoute: LatLng[] | null = null
    let bestRisk = currentRisk
    for (const alt of alternatives) {
      const risk = rankRouteRisk(countFloodIntersections(alt, confirmedFloods), countFloodIntersections(alt, forecastFloods))
      if (risk.score < bestRisk.score || (risk.score === bestRisk.score && risk.floodZones.length < bestRisk.floodZones.length)) {
        bestRisk = risk
        bestRoute = alt
      }
    }
    if (bestRoute && (bestRisk.score < currentRisk.score || bestRisk.floodZones.length < currentRisk.floodZones.length)) {
      return { coords: bestRoute, floodZones: bestRisk.floodZones }
    }
  }

  const centroid = computeFloodCentroid(currentRisk.floodZones)
  const bearing = computeBearing(origin, destination)
  const perpendicular = (bearing + 90) % 360

  for (const offsetDir of [perpendicular, (perpendicular + 180) % 360]) {
    const waypoint = offsetPoint(centroid, offsetDir, 500)
    const waypointRoutes = await getRouteAlternatives(origin, destination, [waypoint])
    if (waypointRoutes && waypointRoutes.length > 0) {
      const route = waypointRoutes[0]
      const risk = rankRouteRisk(countFloodIntersections(route, confirmedFloods), countFloodIntersections(route, forecastFloods))
      if (risk.score < currentRisk.score || (risk.score === currentRisk.score && risk.floodZones.length < currentRisk.floodZones.length)) {
        return { coords: route, floodZones: risk.floodZones }
      }
    }
  }

  return null
}

export default function createRouteCheckRoutes(store: FloodStore): express.Router {
  const router = express.Router()

  router.post('/', async (req: Request, res: Response) => {
    const body = req.body as RouteCheckRequest
    const origin = await resolveLocation(body?.origin)
    const destination = await resolveLocation(body?.destination)
    const anonId = getAnonId(req)
    const originLabel = body?.origin ? formatLocationLabel(body.origin) : 'Origin'
    const destinationLabel = body?.destination ? formatLocationLabel(body.destination) : 'Destination'

    if (!origin || !destination) {
      res.status(400).json({ success: false, error: 'Invalid origin/destination' })
      return
    }

      const coords = await buildRouteCoords(origin, destination)
      const bounding_box = bboxFromCoords(coords)
      let historyContext: RouteForecastHistoryContext | null = null

    try {
      let floods
      if (isLiveMode() && supabase) {
        const { data, error } = await supabase.rpc('get_floods_in_bbox', {
          p_north: bounding_box.north,
          p_south: bounding_box.south,
          p_east: bounding_box.east,
          p_west: bounding_box.west,
        })
        if (error) throw error
        floods = (data ?? []).map((row: Record<string, unknown>) => toFloodEvent(row))
        if (anonId) {
          try {
            const { data: historyRows, error: historyError } = await supabase
              .from('route_check_history')
              .select('id, checked_at, origin_label, destination_label, risk_level, confirmed_flood_count, forecast_flood_count, has_alternative_route, result_json')
              .eq('anonymous_id', anonId)
              .order('checked_at', { ascending: false })
              .limit(10)

            if (!historyError && historyRows) {
              historyContext = buildHistoryContext(
                historyRows.map((row) => ({
                  id: String(row.id),
                  checked_at: String(row.checked_at),
                  origin_label: String(row.origin_label ?? ''),
                  destination_label: String(row.destination_label ?? ''),
                  risk_level: (row.risk_level as RouteCheckHistoryEntry['risk_level']) ?? 'unknown',
                  confirmed_flood_count: Number(row.confirmed_flood_count ?? 0),
                  forecast_flood_count: Number(row.forecast_flood_count ?? 0),
                  has_alternative_route: Boolean(row.has_alternative_route),
                  result: (row.result_json as RouteCheckResponse) ?? {
                    route: { coords: [], bounding_box: { north: 0, south: 0, east: 0, west: 0 } },
                    floodZones: [],
                    warnings: [],
                    alertText: null,
                    forecast: null,
                  },
                })),
                originLabel,
                destinationLabel,
              )
            }
          } catch {
            // ignore history context failures
          }
        }
      } else {
        floods = getFloods(store)
      }

      const confirmedFloods = floods.filter((flood) => !flood.is_forecast)
      const forecastFloods = floods.filter((flood) => flood.is_forecast)
      const affected = countFloodIntersections(coords, confirmedFloods)
      const forecastAffected = countFloodIntersections(coords, forecastFloods)
      const currentRisk = rankRouteRisk(affected, forecastAffected)
      let precipitationSum6h: number | null = null

      if (forecastAffected.length > 0) {
        try {
          const enriched = await fetchEnrichedWeather()
          if (enriched) {
            precipitationSum6h = enriched.hourly.reduce((sum, hour) => sum + hour.rain_mm, 0)
          }
        } catch {
          // non-fatal
        }
      }

      const warnings: string[] = []
      if (affected.length > 0) {
        warnings.push(`Route intersects ${affected.length} flood zone(s).`)
        const top = affected
          .slice(0, 3)
          .map((zone) => `${zone.street_name} (${zone.district})`)
          .join(', ')
        warnings.push(`Hotspots: ${top}`)
      } else {
        warnings.push('No flood zones detected along this route.')
      }

      const alertText =
        affected.length > 0
          ? `Warning: your route crosses ${affected.length} flooded segment(s). ${affected[0]?.street_name ?? 'The first hotspot'} is affected. Risk level is ${pickSeverityWord(affected.length)}.`
          : null

      let alternativeRoute: RouteCheckResponse['alternativeRoute'] = null
      if (currentRisk.floodZones.length > 0) {
        const alt = await findSafeAlternative(origin, destination, confirmedFloods, forecastFloods, currentRisk)
        if (alt) {
          alternativeRoute = {
            coords: alt.coords,
            bounding_box: bboxFromCoords(alt.coords),
            floodZones: alt.floodZones,
          }
          warnings.push(`Safe alternative route available - avoids ${currentRisk.floodZones.length - alt.floodZones.length} flood risk point(s).`)
        }
      }

      if (forecastAffected.length > 0) {
        for (const flood of forecastAffected) {
          const hoursAway = flood.forecast_valid_until
            ? Math.max(1, Math.round((new Date(flood.forecast_valid_until).getTime() - Date.now()) / 3_600_000))
            : 1
          const warning =
            precipitationSum6h != null
              ? `Expected flood risk in ${flood.district} within the next ${hoursAway} hour(s) - forecast rainfall ${Math.round(precipitationSum6h)} mm.`
              : `Expected flood risk in ${flood.district} within the next ${hoursAway} hour(s) based on weather forecast conditions.`
          warnings.push(warning)
        }
      }

      const forecast = await generateRouteForecast({
        originLabel,
        destinationLabel,
        confirmedFloods: affected,
        forecastFloods: forecastAffected,
        rainfallNext6hMm: precipitationSum6h,
        alternativeFloodReduction: currentRisk.floodZones.length - (alternativeRoute?.floodZones.length ?? currentRisk.floodZones.length),
        recentHistory: historyContext,
      })

      warnings.unshift(`Forecast: ${forecast.summary}`)

      const payload: RouteCheckResponse = {
        route: { coords, bounding_box },
        alternativeRoute,
        floodZones: affected,
        warnings,
        alertText,
        forecast,
      }
      res.status(200).json({ success: true, ...payload })
    } catch (err) {
      console.error('[route-check] error:', err)
      res.status(500).json({ success: false, error: 'Route check failed' })
    }
  })

  return router
}
