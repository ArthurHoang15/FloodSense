import type { LatLng } from '../../shared/types.js'

const KNOWN: Array<{ key: string; lat: number; lng: number }> = [
  { key: 'q7', lat: 10.7366, lng: 106.7222 },
  { key: 'quan 7', lat: 10.7366, lng: 106.7222 },
  { key: 'tan binh', lat: 10.8015, lng: 106.6526 },
  { key: 'tân bình', lat: 10.8015, lng: 106.6526 },
  { key: 'binh thanh', lat: 10.8032, lng: 106.7078 },
  { key: 'bình thạnh', lat: 10.8032, lng: 106.7078 },
  { key: 'go vap', lat: 10.8389, lng: 106.6656 },
  { key: 'gò vấp', lat: 10.8389, lng: 106.6656 },
  { key: 'hcmc', lat: 10.7769, lng: 106.7009 },
  { key: 'tp hcm', lat: 10.7769, lng: 106.7009 },
  { key: 'ho chi minh', lat: 10.7769, lng: 106.7009 },
]

export function mockGeocode(input: string): LatLng | null {
  const key = input.trim().toLowerCase()
  for (const item of KNOWN) {
    if (key.includes(item.key)) return { lat: item.lat, lng: item.lng }
  }
  return null
}
