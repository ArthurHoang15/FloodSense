import type { FloodEvent, Severity } from '../../shared/types'

const severityRank: Record<Severity, number> = {
  heavy: 3,
  moderate: 2,
  light: 1,
}

export function compareFloodPriority(a: FloodEvent, b: FloodEvent) {
  const severityDelta = severityRank[b.severity] - severityRank[a.severity]
  if (severityDelta !== 0) return severityDelta
  const depthDelta = (b.depth_cm ?? 0) - (a.depth_cm ?? 0)
  if (depthDelta !== 0) return depthDelta
  return new Date(b.last_confirmed_at).getTime() - new Date(a.last_confirmed_at).getTime()
}

export function formatDepth(depth: number | null) {
  if (depth == null) return 'Unknown depth'
  return `${depth}cm`
}

export function formatTimestamp(iso: string) {
  const date = new Date(iso)
  return new Intl.DateTimeFormat('en-GB', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  }).format(date)
}

export function severityHeadline(severity: Severity) {
  if (severity === 'heavy') return 'Emergency'
  if (severity === 'moderate') return 'Warning'
  return 'Advisory'
}

export function buildFloodNarrative(event: FloodEvent) {
  const sourceType = event.sources[0]?.source_type === 'vetc_mock' ? 'traffic telemetry' : 'field reports'
  const depth = event.depth_cm ? `Water depth around ${event.depth_cm}cm.` : 'Depth still being verified.'
  return `${depth} Confirmed from ${sourceType}.`
}

export function buildAlertBody(event: FloodEvent) {
  return `${event.street_name} (${event.district}) is affecting your route.`
}