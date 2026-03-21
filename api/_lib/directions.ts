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

function buildCoordString(points: LatLng[]): string {
  return points.map((p) => `${p.lng},${p.lat}`).join(';')
}

async function fetchOsrmRoute(origin: LatLng, destination: LatLng): Promise<LatLng[] | null> {
  const coordinates = buildCoordString([origin, destination])
  const url = `https://router.project-osrm.org/route/v1/driving/${coordinates}?overview=full&geometries=geojson`

  try {
    const response = await fetch(url)
    if (!response.ok) {
      console.warn(`[directions] OSRM non-200: status=${response.status}`)
      return null
    }

    const json = (await response.json()) as OsrmResponse
    return normalizeCoordinates(json.routes?.[0]?.geometry?.coordinates)
  } catch (err) {
    console.warn('[directions] OSRM fetch error:', (err as Error).message)
    return null
  }
}

async function fetchOsrmAlternatives(origin: LatLng, destination: LatLng): Promise<LatLng[][] | null> {
  const coordinates = buildCoordString([origin, destination])
  const url = `https://router.project-osrm.org/route/v1/driving/${coordinates}?overview=full&geometries=geojson&alternatives=true`

  try {
    const response = await fetch(url)
    if (!response.ok) return null

    const json = (await response.json()) as OsrmResponse
    const results: LatLng[][] = []
    for (const route of json.routes ?? []) {
      const coords = normalizeCoordinates(route.geometry?.coordinates)
      if (coords) results.push(coords)
    }
    return results.length > 0 ? results : null
  } catch {
    return null
  }
}

export async function getDrivingRoute(origin: LatLng, destination: LatLng): Promise<LatLng[] | null> {
  const token = process.env.MAPBOX_TOKEN || process.env.VITE_MAPBOX_TOKEN
  if (!token) {
    console.warn('[directions] No Mapbox token found, falling back to OSRM')
    return fetchOsrmRoute(origin, destination)
  }

  const coordinates = buildCoordString([origin, destination])
  const url =
    `https://api.mapbox.com/directions/v5/mapbox/driving-traffic/${coordinates}` +
    `?alternatives=false&geometries=geojson&overview=full&steps=false&access_token=${token}`

  try {
    const response = await fetch(url)
    if (!response.ok) {
      const body = await response.text().catch(() => '')
      console.warn(`[directions] Mapbox non-200: status=${response.status} body=${body.slice(0, 200)}`)
      return fetchOsrmRoute(origin, destination)
    }

    const json = (await response.json()) as MapboxDirectionsResponse
    const route = normalizeCoordinates(json.routes?.[0]?.geometry?.coordinates)
    if (!route) {
      console.warn('[directions] Mapbox returned no usable route, falling back to OSRM')
    }
    return route ?? fetchOsrmRoute(origin, destination)
  } catch (err) {
    console.warn('[directions] Mapbox fetch error:', (err as Error).message)
    return fetchOsrmRoute(origin, destination)
  }
}

export async function getRouteAlternatives(
  origin: LatLng,
  destination: LatLng,
  waypoints?: LatLng[],
): Promise<LatLng[][] | null> {
  const token = process.env.MAPBOX_TOKEN || process.env.VITE_MAPBOX_TOKEN

  if (waypoints?.length) {
    // Route through waypoints — no alternatives flag, just a single route via waypoints
    const allPoints = [origin, ...waypoints, destination]

    if (token) {
      const coordinates = buildCoordString(allPoints)
      const url =
        `https://api.mapbox.com/directions/v5/mapbox/driving-traffic/${coordinates}` +
        `?alternatives=false&geometries=geojson&overview=full&steps=false&access_token=${token}`
      try {
        const response = await fetch(url)
        if (response.ok) {
          const json = (await response.json()) as MapboxDirectionsResponse
          const route = normalizeCoordinates(json.routes?.[0]?.geometry?.coordinates)
          if (route) return [route]
        }
      } catch {
        // fall through to OSRM
      }
    }

    // OSRM waypoint route
    const coordinates = buildCoordString(allPoints)
    const url = `https://router.project-osrm.org/route/v1/driving/${coordinates}?overview=full&geometries=geojson`
    try {
      const response = await fetch(url)
      if (response.ok) {
        const json = (await response.json()) as OsrmResponse
        const route = normalizeCoordinates(json.routes?.[0]?.geometry?.coordinates)
        if (route) return [route]
      }
    } catch {
      // fall through
    }
    return null
  }

  // No waypoints — request alternatives
  if (token) {
    const coordinates = buildCoordString([origin, destination])
    const url =
      `https://api.mapbox.com/directions/v5/mapbox/driving-traffic/${coordinates}` +
      `?alternatives=true&geometries=geojson&overview=full&steps=false&access_token=${token}`
    try {
      const response = await fetch(url)
      if (response.ok) {
        const json = (await response.json()) as MapboxDirectionsResponse
        const results: LatLng[][] = []
        for (const route of json.routes ?? []) {
          const coords = normalizeCoordinates(route.geometry?.coordinates)
          if (coords) results.push(coords)
        }
        if (results.length > 0) return results
      }
    } catch {
      // fall through to OSRM
    }
  }

  return fetchOsrmAlternatives(origin, destination)
}