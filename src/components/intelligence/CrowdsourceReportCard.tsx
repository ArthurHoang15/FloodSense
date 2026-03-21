import { useState } from 'react'
import { Activity, MapPinned, MessageSquareWarning } from 'lucide-react'
import SurfaceCard from '@/components/ui/SurfaceCard'
import { cn } from '@/lib/utils'
import { apiPost } from '@/utils/api'
import type { Severity } from '../../../shared/types'

type Metric = {
  label: string
  value: string
}

type OverviewItem = {
  label: string
  value: string
  emphasis: 'primary' | 'secondary' | 'muted'
}

type Props = {
  title: string
  description: string
  primaryMetric: Metric
  secondaryMetric: Metric
  districtLabel: string
  overviewItems: OverviewItem[]
  onReportSubmitted?: () => Promise<void> | void
  className?: string
}

function overviewTone(emphasis: OverviewItem['emphasis']) {
  if (emphasis === 'primary') return 'text-primary'
  if (emphasis === 'secondary') return 'text-secondary-container'
  return 'text-on-surface'
}

export default function CrowdsourceReportCard({ title, description, primaryMetric, secondaryMetric, districtLabel, overviewItems, onReportSubmitted, className }: Props) {
  const [locationText, setLocationText] = useState('')
  const [severity, setSeverity] = useState<Severity>('moderate')
  const [note, setNote] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [statusText, setStatusText] = useState<string | null>(null)
  const [formOpen, setFormOpen] = useState(false)

  async function handleSubmit() {
    if (!locationText.trim()) {
      setStatusText('Nhập vị trí hoặc tên đường để gửi tín hiệu ngập.')
      return
    }

    setSubmitting(true)
    try {
      const response = await apiPost<{ success: boolean; report?: { id: string } }>('/api/report-flood', {
        locationText: locationText.trim(),
        severity,
        note: note.trim() || undefined,
      })

      if (!response.success) {
        throw new Error('submit failed')
      }

      setStatusText('Đã ghi nhận tín hiệu. Intelligence sẽ làm mới để phản ánh báo cáo mới.')
      setLocationText('')
      setNote('')
      setFormOpen(false)
      await onReportSubmitted?.()
    } catch (error) {
      void error
      setStatusText('Không thể gửi báo cáo lúc này. Kiểm tra lại vị trí hoặc thử lại sau.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className={cn('flex h-full flex-col gap-6', className)}>
      <SurfaceCard className="overflow-hidden bg-gradient-to-br from-primary-container to-on-primary-container p-6 text-on-primary">
        <MapPinned className="h-10 w-10" />
        <h3 className="mt-5 font-headline text-3xl font-extrabold tracking-[-0.06em] text-on-primary-fixed">{title}</h3>
        <p className="mt-3 text-sm leading-6 text-on-primary-fixed/82">
          {description}
        </p>

        <div className="mt-6 grid grid-cols-2 gap-3">
          <div className="rounded-2xl bg-[#0b0f19]/88 px-4 py-3">
            <div className="text-[11px] uppercase tracking-[0.16em] text-on-primary-fixed/58">{primaryMetric.label}</div>
            <div className="mt-2 font-headline text-2xl font-bold text-on-primary-fixed">{primaryMetric.value}</div>
          </div>
          <div className="rounded-2xl bg-[#0b0f19]/88 px-4 py-3">
            <div className="text-[11px] uppercase tracking-[0.16em] text-on-primary-fixed/58">{secondaryMetric.label}</div>
            <div className="mt-2 font-headline text-2xl font-bold text-on-primary-fixed">{secondaryMetric.value}</div>
          </div>
        </div>

        <div className="mt-6 rounded-3xl border border-white/10 bg-[#08101b]/72 p-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="text-[11px] uppercase tracking-[0.16em] text-on-primary-fixed/58">Crowd report intake</div>
              <div className="mt-2 text-sm text-on-primary-fixed/78">Mở form khi cần gửi tín hiệu mới từ hiện trường.</div>
            </div>
            <button
              type="button"
              onClick={() => setFormOpen((value) => !value)}
              className="rounded-2xl bg-[#0b0f19] px-4 py-3 text-sm font-bold text-primary transition hover:bg-[#111728]"
            >
              {formOpen ? 'Thu gọn' : 'Mở form'}
            </button>
          </div>

          {formOpen ? (
            <div className="mt-4 grid gap-3">
              <input
                value={locationText}
                onChange={(event) => setLocationText(event.target.value)}
                placeholder="Tên đường, khu vực hoặc giao lộ"
                className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-on-primary-fixed outline-none transition placeholder:text-on-primary-fixed/35 focus:border-white/20"
              />
              <div className="grid grid-cols-[120px_1fr] gap-3">
                <select
                  value={severity}
                  onChange={(event) => setSeverity(event.target.value as Severity)}
                  className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-on-primary-fixed outline-none transition focus:border-white/20"
                >
                  <option value="light">Light</option>
                  <option value="moderate">Moderate</option>
                  <option value="heavy">Heavy</option>
                </select>
                <input
                  value={note}
                  onChange={(event) => setNote(event.target.value)}
                  placeholder="Ghi chú ngắn, ví dụ ngập nửa bánh xe"
                  className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-on-primary-fixed outline-none transition placeholder:text-on-primary-fixed/35 focus:border-white/20"
                />
              </div>
              <button
                type="button"
                onClick={() => void handleSubmit()}
                disabled={submitting}
                className="rounded-2xl bg-[#0b0f19] px-4 py-3 text-sm font-bold text-primary transition hover:bg-[#111728] disabled:cursor-not-allowed disabled:opacity-60"
              >
                {submitting ? 'Đang gửi...' : 'Gửi báo cáo ngập'}
              </button>
            </div>
          ) : null}

          {statusText ? (
            <div className="mt-3 text-xs leading-5 text-on-primary-fixed/75">{statusText}</div>
          ) : null}
        </div>
      </SurfaceCard>

      <div className="relative min-h-[210px] overflow-hidden rounded-3xl bg-surface-container-low">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_30%,rgba(0,229,255,0.16),transparent_22%),radial-gradient(circle_at_70%_45%,rgba(254,179,0,0.12),transparent_18%),linear-gradient(180deg,rgba(23,27,38,0.2),rgba(10,14,24,0.92))]" />
        <div className="absolute inset-0 opacity-40 [background-image:linear-gradient(rgba(132,147,150,0.08)_1px,transparent_1px),linear-gradient(90deg,rgba(132,147,150,0.08)_1px,transparent_1px)] [background-size:32px_32px]" />
        <div className="absolute left-4 top-4 inline-flex items-center gap-2 rounded-full bg-surface-dim/80 px-3 py-1 text-xs font-medium text-primary">
          <MessageSquareWarning className="h-3.5 w-3.5" />
          Signal overview
        </div>
        <div className="absolute inset-x-4 top-14 rounded-3xl border border-white/8 bg-[#08101b]/72 p-4 backdrop-blur-sm">
          <div className="grid gap-3">
            {overviewItems.map((item) => (
              <div key={item.label} className="flex items-center justify-between gap-3 rounded-2xl bg-white/4 px-3 py-2">
                <div className="text-[11px] uppercase tracking-[0.16em] text-on-surface-variant">{item.label}</div>
                <div className={`text-sm font-bold ${overviewTone(item.emphasis)}`}>{item.value}</div>
              </div>
            ))}
          </div>
        </div>
        <div className="absolute bottom-4 left-4 rounded-full bg-surface-dim/80 px-3 py-1 text-xs font-medium text-primary">{districtLabel}</div>
        <div className="absolute bottom-4 right-4 inline-flex items-center gap-2 rounded-full bg-surface-dim/80 px-3 py-1 text-xs font-medium text-secondary-container">
          <Activity className="h-3.5 w-3.5" />
          Live telemetry
        </div>
      </div>
    </div>
  )
}