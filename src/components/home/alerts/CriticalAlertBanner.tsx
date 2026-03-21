import { useEffect, useState } from 'react'
import { AlertTriangle, X } from 'lucide-react'
import SurfaceCard from '@/components/ui/SurfaceCard'
import { buildFloodNarrative, formatDepth } from '@/utils/floodPresentation'
import type { FloodEvent } from '../../../../shared/types'

type Props = {
  flood: FloodEvent | null
}

export default function CriticalAlertBanner({ flood }: Props) {
  const [dismissedFloodId, setDismissedFloodId] = useState<string | null>(null)

  useEffect(() => {
    if (!flood) {
      setDismissedFloodId(null)
      return
    }

    if (dismissedFloodId && dismissedFloodId !== flood.id) {
      setDismissedFloodId(null)
    }
  }, [dismissedFloodId, flood])

  if (flood && dismissedFloodId === flood.id) return null
  if (!flood) return null

  return (
    <div className="absolute left-1/2 top-4 z-30 w-full max-w-2xl -translate-x-1/2 px-4 md:top-6">
      <SurfaceCard tone="glass" className="border-error/20 bg-error-container/72 p-4 shadow-ambient-error">
        <div className="flex items-center gap-4">
          <div className="flex h-12 w-12 flex-none items-center justify-center rounded-2xl bg-error text-on-error">
            <AlertTriangle className="h-6 w-6" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="font-headline text-xl font-bold tracking-[-0.05em] text-on-error-container">
              {flood.street_name} is heavily flooded
            </div>
            <div className="mt-1 text-sm text-on-error-container/80">{flood.district} | Estimated depth {formatDepth(flood.depth_cm)}</div>
            <div className="mt-2 text-xs text-on-error-container/70">{buildFloodNarrative(flood)}</div>
          </div>
          <button
            type="button"
            aria-label="Dismiss critical alert"
            onClick={() => setDismissedFloodId(flood.id)}
            className="fs-icon-button h-10 w-10 flex-none border-error/15 bg-surface-container-highest/20 text-on-error-container"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </SurfaceCard>
    </div>
  )
}
