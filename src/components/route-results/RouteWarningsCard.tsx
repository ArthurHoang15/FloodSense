import { AlertTriangle, ShieldCheck } from 'lucide-react'
import SurfaceCard from '@/components/ui/SurfaceCard'

type Props = {
  warnings: string[]
}

export default function RouteWarningsCard({ warnings }: Props) {
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

      {warnings.length === 0 ? (
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