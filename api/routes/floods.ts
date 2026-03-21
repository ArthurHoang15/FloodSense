import express, { type Request, type Response } from 'express'
import type { FloodStore } from '../lib/mockData.js'
import { getFloods } from '../lib/mockData.js'

export default function createFloodRoutes(store: FloodStore): express.Router {
  const router = express.Router()

  router.get('/', (req: Request, res: Response) => {
    const district = String(req.query.district ?? 'all').toLowerCase()
    const severity = String(req.query.severity ?? 'all').toLowerCase()
    const limit = Math.max(1, Math.min(200, Number(req.query.limit ?? 50)))
    const updatedSinceMin = Number(req.query.updated_since ?? 0)
    const now = Date.now()
    const cutoff = Number.isFinite(updatedSinceMin) && updatedSinceMin > 0
      ? now - updatedSinceMin * 60 * 1000
      : null

    let floods = getFloods(store)

    if (district !== 'all') {
      floods = floods.filter((f) => f.district.toLowerCase().includes(district))
    }
    if (severity !== 'all') {
      floods = floods.filter((f) => f.severity === severity)
    }
    if (cutoff != null) {
      floods = floods.filter((f) => new Date(f.last_confirmed_at).getTime() >= cutoff)
    }

    res.status(200).json({
      success: true,
      floods: floods.slice(0, limit),
      now: new Date(now).toISOString(),
    })
  })

  return router
}
