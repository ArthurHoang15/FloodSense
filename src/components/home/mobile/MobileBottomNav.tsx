import { BarChart3, Route, UserRound, Waves } from 'lucide-react'
import SurfaceCard from '@/components/ui/SurfaceCard'

const navItems = [
  { label: 'Map', icon: Waves, active: true },
  { label: 'Analytics', icon: BarChart3, active: false },
  { label: 'Routes', icon: Route, active: false },
  { label: 'Profile', icon: UserRound, active: false },
]

export default function MobileBottomNav() {
  return (
    <div className="fixed inset-x-0 bottom-3 z-50 px-3 md:hidden">
      <SurfaceCard tone="glass" className="mx-auto flex max-w-xl items-center justify-around px-3 py-3">
        {navItems.map((item) => (
          <button key={item.label} type="button" className={item.active ? 'flex flex-col items-center gap-1 text-primary-container' : 'flex flex-col items-center gap-1 text-on-surface-variant'}>
            <item.icon className="h-5 w-5" />
            <span className="text-[10px] font-semibold uppercase tracking-[0.16em]">{item.label}</span>
          </button>
        ))}
      </SurfaceCard>
    </div>
  )
}