import express, { type Request, type Response } from 'express'
import type { RouteCheckHistoryEntry } from '../../shared/types.js'
import supabase from '../_lib/supabase.js'

function getAnonId(req: Request): string | null {
  return (req.headers['x-anonymous-id'] as string) || null
}

function toHistoryEntry(row: Record<string, unknown>): RouteCheckHistoryEntry {
  return {
    id: String(row.id),
    checked_at: String(row.checked_at),
    origin_label: String(row.origin_label ?? ''),
    destination_label: String(row.destination_label ?? ''),
    risk_level: (row.risk_level as RouteCheckHistoryEntry['risk_level']) ?? 'unknown',
    confirmed_flood_count: Number(row.confirmed_flood_count ?? 0),
    forecast_flood_count: Number(row.forecast_flood_count ?? 0),
    has_alternative_route: Boolean(row.has_alternative_route),
    result: (row.result_json as RouteCheckHistoryEntry['result']) ?? null,
  }
}

export default function createRouteHistoryRoutes(): express.Router {
  const router = express.Router()

  router.get('/', async (req: Request, res: Response) => {
    const anonId = getAnonId(req)
    if (!anonId || !supabase) {
      res.status(200).json({ success: true, history: [] })
      return
    }

    try {
      const { data, error } = await supabase
        .from('route_check_history')
        .select('*')
        .eq('anonymous_id', anonId)
        .order('checked_at', { ascending: false })
        .limit(50)

      if (error) throw error

      res.status(200).json({
        success: true,
        history: (data ?? []).map((row: Record<string, unknown>) => toHistoryEntry(row)),
      })
    } catch (err) {
      console.error('[route-history GET] error:', err)
      res.status(500).json({ success: false, error: 'Failed to load route history' })
    }
  })

  router.post('/bulk', async (req: Request, res: Response) => {
    const anonId = getAnonId(req)
    const entries = ((req.body as { entries?: RouteCheckHistoryEntry[] })?.entries ?? []).filter(Boolean)

    if (!anonId) {
      res.status(400).json({ success: false, error: 'x-anonymous-id header required' })
      return
    }
    if (!supabase) {
      res.status(503).json({ success: false, error: 'Route history storage not configured' })
      return
    }
    if (entries.length === 0) {
      res.status(200).json({ success: true, inserted: 0 })
      return
    }

    try {
      const payload = entries.map((entry) => ({
        id: entry.id,
        anonymous_id: anonId,
        checked_at: entry.checked_at,
        origin_label: entry.origin_label,
        destination_label: entry.destination_label,
        risk_level: entry.risk_level,
        confirmed_flood_count: entry.confirmed_flood_count,
        forecast_flood_count: entry.forecast_flood_count,
        has_alternative_route: entry.has_alternative_route,
        result_json: entry.result,
      }))

      const { error } = await supabase.from('route_check_history').upsert(payload)
      if (error) throw error

      res.status(200).json({ success: true, inserted: payload.length })
    } catch (err) {
      console.error('[route-history POST] error:', err)
      res.status(500).json({ success: false, error: 'Failed to sync route history' })
    }
  })

  return router
}
