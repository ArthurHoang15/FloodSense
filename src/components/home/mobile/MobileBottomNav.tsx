import { BarChart3, Route, UserRound, Waves } from 'lucide-react'
import { Link } from 'react-router-dom'
import SurfaceCard from '@/components/ui/SurfaceCard'

type MobileNavItemId = 'map' | 'analytics' | 'routes' | 'profile'

const navItems = [
  { id: 'map' as const, label: 'Map', icon: Waves, to: '/' },
  { id: 'analytics' as const, label: 'Analytics', icon: BarChart3, to: '/intelligence' },
  { id: 'routes' as const, label: 'Routes', icon: Route, to: '/route-results' },
  { id: 'profile' as const, label: 'Profile', icon: UserRound },
]

type Props = {
  activeItem?: MobileNavItemId
}

export default function MobileBottomNav({ activeItem = 'map' }: Props) {
  return (
    <div className="fixed inset-x-0 bottom-3 z-50 px-3 md:hidden">
      <SurfaceCard tone="glass" className="mx-auto flex max-w-xl items-center justify-around px-3 py-3">
        {navItems.map((item) => (
          item.to ? (
            <Link key={item.id} to={item.to} className={item.id === activeItem ? 'flex flex-col items-center gap-1 text-primary-container' : 'flex flex-col items-center gap-1 text-on-surface-variant'}>
              <item.icon className="h-5 w-5" />
              <span className="text-[10px] font-semibold uppercase tracking-[0.16em]">{item.label}</span>
            </Link>
          ) : (
            <button key={item.id} type="button" className={item.id === activeItem ? 'flex flex-col items-center gap-1 text-primary-container' : 'flex flex-col items-center gap-1 text-on-surface-variant'}>
              <item.icon className="h-5 w-5" />
              <span className="text-[10px] font-semibold uppercase tracking-[0.16em]">{item.label}</span>
            </button>
          )
        ))}
      </SurfaceCard>
    </div>
  )
}