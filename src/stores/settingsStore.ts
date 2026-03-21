import { create } from 'zustand'
import { persist } from 'zustand/middleware'

type VoiceVariant = 'female_south' | 'male_north'

type SettingsState = {
  voiceEnabled: boolean
  voiceVariant: VoiceVariant
  notificationsEnabled: boolean
  setVoiceEnabled: (v: boolean) => void
  setVoiceVariant: (v: VoiceVariant) => void
  setNotificationsEnabled: (v: boolean) => void
}

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      voiceEnabled: true,
      voiceVariant: 'female_south',
      notificationsEnabled: false,
      setVoiceEnabled: (v) => set({ voiceEnabled: v }),
      setVoiceVariant: (v) => set({ voiceVariant: v }),
      setNotificationsEnabled: (v) => set({ notificationsEnabled: v }),
    }),
    { name: 'floodsense_settings_v1' },
  ),
)

export type { VoiceVariant }
