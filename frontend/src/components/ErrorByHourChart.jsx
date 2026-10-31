import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { mw, signedMw } from '../format'
import { axisProps, TooltipBox } from './ui'
import { gwTick } from '../format'

const pad = (h) => `${String(h).padStart(2, '0')}:00`

export default function ErrorByHourChart({ byHour }) {
  return (
    <div className="h-56">
      <ResponsiveContainer>
        <BarChart data={byHour} margin={{ top: 8, right: 8, bottom: 0, left: 0 }} barCategoryGap={2}>
          <CartesianGrid stroke="var(--grid)" vertical={false} />
          <XAxis {...axisProps} dataKey="hour" tickFormatter={pad} interval={2} />
          <YAxis {...axisProps} axisLine={false} width={36} tickFormatter={gwTick} />
          <Tooltip
            cursor={{ fill: 'var(--grid)', fillOpacity: 0.5 }}
            content={({ active, payload }) => {
              if (!active || !payload?.length) return null
              const r = payload[0].payload
              return (
                <TooltipBox
                  title={`${pad(r.hour)} (UK)`}
                  rows={[
                    { label: 'Average miss', value: mw(r.mae), color: 'var(--bar)' },
                    { label: 'Bias', value: signedMw(r.bias) },
                    { label: 'Days', value: r.count },
                  ]}
                />
              )
            }}
          />
          <Bar dataKey="mae" fill="var(--bar)" radius={[3, 3, 0, 0]} isAnimationActive={false} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}
