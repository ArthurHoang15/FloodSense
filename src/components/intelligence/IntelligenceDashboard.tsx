import { TriangleAlert } from 'lucide-react'
import WeatherForecastBanner from '@/components/intelligence/WeatherForecastBanner'
import HotspotAnalyticsCard from '@/components/intelligence/HotspotAnalyticsCard'
import CrowdsourceReportCard from '@/components/intelligence/CrowdsourceReportCard'
import SavedRoutesInsightsCard from '@/components/intelligence/SavedRoutesInsightsCard'
import FloodHistoryCard from '@/components/intelligence/FloodHistoryCard'
import NavigationRail from '@/components/home/sidebar/NavigationRail'
import MobileBottomNav from '@/components/home/mobile/MobileBottomNav'
import type { IntelligenceController } from '@/hooks/useIntelligenceController'

type Props = {
  controller: IntelligenceController
}

export default function IntelligenceDashboard({ controller }: Props) {
  const {
    floods,
    weatherAlert,
    weatherMetrics,
    maxRainStart,
    hotspots,
    savedRouteInsights,
    historyBars,
  } = controller

  return (
    <div className="fs-shell">
      <div className="mx-auto flex max-w-[1600px] gap-0 xl:gap-2">
        <NavigationRail telemetry={floods.slice(0, 3)} activeItem="analytics" />

        <main className="min-w-0 flex-1 px-3 pb-24 pt-4 md:px-6 md:pt-6 xl:ml-0 xl:pb-10">
          <div className="space-y-8">
            <WeatherForecastBanner
              title="Heavy Precipitation Expected"
              description={weatherAlert?.message ?? `Upcoming rain chances remain elevated starting at ${maxRainStart}. District 1 and District 7 are under high flood risk monitoring.`}
              humidityLabel={weatherMetrics.humidityLabel}
              windLabel={weatherMetrics.windLabel}
            />

            <div className="grid grid-cols-1 gap-8 lg:grid-cols-12 lg:items-stretch">
              <section className="lg:col-span-8 lg:h-full">
                <HotspotAnalyticsCard hotspots={hotspots} className="lg:h-full" />
              </section>

              <section className="lg:col-span-4 lg:h-full">
                <CrowdsourceReportCard className="lg:h-full" />
              </section>

              <section className="lg:col-span-6 lg:h-full">
                <SavedRoutesInsightsCard items={savedRouteInsights} className="lg:h-full" />
              </section>

              <section className="lg:col-span-6 lg:h-full">
                <FloodHistoryCard items={historyBars} className="lg:h-full" />
              </section>
            </div>
          </div>
        </main>
      </div>

      <button type="button" className="fixed bottom-6 right-6 z-50 flex h-14 w-14 items-center justify-center rounded-full bg-primary-container text-on-primary shadow-ambient md:hidden">
        <TriangleAlert className="h-6 w-6" />
      </button>
      <MobileBottomNav activeItem="analytics" />
    </div>
  )
}