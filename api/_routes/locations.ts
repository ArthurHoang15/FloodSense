import express, { type Request, type Response } from 'express'
import { searchAddressSuggestions } from '../_lib/geocode.js'

export default function createLocationRoutes(): express.Router {
  const router = express.Router()

  router.get('/search', async (req: Request, res: Response) => {
    const query = typeof req.query.q === 'string' ? req.query.q.trim() : ''
    if (query.length < 3) {
      res.status(200).json({ success: true, suggestions: [] })
      return
    }

    try {
      const suggestions = await searchAddressSuggestions(query)
      res.status(200).json({ success: true, suggestions })
    } catch (error) {
      console.error('[locations/search] error:', error)
      res.status(500).json({ success: false, error: 'Location search failed' })
    }
  })

  return router
}