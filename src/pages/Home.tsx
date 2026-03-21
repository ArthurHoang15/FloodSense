import HomeDashboard from '@/components/home/HomeDashboard'
import { useDashboardController } from '@/hooks/useDashboardController'

export default function Home() {
  const controller = useDashboardController()

  return <HomeDashboard controller={controller} />
}
