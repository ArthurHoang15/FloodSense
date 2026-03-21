import { Bell, Bookmark, Volume2 } from 'lucide-react'
import { Link } from 'react-router-dom'
import SurfaceCard from '@/components/ui/SurfaceCard'

type NavSection = 'live-map' | 'route-check' | 'intelligence'

type Props = {
  savedRouteCount: number
  voiceEnabled: boolean
  activeSection?: NavSection
}

const navItems: Array<{ id: NavSection; label: string; to?: string }> = [
  { id: 'live-map', label: 'Live Map', to: '/' },
  { id: 'route-check', label: 'Route Check' },
  { id: 'intelligence', label: 'Intelligence', to: '/intelligence' },
]

export default function TopNavigation({ savedRouteCount, voiceEnabled, activeSection = 'live-map' }: Props) {
  return (
    <nav className="fixed inset-x-0 top-0 z-50 px-3 py-3 md:px-6">
      <SurfaceCard tone="glass" className="mx-auto flex max-w-[1600px] items-center justify-between px-4 py-3 md:px-6">
        <div className="flex items-center gap-8">
          <Link to="/">
            <div className="font-headline text-xl font-black tracking-[-0.08em] text-primary-container">FloodSense HCM</div>
            <div className="fs-kicker mt-1 hidden md:block">Realtime flood intelligence for Ho Chi Minh City</div>
          </Link>
          <div className="hidden items-center gap-6 text-sm text-on-surface-variant md:flex">
            {navItems.map((item) => {
              const active = item.id === activeSection
              const className = active
                ? 'border-b-2 border-primary-container pb-1 font-medium text-primary'
                : 'font-medium text-on-surface-variant transition hover:text-on-surface'

              if (!item.to) {
                return (
                  <span key={item.id} className={className}>
                    {item.label}
                  </span>
                )
              }

              return (
                <Link key={item.id} to={item.to} className={className}>
                  {item.label}
                </Link>
              )
            })}
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