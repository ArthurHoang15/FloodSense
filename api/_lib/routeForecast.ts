import OpenAI from 'openai'
import type { Confidence, FloodEvent, RouteForecastHistoryContext, RouteRiskForecast } from '../../shared/types.js'

type RouteForecastInput = {
  originLabel: string
  destinationLabel: string
  confirmedFloods: FloodEvent[]
  forecastFloods: FloodEvent[]
  rainfallNext6hMm: number | null
  alternativeFloodReduction: number
  recentHistory?: RouteForecastHistoryContext | null
}

let openaiClient: OpenAI | null = null

function getOpenAI(): OpenAI | null {
  if (!process.env.OPENAI_API_KEY) return null
  if (!openaiClient) {
    openaiClient = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
  }
  return openaiClient
}

function toConfidence(value: string | undefined): Confidence {
  if (value === 'high' || value === 'medium' || value === 'low') return value
  return 'medium'
}

function buildPeakWindow(forecastFloods: FloodEvent[]): string {
  const timestamps = forecastFloods
    .map((flood) => flood.forecast_valid_until)
    .filter((value): value is string => typeof value === 'string')
    .map((value) => new Date(value).getTime())
    .filter((value) => Number.isFinite(value))

  if (timestamps.length === 0) return 'Within the next 1-3 hours'

  const earliest = Math.min(...timestamps)
  const hours = Math.max(1, Math.round((earliest - Date.now()) / 3_600_000))
  return `Within the next ${hours} hour${hours === 1 ? '' : 's'}`
}

function inferRiskLevel(input: RouteForecastInput): RouteRiskForecast['riskLevel'] {
  const confirmedCount = input.confirmedFloods.length
  const forecastCount = input.forecastFloods.length
  const rainfall = input.rainfallNext6hMm ?? 0

  if (confirmedCount >= 2 || rainfall >= 35) return 'high'
  if (confirmedCount >= 1 || forecastCount >= 1 || rainfall >= 15) return 'medium'
  return 'low'
}

function buildFallbackForecast(input: RouteForecastInput): RouteRiskForecast {
  const riskLevel = inferRiskLevel(input)
  const reasons: string[] = []

  if (input.confirmedFloods.length > 0) {
    reasons.push(`${input.confirmedFloods.length} confirmed flood zone(s) intersect the route now.`)
  }
  if (input.forecastFloods.length > 0) {
    reasons.push(`${input.forecastFloods.length} forecast flood zone(s) may affect the route soon.`)
  }
  if (input.rainfallNext6hMm != null) {
    reasons.push(`Forecast rainfall for the next 6 hours is ${Math.round(input.rainfallNext6hMm)} mm.`)
  }
  if (input.alternativeFloodReduction > 0) {
    reasons.push(`An alternative route reduces exposure by ${input.alternativeFloodReduction} flood zone(s).`)
  }
  if ((input.recentHistory?.sameCorridorHighRiskCount ?? 0) > 0) {
    reasons.push(`${input.recentHistory?.sameCorridorHighRiskCount} recent checks on this corridor were already high risk.`)
  }
  if (reasons.length === 0) {
    reasons.push('No confirmed or forecast flood exposure is currently detected on this route.')
  }

  let summary = 'Route risk is currently low.'
  if (riskLevel === 'medium') {
    summary = 'Route risk is elevated. Conditions should be rechecked before departure.'
  }
  if (riskLevel === 'high') {
    summary = 'Route risk is high. Delays or route changes are likely if travel cannot be postponed.'
  }

  return {
    source: 'rule-based',
    riskLevel,
    confidence: riskLevel === 'low' ? 'medium' : 'high',
    summary,
    peakWindow: buildPeakWindow(input.forecastFloods),
    reasons,
    dataPoints: {
      confirmedFloodsOnRoute: input.confirmedFloods.length,
      forecastFloodsOnRoute: input.forecastFloods.length,
      rainfallNext6hMm: input.rainfallNext6hMm,
      alternativeFloodReduction: input.alternativeFloodReduction,
    },
  }
}

export async function generateRouteForecast(input: RouteForecastInput): Promise<RouteRiskForecast> {
  const fallback = buildFallbackForecast(input)
  const client = getOpenAI()

  if (!client) return fallback

  const promptPayload = {
    route: {
      origin: input.originLabel,
      destination: input.destinationLabel,
    },
    metrics: {
      confirmedFloodsOnRoute: input.confirmedFloods.length,
      forecastFloodsOnRoute: input.forecastFloods.length,
      rainfallNext6hMm: input.rainfallNext6hMm,
      alternativeFloodReduction: input.alternativeFloodReduction,
      recentHistory: input.recentHistory ?? null,
    },
    confirmedFloods: input.confirmedFloods.slice(0, 5).map((flood) => ({
      street_name: flood.street_name,
      district: flood.district,
      severity: flood.severity,
      depth_cm: flood.depth_cm,
    })),
    forecastFloods: input.forecastFloods.slice(0, 5).map((flood) => ({
      street_name: flood.street_name,
      district: flood.district,
      severity: flood.severity,
      forecast_valid_until: flood.forecast_valid_until ?? null,
    })),
    recentHistory: input.recentHistory ?? null,
  }

  try {
    const completion = await client.chat.completions.create({
      model: 'gpt-4o-mini',
      temperature: 0.2,
      response_format: { type: 'json_object' },
      messages: [
        {
          role: 'system',
          content:
            'You summarize urban route flood risk. Return JSON only with keys riskLevel, confidence, summary, peakWindow, reasons. riskLevel must be low, medium, or high. confidence must be low, medium, or high. summary must be one short sentence. peakWindow must be short. reasons must be an array of 2 to 4 concise strings. Be conservative and use only the provided data.',
        },
        {
          role: 'user',
          content: JSON.stringify(promptPayload),
        },
      ],
    })

    const raw = JSON.parse(completion.choices[0]?.message?.content ?? '{}') as Partial<RouteRiskForecast>
    const riskLevel = raw.riskLevel === 'low' || raw.riskLevel === 'medium' || raw.riskLevel === 'high'
      ? raw.riskLevel
      : fallback.riskLevel
    const reasons = Array.isArray(raw.reasons)
      ? raw.reasons.filter((reason): reason is string => typeof reason === 'string').slice(0, 4)
      : fallback.reasons

    return {
      source: 'openai',
      riskLevel,
      confidence: toConfidence(typeof raw.confidence === 'string' ? raw.confidence : undefined),
      summary: typeof raw.summary === 'string' && raw.summary.trim() ? raw.summary.trim() : fallback.summary,
      peakWindow: typeof raw.peakWindow === 'string' && raw.peakWindow.trim() ? raw.peakWindow.trim() : fallback.peakWindow,
      reasons: reasons.length > 0 ? reasons : fallback.reasons,
      dataPoints: fallback.dataPoints,
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    console.warn('[route-forecast] OpenAI forecast failed, using fallback:', message)
    return fallback
  }
}
