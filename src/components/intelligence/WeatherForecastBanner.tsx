import { CloudLightning, Droplets, Wind } from 'lucide-react'
import SurfaceCard from '@/components/ui/SurfaceCard'

type Metric = {
  label: string
  value: string
}

type Props = {
  title: string
  description: string
  primaryMetric: Metric
  secondaryMetric: Metric
}

export default function WeatherForecastBanner({ title, description, primaryMetric, secondaryMetric }: Props) {
  return (
    <SurfaceCard className="overflow-hidden border-l-4 border-l-secondary-container p-6 md:p-7">
      <div className="flex flex-col items-start justify-between gap-6 md:flex-row md:items-center">
        <div className="flex items-start gap-5">
          <div className="rounded-3xl bg-secondary-container/12 p-3 text-secondary-container">
            <CloudLightning className="h-12 w-12" />
          </div>
          <div>
            <h2 className="font-headline text-[1.9rem] font-bold tracking-[-0.05em] text-on-surface">{title}</h2>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-on-surface-variant">{description}</p>
          </div>
        </div>

        <div className="grid w-full gap-4 sm:w-auto sm:grid-cols-2">
          <div className="rounded-2xl bg-surface-container px-5 py-4">
            <div className="flex items-center gap-3">
              <Droplets className="h-5 w-5 text-primary" />
              <div>
                <div className="fs-kicker">{primaryMetric.label}</div>
                <div className="mt-1 font-headline text-2xl font-bold text-on-surface">{primaryMetric.value}</div>
              </div>
            </div>
          </div>
          <div className="rounded-2xl bg-surface-container px-5 py-4">
            <div className="flex items-center gap-3">
              <Wind className="h-5 w-5 text-primary" />
              <div>
                <div className="fs-kicker">{secondaryMetric.label}</div>
                <div className="mt-1 font-headline text-2xl font-bold text-on-surface">{secondaryMetric.value}</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </SurfaceCard>
  )
}