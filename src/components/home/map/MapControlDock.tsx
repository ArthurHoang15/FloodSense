import { Crosshair, Layers3, Search, ZoomIn, ZoomOut } from 'lucide-react'
import { useState } from 'react'
import AddressAutocompleteInput from '@/components/ui/AddressAutocompleteInput'
import type { SharedRouteSearchState } from '@/hooks/useDashboardController'
import { useRouteCheckStore } from '@/stores/routeCheckStore'
import type { AddressSuggestion } from '../../../../shared/types'

type Props = {
  onSearchSelect: (suggestion: AddressSuggestion) => void
  onRouteReady: (coords: { lat: number; lng: number }[]) => void
  routeSearch: SharedRouteSearchState
}

const upperControls = [Layers3, Crosshair]
const lowerControls = [ZoomIn, ZoomOut]

export default function MapControlDock({ onSearchSelect, onRouteReady, routeSearch }: Props) {
  const [searchOpen, setSearchOpen] = useState(false)
  const checkRoute = useRouteCheckStore((state) => state.checkRoute)
  const loading = useRouteCheckStore((state) => state.loading)

  const {
    originQuery,
    setOriginQuery,
    destinationQuery,
    setDestinationQuery,
    originSelection,
    setOriginSelection,
    destinationSelection,
    setDestinationSelection,
  } = routeSearch

  async function onPreviewRoute() {
    if (!originSelection || !destinationSelection) return

    const response = await checkRoute(
      { ...originSelection.coordinates, address: originSelection.label },
      { ...destinationSelection.coordinates, address: destinationSelection.label },
    )
    if (!response) return

    onRouteReady(response.route.coords)
  }

  return (
    <div className="absolute right-4 top-4 z-30 hidden flex-col gap-3 md:flex md:right-6 md:top-6">
      {searchOpen ? (
        <div className="absolute right-16 top-0 w-[380px] rounded-[1.75rem] border border-outline-variant/15 bg-surface-container-highest/90 p-4 shadow-ambient backdrop-blur-panel">
          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="fs-label">Route search</div>
              <div className="mt-1 text-sm text-on-surface-variant">Search both origin and destination, then preview the real route on the map.</div>
            </div>
            <button type="button" onClick={() => setSearchOpen(false)} className="fs-button-secondary px-3 py-2 text-xs">
              Close
            </button>
          </div>

          <div className="mt-4 grid gap-4">
            <AddressAutocompleteInput
              label="Origin"
              value={originQuery}
              selected={originSelection}
              onValueChange={setOriginQuery}
              onSelect={(suggestion) => {
                setOriginSelection(suggestion)
                setOriginQuery(suggestion.label)
                onSearchSelect(suggestion)
              }}
              onClearSelection={() => setOriginSelection(null)}
              placeholder="Search a real origin address"
              panelClassName="top-full"
            />

            <AddressAutocompleteInput
              label="Destination"
              value={destinationQuery}
              selected={destinationSelection}
              onValueChange={setDestinationQuery}
              onSelect={(suggestion) => {
                setDestinationSelection(suggestion)
                setDestinationQuery(suggestion.label)
                onSearchSelect(suggestion)
              }}
              onClearSelection={() => setDestinationSelection(null)}
              placeholder="Search a real destination address"
              panelClassName="relative mt-3"
            />

            <button
              type="button"
              onClick={onPreviewRoute}
              disabled={!originSelection || !destinationSelection || loading}
              className="fs-button-primary w-full"
            >
              <Search className="h-4 w-4" />
              <span>{loading ? 'Checking route' : 'Preview route on map'}</span>
            </button>
          </div>
        </div>
      ) : null}

      <div className="fs-glass flex flex-col rounded-3xl p-1">
        <button type="button" onClick={() => setSearchOpen((open) => !open)} className="fs-icon-button border-transparent bg-transparent shadow-none">
          <Search className="h-5 w-5" />
        </button>
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