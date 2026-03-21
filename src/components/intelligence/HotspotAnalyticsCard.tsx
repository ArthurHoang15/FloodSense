import { useMemo, useState } from 'react'
import { BarChart3, X } from 'lucide-react'
import SurfaceCard from '@/components/ui/SurfaceCard'
import { cn } from '@/lib/utils'
import type { Severity } from '../../../shared/types'

type Hotspot = {
  id: string
  name: string
  depthLabel: string
  depthCm: number
  severity: Severity
  widthPercent: number
}

type Props = {
  hotspots: Hotspot[]
  className?: string
}

function fillClass(severity: Severity) {
  if (severity === 'heavy') return 'from-tertiary-container/60 to-tertiary-container text-tertiary-container'
  if (severity === 'moderate') return 'from-secondary-container/60 to-secondary-container text-secondary-container'
  return 'from-primary-container/70 to-primary-container text-primary'
}

export default function HotspotAnalyticsCard({ hotspots, className }: Props) {
  const [reportOpen, setReportOpen] = useState(false)
  const averageDepth = useMemo(() => {
    if (hotspots.length === 0) return 0
    return Math.round(hotspots.reduce((sum, hotspot) => sum + hotspot.depthCm, 0) / hotspots.length)
  }, [hotspots])
  const heavyCount = hotspots.filter((hotspot) => hotspot.severity === 'heavy').length

  return (
    <>
      <SurfaceCard className={cn('flex h-full flex-col p-8', className)}>
        <div className="flex items-center justify-between gap-4">
          <div>
            <h3 className="font-headline text-2xl font-bold tracking-[-0.05em] text-primary">Top 5 Critical Hotspots</h3>
            <p className="mt-1 text-sm text-on-surface-variant">Based on current telemetry intensity and verified flood depth.</p>
          </div>
          <button
            type="button"
            onClick={() => setReportOpen(true)}
            className="inline-flex items-center gap-1 text-sm font-medium text-primary-fixed-dim transition hover:text-primary"
          >
            Full report
          </button>
        </div>

        {hotspots.length === 0 ? (
          <div className="flex flex-1 items-center justify-center">
            <div className="flex max-w-sm flex-col items-center rounded-3xl bg-surface-container-low px-8 py-10 text-center">
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary-container/12 text-primary">
                <BarChart3 className="h-7 w-7" />
              </div>
              <div className="mt-5 font-headline text-2xl font-bold tracking-[-0.05em] text-on-surface">Awaiting hotspot signals</div>
              <p className="mt-3 text-sm leading-6 text-on-surface-variant">
                Once live telemetry or confirmed flood reports arrive, the highest-risk streets will surface here automatically.
              </p>
            </div>
          </div>
        ) : (
          <div className="mt-8 space-y-6">
            {hotspots.map((hotspot) => (
              <div key={hotspot.id} className="group">
                <div className="mb-2 flex items-center justify-between gap-4">
                  <span className="text-sm font-medium text-on-surface">{hotspot.name}</span>
                  <span className={`text-sm font-bold ${fillClass(hotspot.severity).split(' ').at(-1)}`}>{hotspot.depthLabel}</span>
                </div>
                <div className="h-3 w-full overflow-hidden rounded-full bg-surface-container-highest">
                  <div className={`h-full rounded-full bg-gradient-to-r transition group-hover:brightness-110 ${fillClass(hotspot.severity)}`} style={{ width: `${hotspot.widthPercent}%` }} />
                </div>
              </div>
            ))}
          </div>
        )}
      </SurfaceCard>

      {reportOpen ? (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-[#060910]/72 p-4 backdrop-blur-sm">
          <SurfaceCard className="max-h-[85vh] w-full max-w-3xl overflow-y-auto p-6 md:p-8">
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="fs-label">Hotspot report</div>
                <h3 className="mt-2 font-headline text-3xl font-bold tracking-[-0.05em] text-on-surface">Critical hotspot summary</h3>
                <p className="mt-2 max-w-2xl text-sm leading-6 text-on-surface-variant">
                  Ranked snapshot of the highest-risk streets currently tracked by flood depth and severity.
                </p>
              </div>
              <button type="button" aria-label="Close hotspot report" onClick={() => setReportOpen(false)} className="fs-icon-button h-10 w-10">
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="mt-6 grid gap-4 md:grid-cols-3">
              <div className="rounded-3xl bg-surface-container-low p-4">
                <div className="fs-label">Tracked hotspots</div>
                <div className="mt-2 font-headline text-3xl font-bold tracking-[-0.06em] text-primary">{hotspots.length}</div>
              </div>
              <div className="rounded-3xl bg-surface-container-low p-4">
                <div className="fs-label">Heavy severity</div>
                <div className="mt-2 font-headline text-3xl font-bold tracking-[-0.06em] text-tertiary-container">{heavyCount}</div>
              </div>
              <div className="rounded-3xl bg-surface-container-low p-4">
                <div className="fs-label">Average depth</div>
                <div className="mt-2 font-headline text-3xl font-bold tracking-[-0.06em] text-secondary-container">{averageDepth}cm</div>
              </div>
            </div>

            <div className="mt-6 space-y-4">
              {hotspots.length === 0 ? (
                <div className="rounded-3xl bg-surface-container-low px-5 py-6 text-sm leading-6 text-on-surface-variant">
                  No critical hotspots are available yet. This report will populate automatically when live flood signals enter the analytics board.
                </div>
              ) : (
                hotspots.map((hotspot, index) => (
                  <div key={hotspot.id} className="rounded-3xl border border-outline-variant/12 bg-surface-container-low p-5">
                    <div className="flex flex-wrap items-start justify-between gap-4">
                      <div className="min-w-0">
                        <div className="fs-label">Rank {index + 1}</div>
                        <div className="mt-2 text-xl font-semibold text-on-surface">{hotspot.name}</div>
                      </div>
                      <div className={`rounded-full px-3 py-1 text-xs font-semibold ${fillClass(hotspot.severity).split(' ').at(-1)}`}>
                        {hotspot.severity.toUpperCase()}
                      </div>
                    </div>
                    <div className="mt-4 grid gap-3 md:grid-cols-3">
                      <div className="rounded-2xl bg-surface px-4 py-3">
                        <div className="fs-kicker">Estimated depth</div>
                        <div className="mt-1 text-sm text-on-surface">{hotspot.depthLabel}</div>
                      </div>
                      <div className="rounded-2xl bg-surface px-4 py-3">
                        <div className="fs-kicker">Severity</div>
                        <div className="mt-1 text-sm text-on-surface">{hotspot.severity}</div>
                      </div>
                      <div className="rounded-2xl bg-surface px-4 py-3">
                        <div className="fs-kicker">Relative intensity</div>
                        <div className="mt-1 text-sm text-on-surface">{hotspot.widthPercent}%</div>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </SurfaceCard>
        </div>
      ) : null}
    </>
  )
}
