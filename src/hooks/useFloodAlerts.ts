import { useEffect, useMemo, useRef, useState } from 'react'
import { buildAlertBody } from '@/utils/floodPresentation'
import { floodHitsRoute, getImpactedRouteIds } from '@/utils/routeInsights'
import type { FloodEvent, SavedRoute } from '../../shared/types'

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
  const impactedRouteIds = useMemo(() => getImpactedRouteIds(floods, activeRoutes), [activeRoutes, floods])

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