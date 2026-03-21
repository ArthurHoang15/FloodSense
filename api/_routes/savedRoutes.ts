import express, { type Request, type Response } from 'express'
import supabase from '../_lib/supabase.js'

function getAnonId(req: Request): string | null {
  return (req.headers['x-anonymous-id'] as string) || null
}

export default function createSavedRoutesRoutes(): express.Router {
  const router = express.Router()

  // ── GET /api/saved-routes ─────────────────────────────────────────────
  router.get('/', async (req: Request, res: Response) => {
    const anonId = getAnonId(req)
    if (!anonId) {
      res.status(200).json({ success: true, routes: [] })
      return
    }
    try {
      const { data, error } = await supabase
        .from('saved_routes')
        .select('*')
        .eq('anonymous_id', anonId)
        .order('created_at', { ascending: true })
        .limit(3)
      if (error) throw error
      res.status(200).json({ success: true, routes: data ?? [] })
    } catch (err) {
      console.error('[saved-routes GET] error:', err)
      res.status(500).json({ success: false, error: 'Failed to load routes' })
    }
  })

  // ── POST /api/saved-routes ────────────────────────────────────────────
  router.post('/', async (req: Request, res: Response) => {
    const anonId = getAnonId(req)
    if (!anonId) {
      res.status(400).json({ success: false, error: 'x-anonymous-id header required' })
      return
    }
    const b = req.body
    try {
      const { data, error } = await supabase
        .from('saved_routes')
        .insert({
          anonymous_id: anonId,
          name: b.name,
          origin_lat: b.origin?.lat,
          origin_lng: b.origin?.lng,
          origin_address: b.origin?.address ?? null,
          destination_lat: b.destination?.lat,
          destination_lng: b.destination?.lng,
          destination_address: b.destination?.address ?? null,
          route_polyline: b.route_polyline ?? null,
          bbox_north: b.bounding_box?.north,
          bbox_south: b.bounding_box?.south,
          bbox_east: b.bounding_box?.east,
          bbox_west: b.bounding_box?.west,
          notify_enabled: b.notify_enabled ?? true,
        })
        .select('*')
        .single()
      if (error) throw error
      res.status(201).json({ success: true, route: data })
    } catch (err) {
      console.error('[saved-routes POST] error:', err)
      res.status(500).json({ success: false, error: 'Failed to save route' })
    }
  })

  // ── PATCH /api/saved-routes/:id ───────────────────────────────────────
  router.patch('/:id', async (req: Request, res: Response) => {
    const anonId = getAnonId(req)
    const { id } = req.params
    const { notify_enabled } = req.body as { notify_enabled?: boolean }
    if (notify_enabled === undefined) {
      res.status(400).json({ success: false, error: 'notify_enabled required' })
      return
    }
    try {
      const { error } = await supabase
        .from('saved_routes')
        .update({ notify_enabled })
        .eq('id', id)
        .eq('anonymous_id', anonId ?? '')
      if (error) throw error
      res.status(200).json({ success: true })
    } catch (err) {
      console.error('[saved-routes PATCH] error:', err)
      res.status(500).json({ success: false, error: 'Failed to update route' })
    }
  })

  // ── DELETE /api/saved-routes/:id ──────────────────────────────────────
  router.delete('/:id', async (req: Request, res: Response) => {
    const anonId = getAnonId(req)
    const { id } = req.params
    try {
      const { error } = await supabase
        .from('saved_routes')
        .delete()
        .eq('id', id)
        .eq('anonymous_id', anonId ?? '')
      if (error) throw error
      res.status(200).json({ success: true })
    } catch (err) {
      console.error('[saved-routes DELETE] error:', err)
      res.status(500).json({ success: false, error: 'Failed to delete route' })
    }
  })

  return router
}
