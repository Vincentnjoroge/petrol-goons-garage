'use client'

import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts'

export type RevenuePoint = { period: string; revenue: number }

export function RevenueChart({ data }: { data: RevenuePoint[] }) {
  return (
    <div className="h-64 w-full rounded-xl border border-black/10 bg-white p-4 dark:border-white/10 dark:bg-[#111318]">
      <p className="mb-2 text-sm font-semibold text-[#1A1A1A] dark:text-[#F2F0EA]">Revenue</p>
      <ResponsiveContainer width="100%" height="88%">
        <AreaChart data={data} margin={{ top: 4, right: 8, left: -16, bottom: 0 }}>
          <defs>
            <linearGradient id="revenueFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#FFB020" stopOpacity={0.35} />
              <stop offset="100%" stopColor="#FFB020" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeOpacity={0.08} vertical={false} />
          <XAxis dataKey="period" tick={{ fontSize: 11, fill: '#8A8F98' }} axisLine={false} tickLine={false} />
          <YAxis tick={{ fontSize: 11, fill: '#8A8F98' }} axisLine={false} tickLine={false} width={40} />
          <Tooltip
            contentStyle={{
              background: '#111318',
              border: '1px solid #2A2E35',
              borderRadius: 8,
              fontSize: 12,
              color: '#F2F0EA',
            }}
            formatter={(value: number) => [`KSh ${value.toLocaleString()}`, 'Revenue']}
          />
          <Area type="monotone" dataKey="revenue" stroke="#FFB020" strokeWidth={2} fill="url(#revenueFill)" />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  )
}
