import { dateTime, mw, signedMw } from '../format'
import DayCalendar from './DayCalendar'
import ErrorByHourChart from './ErrorByHourChart'
import ErrorHistogram from './ErrorHistogram'
import { Card, StatTile } from './ui'

export default function AccuracyView({ summary, days, onOpenDay }) {
  const m = summary.metrics
  const highShare = Math.round(
    (100 * summary.errors.filter((e) => e > 0).length) / summary.errors.length,
  )
  const worst = [...days].sort((a, b) => b.mae - a.mae).slice(0, 5)

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatTile label="Average miss (MAE)" value={mw(m.mae)} hint={`${m.maePct}% of average wind (${mw(m.meanActual)})`} />
        <StatTile
          label="Bias"
          value={signedMw(m.bias)}
          hint={m.bias > 0 ? `Too high in ${highShare}% of hours` : `Too low in ${100 - highShare}% of hours`}
          tone={Math.abs(m.bias) > 0.5 * m.mae ? 'warn' : undefined}
        />
        <StatTile label="Half of hours missed by ≤" value={mw(m.p50AbsError)} />
        <StatTile label="90% of hours missed by ≤" value={mw(m.p90AbsError)} hint="A safety margin that covers 9 hours in 10" />
      </div>

      <Card title="What this means for buying">
        <ul className="list-disc space-y-1.5 pl-5 text-sm text-neutral-700 dark:text-neutral-300">
          {m.bias > 0 ? (
            <li>
              The day-ahead forecast <strong>over-estimated wind</strong> on average by {mw(m.bias)}.
              Buying on the raw forecast would usually have left the book <strong>short</strong>.
            </li>
          ) : (
            <li>
              The forecast <strong>under-estimated wind</strong> on average by {mw(-m.bias)}, so buying on it
              would usually have left the book long.
            </li>
          )}
          <li>
            To be covered in 9 hours out of 10, plan on about <strong>{mw(m.p90Error)} less wind</strong> than forecast.
          </li>
          <li>
            Biggest single miss: forecast {mw(m.worstOver.forecast)} vs actual {mw(m.worstOver.actual)} at{' '}
            {dateTime(m.worstOver.startTime)}.
          </li>
        </ul>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card title="Average miss by delivery day" subtitle="Click a day to open it">
          <DayCalendar days={days} onOpenDay={onOpenDay} />
        </Card>
        <Card title="Worst days" subtitle="Largest average miss">
          <ol className="divide-y divide-neutral-100 dark:divide-neutral-800">
            {worst.map((d, i) => (
              <li key={d.deliveryDay}>
                <button
                  onClick={() => onOpenDay(d.deliveryDay)}
                  className="flex w-full items-center justify-between gap-3 py-2.5 text-left text-sm hover:text-blue-700 dark:hover:text-blue-400"
                >
                  <span className="flex items-center gap-3">
                    <span className="w-4 text-xs text-neutral-400">{i + 1}</span>
                    {new Date(`${d.deliveryDay}T00:00:00Z`).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC' })}
                  </span>
                  <span className="text-right">
                    <span className="font-medium">{mw(d.mae)}</span>
                    <span className="ml-2 text-xs text-neutral-500">{d.maePct}%</span>
                  </span>
                </button>
              </li>
            ))}
          </ol>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card
          title="Average miss by hour of day"
          subtitle="GW · each hour is always forecast the same time ahead (decision at 11:00 the day before)"
        >
          <ErrorByHourChart byHour={summary.byHourOfDay} />
        </Card>
        <Card title="How big the misses were" subtitle={`Hours per 1 GW error band · all ${summary.errors.length} hours, forecast minus actual`}>
          <ErrorHistogram errors={summary.errors} />
        </Card>
      </div>
    </div>
  )
}
