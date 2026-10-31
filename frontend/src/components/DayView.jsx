import { useEffect, useState } from 'react'
import { getDay } from '../api'
import { dateTime, duration, gw, longDate, mw, signedMw, time } from '../format'
import DayChart from './DayChart'
import HourlyErrorChart from './HourlyErrorChart'
import { Card, StatTile } from './ui'

const avg = (xs) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null)

export default function DayView({ days, day, onChangeDay, summary }) {
  const [detail, setDetail] = useState(null)
  const [error, setError] = useState(null)

  useEffect(() => {
    let cancelled = false
    setError(null)
    getDay(day)
      .then((d) => !cancelled && setDetail(d))
      .catch((e) => !cancelled && setError(e.message))
    return () => { cancelled = true }
  }, [day])

  const index = days.findIndex((d) => d.deliveryDay === day)
  const { p10Error, p90Error } = summary.metrics
  const ready = detail && detail.deliveryDay === day

  return (
    <div className="space-y-4">
      {/* Day picker */}
      <div className="flex flex-wrap items-center gap-2">
        <button
          className="rounded-lg border border-neutral-200 px-3 py-2 text-sm hover:bg-neutral-100 disabled:opacity-40 dark:border-neutral-800 dark:hover:bg-neutral-800"
          disabled={index <= 0}
          onClick={() => onChangeDay(days[index - 1].deliveryDay)}
          aria-label="Previous day"
        >
          ←
        </button>
        <select
          value={day}
          onChange={(e) => onChangeDay(e.target.value)}
          className="rounded-lg border border-neutral-200 bg-white px-3 py-2 text-sm font-medium dark:border-neutral-800 dark:bg-neutral-900"
        >
          {days.map((d) => (
            <option key={d.deliveryDay} value={d.deliveryDay}>
              Delivery {longDate(d.deliveryDay)}
            </option>
          ))}
        </select>
        <button
          className="rounded-lg border border-neutral-200 px-3 py-2 text-sm hover:bg-neutral-100 disabled:opacity-40 dark:border-neutral-800 dark:hover:bg-neutral-800"
          disabled={index >= days.length - 1}
          onClick={() => onChangeDay(days[index + 1].deliveryDay)}
          aria-label="Next day"
        >
          →
        </button>
      </div>

      {error && <p className="text-sm text-red-700 dark:text-red-400">{error}</p>}
      {!ready && !error && <p className="text-sm text-neutral-500">Loading day…</p>}
      {ready && <DayContent detail={detail} p10Error={p10Error} p90Error={p90Error} />}
    </div>
  )
}

function DayContent({ detail, p10Error, p90Error }) {
  const decision = new Date(detail.decisionTime)
  const published = detail.forecast.reduce(
    (latest, f) => (f.publishTime > latest ? f.publishTime : latest),
    detail.forecast[0]?.publishTime,
  )
  const forecastAvg = avg(detail.forecast.map((f) => f.generation))
  const actualAvg = avg(detail.actual.map((a) => a.generation))
  const reliableAvg = forecastAvg == null ? null : Math.max(0, forecastAvg - p90Error)
  const m = detail.metrics

  return (
    <>
      {/* Decision context */}
      <Card>
        <div className="grid gap-4 sm:grid-cols-3">
          <div>
            <div className="text-xs font-medium text-neutral-500 dark:text-neutral-400">Purchase decision</div>
            <div className="mt-1 text-sm font-semibold">{dateTime(detail.decisionTime)}</div>
            <div className="text-xs text-neutral-500 dark:text-neutral-400">Day-ahead auction deadline</div>
          </div>
          <div>
            <div className="text-xs font-medium text-neutral-500 dark:text-neutral-400">Latest forecast available</div>
            <div className="mt-1 text-sm font-semibold">
              {published ? `Published ${time(published)}` : 'None'}
            </div>
            {published && (
              <div className="text-xs text-neutral-500 dark:text-neutral-400">
                {duration(decision - new Date(published))} before the deadline
              </div>
            )}
          </div>
          <div>
            <div className="text-xs font-medium text-neutral-500 dark:text-neutral-400">Forecast horizon</div>
            <div className="mt-1 text-sm font-semibold">
              {detail.forecast.length
                ? `${detail.forecast[0].leadHours}–${detail.forecast.at(-1).leadHours} hours ahead`
                : '–'}
            </div>
            <div className="text-xs text-neutral-500 dark:text-neutral-400">{detail.forecast.length} hourly values</div>
          </div>
        </div>
      </Card>

      {/* Headline numbers */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatTile label="Forecast (day average)" value={gw(forecastAvg)} hint="What the team saw at 11:00" />
        <StatTile
          label="Wind to rely on (P90)"
          value={gw(reliableAvg)}
          hint="In 90% of January hours, actual wind was at least this"
        />
        <StatTile label="Actual (day average)" value={gw(actualAvg)} />
        <StatTile
          label="Average miss this day"
          value={mw(m.mae)}
          hint={m.bias > 0 ? `Too high by ${mw(m.bias)} on average` : `Too low by ${mw(-m.bias)} on average`}
          tone={m.maePct > 25 ? 'warn' : undefined}
        />
      </div>

      <Card
        title="Forecast at decision time vs what happened"
        subtitle="GW · likely range = forecast adjusted by the 10th–90th percentile of January errors"
      >
        <DayChart detail={detail} p10Error={p10Error} p90Error={p90Error} />
      </Card>

      <Card title="Hourly error" subtitle="GW · forecast minus actual">
        <HourlyErrorChart comparison={detail.comparison} />
      </Card>

      <Card>
        <details>
          <summary className="cursor-pointer text-sm font-semibold">Data table</summary>
          <div className="mt-3 overflow-x-auto">
            <table className="w-full text-right text-sm">
              <thead className="text-xs text-neutral-500 dark:text-neutral-400">
                <tr className="border-b border-neutral-200 dark:border-neutral-800">
                  <th className="py-2 text-left font-medium">Hour</th>
                  <th className="py-2 font-medium">Forecast</th>
                  <th className="py-2 font-medium">Actual</th>
                  <th className="py-2 font-medium">Error</th>
                  <th className="py-2 font-medium">Made</th>
                </tr>
              </thead>
              <tbody>
                {detail.comparison.map((r) => (
                  <tr key={r.startTime} className="border-b border-neutral-100 last:border-0 dark:border-neutral-800/60">
                    <td className="py-1.5 text-left">{time(r.startTime)}</td>
                    <td className="py-1.5">{mw(r.forecast)}</td>
                    <td className="py-1.5">{mw(r.actual)}</td>
                    <td className="py-1.5">{signedMw(r.error)}</td>
                    <td className="py-1.5 text-neutral-500">{r.leadHours}h ahead</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </details>
      </Card>
    </>
  )
}
