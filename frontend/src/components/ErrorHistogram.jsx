import {
  Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts'
import { axisProps, Legend, TooltipBox } from './ui'

const BIN = 1000 // MW
const fmt = (v) => `${v > 0 ? '+' : ''}${(v / 1000).toFixed(0)}`

export default function ErrorHistogram({ errors }) {
  const lo = Math.floor(Math.min(...errors) / BIN) * BIN
  const hi = Math.ceil(Math.max(...errors) / BIN) * BIN
  const bins = []
  for (let from = lo; from < hi; from += BIN) bins.push({ from, to: from + BIN, count: 0 })
  for (const e of errors) bins[Math.min(bins.length - 1, Math.floor((e - lo) / BIN))].count++
  const total = errors.length

  return (
    <div>
      <Legend
        items={[
          { label: 'Forecast too high', color: 'var(--too-high)' },
          { label: 'Forecast too low', color: 'var(--too-low)' },
        ]}
      />
      <div className="mt-3 h-56">
        <ResponsiveContainer>
          <BarChart data={bins} margin={{ top: 8, right: 8, bottom: 0, left: 0 }} barCategoryGap={2}>
            <CartesianGrid stroke="var(--grid)" vertical={false} />
            <XAxis {...axisProps} dataKey="from" tickFormatter={(v) => `${fmt(v)}…${fmt(v + BIN)}`} />
            <YAxis {...axisProps} axisLine={false} width={40} />
            <Tooltip
              cursor={{ fill: 'var(--grid)', fillOpacity: 0.5 }}
              content={({ active, payload }) => {
                if (!active || !payload?.length) return null
                const b = payload[0].payload
                return (
                  <TooltipBox
                    title={`${fmt(b.from)} to ${fmt(b.to)} GW`}
                    rows={[
                      { label: 'Hours', value: b.count },
                      { label: 'Share', value: `${((100 * b.count) / total).toFixed(1)}%` },
                    ]}
                  />
                )
              }}
            />
            <Bar dataKey="count" radius={[3, 3, 0, 0]} isAnimationActive={false}>
              {bins.map((b) => (
                <Cell key={b.from} fill={b.from >= 0 ? 'var(--too-high)' : 'var(--too-low)'} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}
