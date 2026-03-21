import { useEffect, useMemo, useState } from 'react'
import { Bell, BellOff } from 'lucide-react'
import { useSettingsStore } from '@/stores/settingsStore'

type Props = {
  lastAlert?: { title: string; body: string } | null
}

export default function NotificationsPanel({ lastAlert }: Props) {
  const { notificationsEnabled, setNotificationsEnabled } = useSettingsStore()
  const [permission, setPermission] = useState<NotificationPermission>(() => {
    if (!('Notification' in window)) return 'denied'
    return Notification.permission
  })

  const supported = useMemo(() => 'Notification' in window, [])

  useEffect(() => {
    if (!('serviceWorker' in navigator)) return
    navigator.serviceWorker.register('/sw.js').catch(() => {})
  }, [])

  async function enable() {
    if (!supported) return
    const p = await Notification.requestPermission()
    setPermission(p)
    if (p === 'granted') setNotificationsEnabled(true)
  }

  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-950 p-4">
      <div className="flex items-center justify-between">
        <div className="text-sm font-medium text-zinc-100">Alerts</div>
        <button
          type="button"
          onClick={() => setNotificationsEnabled(!notificationsEnabled)}
          className="inline-flex items-center gap-2 rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-1.5 text-xs text-zinc-200 hover:bg-zinc-800"
          disabled={permission !== 'granted'}
        >
          {notificationsEnabled ? <Bell className="h-4 w-4" /> : <BellOff className="h-4 w-4" />}
          <span>{notificationsEnabled ? 'On' : 'Off'}</span>
        </button>
      </div>

      {!supported ? (
        <div className="mt-3 text-xs text-zinc-400">Notifications are not supported in this browser.</div>
      ) : permission !== 'granted' ? (
        <div className="mt-3">
          <div className="text-xs text-zinc-400">Permission: {permission}</div>
          <button
            type="button"
            onClick={enable}
            className="mt-2 inline-flex items-center gap-2 rounded-lg bg-zinc-100 px-3 py-2 text-xs font-medium text-zinc-950 hover:bg-white"
          >
            Enable notifications
          </button>
        </div>
      ) : (
        <div className="mt-3 text-xs text-zinc-400">Permission granted. Alerts are delivered via polling in demo mode.</div>
      )}

      {lastAlert ? (
        <div className="mt-3 rounded-lg border border-zinc-800 bg-zinc-900 p-3">
          <div className="text-xs font-medium text-zinc-200">Last alert</div>
          <div className="mt-1 text-xs text-zinc-300">{lastAlert.title}</div>
          <div className="mt-1 text-[11px] text-zinc-400">{lastAlert.body}</div>
        </div>
      ) : null}
    </div>
  )
}
