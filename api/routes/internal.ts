import express, { type Request, type Response } from 'express'
import type { FloodStore } from '../lib/mockData.js'
import { setSimulated } from '../lib/mockData.js'

export default function createInternalRoutes(store: FloodStore): express.Router {
  const router = express.Router()

  router.post('/simulate-rain', (req: Request, res: Response) => {
    const preset = String(req.body?.preset ?? 'heavy_rain_hcmc')
    if (preset !== 'heavy_rain_hcmc') {
      res.status(400).json({ success: false, error: 'Unknown preset' })
      return
    }
    const enableRaw = req.body?.enable
    const enabled = typeof enableRaw === 'boolean' ? enableRaw : true
    const simulated = setSimulated(store, enabled)
    res.status(200).json({
      success: true,
      enabled,
      count: simulated.length,
      floods: simulated,
    })
  })

  router.post('/reset-simulated', (req: Request, res: Response) => {
    setSimulated(store, false)
    res.status(200).json({ success: true })
  })

  return router
}
