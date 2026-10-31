import {
  Bar, BarChart, CartesianGrid, Cell, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts'
import { mw, signedMw, time } from '../format'
import { axisProps, Legend, TooltipBox } from './ui'
import { gwTick } from '../format'

export default function HourlyErrorChart({ comparison }) {
  const data = comparison.map((r) => ({ ...r, label: time(r.startTime) }))
  return (
    <div>
      <Legend
        items={[
          { label: 'Forecast too high (less wind came)', color: 'var(--too-high)' },
          { label: 'Forecast too low (more wind came)', color: 'var(--too-low)' },
        ]}
      />
      <div className="mt-3 h-52">
        <ResponsiveContainer>
          <BarChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: 0 }} barCategoryGap={2}>
            <CartesianGrid stroke="var(--grid)" vertical={false} />
            <XAxis {...axisProps} dataKey="label" interval={2} />
            <YAxis {...axisProps} axisLine={false} width={36} tickFormatter={gwTick} />
            <ReferenceLine y={0} stroke="var(--axis)" strokeOpacity={0.5} />
            <Tooltip
              cursor={{ fill: 'var(--grid)', fillOpacity: 0.5 }}
              content={({ active, payload }) => {
                if (!active || !payload?.length) return null
                const r = payload[0].payload
                return (
                  <TooltipBox
                    title={r.label}
                    rows={[
                      { label: 'Error', value: signedMw(r.error), color: r.error > 0 ? 'var(--too-high)' : 'var(--too-low)' },
                      { label: 'Forecast', value: mw(r.forecast) },
                      { label: 'Actual', value: mw(r.actual) },
                      { label: 'Made', value: `${r.leadHours}h ahead` },
                    ]}
                  />
                )
              }}
            />
            <Bar dataKey="error" radius={2} isAnimationActive={false}>
              {data.map((r) => (
                <Cell key={r.startTime} fill={r.error > 0 ? 'var(--too-high)' : 'var(--too-low)'} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}
