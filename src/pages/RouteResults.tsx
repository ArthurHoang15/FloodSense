import RouteResultsDashboard from '@/components/route-results/RouteResultsDashboard'
import { useRouteResultsController } from '@/hooks/useRouteResultsController'

export default function RouteResults() {
  const controller = useRouteResultsController()

  return <RouteResultsDashboard controller={controller} />
}