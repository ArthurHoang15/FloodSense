import { Bell, Bookmark, Volume2 } from 'lucide-react'
import SurfaceCard from '@/components/ui/SurfaceCard'

type Props = {
  savedRouteCount: number
  voiceEnabled: boolean
}

export default function TopNavigation({ savedRouteCount, voiceEnabled }: Props) {
  return (
    <nav className="fixed inset-x-0 top-0 z-50 px-3 py-3 md:px-6">
      <SurfaceCard tone="glass" className="mx-auto flex max-w-[1600px] items-center justify-between px-4 py-3 md:px-6">
        <div className="flex items-center gap-8">
          <div>
            <div className="font-headline text-xl font-black tracking-[-0.08em] text-primary-container">FloodSense HCM</div>
            <div className="fs-kicker mt-1 hidden md:block">Realtime flood intelligence for Ho Chi Minh City</div>
          </div>
          <div className="hidden items-center gap-6 text-sm text-on-surface-variant md:flex">
            <span className="border-b-2 border-primary-container pb-1 font-medium text-primary">Live Map</span>
            <span>Route Check</span>
            <span>Intelligence</span>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="hidden items-center gap-2 rounded-2xl border border-outline-variant/15 bg-surface-container-high/80 px-3 py-2 lg:flex">
            <Bookmark className="h-4 w-4 text-primary-fixed-dim" />
            <span className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">
              {savedRouteCount} saved routes
            </span>
          </div>
          <div className="hidden items-center gap-2 rounded-2xl border border-outline-variant/15 bg-surface-container-high/80 px-3 py-2 md:flex">
            <Volume2 className="h-4 w-4 text-primary-fixed-dim" />
            <span className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">
              Voice {voiceEnabled ? 'enabled' : 'muted'}
            </span>
          </div>
          <button type="button" className="fs-icon-button" aria-label="Notifications summary">
            <Bell className="h-5 w-5" />
          </button>
          <div className="flex h-11 w-11 items-center justify-center rounded-full border border-outline-variant/15 bg-surface-container-highest text-primary">
            FS
          </div>
        </div>
      </SurfaceCard>
    </nav>
  )
}