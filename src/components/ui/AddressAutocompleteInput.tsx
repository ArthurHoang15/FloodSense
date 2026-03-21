import { LoaderCircle, MapPin, Search } from 'lucide-react'
import { useEffect, useState } from 'react'
import { apiGet } from '@/utils/api'
import { cn } from '@/lib/utils'
import type { AddressSuggestion } from '../../../shared/types'

type SearchResponse = {
  success: boolean
  suggestions: AddressSuggestion[]
}

type Props = {
  label: string
  placeholder: string
  value: string
  selected: AddressSuggestion | null
  onValueChange: (value: string) => void
  onSelect: (suggestion: AddressSuggestion) => void
  onClearSelection: () => void
  className?: string
  panelClassName?: string
}

export default function AddressAutocompleteInput({
  label,
  placeholder,
  value,
  selected,
  onValueChange,
  onSelect,
  onClearSelection,
  className,
  panelClassName,
}: Props) {
  const [loading, setLoading] = useState(false)
  const [open, setOpen] = useState(false)
  const [suggestions, setSuggestions] = useState<AddressSuggestion[]>([])

  useEffect(() => {
    const query = value.trim()
    if (!open || query.length < 3) {
      setSuggestions([])
      setLoading(false)
      return
    }

    let active = true
    const timer = window.setTimeout(() => {
      setLoading(true)
      apiGet<SearchResponse>(`/api/locations/search?q=${encodeURIComponent(query)}`)
        .then((response) => {
          if (!active) return
          setSuggestions(response.suggestions ?? [])
        })
        .catch(() => {
          if (!active) return
          setSuggestions([])
        })
        .finally(() => {
          if (!active) return
          setLoading(false)
        })
    }, 220)

    return () => {
      active = false
      window.clearTimeout(timer)
    }
  }, [open, value])

  return (
    <div className={cn('relative', className)}>
      <label className="fs-label">{label}</label>
      <div className="relative mt-2">
        <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-on-surface-variant/70" />
        <input
          value={value}
          onFocus={() => setOpen(true)}
          onBlur={() => {
            window.setTimeout(() => setOpen(false), 120)
          }}
          onChange={(event) => {
            const nextValue = event.target.value
            onValueChange(nextValue)
            if (selected && nextValue !== selected.label) {
              onClearSelection()
            }
            setOpen(true)
          }}
          className="fs-input pl-11 pr-11"
          placeholder={placeholder}
          autoComplete="off"
        />
        {loading ? <LoaderCircle className="absolute right-4 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-primary" /> : null}
      </div>

      {selected ? <div className="mt-2 text-xs text-primary">Selected: {selected.label}</div> : <div className="mt-2 text-xs text-on-surface-variant">Type at least 3 characters to search a real address.</div>}

      {open && (loading || suggestions.length > 0 || value.trim().length >= 3) ? (
        <div className={cn('absolute z-40 mt-2 w-full overflow-hidden rounded-3xl border border-outline-variant/15 bg-surface-container-highest/95 shadow-ambient backdrop-blur-panel', panelClassName)}>
          {suggestions.length > 0 ? (
            <div className="max-h-72 overflow-y-auto p-2">
              {suggestions.map((suggestion) => (
                <button
                  key={suggestion.id}
                  type="button"
                  onMouseDown={(event) => {
                    event.preventDefault()
                    onSelect(suggestion)
                    setOpen(false)
                  }}
                  className="flex w-full items-start gap-3 rounded-2xl px-3 py-3 text-left transition hover:bg-surface-container-high"
                >
                  <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                  <span className="text-sm leading-5 text-on-surface">{suggestion.label}</span>
                </button>
              ))}
            </div>
          ) : !loading ? (
            <div className="px-4 py-4 text-sm text-on-surface-variant">No real address matches found for this query.</div>
          ) : null}
        </div>
      ) : null}
    </div>
  )
}