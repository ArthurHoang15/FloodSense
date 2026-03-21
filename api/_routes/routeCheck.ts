import express, { type Request, type Response } from 'express'
import type { FloodStore } from '../_lib/mockData.js'
import { getFloods } from '../_lib/mockData.js'
import type { FloodEvent, LatLng, RouteCheckRequest, RouteCheckResponse } from '../../shared/types.js'
import { bboxFromCoords, haversineMeters, interpolateLine, computeBearing } from '../_lib/geo.js'
import { getDrivingRoute, getRouteAlternatives } from '../_lib/directions.js'
import { geocode, mockGeocode } from '../_lib/geocode.js'
import supabase, { toFloodEvent } from '../_lib/supabase.js'
import { fetchEnrichedWeather } from '../_lib/weatherEnrich.js'

const RADIUS_METERS = 200

function isLiveMode() {
  return process.env.DATA_MODE === 'live'
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
  if (count >= 3) return 'high risk'
  if (count >= 1) return 'some risk'
  return 'low risk'
}

async function buildRouteCoords(origin: LatLng, destination: LatLng): Promise<LatLng[]> {
  const mapboxRoute = await getDrivingRoute(origin, destination)
  if (mapboxRoute && mapboxRoute.length > 1) {
    return mapboxRoute
  }
  console.warn('[route-check] Directions API failed, falling back to straight-line interpolation')
  return interpolateLine(origin, destination, 40)
}

function countFloodIntersections(coords: LatLng[], floods: FloodEvent[]): FloodEvent[] {
  return floods.filter((f) => {
    for (const c of coords) {
      if (haversineMeters(f.coordinates, c) <= RADIUS_METERS) return true
    }
    return false
  })
}

function computeFloodCentroid(floods: FloodEvent[]): LatLng {
  let totalLat = 0
  let totalLng = 0
  for (const f of floods) {
    totalLat += f.coordinates.lat
    totalLng += f.coordinates.lng
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
  floods: FloodEvent[],
): Promise<{ coords: LatLng[]; floodZones: FloodEvent[] } | null> {
  // Strategy A: request alternative routes from Mapbox/OSRM
  const alternatives = await getRouteAlternatives(origin, destination)
  if (alternatives && alternatives.length > 1) {
    let bestRoute: LatLng[] | null = null
    let bestFloods: FloodEvent[] = floods // worst case = original
    for (const alt of alternatives) {
      const hits = countFloodIntersections(alt, floods)
      if (hits.length < bestFloods.length) {
        bestFloods = hits
        bestRoute = alt
      }
    }
    if (bestRoute && bestFloods.length < floods.length) {
      return { coords: bestRoute, floodZones: bestFloods }
    }
  }

  // Strategy B: waypoint avoidance — offset perpendicular to route bearing at flood centroid
  const centroid = computeFloodCentroid(floods)
  const bearing = computeBearing(origin, destination)
  const perpendicular = (bearing + 90) % 360

  for (const offsetDir of [perpendicular, (perpendicular + 180) % 360]) {
    const waypoint = offsetPoint(centroid, offsetDir, 500)
    const waypointRoutes = await getRouteAlternatives(origin, destination, [waypoint])
    if (waypointRoutes && waypointRoutes.length > 0) {
      const route = waypointRoutes[0]
      const hits = countFloodIntersections(route, floods)
      if (hits.length < floods.length) {
        return { coords: route, floodZones: hits }
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

    if (!origin || !destination) {
      res.status(400).json({ success: false, error: 'Invalid origin/destination' })
      return
    }

    const coords = await buildRouteCoords(origin, destination)
    const bounding_box = bboxFromCoords(coords)

    try {
      let floods
      if (isLiveMode() && supabase) {
        // Use Supabase stored function for bbox query
        const { data, error } = await supabase.rpc('get_floods_in_bbox', {
          p_north: bounding_box.north,
          p_south: bounding_box.south,
          p_east: bounding_box.east,
          p_west: bounding_box.west,
        })
        if (error) throw error
        floods = (data ?? []).map((row: Record<string, unknown>) => toFloodEvent(row))
      } else {
        floods = getFloods(store)
      }

      // ── Separate forecast floods from confirmed floods ─────────────────
      const confirmedFloods = floods.filter((f) => !f.is_forecast)
      const forecastFloods = floods.filter((f) => f.is_forecast)
      const affected = countFloodIntersections(coords, confirmedFloods)

      const warnings: string[] = []
      if (affected.length > 0) {
        warnings.push(`Route intersects ${affected.length} flood zone(s).`)
        const top = affected
          .slice(0, 3)
          .map((z) => `${z.street_name} (${z.district})`)
          .join(', ')
        warnings.push(`Hotspots: ${top}`)
      } else {
        warnings.push('No flood zones detected along this route.')
      }

      const alertText =
        affected.length > 0
          ? `Cảnh báo — tuyến đường của bạn đi qua ${affected.length} điểm ngập. ` +
            `${affected[0]?.street_name ?? ''} bị ảnh hưởng. Mức độ rủi ro: ${pickSeverityWord(affected.length)}.`
          : null

      // Find a safer alternative if the route hits flood zones
      let alternativeRoute: RouteCheckResponse['alternativeRoute'] = null
      if (affected.length > 0) {
        const alt = await findSafeAlternative(origin, destination, affected)
        if (alt) {
          alternativeRoute = {
            coords: alt.coords,
            bounding_box: bboxFromCoords(alt.coords),
            floodZones: alt.floodZones,
          }
          warnings.push(`Safe alternative route available — avoids ${affected.length - alt.floodZones.length} flood zone(s).`)
        }
      }

      // ── Forecast warnings ──────────────────────────────────────────────
      const forecastAffected = countFloodIntersections(coords, forecastFloods)
      if (forecastAffected.length > 0) {
        let precipitation_sum_6h: number | null = null
        try {
          const enriched = await fetchEnrichedWeather()
          if (enriched) {
            precipitation_sum_6h = enriched.hourly.reduce((sum, h) => sum + h.rain_mm, 0)
          }
        } catch {
          // non-fatal
        }

        for (const f of forecastAffected) {
          const hoursAway = f.forecast_valid_until
            ? Math.max(1, Math.round((new Date(f.forecast_valid_until).getTime() - Date.now()) / 3_600_000))
            : 1
          const warning =
            precipitation_sum_6h != null
              ? `Khu vực ${f.district} có nguy cơ ngập trong ${hoursAway} giờ tới — dự báo mưa ${Math.round(precipitation_sum_6h)}mm`
              : `Khu vực ${f.district} có nguy cơ ngập trong ${hoursAway} giờ tới theo dự báo thời tiết`
          warnings.push(warning)
        }
      }

      const payload: RouteCheckResponse = { route: { coords, bounding_box }, alternativeRoute, floodZones: affected, warnings, alertText }
      res.status(200).json({ success: true, ...payload })
    } catch (err) {
      console.error('[route-check] error:', err)
      res.status(500).json({ success: false, error: 'Route check failed' })
    }
  })

  return router
}
