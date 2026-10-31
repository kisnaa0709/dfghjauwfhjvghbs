import {
  Area, CartesianGrid, ComposedChart, Line, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts'
import { mw, time } from '../format'
import { axisProps, Legend, TooltipBox } from './ui'
import { gwTick } from '../format'

// Forecast (hourly) + actual (half-hourly) + likely range for one delivery day
export default function DayChart({ detail, p10Error, p90Error }) {
  const byTime = new Map()
  const point = (iso) => {
    const t = new Date(iso).getTime()
    if (!byTime.has(t)) byTime.set(t, { t })
    return byTime.get(t)
  }
  for (const a of detail.actual) point(a.startTime).actual = a.generation
  for (const f of detail.forecast) {
    const p = point(f.startTime)
    p.forecast = f.generation
    // error = forecast - actual  =>  actual = forecast - error
    p.band = [Math.max(0, f.generation - p90Error), f.generation - p10Error]
  }
  const data = [...byTime.values()].sort((a, b) => a.t - b.t)

  const start = new Date(`${detail.deliveryDay}T00:00:00Z`).getTime()
  const ticks = Array.from({ length: 9 }, (_, i) => start + i * 3 * 3600_000)

  return (
    <div>
      <Legend
        items={[
          { label: 'Forecast used', color: 'var(--forecast)', kind: 'line' },
          { label: 'Actual', color: 'var(--actual)', kind: 'line' },
          { label: 'Likely range (80%)', color: 'var(--band)', kind: 'band' },
        ]}
      />
      <div className="mt-3 h-72 sm:h-80">
        <ResponsiveContainer>
          <ComposedChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
            <CartesianGrid stroke="var(--grid)" vertical={false} />
            <XAxis
              {...axisProps}
              dataKey="t"
              type="number"
              domain={[ticks[0], ticks[ticks.length - 1]]}
              ticks={ticks}
              tickFormatter={(t) => time(t)}
            />
            <YAxis
              {...axisProps}
              axisLine={false}
              width={36}
              tickFormatter={gwTick}
            />
            <Tooltip
              cursor={{ stroke: 'var(--axis)', strokeWidth: 1 }}
              content={({ active, payload }) => {
                if (!active || !payload?.length) return null
                const p = payload[0].payload
                const rows = [
                  p.forecast != null && { label: 'Forecast', value: mw(p.forecast), color: 'var(--forecast)' },
                  p.actual != null && { label: 'Actual', value: mw(p.actual), color: 'var(--actual)' },
                  p.band && { label: 'Likely range', value: `${mw(p.band[0])} – ${mw(p.band[1])}` },
                ].filter(Boolean)
                return <TooltipBox title={time(p.t)} rows={rows} />
              }}
            />
            <Area
              dataKey="band"
              stroke="none"
              fill="var(--band)"
              fillOpacity={0.7}
              connectNulls
              isAnimationActive={false}
              activeDot={false}
            />
            <Line
              dataKey="actual"
              stroke="var(--actual)"
              strokeWidth={2}
              dot={false}
              activeDot={{ r: 4, stroke: 'var(--surface)', strokeWidth: 2 }}
              isAnimationActive={false}
            />
            <Line
              dataKey="forecast"
              stroke="var(--forecast)"
              strokeWidth={2}
              dot={false}
              activeDot={{ r: 4, stroke: 'var(--surface)', strokeWidth: 2 }}
              connectNulls
              isAnimationActive={false}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}
