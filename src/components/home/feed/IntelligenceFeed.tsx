import { useState } from 'react'
import { X } from 'lucide-react'
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
  kind: 'flood' | 'forecast'
}

type Props = {
  items: FeedItem[]
}

export default function IntelligenceFeed({ items }: Props) {
  const [dismissed, setDismissed] = useState(false)

  if (dismissed || items.length === 0) {
    return null
  }

  return (
    <div className="absolute bottom-6 left-4 z-30 hidden w-[420px] max-w-[calc(100%-2rem)] lg:block xl:bottom-8 xl:left-6">
      <SurfaceCard tone="glass" className="p-6">
        <div className="flex items-center justify-between gap-3">
          <div>
            <div className="font-headline text-2xl font-black tracking-[-0.08em] text-primary">Intelligence Feed</div>
            <div className="mt-1 text-xs text-on-surface-variant">Realtime signals synthesized from mock telemetry and reports</div>
          </div>
          <div className="flex items-center gap-2">
            <span className="rounded-full bg-primary-container/12 px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-primary">
              Live 0.4s
            </span>
            <button
              type="button"
              aria-label="Close intelligence feed"
              onClick={() => setDismissed(true)}
              className="flex h-8 w-8 items-center justify-center rounded-full border border-outline-variant/15 bg-surface-container-high/70 text-on-surface-variant transition hover:bg-surface-container-highest hover:text-on-surface"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        <div className="fs-scrollbar mt-6 grid max-h-[290px] gap-4 overflow-y-auto pr-2">
          {items.map((item) => (
            <div key={item.id} className="grid grid-cols-[8px_1fr] gap-4">
              <div className={item.kind === 'forecast' ? 'rounded-full bg-yellow-400' : item.severity === 'heavy' ? 'rounded-full bg-error' : item.severity === 'moderate' ? 'rounded-full bg-secondary-container' : 'rounded-full bg-primary-container'} />
              <div>
                <div className="flex items-center gap-2">
                  <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-on-surface-variant">
                    {item.time} | {item.tone}
                  </div>
                  {item.kind === 'forecast' ? (
                    <span className="inline-flex items-center rounded-full border border-yellow-500/35 bg-yellow-500/12 px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-yellow-300">
                      Forecast
                    </span>
                  ) : (
                    <SeverityBadge severity={item.severity} className="scale-[0.9]" />
                  )}
                </div>
                <div className="mt-2 text-sm font-semibold leading-6 text-on-surface">{item.headline}</div>
                <div className={item.kind === 'forecast' ? 'mt-2 text-sm leading-6 text-yellow-100/88' : 'mt-2 text-sm leading-6 text-on-surface-variant'}>{item.body}</div>
              </div>
            </div>
          ))}
        </div>
      </SurfaceCard>
    </div>
  )
}
