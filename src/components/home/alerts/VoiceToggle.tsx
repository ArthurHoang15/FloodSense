import { Volume2, VolumeX } from 'lucide-react'
import { useSettingsStore } from '@/stores/settingsStore'
import SurfaceCard from '@/components/ui/SurfaceCard'

export default function VoiceToggle() {
  const { voiceEnabled, setVoiceEnabled } = useSettingsStore()

  return (
    <div className="absolute bottom-6 right-4 z-30 md:bottom-8 md:right-6">
      <button type="button" onClick={() => setVoiceEnabled(!voiceEnabled)}>
        <SurfaceCard tone="glass" className="flex items-center gap-3 px-5 py-4">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-primary-container/15 text-primary-container">
            {voiceEnabled ? <Volume2 className="h-5 w-5" /> : <VolumeX className="h-5 w-5" />}
          </div>
          <div className="text-left">
            <div className="fs-kicker">Vietnamese voice</div>
            <div className="mt-1 text-sm font-semibold text-primary">{voiceEnabled ? 'Alerts enabled' : 'Alerts muted'}</div>
          </div>
        </SurfaceCard>
      </button>
    </div>
  )
}