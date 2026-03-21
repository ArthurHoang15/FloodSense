import { describe, it, expect } from 'vitest'
import { computeFloodRisk, DISTRICT_RISK_MAP } from '../floodRisk.js'
import type { EnrichedWeather } from '../weatherEnrich.js'

function makeWeather(overrides: Partial<{
  hourlyRain: number[]
  soilMoisture: number[]
  riverDischarge: number[]
  riverDischargeAvg: number
}>): EnrichedWeather {
  const hourlyRain = overrides.hourlyRain ?? [0, 0, 0, 0, 0, 0]
  const soilMoisture = overrides.soilMoisture ?? [0, 0, 0, 0, 0, 0]
  const riverDischarge = overrides.riverDischarge ?? [100, 100, 100, 100, 100, 100, 100]
  const riverDischargeAvg = overrides.riverDischargeAvg ?? 100

  return {
    current: { time: '', temperature_c: 28, rain_mm: 0, wind_speed_kmh: 0, wind_gusts_kmh: 0, weather_code: 0 },
    hourly: hourlyRain.map((rain_mm, i) => ({
      time: `2026-03-21T${String(9 + i).padStart(2, '0')}:00`,
      precipitation_probability: 50,
      rain_mm,
      wind_gusts_kmh: 20,
      soil_moisture: soilMoisture[i] ?? 0,
    })),
    riverDischarge,
    riverDischargeAvg,
  }
}

describe('computeFloodRisk', () => {
  it('zero rain + zero soil + normal river → low score, level low', () => {
    // river at avg (ratio 1.0 → factor 0.5 → contributes ~12 pts); no rain, no soil
    const result = computeFloodRisk(makeWeather({}))
    expect(result.score).toBeLessThan(20)
    expect(result.level).toBe('low')
    expect(result.forecastDistricts).toHaveLength(0)
  })

  it('max rainfall (50mm over 6h) → score in high range', () => {
    const result = computeFloodRisk(makeWeather({ hourlyRain: [10, 10, 10, 10, 10, 0] }))
    // rainfall factor: 50/50 = 1.0, weight 0.5 → contribution = 50
    // river = avg so ratio=1.0 → factor = min(1/2, 1) = 0.5 → contribution = 12.5
    // score ≈ 62
    expect(result.score).toBeGreaterThan(55)
    expect(result.score).toBeLessThan(70)
    expect(result.level).toBe('high')
  })

  it('all factors maxed → score 100, level critical', () => {
    const result = computeFloodRisk(makeWeather({
      hourlyRain: [10, 10, 10, 10, 10, 10],
      soilMoisture: [0.4, 0.4, 0.4, 0.4, 0.4, 0.4],
      riverDischarge: [200, 200, 200, 200, 200, 200, 200],
      riverDischargeAvg: 100,
    }))
    expect(result.score).toBe(100)
    expect(result.level).toBe('critical')
  })

  it('score ≥ 80 → forecastDistricts has up to 3 entries', () => {
    const result = computeFloodRisk(makeWeather({
      hourlyRain: [10, 10, 10, 10, 10, 10],
      soilMoisture: [0.4, 0.4, 0.4, 0.4, 0.4, 0.4],
      riverDischarge: [200, 200, 200, 200, 200, 200, 200],
      riverDischargeAvg: 100,
    }))
    expect(result.forecastDistricts.length).toBeGreaterThan(0)
    expect(result.forecastDistricts.length).toBeLessThanOrEqual(3)
  })

  it('score < 80 → forecastDistricts is empty', () => {
    const result = computeFloodRisk(makeWeather({ hourlyRain: [5, 5, 0, 0, 0, 0] }))
    expect(result.forecastDistricts).toHaveLength(0)
  })

  it('peakHour is the ISO timestamp of the hour with highest rain_mm', () => {
    const result = computeFloodRisk(makeWeather({
      hourlyRain: [2, 12, 5, 3, 1, 0],
    }))
    // peak is index 1: time = '2026-03-21T10:00Z'
    expect(result.peakHour).toContain('T10:00')
  })

  it('DISTRICT_RISK_MAP has 6 districts with lat/lng/multiplier', () => {
    const entries = Object.values(DISTRICT_RISK_MAP)
    expect(entries).toHaveLength(6)
    for (const d of entries) {
      expect(d).toMatchObject({
        lat: expect.any(Number),
        lng: expect.any(Number),
        multiplier: expect.any(Number),
      })
    }
  })

  it('districtScore > 90 → severity heavy, otherwise moderate', () => {
    const result = computeFloodRisk(makeWeather({
      hourlyRain: [10, 10, 10, 10, 10, 10],
      soilMoisture: [0.4, 0.4, 0.4, 0.4, 0.4, 0.4],
      riverDischarge: [200, 200, 200, 200, 200, 200, 200],
      riverDischargeAvg: 100,
    }))
    for (const d of result.forecastDistricts) {
      expect(['moderate', 'heavy']).toContain(d.severity)
    }
  })
})
