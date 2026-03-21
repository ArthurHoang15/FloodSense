import { GraduationCap, Home, Route } from 'lucide-react'
import SurfaceCard from '@/components/ui/SurfaceCard'
import { cn } from '@/lib/utils'

type SavedRouteInsight = {
  id: string
  name: string
  subtitle: string
  status: 'clear' | 'clogged'
  etaLabel: string
  kind: 'home' | 'school' | 'route'
}

type Props = {
  items: SavedRouteInsight[]
  className?: string
}

function iconFor(kind: SavedRouteInsight['kind']) {
  if (kind === 'school') return GraduationCap
  if (kind === 'home') return Home
  return Route
}

export default function SavedRoutesInsightsCard({ items, className }: Props) {
  return (
    <SurfaceCard className={cn('flex h-full flex-col p-8', className)}>
      <div className="flex items-center justify-between gap-4">
        <h3 className="font-headline text-2xl font-bold tracking-[-0.05em] text-on-surface">Saved Routes</h3>
        <button type="button" className="text-on-surface-variant transition hover:text-on-surface">
          ...
        </button>
      </div>

      <div className="mt-6 flex flex-1 flex-col gap-4">
        {items.length === 0 ? (
          <div className="flex flex-1 items-center rounded-2xl bg-surface-container-low px-5 py-5 text-sm text-on-surface-variant">
            No saved routes yet. Save one from Route Check to unlock proactive commute monitoring.
          </div>
        ) : (
          items.map((item) => {
            const Icon = iconFor(item.kind)
            return (
              <div key={item.id} className="flex items-center justify-between gap-4 rounded-2xl bg-surface-container-low px-4 py-4 transition hover:bg-surface-container-high">
                <div className="flex items-center gap-4">
                  <div className={item.status === 'clear' ? 'flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary' : 'flex h-12 w-12 items-center justify-center rounded-full bg-secondary-container/10 text-secondary-container'}>
                    <Icon className="h-5 w-5" />
                  </div>
                  <div>
                    <div className="text-sm font-bold text-on-surface">{item.name}</div>
                    <div className="mt-1 text-xs text-on-surface-variant">{item.subtitle}</div>
                  </div>
                </div>

                <div className="text-right">
                  <span className={item.status === 'clear' ? 'inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.16em] text-emerald-400' : 'inline-flex items-center gap-1 rounded-full bg-secondary-container/12 px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.16em] text-secondary-container'}>
                    {item.status}
                  </span>
                  <div className="mt-1 font-headline text-base font-medium text-on-surface">{item.etaLabel}</div>
                </div>
              </div>
            )
          })
        )}
      </div>
    </SurfaceCard>
  )
}
