import type { ElementType, ReactNode } from 'react'
import { cn } from '@/lib/utils'

type SurfaceTone = 'low' | 'glass' | 'high'

type Props<T extends ElementType> = {
  as?: T
  tone?: SurfaceTone
  className?: string
  children: ReactNode
}

const toneClass: Record<SurfaceTone, string> = {
  low: 'fs-surface-panel',
  glass: 'fs-glass rounded-3xl',
  high: 'rounded-3xl border border-outline-variant/15 bg-surface-container-high/90 shadow-ambient',
}

export default function SurfaceCard<T extends ElementType = 'div'>({
  as,
  tone = 'low',
  className,
  children,
}: Props<T>) {
  const Component = as ?? 'div'

  return <Component className={cn(toneClass[tone], className)}>{children}</Component>
}