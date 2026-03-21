import { useEffect, useMemo, useRef, useState } from 'react'
import FloodMap from '@/components/FloodMap'
import Legend from '@/components/Legend'
import RoutePlanner from '@/components/RoutePlanner'
import DemoControls from '@/components/DemoControls'
import SavedRoutesPanel from '@/components/SavedRoutesPanel'
import NotificationsPanel from '@/components/NotificationsPanel'
import { useFloodStore } from '@/stores/floodStore'
import { useRouteCheckStore } from '@/stores/routeCheckStore'
import { useSavedRoutesStore } from '@/stores/savedRoutesStore'
import { useSettingsStore } from '@/stores/settingsStore'
import { useInterval } from '@/hooks/useInterval'
import type { FloodEvent, LatLng, SavedRoute } from '../../shared/types'
import { haversineMeters } from '@/utils/geo'

function floodHitsRoute(f: FloodEvent, r: SavedRoute): boolean {
  const p = { lat: f.coordinates.lat, lng: f.coordinates.lng }
  for (const c of r.route_coords) {
    if (haversineMeters(p, c) <= 200) return true
  }
  return false
}

async function showAlert(title: string, body: string) {
  if (!('Notification' in window)) return
  if (Notification.permission !== 'granted') return
  if ('serviceWorker' in navigator) {
    const reg = await navigator.serviceWorker.getRegistration()
    if (reg) {
      await reg.showNotification(title, { body, data: { url: '/' } })
      return
    }
  }
  new Notification(title, { body })
}

export default function Home() {
  const { fetchFloods, simulating, stepSimulation } = useFloodStore()
  const floods = useFloodStore((s) => s.displayFloods())
  const routeData = useRouteCheckStore((s) => s.data)
  const { routes } = useSavedRoutesStore()
  const { notificationsEnabled } = useSettingsStore()

  const [routeCoords, setRouteCoords] = useState<LatLng[] | null>(null)
  const [lastAlert, setLastAlert] = useState<{ title: string; body: string } | null>(null)
  const notifiedRef = useRef<Record<string, true>>({})

  useEffect(() => {
    fetchFloods().catch(() => {})
  }, [fetchFloods])

  useEffect(() => {
    if (routeData?.route?.coords?.length) setRouteCoords(routeData.route.coords)
  }, [routeData])

  useInterval(() => {
    fetchFloods().catch(() => {})
  }, 60_000)

  useInterval(
    () => {
      stepSimulation()
    },
    simulating ? 1500 : null,
  )

  const activeRoutes = useMemo(() => routes.filter((r) => r.notify_enabled), [routes])

  useEffect(() => {
    if (!notificationsEnabled) return
    if (activeRoutes.length === 0) return
    if (!floods.length) return

    const hits: Array<{ route: SavedRoute; flood: FloodEvent }> = []
    for (const r of activeRoutes) {
      for (const f of floods) {
        const key = `${r.id}:${f.id}`
        if (notifiedRef.current[key]) continue
        if (!floodHitsRoute(f, r)) continue
        hits.push({ route: r, flood: f })
      }
    }
    if (hits.length === 0) return

    const first = hits[0]
    const title = `Flood alert: ${first.route.name}`
    const body = `${first.flood.street_name} (${first.flood.district}) is affecting your route.`
    setLastAlert({ title, body })
    showAlert(title, body).catch(() => {})
    for (const h of hits) {
      notifiedRef.current[`${h.route.id}:${h.flood.id}`] = true
    }
  }, [activeRoutes, floods, notificationsEnabled])

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100">
      <div className="mx-auto max-w-7xl px-4 py-6">
        <div className="flex items-end justify-between gap-4">
          <div>
            <div className="text-xl font-semibold tracking-tight">FloodSense (Mock-first)</div>
            <div className="mt-1 text-sm text-zinc-400">HCMC flood heatmap, route risk, alerts, and demo simulation.</div>
          </div>
          <div className="text-xs text-zinc-500">Backend: Express on :3001 · Client: Vite</div>
        </div>

        <div className="mt-6 grid gap-4 lg:grid-cols-[1.4fr_0.8fr]">
          <div className="relative h-[70vh] min-h-[520px]">
            <FloodMap floods={floods} routeCoords={routeCoords} />
            <div className="absolute left-4 top-4">
              <Legend />
            </div>
            <div className="absolute bottom-4 left-4 rounded-xl border border-zinc-800 bg-zinc-950/80 px-3 py-2 text-xs text-zinc-300 backdrop-blur">
              Showing {floods.length} flood point(s)
            </div>
          </div>

          <div className="grid gap-4">
            <RoutePlanner onRouteReady={(coords) => setRouteCoords(coords)} />
            <DemoControls />
            <NotificationsPanel lastAlert={lastAlert} />
            <SavedRoutesPanel />
          </div>
        </div>
      </div>
    </div>
  )
}
