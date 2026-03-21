import { useEffect, useMemo, useRef, useState } from 'react'
import mapboxgl from 'mapbox-gl'
import type { AddressSuggestion, FloodEvent, LatLng } from '../../shared/types'

type Props = {
  floods: FloodEvent[]
  routeCoords: LatLng[] | null
  altRouteCoords?: LatLng[] | null
  focusLocation?: AddressSuggestion | null
  onSelectFlood?: (floodId: string) => void
}

function toFeatureCollection(floods: FloodEvent[]) {
  return {
    type: 'FeatureCollection' as const,
    features: floods.map((f) => ({
      type: 'Feature' as const,
      geometry: {
        type: 'Point' as const,
        coordinates: [f.coordinates.lng, f.coordinates.lat] as [number, number],
      },
      properties: {
        id: f.id,
        depth_cm: f.depth_cm ?? 0,
        severity: f.severity,
        street_name: f.street_name,
        district: f.district,
      },
    })),
  }
}

function toRouteGeoJSON(coords: LatLng[]) {
  return {
    type: 'FeatureCollection' as const,
    features: [
      {
        type: 'Feature' as const,
        geometry: {
          type: 'LineString' as const,
          coordinates: coords.map((c) => [c.lng, c.lat] as [number, number]),
        },
        properties: {},
      },
    ],
  }
}

