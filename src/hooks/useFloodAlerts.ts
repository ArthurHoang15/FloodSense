import { useEffect, useMemo, useRef, useState } from 'react'
import { haversineMeters } from '@/utils/geo'
import { buildAlertBody } from '@/utils/floodPresentation'
import type { FloodEvent, SavedRoute } from '../../shared/types'

function floodHitsRoute(flood: FloodEvent, route: SavedRoute) {
  const floodPoint = { lat: flood.coordinates.lat, lng: flood.coordinates.lng }
  for (const coordinate of route.route_coords) {
    if (haversineMeters(floodPoint, coordinate) <= 200) {
      return true
    }
  }
  return false
}

async function showAlert(title: string, body: string) {
  if (!('Notification' in window)) return
  if (Notification.permission !== 'granted') return

  if ('serviceWorker' in navigator) {
    const registration = await navigator.serviceWorker.getRegistration()
    if (registration) {
      await registration.showNotification(title, { body, data: { url: '/' } })
      return
    }
  }

  new Notification(title, { body })
}

type AlertState = {
  lastAlert: { title: string; body: string } | null
  impactedRouteIds: string[]
}

export function useFloodAlerts(floods: FloodEvent[], routes: SavedRoute[], notificationsEnabled: boolean): AlertState {
  const [lastAlert, setLastAlert] = useState<{ title: string; body: string } | null>(null)
  const notifiedRef = useRef<Record<string, true>>({})

  const activeRoutes = useMemo(() => routes.filter((route) => route.notify_enabled), [routes])
  const impactedRouteIds = useMemo(() => {
    const impacted = new Set<string>()
    for (const route of activeRoutes) {
      for (const flood of floods) {
        if (floodHitsRoute(flood, route)) impacted.add(route.id)
      }
    }
    return [...impacted]
  }, [activeRoutes, floods])

  useEffect(() => {
    if (!notificationsEnabled || activeRoutes.length === 0 || floods.length === 0) return

    const hits: Array<{ route: SavedRoute; flood: FloodEvent }> = []
    for (const route of activeRoutes) {
      for (const flood of floods) {
        const key = `${route.id}:${flood.id}`
        if (notifiedRef.current[key]) continue
        if (!floodHitsRoute(flood, route)) continue
        hits.push({ route, flood })
      }
    }

    if (hits.length === 0) return

    const firstHit = hits[0]
    const title = `Flood alert: ${firstHit.route.name}`
    const body = buildAlertBody(firstHit.flood)
    setLastAlert({ title, body })
    showAlert(title, body).catch(() => {})

    for (const hit of hits) {
      notifiedRef.current[`${hit.route.id}:${hit.flood.id}`] = true
    }
  }, [activeRoutes, floods, notificationsEnabled])

  return { lastAlert, impactedRouteIds }
}