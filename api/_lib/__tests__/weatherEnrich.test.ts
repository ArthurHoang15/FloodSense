import { describe, it, expect, vi, beforeEach } from 'vitest'

// Intercept global fetch before importing the module under test
const fetchMock = vi.fn()
vi.stubGlobal('fetch', fetchMock)

// Import after stubbing fetch
const { fetchEnrichedWeather, clearWeatherCache } = await import('../weatherEnrich.js')

// Generate future hourly times so they survive the "next 6h" filter
function futureHours(count: number): string[] {
  return Array.from({ length: count }, (_, i) => {
    const d = new Date(Date.now() + (i + 1) * 60 * 60 * 1000)
    // Open-Meteo returns times without trailing Z (UTC assumed)
    return d.toISOString().slice(0, 16)
  })
}

const METEO_RESPONSE = {
  current: { time: new Date().toISOString().slice(0, 16), temperature_2m: 28, rain: 2, wind_speed_10m: 15, wind_gusts_10m: 25, weather_code: 61 },
  hourly: {
    time: futureHours(6),
    precipitation_probability: [60, 70, 80, 75, 65, 55],
    rain: [3, 8, 12, 9, 6, 4],
    wind_gusts_10m: [20, 28, 35, 30, 22, 18],
    soil_moisture_0_to_1cm: [0.2, 0.22, 0.25, 0.27, 0.28, 0.26],
  },
}

const FLOOD_RESPONSE = {
  daily: {
    time: ['2026-03-21', '2026-03-22', '2026-03-23', '2026-03-24', '2026-03-25', '2026-03-26', '2026-03-27'],
    river_discharge: [120, 130, 125, 118, 122, 115, 110],
  },
}

function makeOkResponse(body: unknown) {
  return Promise.resolve({
    ok: true,
    json: () => Promise.resolve(body),
  })
}

describe('fetchEnrichedWeather', () => {
  beforeEach(() => {
    fetchMock.mockReset()
    clearWeatherCache()
  })

  it('calls Open-Meteo weather API and flood API', async () => {
    fetchMock
      .mockResolvedValueOnce(makeOkResponse(METEO_RESPONSE))
      .mockResolvedValueOnce(makeOkResponse(FLOOD_RESPONSE))

    await fetchEnrichedWeather()

    expect(fetchMock).toHaveBeenCalledTimes(2)
    const [weatherUrl, floodUrl] = fetchMock.mock.calls.map((c: unknown[]) => String(c[0]))
    expect(weatherUrl).toContain('api.open-meteo.com')
    expect(weatherUrl).toContain('soil_moisture_0_to_1cm')
    expect(floodUrl).toContain('flood-api.open-meteo.com')
    expect(floodUrl).toContain('river_discharge')
  })

  it('returns enriched weather shape', async () => {
    fetchMock
      .mockResolvedValueOnce(makeOkResponse(METEO_RESPONSE))
      .mockResolvedValueOnce(makeOkResponse(FLOOD_RESPONSE))

    const result = await fetchEnrichedWeather()

    expect(result).toMatchObject({
      hourly: expect.arrayContaining([
        expect.objectContaining({ rain_mm: expect.any(Number), soil_moisture: expect.any(Number) }),
      ]),
      riverDischarge: expect.arrayContaining([expect.any(Number)]),
      riverDischargeAvg: expect.any(Number),
    })
  })

  it('returns cached result on second call within 30 min', async () => {
    fetchMock
      .mockResolvedValueOnce(makeOkResponse(METEO_RESPONSE))
      .mockResolvedValueOnce(makeOkResponse(FLOOD_RESPONSE))

    await fetchEnrichedWeather()
    await fetchEnrichedWeather()

    expect(fetchMock).toHaveBeenCalledTimes(2) // not 4
  })

  it('returns null when weather API fails', async () => {
    fetchMock.mockResolvedValueOnce({ ok: false, status: 500 })

    const result = await fetchEnrichedWeather()
    expect(result).toBeNull()
  })

  it('still returns result when flood API fails (river data gracefully absent)', async () => {
    fetchMock
      .mockResolvedValueOnce(makeOkResponse(METEO_RESPONSE))
      .mockRejectedValueOnce(new Error('flood API down'))

    const result = await fetchEnrichedWeather()
    expect(result).not.toBeNull()
    expect(result?.riverDischarge).toEqual([])
    expect(result?.riverDischargeAvg).toBe(0)
  })
})
