import express, { type Request, type Response } from 'express'
import type { FloodStore } from '../_lib/mockData.js'
import { getFloods } from '../_lib/mockData.js'
import type { LatLng, RouteCheckRequest, RouteCheckResponse } from '../../shared/types.js'
import { bboxFromCoords, haversineMeters, interpolateLine } from '../_lib/geo.js'
import { geocode, mockGeocode } from '../_lib/geocode.js'
import supabase, { toFloodEvent } from '../_lib/supabase.js'

const IS_LIVE = process.env.DATA_MODE === 'live'
const RADIUS_METERS = 200

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
    return IS_LIVE ? geocode(input) : mockGeocode(input)
  }
  const ll = asLatLng(input)
  if (ll) return ll
  const addr = (input as { address?: unknown })?.address
  if (typeof addr === 'string') {
    return IS_LIVE ? geocode(addr) : mockGeocode(addr)
  }
  return null
}

function pickSeverityWord(count: number): string {
  if (count >= 3) return 'high risk'
  if (count >= 1) return 'some risk'
  return 'low risk'
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

    const coords = interpolateLine(origin, destination, 40)
    const bounding_box = bboxFromCoords(coords)

    try {
      let floods
      if (IS_LIVE) {
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

      // Fine-grained 200 m filter along interpolated route points
      const affected = floods.filter((f) => {
        const p = f.coordinates
        for (const c of coords) {
          if (haversineMeters(p, c) <= RADIUS_METERS) return true
        }
        return false
      })

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

      const payload: RouteCheckResponse = { route: { coords, bounding_box }, floodZones: affected, warnings, alertText }
      res.status(200).json({ success: true, ...payload })
    } catch (err) {
      console.error('[route-check] error:', err)
      res.status(500).json({ success: false, error: 'Route check failed' })
    }
  })

  return router
}