export default function FloodMap({ floods, routeCoords, altRouteCoords = null, focusLocation = null, onSelectFlood }: Props) {
  const token = import.meta.env.VITE_MAPBOX_TOKEN as string | undefined
  const mapRef = useRef<mapboxgl.Map | null>(null)
  const containerRef = useRef<HTMLDivElement | null>(null)
  const popupRef = useRef<mapboxgl.Popup | null>(null)
  const searchMarkerRef = useRef<mapboxgl.Marker | null>(null)
  const onSelectFloodRef = useRef<Props['onSelectFlood']>(onSelectFlood)
  const [mapReady, setMapReady] = useState(false)

  const floodsGeo = useMemo(() => toFeatureCollection(floods), [floods])
  const hasFloodIntersection = !!altRouteCoords
  const routeGeo = useMemo(() => (routeCoords ? toRouteGeoJSON(routeCoords) : null), [routeCoords])
  const altRouteGeo = useMemo(() => (altRouteCoords ? toRouteGeoJSON(altRouteCoords) : null), [altRouteCoords])

  useEffect(() => {
    onSelectFloodRef.current = onSelectFlood
  }, [onSelectFlood])

  useEffect(() => {
    if (!containerRef.current) return
    if (!token) return
    setMapReady(false)
    mapboxgl.accessToken = token
    const map = new mapboxgl.Map({
      container: containerRef.current,
      style: 'mapbox://styles/mapbox/dark-v11',
      center: [106.7009, 10.7769],
      zoom: 11.5,
    })
    mapRef.current = map
    popupRef.current = new mapboxgl.Popup({ closeButton: true, closeOnClick: true })

    map.on('load', () => {
      setMapReady(true)
      map.addSource('flood-points', {
        type: 'geojson',
        data: toFeatureCollection([]) as unknown as GeoJSON.FeatureCollection,
      })

      map.addLayer({
        id: 'flood-heat',
        type: 'heatmap',
        source: 'flood-points',
        paint: {
          'heatmap-weight': ['interpolate', ['linear'], ['get', 'depth_cm'], 0, 0, 15, 0.3, 30, 0.7, 60, 1],
          'heatmap-color': [
            'interpolate',
            ['linear'],
            ['heatmap-density'],
            0,
            'rgba(0,0,255,0)',
            0.3,
            'rgba(0,229,255,0.35)',
            0.6,
            'rgba(254,179,0,0.75)',
            1,
            'rgba(255,180,171,0.88)',
          ],
          'heatmap-radius': 38,
          'heatmap-opacity': 0.85,
        },
      })

      map.addLayer({
        id: 'flood-circles',
        type: 'circle',
        source: 'flood-points',
        paint: {
          'circle-radius': 6,
          'circle-color': [
            'match',
            ['get', 'severity'],
            'heavy',
            '#ffb4ab',
            'moderate',
            '#feb300',
            'light',
            '#00e5ff',
            '#849396',
          ],
          'circle-stroke-width': 1,
          'circle-stroke-color': '#0a0e18',
          'circle-opacity': 0.95,
        },
      })

      map.on('click', 'flood-circles', (e) => {
        const feature = e.features?.[0]
        const p = feature?.properties
        const id = p?.id as string | undefined
        const street = (p?.street_name as string | undefined) ?? 'Unknown'
        const district = (p?.district as string | undefined) ?? ''
        const depth = Number(p?.depth_cm ?? 0)
        if (id) onSelectFloodRef.current?.(id)

        const html = `
          <div style="font-family: Inter, ui-sans-serif, system-ui; font-size: 12px; color: #dfe2f1;">
            <div style="font-family: 'Space Grotesk', ui-sans-serif, system-ui; font-size: 15px; font-weight: 700; letter-spacing: -0.03em; margin-bottom: 2px;">${street}</div>
            <div style="opacity: 0.78;">${district}</div>
            <div style="margin-top: 8px; color: #c3f5ff;">Depth: ${depth ? `${depth}cm` : 'unknown'}</div>
          </div>
        `

        const lngLat = e.lngLat
        popupRef.current?.setLngLat(lngLat).setHTML(html).addTo(map)
      })

      map.on('mouseenter', 'flood-circles', () => {
        map.getCanvas().style.cursor = 'pointer'
      })
      map.on('mouseleave', 'flood-circles', () => {
        map.getCanvas().style.cursor = ''
      })
    })

    return () => {
      setMapReady(false)
      popupRef.current?.remove()
      searchMarkerRef.current?.remove()
      searchMarkerRef.current = null
      map.remove()
      mapRef.current = null
    }
  }, [token])

  useEffect(() => {
    const map = mapRef.current
    if (!map || !mapReady) return
    const src = map.getSource('flood-points') as mapboxgl.GeoJSONSource | undefined
    if (src) src.setData(floodsGeo as unknown as GeoJSON.FeatureCollection)
  }, [floodsGeo, mapReady])

  useEffect(() => {
    const map = mapRef.current
    if (!map || !mapReady) return
    const has = !!map.getSource('route-line')
    if (!routeGeo) {
      if (has) {
        if (map.getLayer('route-line-layer')) map.removeLayer('route-line-layer')
        map.removeSource('route-line')
      }
      return
    }

    const lineColor = hasFloodIntersection ? '#ff6b35' : '#00e5ff'
    const dashArray = hasFloodIntersection ? [2, 2] : undefined

    if (!has) {
      map.addSource('route-line', { type: 'geojson', data: routeGeo as unknown as GeoJSON.FeatureCollection })
      map.addLayer({
        id: 'route-line-layer',
        type: 'line',
        source: 'route-line',
        paint: {
          'line-color': lineColor,
          'line-width': 4,
          'line-opacity': 0.95,
          ...(dashArray ? { 'line-dasharray': dashArray } : {}),
        },
      })
      return
    }
    const src = map.getSource('route-line') as mapboxgl.GeoJSONSource | undefined
    if (src) src.setData(routeGeo as unknown as GeoJSON.FeatureCollection)
    if (map.getLayer('route-line-layer')) {
      map.setPaintProperty('route-line-layer', 'line-color', lineColor)
      map.setPaintProperty('route-line-layer', 'line-dasharray', dashArray ?? [])
    }
  }, [routeGeo, hasFloodIntersection, mapReady])

  useEffect(() => {
    const map = mapRef.current
    if (!map || !mapReady) return
    const has = !!map.getSource('safe-route-line')
    if (!altRouteGeo) {
      if (has) {
        if (map.getLayer('safe-route-line-layer')) map.removeLayer('safe-route-line-layer')
        map.removeSource('safe-route-line')
      }
      return
    }
    if (!has) {
      map.addSource('safe-route-line', { type: 'geojson', data: altRouteGeo as unknown as GeoJSON.FeatureCollection })
      map.addLayer({
        id: 'safe-route-line-layer',
        type: 'line',
        source: 'safe-route-line',
        paint: {
          'line-color': '#4ade80',
          'line-width': 4,
          'line-opacity': 0.95,
        },
      })
      return
    }
    const src = map.getSource('safe-route-line') as mapboxgl.GeoJSONSource | undefined
    if (src) src.setData(altRouteGeo as unknown as GeoJSON.FeatureCollection)
  }, [altRouteGeo, mapReady])

  useEffect(() => {
    const map = mapRef.current
    if (!map || !mapReady) return

    if (!focusLocation) {
      searchMarkerRef.current?.remove()
      searchMarkerRef.current = null
      return
    }

    const marker = searchMarkerRef.current ?? new mapboxgl.Marker({ color: '#feb300' })
    marker.setLngLat([focusLocation.coordinates.lng, focusLocation.coordinates.lat]).addTo(map)
    searchMarkerRef.current = marker

    map.flyTo({
      center: [focusLocation.coordinates.lng, focusLocation.coordinates.lat],
      zoom: 14.5,
      essential: true,
    })
  }, [focusLocation, mapReady])

  if (!token) {
    return (
      <div className="h-full w-full rounded-[2rem] border border-outline-variant/15 bg-surface-container-lowest p-6">
        <div className="text-sm text-on-surface">Mapbox token missing.</div>
        <div className="mt-2 text-xs text-on-surface-variant">
          Set <span className="font-mono">VITE_MAPBOX_TOKEN</span> in <span className="font-mono">.env</span> to enable the map.
        </div>
      </div>
    )
  }

  return <div ref={containerRef} className="h-full w-full overflow-hidden rounded-[2rem]" />
}
