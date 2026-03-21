import SurfaceCard from '@/components/ui/SurfaceCard'
import SeverityBadge from '@/components/ui/SeverityBadge'
import type { Severity } from '../../../../shared/types'

type FeedItem = {
  id: string
  time: string
  tone: string
  headline: string
  body: string
  severity: Severity
}

type Props = {
  items: FeedItem[]
}

export default function IntelligenceFeed({ items }: Props) {
  return (
    <div className="absolute bottom-6 left-4 z-30 hidden w-[420px] max-w-[calc(100%-2rem)] lg:block xl:left-6 xl:bottom-8">
      <SurfaceCard tone="glass" className="p-6">
        <div className="flex items-center justify-between gap-3">
          <div>
            <div className="font-headline text-2xl font-black tracking-[-0.08em] text-primary">Intelligence Feed</div>
            <div className="mt-1 text-xs text-on-surface-variant">Realtime signals synthesized from mock telemetry and reports</div>
          </div>
          <span className="rounded-full bg-primary-container/12 px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-primary">
            Live 0.4s
          </span>
        </div>

        <div className="fs-scrollbar mt-6 grid max-h-[290px] gap-4 overflow-y-auto pr-2">
          {items.map((item) => (
            <div key={item.id} className="grid grid-cols-[8px_1fr] gap-4">
              <div className={item.severity === 'heavy' ? 'rounded-full bg-error' : item.severity === 'moderate' ? 'rounded-full bg-secondary-container' : 'rounded-full bg-primary-container'} />
              <div>
                <div className="flex items-center gap-2">
                  <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-on-surface-variant">
                    {item.time} • {item.tone}
                  </div>
                  <SeverityBadge severity={item.severity} className="scale-[0.9]" />
                </div>
                <div className="mt-2 text-sm font-semibold leading-6 text-on-surface">{item.headline}</div>
                <div className="mt-2 text-sm leading-6 text-on-surface-variant">{item.body}</div>
              </div>
            </div>
          ))}
        </div>
      </SurfaceCard>
    </div>
  )
}