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

  const timeLabel = new Date(peakHour.time).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
  const severity = severeRain || severeWind ? 'high' : severeProbability ? 'medium' : 'low'

  return {
    probability: peakHour.precipitation_probability,
    time: peakHour.time,
    severity,
    message:
      `⛈ Severe weather is forecast around ${timeLabel}. ` +
      `Rain chance ${peakHour.precipitation_probability}%, ` +
      `peak rainfall ${peakHour.rain_mm.toFixed(1)} mm/h, ` +
      `gusts ${Math.round(peakHour.wind_gusts_kmh)} km/h. ` +
      `Recheck route conditions before departure.`,
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

      const hourly: HourlyForecast[] = meteo.hourly.time
        .map((time, index) => ({
          time,
          precipitation_probability: meteo.hourly.precipitation_probability[index] ?? 0,
          rain_mm: meteo.hourly.rain[index] ?? 0,
          wind_gusts_kmh: meteo.hourly.wind_gusts_10m[index] ?? 0,
        }))
        .filter((hour) => {
          const date = new Date(hour.time + 'Z')
          return date >= now && date <= sixHoursLater
        })

      const governmentAlerts = await fetchGovernmentAlerts()

      if (hourly.length > 0 && supabase) {
        void Promise.resolve(
          supabase
            .from('weather_forecasts')
            .upsert(
              hourly.map((hour) => ({
                location: 'HCMC',
                forecast_time: new Date(hour.time + 'Z').toISOString(),
                precipitation_probability: hour.precipitation_probability,
                rain_mm: hour.rain_mm,
                source: 'open-meteo',
                fetched_at: now.toISOString(),
              })),
              { onConflict: 'location,forecast_time' },
            ),
        ).catch((error) => console.warn('[weather] upsert failed:', error))
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
