import { useEffect, useMemo, useState } from 'react'
import { Bell, BellOff } from 'lucide-react'
import SurfaceCard from '@/components/ui/SurfaceCard'
import { useSettingsStore } from '@/stores/settingsStore'

type Props = {
  lastAlert: { title: string; body: string } | null
}

export default function NotificationsPanel({ lastAlert }: Props) {
  const { notificationsEnabled, setNotificationsEnabled } = useSettingsStore()
  const [permission, setPermission] = useState<NotificationPermission>('default')

  const supported = useMemo(() => typeof window !== 'undefined' && 'Notification' in window, [])

  useEffect(() => {
    if (!supported) {
      setPermission('denied')
      return
    }

    setPermission(Notification.permission)

    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js').catch(() => {})
    }
  }, [supported])

  async function requestPermission() {
    if (!supported) return
    const nextPermission = await Notification.requestPermission()
    setPermission(nextPermission)
    if (nextPermission === 'granted') {
      setNotificationsEnabled(true)
    }
  }

  return (
    <SurfaceCard className="p-5">
      <div className="flex items-center justify-between gap-3">
        <div>
          <div className="fs-label">Alerting</div>
          <div className="mt-2 font-headline text-xl font-bold tracking-[-0.05em] text-on-surface">Notifications</div>
        </div>
        <button
          type="button"
          onClick={() => setNotificationsEnabled(!notificationsEnabled)}
          disabled={permission !== 'granted'}
          className="fs-button-secondary px-3 py-2 text-xs"
        >
          {notificationsEnabled ? <Bell className="h-4 w-4" /> : <BellOff className="h-4 w-4" />}
          {notificationsEnabled ? 'On' : 'Off'}
        </button>
      </div>

      {!supported ? (
        <div className="mt-4 rounded-2xl border border-outline-variant/15 bg-surface-container p-4 text-sm text-on-surface-variant">
          Notifications are not supported in this browser.
        </div>
      ) : permission !== 'granted' ? (
        <div className="mt-4 rounded-2xl border border-outline-variant/15 bg-surface-container p-4">
          <div className="text-sm text-on-surface-variant">Permission: {permission}</div>
          <button type="button" onClick={requestPermission} className="fs-button-primary mt-4 w-full">
            Enable notifications
          </button>
        </div>
      ) : (
        <div className="mt-4 rounded-2xl border border-outline-variant/15 bg-surface-container p-4 text-sm text-on-surface-variant">
          Permission granted. Demo alerts are delivered by local polling against active saved routes.
        </div>
      )}

      {lastAlert ? (
        <div className="mt-4 rounded-2xl border border-outline-variant/15 bg-surface-container-high p-4">
          <div className="fs-label">Last alert</div>
          <div className="mt-3 text-sm font-semibold text-on-surface">{lastAlert.title}</div>
          <div className="mt-2 text-sm text-on-surface-variant">{lastAlert.body}</div>
        </div>
      ) : null}
    </SurfaceCard>
  )
}