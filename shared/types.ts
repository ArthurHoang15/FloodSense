export type Severity = 'heavy' | 'moderate' | 'light'
export type Confidence = 'high' | 'medium' | 'low'

export type FloodSourceType =
  | 'news'
  | 'social'
  | 'government'
  | 'vetc_mock'
  | 'user_report'
  | 'forecast'

export interface FloodSource {
  url: string
  title: string
  snippet: string
  published_at: string
  source_type: FloodSourceType
}

export interface LatLng {
  lat: number
  lng: number
}

export interface AddressSuggestion {
  id: string
  label: string
  coordinates: LatLng
}

export interface FloodEvent {
  id: string
  street_name: string
  district: string
  city: string
  coordinates: LatLng
  depth_cm: number | null
  severity: Severity
  confidence: Confidence
  sources: FloodSource[]
  first_detected_at: string
  last_confirmed_at: string
  expires_at: string
  is_active: boolean
  is_simulated: boolean
  is_forecast: boolean
  forecast_valid_until?: string
}

export interface SavedRoute {
  id: string
  name: string
  origin: LatLng & { address?: string }
  destination: LatLng & { address?: string }
  route_coords: LatLng[]
  bounding_box: { north: number; south: number; east: number; west: number }
  notify_enabled: boolean
  created_at: string
}

export interface RouteCheckRequest {
  origin: LatLng & { address?: string } | string
  destination: LatLng & { address?: string } | string
}

export interface RouteRiskForecast {
  source: 'openai' | 'rule-based'
  riskLevel: 'low' | 'medium' | 'high'
  confidence: Confidence
  summary: string
  peakWindow: string
  reasons: string[]
  dataPoints: {
    confirmedFloodsOnRoute: number
    forecastFloodsOnRoute: number
    rainfallNext6hMm: number | null
    alternativeFloodReduction: number
  }
}

export interface RouteForecastHistoryContext {
  recentChecks: number
  sameCorridorChecks: number
  sameCorridorHighRiskCount: number
  sameCorridorAlternativeRate: number
  recentRiskLevels: Array<'low' | 'medium' | 'high' | 'unknown'>
}

export interface RouteCheckResponse {
  route: {
    coords: LatLng[]
    bounding_box: { north: number; south: number; east: number; west: number }
  }
  alternativeRoute?: {
    coords: LatLng[]
    bounding_box: { north: number; south: number; east: number; west: number }
    floodZones: FloodEvent[]
  } | null
  floodZones: FloodEvent[]
  warnings: string[]
  alertText: string | null
  forecast: RouteRiskForecast | null
}

export interface RouteCheckHistoryEntry {
  id: string
  checked_at: string
  origin_label: string
  destination_label: string
  risk_level: RouteRiskForecast['riskLevel'] | 'unknown'
  confirmed_flood_count: number
  forecast_flood_count: number
  has_alternative_route: boolean
  result: RouteCheckResponse
}

export type ReportStatus = 'pending' | 'confirmed' | 'rejected'

export interface UserReport {
  id: string
  anonymous_id: string | null
  coordinates: LatLng
  severity: Severity
  note: string | null
  location_text: string | null
  status: ReportStatus
  confirm_count: number
  flood_event_id: string | null
  created_at: string
}

export interface ReportFloodRequest {
  locationText?: string
  lat?: number
  lng?: number
  severity: Severity
  note?: string
}
