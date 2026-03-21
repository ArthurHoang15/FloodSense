import { create } from 'zustand'
import type { RouteCheckResponse } from '../../shared/types'
import { apiPost } from '@/utils/api'

type RouteCheckState = {
  loading: boolean
  error: string | null
  data: RouteCheckResponse | null
  checkRoute: (origin: string, destination: string) => Promise<RouteCheckResponse | null>
  clear: () => void
}

type RouteCheckApiResponse = { success: boolean } & Partial<RouteCheckResponse> & { error?: string }

export const useRouteCheckStore = create<RouteCheckState>((set) => ({
  loading: false,
  error: null,
  data: null,
  checkRoute: async (origin, destination) => {
    set({ loading: true, error: null })
    try {
      const res = await apiPost<RouteCheckApiResponse>('/api/route-check', { origin, destination })
      if (!res.success) {
        const msg = res.error ?? 'Route check failed'
        set({ loading: false, error: msg })
        return null
      }
      const data: RouteCheckResponse = {
        route: res.route as RouteCheckResponse['route'],
        floodZones: (res.floodZones as RouteCheckResponse['floodZones']) ?? [],
        warnings: (res.warnings as RouteCheckResponse['warnings']) ?? [],
        alertText: (res.alertText as RouteCheckResponse['alertText']) ?? null,
      }
      set({ loading: false, data })
      return data
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Route check failed'
      set({ loading: false, error: msg })
      return null
    }
  },
  clear: () => set({ data: null, error: null, loading: false }),
}))
