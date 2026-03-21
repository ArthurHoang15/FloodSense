import type { LatLng } from '../../shared/types.js'

type MapboxDirectionsResponse = {
  routes?: Array<{
    geometry?: {
      coordinates?: [number, number][]
    }
  }>
}

type OsrmResponse = {
  routes?: Array<{
    geometry?: {
      coordinates?: [number, number][]
    }
  }>
}

function normalizeCoordinates(route: [number, number][] | undefined): LatLng[] | null {
  if (!route || route.length < 2) return null
  return route.map(([lng, lat]) => ({ lat, lng }))
}

async function fetchOsrmRoute(origin: LatLng, destination: LatLng): Promise<LatLng[] | null> {
  const coordinates = `${origin.lng},${origin.lat};${destination.lng},${destination.lat}`
  const url = `https://router.project-osrm.org/route/v1/driving/${coordinates}?overview=full&geometries=geojson`

  try {
    const response = await fetch(url)
    if (!response.ok) return null

    const json = (await response.json()) as OsrmResponse
    return normalizeCoordinates(json.routes?.[0]?.geometry?.coordinates)
  } catch {
    return null
  }
}

export async function getDrivingRoute(origin: LatLng, destination: LatLng): Promise<LatLng[] | null> {
  const token = process.env.MAPBOX_TOKEN || process.env.VITE_MAPBOX_TOKEN
  if (!token) {
    return fetchOsrmRoute(origin, destination)
  }

  const coordinates = `${origin.lng},${origin.lat};${destination.lng},${destination.lat}`
  const url =
    `https://api.mapbox.com/directions/v5/mapbox/driving-traffic/${coordinates}` +
    `?alternatives=false&geometries=geojson&overview=full&steps=false&access_token=${token}`

  try {
    const response = await fetch(url)
    if (!response.ok) return fetchOsrmRoute(origin, destination)

    const json = (await response.json()) as MapboxDirectionsResponse
    const route = normalizeCoordinates(json.routes?.[0]?.geometry?.coordinates)
    return route ?? fetchOsrmRoute(origin, destination)
  } catch {
    return fetchOsrmRoute(origin, destination)
  }
}