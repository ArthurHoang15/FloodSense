import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { RouteCheckHistoryEntry, RouteCheckRequest, RouteCheckResponse } from '../../shared/types'
import { apiGet, apiPost } from '@/utils/api'

const MAX_ROUTE_HISTORY = 50

type RouteCheckState = {
  loading: boolean
  error: string | null
  data: RouteCheckResponse | null
  history: RouteCheckHistoryEntry[]
  checkRoute: (origin: RouteCheckRequest['origin'], destination: RouteCheckRequest['destination']) => Promise<RouteCheckResponse | null>
  loadHistory: () => Promise<void>
  syncHistory: () => Promise<void>
  clear: () => void
  clearHistory: () => void
}

type RouteCheckApiResponse = { success: boolean } & Partial<RouteCheckResponse> & { error?: string }

function toLocationLabel(input: RouteCheckRequest['origin']) {
  if (typeof input === 'string') return input
  if (typeof input.address === 'string' && input.address.trim()) return input.address
  return `${input.lat}, ${input.lng}`
}

function toHistoryEntry(
  origin: RouteCheckRequest['origin'],
  destination: RouteCheckRequest['destination'],
  data: RouteCheckResponse,
): RouteCheckHistoryEntry {
  return {
    id: crypto.randomUUID(),
    checked_at: new Date().toISOString(),
    origin_label: toLocationLabel(origin),
    destination_label: toLocationLabel(destination),
    risk_level: data.forecast?.riskLevel ?? 'unknown',
    confirmed_flood_count: data.floodZones.length,
    forecast_flood_count: data.forecast?.dataPoints.forecastFloodsOnRoute ?? 0,
    has_alternative_route: !!data.alternativeRoute,
    result: data,
  }
}

export const useRouteCheckStore = create<RouteCheckState>()(
  persist(
    (set, get) => ({
      loading: false,
      error: null,
      data: null,
      history: [],
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
            alternativeRoute: (res.alternativeRoute as RouteCheckResponse['alternativeRoute']) ?? null,
            floodZones: (res.floodZones as RouteCheckResponse['floodZones']) ?? [],
            warnings: (res.warnings as RouteCheckResponse['warnings']) ?? [],
            alertText: (res.alertText as RouteCheckResponse['alertText']) ?? null,
            forecast: (res.forecast as RouteCheckResponse['forecast']) ?? null,
          }
          const historyEntry = toHistoryEntry(origin, destination, data)
          set((state) => ({
            loading: false,
            data,
            history: [historyEntry, ...state.history].slice(0, MAX_ROUTE_HISTORY),
          }))
          void apiPost<{ success: boolean; inserted: number }>('/api/route-history/bulk', { entries: [historyEntry] }).catch(() => {})
          return data
        } catch (e) {
          const msg = e instanceof Error ? e.message : 'Route check failed'
          set({ loading: false, error: msg })
          return null
        }
      },
      loadHistory: async () => {
        try {
          const res = await apiGet<{ success: boolean; history: RouteCheckHistoryEntry[] }>('/api/route-history')
          if (res.success) {
            set((state) => {
              const merged = [...res.history, ...state.history].reduce<RouteCheckHistoryEntry[]>((acc, entry) => {
                if (!acc.some((item) => item.id === entry.id)) acc.push(entry)
                return acc
              }, [])
              merged.sort((a, b) => new Date(b.checked_at).getTime() - new Date(a.checked_at).getTime())
              return { history: merged.slice(0, MAX_ROUTE_HISTORY) }
            })
          }
        } catch {
          // keep local history when server load fails
        }
      },
      syncHistory: async () => {
        const entries = get().history
        if (entries.length === 0) return
        try {
          await apiPost<{ success: boolean; inserted: number }>('/api/route-history/bulk', { entries })
        } catch {
          // ignore sync failures and keep local cache
        }
      },
      clear: () => set({ data: null, error: null, loading: false }),
      clearHistory: () => set({ history: [] }),
    }),
    {
      name: 'floodsense_route_check_v1',
      partialize: (state) => ({
        data: state.data,
        history: state.history,
      }),
    },
  ),
)
