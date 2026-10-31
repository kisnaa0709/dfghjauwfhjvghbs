import { useState } from 'react'
import { mw, signedMw, longDate } from '../format'
import { TooltipBox } from './ui'

// Daily MAE bins -> one-hue blue ramp: darker = bigger miss, in light and dark mode.
const BINS = [
  { max: 750, fill: 'var(--seq-1)', text: 'text-neutral-900', label: '< 750' },
  { max: 1250, fill: 'var(--seq-2)', text: 'text-neutral-900', label: '750–1,250' },
  { max: 1750, fill: 'var(--seq-3)', text: 'text-neutral-900', label: '1,250–1,750' },
  { max: 2500, fill: 'var(--seq-4)', text: 'text-white', label: '1,750–2,500' },
  { max: 3500, fill: 'var(--seq-5)', text: 'text-white', label: '2,500–3,500' },
  { max: Infinity, fill: 'var(--seq-6)', text: 'text-white', label: '≥ 3,500' },
]
const binFor = (mae) => BINS.find((b) => mae < b.max)
const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

export default function DayCalendar({ days, onOpenDay }) {
  const [hover, setHover] = useState(null)
  // Pad the start so the first day lands in its weekday column (Mon = 0)
  const firstWeekday = (new Date(`${days[0].deliveryDay}T00:00:00Z`).getUTCDay() + 6) % 7
  const cells = [...Array(firstWeekday).fill(null), ...days]

  return (
    <div>
      <div className="grid grid-cols-7 gap-1 sm:gap-1.5">
        {WEEKDAYS.map((w) => (
          <div key={w} className="pb-1 text-center text-[11px] font-medium text-neutral-500 dark:text-neutral-400">{w}</div>
        ))}
        {cells.map((d, i) => {
          if (!d) return <div key={`pad-${i}`} />
          const bin = binFor(d.mae ?? 0)
          const date = new Date(`${d.deliveryDay}T00:00:00Z`)
          return (
            <button
              key={d.deliveryDay}
              onClick={() => onOpenDay(d.deliveryDay)}
              onMouseEnter={() => setHover(d)}
              onMouseLeave={() => setHover(null)}
              onFocus={() => setHover(d)}
              onBlur={() => setHover(null)}
              className={`flex aspect-square flex-col items-start justify-between rounded-md p-1 text-left transition hover:ring-2 hover:ring-neutral-900 focus-visible:ring-2 focus-visible:ring-neutral-900 sm:p-1.5 dark:hover:ring-neutral-100 ${bin.text}`}
              style={{ background: bin.fill }}
              aria-label={`${longDate(d.deliveryDay)}: average miss ${mw(d.mae)}`}
            >
              <span className="text-[11px] font-semibold leading-none sm:text-xs">
                {date.getUTCDate()}{date.getUTCDate() === 1 ? ` ${date.toLocaleString('en-GB', { month: 'short', timeZone: 'UTC' })}` : ''}
              </span>
              <span className="hidden text-[10px] leading-none opacity-90 sm:block">{(d.mae / 1000).toFixed(1)}</span>
            </button>
          )
        })}
      </div>

      <div className="mt-3 flex min-h-12 flex-wrap items-end justify-between gap-3">
        <div className="flex items-center gap-1 text-[11px] text-neutral-500 dark:text-neutral-400">
          <span className="mr-1">Average miss (MW)</span>
          {BINS.map((b) => (
            <span key={b.label} className="flex flex-col items-center gap-0.5">
              <span className="h-2.5 w-8 rounded-sm" style={{ background: b.fill }} />
              <span className="whitespace-nowrap">{b.label}</span>
            </span>
          ))}
        </div>
        {hover && (
          <TooltipBox
            title={`Delivery ${longDate(hover.deliveryDay)}`}
            rows={[
              { label: 'Average miss', value: mw(hover.mae) },
              { label: 'Bias', value: signedMw(hover.bias) },
            ]}
          />
        )}
      </div>
    </div>
  )
}
