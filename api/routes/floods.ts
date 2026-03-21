import express, { type Request, type Response } from 'express'
import type { FloodStore } from '../lib/mockData.js'
import { getFloods } from '../lib/mockData.js'
import supabase, { toFloodEvent } from '../lib/supabase.js'

const IS_LIVE = process.env.DATA_MODE === 'live'

export default function createFloodRoutes(store: FloodStore): express.Router {
  const router = express.Router()

  router.get('/', async (req: Request, res: Response) => {
    const district = String(req.query.district ?? 'all').toLowerCase()
    const severity = String(req.query.severity ?? 'all').toLowerCase()
    const limit = Math.max(1, Math.min(200, Number(req.query.limit ?? 50)))
    const updatedSinceMin = Number(req.query.updated_since ?? 0)
    const now = new Date()

    try {
      if (IS_LIVE) {
        // ── Expire stale events first ──────────────────────────────────────
        await supabase.rpc('expire_flood_events')

        // ── Build query ────────────────────────────────────────────────────
        let query = supabase
          .from('flood_events')
          .select('*, flood_sources(*)')
          .eq('is_active', true)
          .gt('expires_at', now.toISOString())
          .order('last_confirmed_at', { ascending: false })
          .limit(limit)

        if (district !== 'all') {
          query = query.ilike('district', `%${district}%`)
        }
        if (severity !== 'all') {
          query = query.eq('severity', severity)
        }
        if (updatedSinceMin > 0) {
          const cutoff = new Date(now.getTime() - updatedSinceMin * 60 * 1000)
          query = query.gte('last_confirmed_at', cutoff.toISOString())
        }

        const { data, error } = await query
        if (error) throw error

        const floods = (data ?? []).map((row) => toFloodEvent(row as Record<string, unknown>))
        return res.status(200).json({ success: true, floods, now: now.toISOString() })
      }

      // ── Mock fallback ──────────────────────────────────────────────────
      let floods = getFloods(store)
      if (district !== 'all') floods = floods.filter((f) => f.district.toLowerCase().includes(district))
      if (severity !== 'all') floods = floods.filter((f) => f.severity === severity)
      if (updatedSinceMin > 0) {
        const cutoff = now.getTime() - updatedSinceMin * 60 * 1000
        floods = floods.filter((f) => new Date(f.last_confirmed_at).getTime() >= cutoff)
      }
      return res.status(200).json({ success: true, floods: floods.slice(0, limit), now: now.toISOString() })
    } catch (err) {
      console.error('[floods] error:', err)
      return res.status(500).json({ success: false, error: 'Failed to fetch floods' })
    }
  })

  return router
}
