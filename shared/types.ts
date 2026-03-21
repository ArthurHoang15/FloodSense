export type Severity = 'heavy' | 'moderate' | 'light'
export type Confidence = 'high' | 'medium' | 'low'

export type FloodSourceType =
  | 'news'
  | 'social'
  | 'government'
  | 'vetc_mock'
  | 'user_report'

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

export interface RouteCheckResponse {
  route: {
    coords: LatLng[]
    bounding_box: { north: number; south: number; east: number; west: number }
  }
  floodZones: FloodEvent[]
  warnings: string[]
  alertText: string | null
}
