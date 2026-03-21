import type { EnrichedWeather } from './weatherEnrich.js'
import type { Severity } from '../../shared/types.js'

export interface DistrictRiskEntry {
  lat: number
  lng: number
  multiplier: number
  name: string
}

export const DISTRICT_RISK_MAP: Record<string, DistrictRiskEntry> = {
  'Quận Bình Thạnh': { lat: 10.8124, lng: 106.7143, multiplier: 1.3, name: 'Quận Bình Thạnh' },
  'Quận 8':          { lat: 10.7230, lng: 106.6285, multiplier: 1.3, name: 'Quận 8' },
  'Quận 6':          { lat: 10.7462, lng: 106.6340, multiplier: 1.2, name: 'Quận 6' },
  'Quận 7':          { lat: 10.7320, lng: 106.7210, multiplier: 1.2, name: 'Quận 7' },
  'Quận 12':         { lat: 10.8680, lng: 106.6570, multiplier: 1.1, name: 'Quận 12' },
  'Thủ Đức':         { lat: 10.8544, lng: 106.7715, multiplier: 1.1, name: 'Thủ Đức' },
}

export interface ForecastDistrict {
  district: string
  lat: number
  lng: number
  severity: Severity
  districtScore: number
}

export interface FloodRiskResult {
  score: number
  level: 'low' | 'moderate' | 'high' | 'critical'
  peakHour: string
  forecastDistricts: ForecastDistrict[]
}

export function computeFloodRisk(weather: EnrichedWeather): FloodRiskResult {
  const { hourly, riverDischarge, riverDischargeAvg } = weather

  // Factor 1: Rainfall — sum of hourly rain_mm for next 6h, cap 50mm, weight 0.5
  const rainfallSum = hourly.reduce((sum, h) => sum + h.rain_mm, 0)
  const rainfallFactor = Math.min(rainfallSum / 50, 1.0)

  // Factor 2: Soil moisture — average, cap 0.4 m³/m³, weight 0.25
  const avgSoilMoisture =
    hourly.length > 0
      ? hourly.reduce((sum, h) => sum + h.soil_moisture, 0) / hourly.length
      : 0
  const soilFactor = Math.min(avgSoilMoisture / 0.4, 1.0)

  // Factor 3: River discharge — current / 7-day avg, ratio cap 2.0, weight 0.25
  const currentRiver = riverDischarge[0] ?? 0
  const riverRatio = riverDischargeAvg > 0 ? currentRiver / riverDischargeAvg : 0
  const riverFactor = Math.min(riverRatio / 2.0, 1.0)

  const compositeScore = Math.round(
    (rainfallFactor * 0.5 + soilFactor * 0.25 + riverFactor * 0.25) * 100,
  )

  let level: FloodRiskResult['level']
  if (compositeScore >= 80) level = 'critical'
  else if (compositeScore >= 60) level = 'high'
  else if (compositeScore >= 40) level = 'moderate'
  else level = 'low'

  // Peak hour: ISO timestamp of hour with highest rain_mm
  const peakEntry = [...hourly].sort((a, b) => b.rain_mm - a.rain_mm)[0]
  const peakHour = peakEntry ? peakEntry.time + 'Z' : new Date().toISOString()

  // Forecast districts — only when critical
  const forecastDistricts: ForecastDistrict[] = []
  if (compositeScore >= 80) {
    const ranked = Object.entries(DISTRICT_RISK_MAP)
      .map(([key, entry]) => {
        const districtScore = Math.min(compositeScore * entry.multiplier, 100)
        const severity: Severity = districtScore > 90 ? 'heavy' : 'moderate'
        return { district: key, lat: entry.lat, lng: entry.lng, severity, districtScore }
      })
      .sort((a, b) => b.districtScore - a.districtScore)
      .slice(0, 3)
    forecastDistricts.push(...ranked)
  }

  return { score: compositeScore, level, peakHour, forecastDistricts }
}
