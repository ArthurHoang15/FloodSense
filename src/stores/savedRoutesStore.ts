import { create } from 'zustand'
import type { SavedRoute } from '../../shared/types'
import { apiGet, apiPost, apiPatch, apiDelete } from '@/utils/api'

type ApiRouteRow = {
  id: string
  name: string
  origin_lat: number
  origin_lng: number
  origin_address: string | null
  destination_lat: number
  destination_lng: number
  destination_address: string | null
  route_polyline: string | null
  bbox_north: number
  bbox_south: number
  bbox_east: number
  bbox_west: number
  notify_enabled: boolean
  created_at: string
}

function rowToSavedRoute(row: ApiRouteRow): SavedRoute {
  let route_coords: SavedRoute['route_coords'] = []
  try {
    if (row.route_polyline) route_coords = JSON.parse(row.route_polyline) as SavedRoute['route_coords']
  } catch {
    // malformed JSON — leave empty
  }
  return {
    id: row.id,
    name: row.name,
    origin: { lat: row.origin_lat, lng: row.origin_lng, address: row.origin_address ?? undefined },
    destination: { lat: row.destination_lat, lng: row.destination_lng, address: row.destination_address ?? undefined },
    route_coords,
    bounding_box: { north: row.bbox_north, south: row.bbox_south, east: row.bbox_east, west: row.bbox_west },
    notify_enabled: row.notify_enabled,
    created_at: row.created_at,
  }
}

type SavedRoutesState = {
  routes: SavedRoute[]
  loading: boolean
  loadRoutes: () => Promise<void>
  addRoute: (r: SavedRoute) => Promise<void>
  removeRoute: (id: string) => Promise<void>
  toggleNotify: (id: string) => Promise<void>
}

export const useSavedRoutesStore = create<SavedRoutesState>()((set, get) => ({
  routes: [],
  loading: false,

  loadRoutes: async () => {
    set({ loading: true })
    try {
      const res = await apiGet<{ success: boolean; routes: ApiRouteRow[] }>('/api/saved-routes')
      set({ routes: res.routes.map(rowToSavedRoute) })
    } catch (err) {
      console.error('[savedRoutesStore] loadRoutes failed:', err)
    } finally {
      set({ loading: false })
    }
  },

  addRoute: async (r: SavedRoute) => {
    // Optimistic update
    set({ routes: [r, ...get().routes].slice(0, 3) })
    try {
      const res = await apiPost<{ success: boolean; route: ApiRouteRow }>('/api/saved-routes', {
        name: r.name,
        origin: r.origin,
        destination: r.destination,
        route_polyline: JSON.stringify(r.route_coords),
        bounding_box: r.bounding_box,
        notify_enabled: r.notify_enabled,
      })
      if (res.success && res.route) {
        // Replace local temp entry with server-assigned ID
        set({
          routes: get().routes.map((x) => (x.id === r.id ? rowToSavedRoute(res.route) : x)),
        })
      }
    } catch (err) {
      console.error('[savedRoutesStore] addRoute failed:', err)
      // Rollback optimistic update
      set({ routes: get().routes.filter((x) => x.id !== r.id) })
    }
  },

  removeRoute: async (id: string) => {
    const prev = get().routes
    set({ routes: prev.filter((r) => r.id !== id) })
    try {
      await apiDelete(`/api/saved-routes/${id}`)
    } catch (err) {
      console.error('[savedRoutesStore] removeRoute failed:', err)
      set({ routes: prev })
    }
  },

  toggleNotify: async (id: string) => {
    const prev = get().routes
    const route = prev.find((r) => r.id === id)
    if (!route) return
    const next = !route.notify_enabled
    set({ routes: prev.map((r) => (r.id === id ? { ...r, notify_enabled: next } : r)) })
    try {
      await apiPatch(`/api/saved-routes/${id}`, { notify_enabled: next })
    } catch (err) {
      console.error('[savedRoutesStore] toggleNotify failed:', err)
      set({ routes: prev })
    }
  },
}))
