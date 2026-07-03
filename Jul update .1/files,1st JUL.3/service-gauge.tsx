type GaugeStatus = 'good' | 'due-soon' | 'overdue'

const STATUS_META: Record<GaugeStatus, { color: string; label: string }> = {
  good: { color: '#00E5C7', label: 'Up to date' },
  'due-soon': { color: '#FFB020', label: 'Service due soon' },
  overdue: { color: '#FF6B4A', label: 'Service overdue' },
}

export function ServiceGauge({
  percentRemaining, // 0 = needs service now, 100 = just serviced
  status,
}: {
  percentRemaining: number
  status: GaugeStatus
}) {
  const clamped = Math.max(0, Math.min(100, percentRemaining))
  const meta = STATUS_META[status]

  // Semicircle arc math: 180 -> 0 degrees mapped across the gauge
  const radius = 70
  const circumference = Math.PI * radius
  const dashOffset = circumference * (1 - clamped / 100)

  return (
    <div className="flex flex-col items-center">
      <svg width="180" height="110" viewBox="0 0 180 100">
        {/* track */}
        <path
          d="M 20 90 A 70 70 0 0 1 160 90"
          fill="none"
          stroke="currentColor"
          strokeOpacity="0.12"
          strokeWidth="14"
          strokeLinecap="round"
        />
        {/* value */}
        <path
          d="M 20 90 A 70 70 0 0 1 160 90"
          fill="none"
          stroke={meta.color}
          strokeWidth="14"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={dashOffset}
          style={{ transition: 'stroke-dashoffset 0.6s ease' }}
        />
      </svg>
      <div className="-mt-4 text-center">
        <p className="text-2xl font-bold text-[#1A1A1A] dark:text-[#F2F0EA]">{clamped}%</p>
        <p className="text-xs font-medium" style={{ color: meta.color }}>
          {meta.label}
        </p>
      </div>
    </div>
  )
}
