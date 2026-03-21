import express, { type Request, type Response } from 'express'
import type { FloodStore } from '../lib/mockData.js'
import { getFloods } from '../lib/mockData.js'
import type { LatLng, RouteCheckRequest, RouteCheckResponse } from '../../shared/types.js'
import { bboxFromCoords, haversineMeters, interpolateLine } from '../lib/geo.js'
import { mockGeocode } from '../lib/geocode.js'

function asLatLng(input: unknown): LatLng | null {
  if (!input || typeof input !== 'object') return null
  const v = input as { lat?: unknown; lng?: unknown }
  const lat = typeof v.lat === 'number' ? v.lat : Number(v.lat)
  const lng = typeof v.lng === 'number' ? v.lng : Number(v.lng)
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null
  return { lat, lng }
}

function resolveLocation(input: RouteCheckRequest['origin']): LatLng | null {
  if (typeof input === 'string') return mockGeocode(input)
  const ll = asLatLng(input)
  if (ll) return ll
  const addr = (input as { address?: unknown })?.address
  if (typeof addr === 'string') return mockGeocode(addr)
  return null
}

function pickSeverityWord(count: number): string {
  if (count >= 3) return 'high risk'
  if (count >= 1) return 'some risk'
  return 'low risk'
}

export default function createRouteCheckRoutes(store: FloodStore): express.Router {
  const router = express.Router()

  router.post('/', (req: Request, res: Response) => {
    const body = req.body as RouteCheckRequest
    const origin = resolveLocation(body?.origin)
    const destination = resolveLocation(body?.destination)
    if (!origin || !destination) {
      res.status(400).json({ success: false, error: 'Invalid origin/destination' })
      return
    }

    const coords = interpolateLine(origin, destination, 40)
    const bounding_box = bboxFromCoords(coords)

    const radiusMeters = 200
    const floods = getFloods(store)
    const affected = floods.filter((f) => {
      const p = f.coordinates
      for (const c of coords) {
        if (haversineMeters(p, c) <= radiusMeters) return true
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
      warnings.push('No flood zones detected along this route (mock check).')
    }

    const alertText =
      affected.length > 0
        ? `Warning. Flood detected on your route. ${affected[0]?.street_name ?? ''} is affected. Risk level: ${pickSeverityWord(affected.length)}.`
        : null

    const payload: RouteCheckResponse = {
      route: { coords, bounding_box },
      floodZones: affected,
      warnings,
      alertText,
    }

    res.status(200).json({ success: true, ...payload })
  })

  return router
}
