import { Activity, MapPinned, MessageSquareWarning } from 'lucide-react'
import SurfaceCard from '@/components/ui/SurfaceCard'
import { cn } from '@/lib/utils'

type Metric = {
  label: string
  value: string
}

type Props = {
  title: string
  description: string
  primaryMetric: Metric
  secondaryMetric: Metric
  districtLabel: string
  className?: string
}

export default function CrowdsourceReportCard({ title, description, primaryMetric, secondaryMetric, districtLabel, className }: Props) {
  return (
    <div className={cn('flex h-full flex-col gap-6', className)}>
      <SurfaceCard className="flex-1 overflow-hidden bg-gradient-to-br from-primary-container to-on-primary-container p-6 text-on-primary">
        <MapPinned className="h-10 w-10" />
        <h3 className="mt-5 font-headline text-3xl font-extrabold tracking-[-0.06em] text-on-primary-fixed">{title}</h3>
        <p className="mt-3 text-sm leading-6 text-on-primary-fixed/82">
          {description}
        </p>

        <div className="mt-6 grid grid-cols-2 gap-3">
          <div className="rounded-2xl bg-[#0b0f19]/88 px-4 py-3">
            <div className="text-[11px] uppercase tracking-[0.16em] text-on-primary-fixed/58">{primaryMetric.label}</div>
            <div className="mt-2 font-headline text-2xl font-bold text-on-primary-fixed">{primaryMetric.value}</div>
          </div>
          <div className="rounded-2xl bg-[#0b0f19]/88 px-4 py-3">
            <div className="text-[11px] uppercase tracking-[0.16em] text-on-primary-fixed/58">{secondaryMetric.label}</div>
            <div className="mt-2 font-headline text-2xl font-bold text-on-primary-fixed">{secondaryMetric.value}</div>
          </div>
        </div>
      </SurfaceCard>

      <div className="relative h-48 shrink-0 overflow-hidden rounded-3xl bg-surface-container-low">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_30%,rgba(0,229,255,0.16),transparent_22%),radial-gradient(circle_at_70%_45%,rgba(254,179,0,0.12),transparent_18%),linear-gradient(180deg,rgba(23,27,38,0.2),rgba(10,14,24,0.92))]" />
        <div className="absolute inset-0 opacity-40 [background-image:linear-gradient(rgba(132,147,150,0.08)_1px,transparent_1px),linear-gradient(90deg,rgba(132,147,150,0.08)_1px,transparent_1px)] [background-size:32px_32px]" />
        <div className="absolute left-4 top-4 inline-flex items-center gap-2 rounded-full bg-surface-dim/80 px-3 py-1 text-xs font-medium text-primary">
          <MessageSquareWarning className="h-3.5 w-3.5" />
          Signal overview
        </div>
        <div className="absolute bottom-4 left-4 rounded-full bg-surface-dim/80 px-3 py-1 text-xs font-medium text-primary">{districtLabel}</div>
        <div className="absolute bottom-4 right-4 inline-flex items-center gap-2 rounded-full bg-surface-dim/80 px-3 py-1 text-xs font-medium text-secondary-container">
          <Activity className="h-3.5 w-3.5" />
          Live telemetry
        </div>
      </div>
    </div>
  )
}