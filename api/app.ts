/**
 * This is a API server
 */

import express, {
  type Request,
  type Response,
  type NextFunction,
} from 'express'
import cors from 'cors'
import dotenv from 'dotenv'
import authRoutes from './routes/auth.js'
import createFloodRoutes from './routes/floods.js'
import createInternalRoutes from './routes/internal.js'
import createRouteCheckRoutes from './routes/routeCheck.js'
import createSavedRoutesRoutes from './routes/savedRoutes.js'
import createVoiceRoutes from './routes/voice.js'
import createWeatherRoutes from './routes/weather.js'
import type { FloodStore } from './lib/mockData.js'

// load env
dotenv.config()

const app: express.Application = express()

const floodStore: FloodStore = {
  base: [],
  simulated: [],
}

app.use(cors())
app.use(express.json({ limit: '10mb' }))
app.use(express.urlencoded({ extended: true, limit: '10mb' }))

/**
 * API Routes
 */
app.use('/api/auth', authRoutes)
app.use('/api/floods', createFloodRoutes(floodStore))
app.use('/api/route-check', createRouteCheckRoutes(floodStore))
app.use('/api/internal', createInternalRoutes(floodStore))
app.use('/api/saved-routes', createSavedRoutesRoutes())
app.use('/api/voice', createVoiceRoutes())
app.use('/api/weather', createWeatherRoutes())

/**
 * health
 */
app.use(
  '/api/health',
  (req: Request, res: Response): void => {
    res.status(200).json({
      success: true,
      message: 'ok',
    })
  },
)

/**
 * error handler middleware
 */
app.use((error: Error, req: Request, res: Response, _next: NextFunction) => {
  void _next
  res.status(500).json({
    success: false,
    error: 'Server internal error',
  })
})

/**
 * 404 handler
 */
app.use((req: Request, res: Response) => {
  res.status(404).json({
    success: false,
    error: 'API not found',
  })
})

export default app
