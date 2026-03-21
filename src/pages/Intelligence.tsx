import IntelligenceDashboard from '@/components/intelligence/IntelligenceDashboard'
import { useIntelligenceController } from '@/hooks/useIntelligenceController'

export default function Intelligence() {
  const controller = useIntelligenceController()

  return <IntelligenceDashboard controller={controller} />
}