import SurfaceCard from '@/components/ui/SurfaceCard'
import { cn } from '@/lib/utils'

type HistoryBar = {
  day: string
  heightPercent: number
  tone: 'muted' | 'primary' | 'secondary'
  highlighted: boolean
}

type Props = {
  items: HistoryBar[]
  className?: string
}

function barToneClass(tone: HistoryBar['tone']) {
  if (tone === 'primary') return 'bg-primary/40 border-t-2 border-primary'
  if (tone === 'secondary') return 'bg-secondary-container/40 border-t-2 border-secondary-container'
  return 'bg-surface-container-highest'
}

export default function FloodHistoryCard({ items, className }: Props) {
  return (
    <SurfaceCard className={cn('h-full p-8', className)}>
      <h3 className="font-headline text-2xl font-bold tracking-[-0.05em] text-on-surface">Flood History (7D)</h3>

      <div className="mt-6 flex h-48 items-end justify-between gap-2 pb-4">
        {items.map((item) => (
          <div key={item.day} className="group flex flex-1 flex-col items-center gap-2">
            <div className={`w-full rounded-t-lg transition-all group-hover:brightness-110 ${barToneClass(item.tone)}`} style={{ height: `${item.heightPercent}%` }} />
            <span className={item.highlighted ? 'text-[10px] font-bold text-primary' : 'text-[10px] font-bold text-on-surface-variant'}>{item.day}</span>
          </div>
        ))}
      </div>

      <div className="mt-4 flex items-center gap-2 border-t border-outline-variant/10 pt-4">
        <span className="h-2 w-2 rounded-full bg-primary" />
        <span className="text-xs text-on-surface-variant">Peak intensity occurred mid-week, matching the current rainfall escalation window.</span>
      </div>
    </SurfaceCard>
  )
}