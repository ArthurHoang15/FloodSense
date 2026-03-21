import { CloudRain, RefreshCw, RotateCcw } from 'lucide-react'
import { useFloodStore } from '@/stores/floodStore'

export default function DemoControls() {
  const { simulating, startSimulateRain, resetSimulated, fetchFloods } = useFloodStore()

  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-950 p-4">
      <div className="text-sm font-medium text-zinc-100">Demo Controls</div>
      <div className="mt-3 grid gap-2">
        <button
          type="button"
          onClick={() => startSimulateRain()}
          disabled={simulating}
          className="inline-flex items-center justify-center gap-2 rounded-lg bg-indigo-500 px-3 py-2 text-sm font-medium text-zinc-950 hover:bg-indigo-400 disabled:cursor-not-allowed disabled:opacity-70"
        >
          <CloudRain className="h-4 w-4" />
          <span>{simulating ? 'Simulating…' : 'Simulate Heavy Rain'}</span>
        </button>
        <button
          type="button"
          onClick={() => resetSimulated()}
          className="inline-flex items-center justify-center gap-2 rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-2 text-sm text-zinc-200 hover:bg-zinc-800"
        >
          <RotateCcw className="h-4 w-4" />
          <span>Reset Simulation</span>
        </button>
        <button
          type="button"
          onClick={() => fetchFloods()}
          className="inline-flex items-center justify-center gap-2 rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-2 text-sm text-zinc-200 hover:bg-zinc-800"
        >
          <RefreshCw className="h-4 w-4" />
          <span>Refresh Floods</span>
        </button>
      </div>
      <div className="mt-3 text-xs text-zinc-400">Mock-first demo. No live Tasco/VETC integration.</div>
    </div>
  )
}
