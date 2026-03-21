import type { LatLng } from '../../shared/types.js'

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

// ── Mapbox Geocoding API ───────────────────────────────────────────────────
// Uses MAPBOX_TOKEN env var (server-side); falls back to hardcoded table.
export async function geocode(input: string): Promise<LatLng | null> {
  const token = process.env.MAPBOX_TOKEN || process.env.VITE_MAPBOX_TOKEN
  if (!token) return fallbackGeocode(input)

  const encoded = encodeURIComponent(input.trim())
  const url =
    `https://api.mapbox.com/geocoding/v5/mapbox.places/${encoded}.json` +
    `?country=VN&proximity=106.7009,10.7769&limit=1&access_token=${token}`

  try {
    const res = await fetch(url)
    if (!res.ok) return fallbackGeocode(input)
    const json = (await res.json()) as { features?: Array<{ center: [number, number] }> }
    const center = json.features?.[0]?.center
    if (!center) return fallbackGeocode(input)
    return { lat: center[1], lng: center[0] }
  } catch {
    return fallbackGeocode(input)
  }
}

// Keep the old sync export as alias so existing callers don't break in mock mode
export function mockGeocode(input: string): LatLng | null {
  return fallbackGeocode(input)
}
