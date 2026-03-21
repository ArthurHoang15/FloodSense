import { cn } from '@/lib/utils'
import type { Severity } from '../../../shared/types'

const toneMap: Record<Severity, string> = {
  heavy: 'bg-error/15 text-error border-error/25',
  moderate: 'bg-secondary-container/18 text-secondary border-secondary-container/25',
  light: 'bg-primary-container/12 text-primary border-primary-container/20',
}

const labelMap: Record<Severity, string> = {
  heavy: 'Heavy',
  moderate: 'Moderate',
  light: 'Light',
}

type Props = {
  severity: Severity
  className?: string
}

export default function SeverityBadge({ severity, className }: Props) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.14em]',
        toneMap[severity],
        className,
      )}
    >
      {labelMap[severity]}
    </span>
  )
}