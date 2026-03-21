export default function Legend() {
  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-950/80 p-3 backdrop-blur">
      <div className="text-xs font-medium text-zinc-200">Flood Severity</div>
      <div className="mt-2 grid gap-2 text-xs text-zinc-200">
        <div className="flex items-center gap-2">
          <span className="h-2.5 w-2.5 rounded-full bg-red-500" />
          <span>Heavy (&gt;30cm)</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="h-2.5 w-2.5 rounded-full bg-orange-500" />
          <span>Moderate (15–30cm)</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="h-2.5 w-2.5 rounded-full bg-yellow-500" />
          <span>Light (&lt;15cm)</span>
        </div>
      </div>
    </div>
  )
}
