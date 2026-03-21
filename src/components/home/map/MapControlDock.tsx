import { Crosshair, Layers3, Search, ZoomIn, ZoomOut } from 'lucide-react'

const upperControls = [Search, Layers3, Crosshair]
const lowerControls = [ZoomIn, ZoomOut]

export default function MapControlDock() {
  return (
    <div className="absolute right-4 top-4 z-30 hidden flex-col gap-3 md:flex md:right-6 md:top-6">
      <div className="fs-glass flex flex-col rounded-3xl p-1">
        {upperControls.map((Icon, index) => (
          <button key={index} type="button" className="fs-icon-button border-transparent bg-transparent shadow-none">
            <Icon className="h-5 w-5" />
          </button>
        ))}
      </div>
      <div className="fs-glass flex flex-col rounded-3xl p-1">
        {lowerControls.map((Icon, index) => (
          <button key={index} type="button" className="fs-icon-button border-transparent bg-transparent shadow-none">
            <Icon className="h-5 w-5" />
          </button>
        ))}
      </div>
    </div>
  )
}