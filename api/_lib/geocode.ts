import type { AddressSuggestion, LatLng } from '../../shared/types.js'

type MapboxFeature = {
  id: string
  place_name?: string
  text?: string
  center?: [number, number]
}

type MapboxResponse = {
  features?: MapboxFeature[]
}

type NominatimItem = {
  place_id: number | string
  display_name?: string
  lat?: string
  lon?: string
}

// ── Hardcoded fallback table (used when Mapbox call fails or key missing) ─
const KNOWN: Array<{ key: string; lat: number; lng: number }> = [
  { key: 'q7', lat: 10.7366, lng: 106.7222 },
  { key: 'quan 7', lat: 10.7366, lng: 106.7222 },
  { key: 'tan binh', lat: 10.8015, lng: 106.6526 },
  { key: 'tân bình', lat: 10.8015, lng: 106.6526 },
  { key: 'binh thanh', lat: 10.8032, lng: 106.7078 },
  { key: 'bình thạnh', lat: 10.8032, lng: 106.7078 },
  { key: 'go vap', lat: 10.8389, lng: 106.6656 },
  { key: 'gò vấp', lat: 10.8389, lng: 106.6656 },
  { key: 'tan phu', lat: 10.7898, lng: 106.6282 },
  { key: 'tân phú', lat: 10.7898, lng: 106.6282 },
  { key: 'phu nhuan', lat: 10.8000, lng: 106.6780 },
  { key: 'phú nhuận', lat: 10.8000, lng: 106.6780 },
  { key: 'binh tan', lat: 10.7644, lng: 106.6063 },
  { key: 'bình tân', lat: 10.7644, lng: 106.6063 },
  { key: 'thu duc', lat: 10.8537, lng: 106.7538 },
  { key: 'thủ đức', lat: 10.8537, lng: 106.7538 },
  { key: 'hcmc', lat: 10.7769, lng: 106.7009 },
  { key: 'tp hcm', lat: 10.7769, lng: 106.7009 },
  { key: 'ho chi minh', lat: 10.7769, lng: 106.7009 },
]

function fallbackGeocode(input: string): LatLng | null {
  const key = input.trim().toLowerCase()
  for (const item of KNOWN) {
    if (key.includes(item.key)) return { lat: item.lat, lng: item.lng }
  }
  return null
}

function getMapboxToken() {
  return process.env.MAPBOX_TOKEN || process.env.VITE_MAPBOX_TOKEN
}

async function fetchMapboxFeatures(input: string, params: URLSearchParams): Promise<MapboxFeature[]> {
  const token = getMapboxToken()
  if (!token) return []

  const encoded = encodeURIComponent(input.trim())
  params.set('access_token', token)

  const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${encoded}.json?${params.toString()}`
  const res = await fetch(url)
  if (!res.ok) return []

  const json = (await res.json()) as MapboxResponse
  return json.features ?? []
}

async function fetchNominatimSuggestions(input: string, limit: number): Promise<AddressSuggestion[]> {
  const query = input.trim()
  if (query.length < 3) return []

  const params = new URLSearchParams({
    q: `${query}, Ho Chi Minh City, Vietnam`,
    format: 'jsonv2',
    addressdetails: '1',
    dedupe: '1',
    limit: String(limit),
  })

  try {
    const response = await fetch(`https://nominatim.openstreetmap.org/search?${params.toString()}`, {
      headers: {
        'Accept-Language': 'vi,en;q=0.8',
        'User-Agent': 'FloodSense/1.0 (local development geocoding)',
      },
    })
    if (!response.ok) return []

    const json = (await response.json()) as NominatimItem[]
    return json
      .map((item) => {
        const lat = Number(item.lat)
        const lng = Number(item.lon)
        if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null
        return {
          id: String(item.place_id),
          label: item.display_name ?? query,
          coordinates: { lat, lng },
        }
      })
      .filter((item): item is AddressSuggestion => item !== null)
  } catch {
    return []
  }
}

// ── Mapbox Geocoding API ───────────────────────────────────────────────────
// Uses MAPBOX_TOKEN env var (server-side); falls back to hardcoded table.
export async function geocode(input: string): Promise<LatLng | null> {
  const token = getMapboxToken()
  if (!token) {
    const publicSuggestions = await fetchNominatimSuggestions(input, 1)
    return publicSuggestions[0]?.coordinates ?? fallbackGeocode(input)
  }

  try {
    const features = await fetchMapboxFeatures(
      input,
      new URLSearchParams({
        country: 'VN',
        proximity: '106.7009,10.7769',
        limit: '1',
        language: 'vi',
      }),
    )
    const center = features[0]?.center
    if (!center) {
      const publicSuggestions = await fetchNominatimSuggestions(input, 1)
      return publicSuggestions[0]?.coordinates ?? fallbackGeocode(input)
    }
    return { lat: center[1], lng: center[0] }
  } catch {
    const publicSuggestions = await fetchNominatimSuggestions(input, 1)
    return publicSuggestions[0]?.coordinates ?? fallbackGeocode(input)
  }
}

export async function searchAddressSuggestions(input: string): Promise<AddressSuggestion[]> {
  const query = input.trim()
  if (query.length < 3) return []
  if (!getMapboxToken()) {
    return fetchNominatimSuggestions(query, 6)
  }

  try {
    const features = await fetchMapboxFeatures(
      query,
      new URLSearchParams({
        autocomplete: 'true',
        country: 'VN',
        bbox: '106.3,10.3,107.1,11.2',
        limit: '6',
        language: 'vi',
        types: 'address,poi,place,locality,neighborhood',
        proximity: '106.7009,10.7769',
      }),
    )

    if (features.length === 0) {
      return fetchNominatimSuggestions(query, 6)
    }

    return features
      .filter((feature) => Array.isArray(feature.center) && feature.center.length === 2)
      .map((feature) => ({
        id: feature.id,
        label: feature.place_name ?? feature.text ?? query,
        coordinates: {
          lat: feature.center![1],
          lng: feature.center![0],
        },
      }))
  } catch {
    return fetchNominatimSuggestions(query, 6)
  }
}

// Keep the old sync export as alias so existing callers don't break in mock mode
export function mockGeocode(input: string): LatLng | null {
  return fallbackGeocode(input)
}
