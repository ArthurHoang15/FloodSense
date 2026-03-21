import { MapPinned, MessageSquareWarning } from 'lucide-react'
import SurfaceCard from '@/components/ui/SurfaceCard'
import { cn } from '@/lib/utils'

type Props = {
  className?: string
}

export default function CrowdsourceReportCard({ className }: Props) {
  return (
    <div className={cn('flex h-full flex-col gap-6', className)}>
      <SurfaceCard className="flex-1 overflow-hidden bg-gradient-to-br from-primary-container to-on-primary-container p-6 text-on-primary">
        <MapPinned className="h-10 w-10" />
        <h3 className="mt-5 font-headline text-3xl font-extrabold tracking-[-0.06em] text-on-primary-fixed">Active Flooding?</h3>
        <p className="mt-3 text-sm leading-6 text-on-primary-fixed/82">
          Real-time reports help commuters avoid submerged corridors. Upload a photo, mark severity, and strengthen confidence scoring.
        </p>
        <button type="button" className="mt-6 flex w-full items-center justify-center gap-2 rounded-2xl bg-[#0b0f19] px-4 py-3 text-sm font-bold text-primary transition hover:bg-[#111728] active:scale-[0.99]">
          <MessageSquareWarning className="h-4 w-4" />
          Report flood now
        </button>
      </SurfaceCard>

      <div className="relative h-48 shrink-0 overflow-hidden rounded-3xl bg-surface-container-low">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_30%,rgba(0,229,255,0.16),transparent_22%),radial-gradient(circle_at_70%_45%,rgba(254,179,0,0.12),transparent_18%),linear-gradient(180deg,rgba(23,27,38,0.2),rgba(10,14,24,0.92))]" />
        <div className="absolute inset-0 opacity-40 [background-image:linear-gradient(rgba(132,147,150,0.08)_1px,transparent_1px),linear-gradient(90deg,rgba(132,147,150,0.08)_1px,transparent_1px)] [background-size:32px_32px]" />
        <div className="absolute bottom-4 left-4 rounded-full bg-surface-dim/80 px-3 py-1 text-xs font-medium text-primary">District 1 Live Feed</div>
      </div>
    </div>
  )
}