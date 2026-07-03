export type Bay = {
  id: string
  label: string // e.g. "Bay 1"
  status: 'free' | 'occupied' | 'maintenance'
  occupiedBy?: string // e.g. car/plate or booking reference
}

const STATUS_STYLE: Record<Bay['status'], { bg: string; text: string; label: string }> = {
  free: { bg: '#00E5C7', text: '#0A0B0D', label: 'Free' },
  occupied: { bg: '#FFB020', text: '#0A0B0D', label: 'In use' },
  maintenance: { bg: '#FF6B4A', text: '#0A0B0D', label: 'Maintenance' },
}

export function BayGrid({ bays }: { bays: Bay[] }) {
  if (bays.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-black/15 p-8 text-center text-sm text-black/50 dark:border-white/15 dark:text-white/50">
        No bays set up yet. Add your first bay to start tracking capacity.
      </div>
    )
  }

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
      {bays.map((bay) => {
        const style = STATUS_STYLE[bay.status]
        return (
          <div
            key={bay.id}
            className="flex flex-col justify-between rounded-lg border border-black/10 bg-white p-4 dark:border-white/10 dark:bg-[#111318]"
          >
            <div className="flex items-center justify-between">
              <span className="text-sm font-semibold text-[#1A1A1A] dark:text-[#F2F0EA]">
                {bay.label}
              </span>
              <span
                className="rounded-full px-2 py-0.5 text-[10px] font-bold uppercase"
                style={{ backgroundColor: style.bg, color: style.text }}
              >
                {style.label}
              </span>
            </div>
            <p className="mt-3 truncate text-xs text-black/50 dark:text-white/50">
              {bay.occupiedBy ?? '—'}
            </p>
          </div>
        )
      })}
    </div>
  )
}
