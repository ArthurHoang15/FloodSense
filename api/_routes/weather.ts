import express, { type Request, type Response } from 'express'
import supabase from '../_lib/supabase.js'

const HCMC_LAT = 10.7769
const HCMC_LNG = 106.7009
const OPEN_METEO_URL =
  `https://api.open-meteo.com/v1/forecast?latitude=${HCMC_LAT}&longitude=${HCMC_LNG}` +
  `&current=temperature_2m,rain,wind_speed_10m,wind_gusts_10m,weather_code` +
  `&hourly=precipitation_probability,rain,wind_gusts_10m&forecast_days=1&timezone=UTC`

const OPENWEATHER_URL =
  `https://api.openweathermap.org/data/3.0/onecall?lat=${HCMC_LAT}&lon=${HCMC_LNG}` +
  `&exclude=minutely,hourly,daily&units=metric`

type GovernmentAlert = {
  sender_name: string
  event: string
  start: string | null
  end: string | null
  description: string
  tags: string[]
}

type CurrentWeather = {
  time: string
  temperature_c: number
  rain_mm: number
  wind_speed_kmh: number
  wind_gusts_kmh: number
  weather_code: number
}

export interface HourlyForecast {
  time: string
  precipitation_probability: number
  rain_mm: number
  wind_gusts_kmh: number
}

function toIsoOrNull(value: number | undefined): string | null {
  if (!value) return null
  return new Date(value * 1000).toISOString()
}

function buildRainAlert(hourly: HourlyForecast[]) {
  const peakHour = [...hourly].sort((left, right) => {
    if (right.precipitation_probability !== left.precipitation_probability) {
      return right.precipitation_probability - left.precipitation_probability
    }
    if (right.rain_mm !== left.rain_mm) {
      return right.rain_mm - left.rain_mm
    }
    return right.wind_gusts_kmh - left.wind_gusts_kmh
  })[0]

  if (!peakHour) {
    return null
  }

  const severeProbability = peakHour.precipitation_probability >= 70
  const severeRain = peakHour.rain_mm >= 8
  const severeWind = peakHour.wind_gusts_kmh >= 35

  if (!severeProbability && !severeRain && !severeWind) {
    return null
  }

  const timeLabel = new Date(peakHour.time).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })
  const severity = severeRain || severeWind ? 'high' : severeProbability ? 'medium' : 'low'

  return {
    probability: peakHour.precipitation_probability,
    time: peakHour.time,
    severity,
    message:
      `⛈ Dự báo thời tiết xấu quanh ${timeLabel}. ` +
      `Xác suất mưa ${peakHour.precipitation_probability}%, ` +
      `mưa cực đại ${peakHour.rain_mm.toFixed(1)} mm/h, ` +
      `gió giật ${Math.round(peakHour.wind_gusts_kmh)} km/h. ` +
      `Nên kiểm tra lại tuyến đường trước khi di chuyển.`,
  }
}

async function fetchGovernmentAlerts(): Promise<GovernmentAlert[]> {
  if (!process.env.OPENWEATHER_API_KEY) return []

  try {
    const response = await fetch(`${OPENWEATHER_URL}&appid=${process.env.OPENWEATHER_API_KEY}`)
    if (!response.ok) {
      throw new Error(`OpenWeather responded ${response.status}`)
    }

    const payload = (await response.json()) as {
      alerts?: Array<{
        sender_name?: string
        event?: string
        start?: number
        end?: number
        description?: string
        tags?: string[]
      }>
    }

    return (payload.alerts ?? []).map((alert) => ({
      sender_name: alert.sender_name ?? 'Unknown sender',
      event: alert.event ?? 'Weather alert',
      start: toIsoOrNull(alert.start),
      end: toIsoOrNull(alert.end),
      description: alert.description ?? '',
      tags: alert.tags ?? [],
    }))
  } catch (error) {
    console.warn('[weather] government alerts fetch failed:', error)
    return []
  }
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
        current: {
          time: string
          temperature_2m: number
          rain: number
          wind_speed_10m: number
          wind_gusts_10m: number
          weather_code: number
        }
        hourly: {
          time: string[]
          precipitation_probability: number[]
          rain: number[]
          wind_gusts_10m: number[]
        }
      }

      const now = new Date()
      const sixHoursLater = new Date(now.getTime() + 6 * 60 * 60 * 1000)
      const current: CurrentWeather = {
        time: meteo.current.time,
        temperature_c: meteo.current.temperature_2m ?? 0,
        rain_mm: meteo.current.rain ?? 0,
        wind_speed_kmh: meteo.current.wind_speed_10m ?? 0,
        wind_gusts_kmh: meteo.current.wind_gusts_10m ?? 0,
        weather_code: meteo.current.weather_code ?? 0,
      }

      // Filter to next 6 hours only
      const hourly: HourlyForecast[] = meteo.hourly.time
        .map((t, i) => ({
          time: t,
          precipitation_probability: meteo.hourly.precipitation_probability[i] ?? 0,
          rain_mm: meteo.hourly.rain[i] ?? 0,
          wind_gusts_kmh: meteo.hourly.wind_gusts_10m[i] ?? 0,
        }))
        .filter((h) => {
          const d = new Date(h.time + 'Z')
          return d >= now && d <= sixHoursLater
        })

      const governmentAlerts = await fetchGovernmentAlerts()

      // Upsert into weather_forecasts (fire-and-forget)
      if (hourly.length > 0 && supabase) {
        void Promise.resolve(
          supabase
            .from('weather_forecasts')
            .upsert(
              hourly.map((h) => ({
                location: 'HCMC',
                forecast_time: new Date(h.time + 'Z').toISOString(),
                precipitation_probability: h.precipitation_probability,
                rain_mm: h.rain_mm,
                source: 'open-meteo',
                fetched_at: now.toISOString(),
              })),
              { onConflict: 'location,forecast_time' },
            ),
        ).catch((e) => console.warn('[weather] upsert failed:', e))
      }

      const alert = buildRainAlert(hourly)

      res.status(200).json({
        success: true,
        source: {
          forecast: 'open-meteo',
          alerts: process.env.OPENWEATHER_API_KEY ? 'openweather' : null,
        },
        current,
        hourly,
        governmentAlerts,
        alert,
      })
    } catch (err) {
      console.error('[weather] error:', err)
      res.status(500).json({ success: false, error: 'Weather fetch failed' })
    }
  })

  return router
}
