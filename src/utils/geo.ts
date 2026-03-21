export type LatLng = { lat: number; lng: number }

export function haversineMeters(a: LatLng, b: LatLng): number {
  const R = 6371000
  const toRad = (deg: number) => (deg * Math.PI) / 180
  const dLat = toRad(b.lat - a.lat)
  const dLng = toRad(b.lng - a.lng)
  const lat1 = toRad(a.lat)
  const lat2 = toRad(b.lat)
  const s1 = Math.sin(dLat / 2)
  const s2 = Math.sin(dLng / 2)
  const h = s1 * s1 + Math.cos(lat1) * Math.cos(lat2) * s2 * s2
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)))
}

export function bboxFromCoords(coords: LatLng[]): {
  north: number
  south: number
  east: number
  west: number
} {
  let north = -90
  let south = 90
  let east = -180
  let west = 180
  for (const c of coords) {
    north = Math.max(north, c.lat)
    south = Math.min(south, c.lat)
    east = Math.max(east, c.lng)
    west = Math.min(west, c.lng)
  }
  return { north, south, east, west }
}

export function bboxIntersects(
  a: { north: number; south: number; east: number; west: number },
  b: { north: number; south: number; east: number; west: number },
): boolean {
  if (a.west > b.east || a.east < b.west) return false
  if (a.south > b.north || a.north < b.south) return false
  return true
}
