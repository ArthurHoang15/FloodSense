import { AlertTriangle, ShieldCheck } from 'lucide-react'
import SurfaceCard from '@/components/ui/SurfaceCard'
import type { RouteRiskForecast } from '../../../shared/types'

type Props = {
  warnings: string[]
  forecast: RouteRiskForecast | null
}

function riskTone(riskLevel: RouteRiskForecast['riskLevel']) {
  if (riskLevel === 'high') return 'border-error/30 bg-error-container/18 text-error'
  if (riskLevel === 'medium') return 'border-secondary-container/30 bg-secondary-container/12 text-secondary'
  return 'border-primary-container/30 bg-primary-container/10 text-primary'
}

export default function RouteWarningsCard({ warnings, forecast }: Props) {
  return (
    <SurfaceCard className="h-full p-5 md:p-6">
      <div className="flex items-center gap-3">
        <div className="rounded-2xl bg-secondary-container/16 p-3 text-secondary">
          <AlertTriangle className="h-5 w-5" />
        </div>
        <div>
          <div className="fs-label">Advisories</div>
          <div className="mt-1 font-headline text-xl font-bold tracking-[-0.05em] text-on-surface">Live route warnings</div>
        </div>
      </div>

      {warnings.length === 0 && !forecast ? (
        <div className="mt-5 flex min-h-[220px] items-center justify-center rounded-3xl bg-surface-container-low px-6 text-center">
          <div>
            <ShieldCheck className="mx-auto h-10 w-10 text-primary" />
            <div className="mt-4 text-sm font-semibold text-on-surface">No active warnings yet</div>
            <p className="mt-2 text-sm leading-6 text-on-surface-variant">
              Run a route check to see flood overlap notes, detour suggestions, and risk escalations.
            </p>
          </div>
        </div>
      ) : (
        <div className="mt-5 grid gap-3">
          {forecast ? (
            <div className={`rounded-3xl border px-4 py-4 ${riskTone(forecast.riskLevel)}`}>
              <div className="flex items-center justify-between gap-3">
                <div className="text-sm font-semibold">Route forecast</div>
                <div className="text-[11px] uppercase tracking-[0.16em]">
                  {forecast.riskLevel} risk | {forecast.source}
                </div>
              </div>
              <div className="mt-3 text-sm leading-6 text-on-surface">{forecast.summary}</div>
              <div className="mt-3 text-xs text-on-surface-variant">
                Peak window: {forecast.peakWindow} | Confidence: {forecast.confidence}
              </div>
              <div className="mt-3 grid gap-2">
                {forecast.reasons.map((reason) => (
                  <div key={reason} className="text-sm leading-6 text-on-surface-variant">
                    {reason}
                  </div>
                ))}
              </div>
            </div>
          ) : null}
          {warnings.map((warning) => (
            <div key={warning} className="rounded-3xl bg-surface-container-low px-4 py-4 text-sm leading-6 text-on-surface-variant">
              {warning}
            </div>
          ))}
        </div>
      )}
    </SurfaceCard>
  )
}
