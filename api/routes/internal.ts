import express, { type Request, type Response } from 'express'
import { readFileSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'
import type { FloodStore } from '../lib/mockData.js'
import { setSimulated } from '../lib/mockData.js'
import supabase from '../lib/supabase.js'
import { searchFloodNews } from '../lib/exa.js'
import { extractFloodData } from '../lib/openai.js'
import { geocode } from '../lib/geocode.js'

const IS_LIVE = process.env.DATA_MODE === 'live'
const __dirname = dirname(fileURLToPath(import.meta.url))

// ── Internal secret guard ─────────────────────────────────────────────────
function checkSecret(req: Request, res: Response): boolean {
  const secret = process.env.INTERNAL_SECRET
  if (!secret) return true // no secret configured → open (dev mode)
  if (req.headers['x-internal-secret'] !== secret) {
    res.status(401).json({ success: false, error: 'Unauthorized' })
    return false
  }
  return true
}

// ── Load preset JSON ──────────────────────────────────────────────────────
function loadPreset(): Array<Record<string, unknown>> {
  const p = join(__dirname, '../../mocks/presets/heavy_rain_hcmc.json')
  return JSON.parse(readFileSync(p, 'utf-8')) as Array<Record<string, unknown>>
}

export default function createInternalRoutes(store: FloodStore): express.Router {
  const router = express.Router()

  // ── POST /api/internal/simulate-rain ────────────────────────────────────
  router.post('/simulate-rain', async (req: Request, res: Response) => {
    if (!checkSecret(req, res)) return
    const preset = String(req.body?.preset ?? 'heavy_rain_hcmc')
    if (preset !== 'heavy_rain_hcmc') {
      res.status(400).json({ success: false, error: 'Unknown preset' })
      return
    }
    const enableRaw = req.body?.enable
    const enabled = typeof enableRaw === 'boolean' ? enableRaw : true

    if (!IS_LIVE) {
      // Mock path — keep existing in-memory behaviour
      const simulated = setSimulated(store, enabled)
      res.status(200).json({ success: true, enabled, count: simulated.length, floods: simulated })
      return
    }

    if (!enabled) {
      await supabase.rpc('clear_simulated_floods')
      res.status(200).json({ success: true, enabled: false, count: 0, floods: [] })
      return
    }

    try {
      const events = loadPreset()
      const inserted: unknown[] = []

      for (const e of events) {
        const coords = e.coordinates as { lat: number; lng: number }
        const { data: floodId } = await supabase.rpc('upsert_flood_event', {
          p_street_name: e.street_name,
          p_district: e.district,
          p_lat: coords.lat,
          p_lng: coords.lng,
          p_depth_cm: e.depth_cm ?? null,
          p_severity: e.severity,
          p_confidence: e.confidence,
          p_is_simulated: true,
        })
        inserted.push(floodId)
      }

      // Activate all simulated floods with 30-min TTL
      await supabase
        .from('flood_events')
        .update({ is_active: true, expires_at: new Date(Date.now() + 30 * 60 * 1000).toISOString() })
        .eq('is_simulated', true)

      res.status(200).json({ success: true, enabled: true, count: inserted.length })
    } catch (err) {
      console.error('[simulate-rain] error:', err)
      res.status(500).json({ success: false, error: 'Simulation failed' })
    }
  })

  // ── POST /api/internal/reset-simulated ──────────────────────────────────
  router.post('/reset-simulated', async (req: Request, res: Response) => {
    if (!checkSecret(req, res)) return

    if (!IS_LIVE) {
      setSimulated(store, false)
      res.status(200).json({ success: true })
      return
    }

    try {
      const { data } = await supabase.rpc('clear_simulated_floods')
      res.status(200).json({ success: true, deleted: data ?? 0 })
    } catch (err) {
      console.error('[reset-simulated] error:', err)
      res.status(500).json({ success: false, error: 'Reset failed' })
    }
  })

  // ── POST /api/internal/run-pipeline ──────────────────────────────────────
  // Called by n8n every 5 minutes: Exa.ai → GPT-4o/rule-based → Supabase upsert
  router.post('/run-pipeline', async (req: Request, res: Response) => {
    if (!checkSecret(req, res)) return

    const startedAt = new Date()
    let new_floods = 0
    let updated_floods = 0
    let articles_fetched = 0

    // Insert pipeline run log (status: running)
    const { data: runLog } = await supabase
      .from('pipeline_runs')
      .insert({ started_at: startedAt.toISOString(), status: 'running', queries_run: 5 })
      .select('id')
      .single()

    try {
      const articles = await searchFloodNews(3)
      articles_fetched = articles.length

      for (const article of articles) {
        const floods = await extractFloodData(article)
        for (const f of floods) {
          // Geocode to get precise coordinates
          const coords = await geocode(`${f.street_name}, ${f.district}, TP.HCM`)
          if (!coords) continue

          const { data: floodId } = await supabase.rpc('upsert_flood_event', {
            p_street_name: f.street_name,
            p_district: f.district,
            p_lat: coords.lat,
            p_lng: coords.lng,
            p_depth_cm: f.depth_cm,
            p_severity: f.severity,
            p_confidence: f.confidence,
            p_is_simulated: false,
          })

          if (floodId) {
            // Insert source record
            await supabase.from('flood_sources').insert({
              flood_event_id: floodId,
              url: f.source_url,
              title: f.source_title,
              snippet: f.source_snippet,
              published_at: f.published_at,
              source_type: 'news',
            })
            new_floods++
          } else {
            updated_floods++
          }
        }
      }

      // Update pipeline run log
      if (runLog?.id) {
        await supabase
          .from('pipeline_runs')
          .update({
            completed_at: new Date().toISOString(),
            articles_fetched,
            new_floods_found: new_floods,
            updated_floods,
            status: 'success',
          })
          .eq('id', runLog.id)
      }

      res.status(200).json({ success: true, articles_fetched, new_floods, updated_floods })
    } catch (err) {
      console.error('[run-pipeline] error:', err)
      if (runLog?.id) {
        await supabase
          .from('pipeline_runs')
          .update({ completed_at: new Date().toISOString(), status: 'failed', error_message: String(err) })
          .eq('id', runLog.id)
      }
      res.status(500).json({ success: false, error: 'Pipeline failed' })
    }
  })

  // ── POST /api/internal/check-saved-routes ────────────────────────────────
  // Called by n8n after run-pipeline finds new floods
  router.post('/check-saved-routes', async (req: Request, res: Response) => {
    if (!checkSecret(req, res)) return
    const { flood_id } = req.body as { flood_id?: string }
    if (!flood_id) {
      res.status(400).json({ success: false, error: 'flood_id required' })
      return
    }

    try {
      const { data: routes, error } = await supabase.rpc('get_affected_routes', { p_flood_id: flood_id })
      if (error) throw error
      if (!routes || routes.length === 0) {
        res.status(200).json({ success: true, notified: 0 })
        return
      }

      // Fetch flood details for the alert message
      const { data: flood } = await supabase
        .from('flood_events')
        .select('street_name, district, depth_cm')
        .eq('id', flood_id)
        .single()

      const alerts = routes.map((r: { user_id: string; anonymous_id: string; id: string; name: string }) => ({
        user_id: r.user_id ?? null,
        anonymous_id: r.anonymous_id ?? null,
        route_id: r.id,
        flood_event_id: flood_id,
        message: `⚠️ Tuyến ${r.name} có ngập mới tại ${flood?.street_name ?? ''}, ${flood?.district ?? ''}. Độ sâu ước tính ${flood?.depth_cm ?? '?'} cm.`,
      }))

      await supabase.from('alert_history').insert(alerts)

      res.status(200).json({ success: true, notified: alerts.length, routes: routes.map((r: { id: string }) => r.id) })
    } catch (err) {
      console.error('[check-saved-routes] error:', err)
      res.status(500).json({ success: false, error: 'Check failed' })
    }
  })

  return router
}
