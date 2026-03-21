const HCMC_LAT = 10.7769
const HCMC_LNG = 106.7009

const WEATHER_URL =
  `https://api.open-meteo.com/v1/forecast?latitude=${HCMC_LAT}&longitude=${HCMC_LNG}` +
  `&current=temperature_2m,rain,wind_speed_10m,wind_gusts_10m,weather_code` +
  `&hourly=precipitation_probability,rain,wind_gusts_10m,soil_moisture_0_to_1cm` +
  `&forecast_days=1&timezone=UTC`

const FLOOD_API_URL =
  `https://flood-api.open-meteo.com/v1/flood?latitude=${HCMC_LAT}&longitude=${HCMC_LNG}` +
  `&daily=river_discharge&forecast_days=7`

const CACHE_TTL_MS = 30 * 60 * 1000

export interface EnrichedHourly {
  time: string
  precipitation_probability: number
  rain_mm: number
  wind_gusts_kmh: number
  soil_moisture: number
}

export interface EnrichedWeather {
  current: {
    time: string
    temperature_c: number
    rain_mm: number
    wind_speed_kmh: number
    wind_gusts_kmh: number
    weather_code: number
  }
  hourly: EnrichedHourly[]
  riverDischarge: number[]
  riverDischargeAvg: number
}

let cache: { result: EnrichedWeather; fetchedAt: number } | null = null

/** Exposed for tests only. */
export function clearWeatherCache() {
  cache = null
}

export async function fetchEnrichedWeather(): Promise<EnrichedWeather | null> {
  if (cache && Date.now() - cache.fetchedAt < CACHE_TTL_MS) {
    return cache.result
  }

  let meteoRes: Response
  try {
    meteoRes = await fetch(WEATHER_URL)
    if (!meteoRes.ok) throw new Error(`Open-Meteo ${meteoRes.status}`)
  } catch (err) {
    console.warn('[weatherEnrich] weather fetch failed:', err)
    return null
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
      soil_moisture_0_to_1cm: number[]
    }
  }

  let riverDischarge: number[] = []
  try {
    const floodRes = await fetch(FLOOD_API_URL)
    if (floodRes.ok) {
      const floodData = (await floodRes.json()) as {
        daily: { river_discharge: number[] }
      }
      riverDischarge = floodData.daily.river_discharge ?? []
    }
  } catch {
    // non-fatal: proceed without river data
  }

  const now = new Date()
  const sixHoursLater = new Date(now.getTime() + 6 * 60 * 60 * 1000)

  const hourly: EnrichedHourly[] = meteo.hourly.time
    .map((t, i) => ({
      time: t,
      precipitation_probability: meteo.hourly.precipitation_probability[i] ?? 0,
      rain_mm: meteo.hourly.rain[i] ?? 0,
      wind_gusts_kmh: meteo.hourly.wind_gusts_10m[i] ?? 0,
      soil_moisture: meteo.hourly.soil_moisture_0_to_1cm[i] ?? 0,
    }))
    .filter((h) => {
      const d = new Date(h.time + 'Z')
      return d >= now && d <= sixHoursLater
    })

  const riverDischargeAvg =
    riverDischarge.length > 0
      ? riverDischarge.reduce((a, b) => a + b, 0) / riverDischarge.length
      : 0

  const result: EnrichedWeather = {
    current: {
      time: meteo.current.time,
      temperature_c: meteo.current.temperature_2m ?? 0,
      rain_mm: meteo.current.rain ?? 0,
      wind_speed_kmh: meteo.current.wind_speed_10m ?? 0,
      wind_gusts_kmh: meteo.current.wind_gusts_10m ?? 0,
      weather_code: meteo.current.weather_code ?? 0,
    },
    hourly,
    riverDischarge,
    riverDischargeAvg,
  }

  cache = { result, fetchedAt: Date.now() }
  return result
}
