import express, { type Request, type Response } from 'express'
import supabase from '../_lib/supabase.js'

const HCMC_LAT = 10.7769
const HCMC_LNG = 106.7009
const OPEN_METEO_URL =
  `https://api.open-meteo.com/v1/forecast?latitude=${HCMC_LAT}&longitude=${HCMC_LNG}` +
  `&hourly=precipitation_probability,rain&forecast_days=1&timezone=UTC`

export interface HourlyForecast {
  time: string
  precipitation_probability: number
  rain_mm: number
}

export default function createWeatherRoutes(): express.Router {
  const router = express.Router()

  // ── GET /api/weather/forecast ─────────────────────────────────────────────
  router.get('/forecast', async (_req: Request, res: Response) => {
    try {
      const meteoRes = await fetch(OPEN_METEO_URL)
      if (!meteoRes.ok) {
        throw new Error(`Open-Meteo responded ${meteoRes.status}`)
      }

      const meteo = (await meteoRes.json()) as {
        hourly: {
          time: string[]
          precipitation_probability: number[]
          rain: number[]
        }
      }

      const now = new Date()
      const sixHoursLater = new Date(now.getTime() + 6 * 60 * 60 * 1000)

      // Filter to next 6 hours only
      const hourly: HourlyForecast[] = meteo.hourly.time
        .map((t, i) => ({
          time: t,
          precipitation_probability: meteo.hourly.precipitation_probability[i] ?? 0,
          rain_mm: meteo.hourly.rain[i] ?? 0,
        }))
        .filter((h) => {
          const d = new Date(h.time + 'Z')
          return d >= now && d <= sixHoursLater
        })

      // Upsert into weather_forecasts (fire-and-forget)
      if (hourly.length > 0) {
        void Promise.resolve(
          supabase
            .from('weather_forecasts')
            .upsert(
              hourly.map((h) => ({
                location: 'HCMC',
                forecast_time: new Date(h.time + 'Z').toISOString(),
                precipitation_probability: h.precipitation_probability,
                rain_mm: h.rain_mm,
                source: 'open_meteo',
                fetched_at: now.toISOString(),
              })),
              { onConflict: 'location,forecast_time' },
            ),
        ).catch((e) => console.warn('[weather] upsert failed:', e))
      }

      const maxProb = hourly.reduce((m, h) => Math.max(m, h.precipitation_probability), 0)
      const alertHour = hourly.find((h) => h.precipitation_probability >= 70)

      res.status(200).json({
        success: true,
        hourly,
        alert:
          maxProb >= 70
            ? {
                probability: maxProb,
                time: alertHour?.time ?? null,
                message: `⛈ Dự báo mưa lớn lúc ${alertHour ? new Date(alertHour.time).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }) : '?'} — điểm thường ngập: Nguyễn Hữu Cảnh, Đinh Bộ Lĩnh, Nguyễn Xí.`,
              }
            : null,
      })
    } catch (err) {
      console.error('[weather] error:', err)
      res.status(500).json({ success: false, error: 'Weather fetch failed' })
    }
  })

  return router
}
