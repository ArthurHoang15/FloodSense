import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { SavedRoute } from '../../shared/types'

type SavedRoutesState = {
  routes: SavedRoute[]
  addRoute: (r: SavedRoute) => void
  removeRoute: (id: string) => void
  toggleNotify: (id: string) => void
}

export const useSavedRoutesStore = create<SavedRoutesState>()(
  persist(
    (set, get) => ({
      routes: [],
      addRoute: (r) => set({ routes: [r, ...get().routes].slice(0, 20) }),
      removeRoute: (id) => set({ routes: get().routes.filter((r) => r.id !== id) }),
      toggleNotify: (id) =>
        set({
          routes: get().routes.map((r) =>
            r.id === id ? { ...r, notify_enabled: !r.notify_enabled } : r,
          ),
        }),
    }),
    { name: 'floodsense_saved_routes_v1' },
  ),
)
