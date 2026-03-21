import { create } from 'zustand'
import type { FloodEvent } from '../../shared/types'
import { apiGet, apiPost, apiPostInternal } from '@/utils/api'

type FloodsApiResponse = { success: boolean; floods: FloodEvent[]; now: string }
type SimulateResponse = { success: boolean; enabled: boolean; floods: FloodEvent[] }

type FloodState = {
  baseFloods: FloodEvent[]
  simulatedVisible: FloodEvent[]
  simulating: boolean
  simulationQueue: FloodEvent[]
  lastFetchIso: string | null
  fetchFloods: () => Promise<void>
  startSimulateRain: () => Promise<void>
  resetSimulated: () => Promise<void>
  stepSimulation: () => void
  displayFloods: () => FloodEvent[]
}

export const useFloodStore = create<FloodState>((set, get) => ({
  baseFloods: [],
  simulatedVisible: [],
  simulating: false,
  simulationQueue: [],
  lastFetchIso: null,
  fetchFloods: async () => {
    const data = await apiGet<FloodsApiResponse>('/api/floods?district=all&severity=all&limit=200')
    if (!data.success) return
    set({ baseFloods: data.floods, lastFetchIso: data.now })
  },
  startSimulateRain: async () => {
    const data = await apiPostInternal<SimulateResponse>('/api/internal/simulate-rain', {
      preset: 'heavy_rain_hcmc',
      enable: true,
    })
    if (!data.success) return
    set({
      simulating: true,
      simulationQueue: data.floods,
      simulatedVisible: [],
    })
  },
  resetSimulated: async () => {
    await apiPostInternal('/api/internal/reset-simulated', {})
    set({ simulating: false, simulationQueue: [], simulatedVisible: [] })
    await get().fetchFloods()
  },
  stepSimulation: () => {
    const { simulationQueue, simulatedVisible } = get()
    if (simulationQueue.length === 0) {
      set({ simulating: false })
      return
    }
    const next = simulationQueue[0]
    set({
      simulationQueue: simulationQueue.slice(1),
      simulatedVisible: [...simulatedVisible, next],
    })
  },
  displayFloods: () => {
    const { baseFloods, simulating, simulatedVisible } = get()
    if (!simulating) return baseFloods
    const baseNoSim = baseFloods.filter((f) => !f.is_simulated)
    return [...simulatedVisible, ...baseNoSim]
  },
}))
