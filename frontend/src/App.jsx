import { useEffect, useState } from 'react'
import { getDays, getSummary } from './api'
import AccuracyView from './components/AccuracyView'
import DayView from './components/DayView'

const TABS = [
  { id: 'day', label: 'Forecast at decision time' },
  { id: 'accuracy', label: 'Forecast accuracy' },
]

export default function App() {
  const [days, setDays] = useState(null)
  const [summary, setSummary] = useState(null)
  const [error, setError] = useState(null)
  const [tab, setTabState] = useState(() => (window.location.hash === '#accuracy' ? 'accuracy' : 'day'))
  const setTab = (t) => {
    setTabState(t)
    window.history.replaceState(null, '', t === 'accuracy' ? '#accuracy' : '#')
  }
  const [day, setDay] = useState(null)

  useEffect(() => {
    Promise.all([getDays(), getSummary()])
      .then(([d, s]) => {
        setDays(d)
        setSummary(s)
        setDay(d.at(-1).deliveryDay)
      })
      .catch((e) => setError(e.message))
  }, [])

  const openDay = (d) => {
    setDay(d)
    setTab('day')
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  return (
    <div className="min-h-screen text-neutral-900 dark:text-neutral-100">
      <header className="border-b border-neutral-200 bg-white dark:border-neutral-800 dark:bg-neutral-900">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-4">
          <div className="flex items-center gap-3">
            <div className="grid h-9 w-9 place-items-center rounded-lg bg-blue-600 text-white">
              <svg viewBox="0 0 32 32" className="h-5 w-5" fill="currentColor" aria-hidden>
                <path d="M6 26h5v-8H6zM13.5 26h5V8h-5zM21 26h5V14h-5z" />
              </svg>
            </div>
            <div>
              <h1 className="text-lg font-semibold leading-tight">Gridbricks</h1>
              <p className="text-xs text-neutral-500 dark:text-neutral-400">
                UK national wind · day-ahead decisions, January 2026
              </p>
            </div>
          </div>
          <nav className="flex rounded-lg bg-neutral-100 p-1 dark:bg-neutral-800" role="tablist">
            {TABS.map((t) => (
              <button
                key={t.id}
                role="tab"
                aria-selected={tab === t.id}
                onClick={() => setTab(t.id)}
                className={`rounded-md px-3 py-1.5 text-sm font-medium transition ${
                  tab === t.id
                    ? 'bg-white shadow-sm dark:bg-neutral-950'
                    : 'text-neutral-600 hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-neutral-100'
                }`}
              >
                {t.label}
              </button>
            ))}
          </nav>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-6">
        {error && (
          <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800 dark:border-red-900 dark:bg-red-950 dark:text-red-300">
            Couldn’t load data: {error}. Is the backend running?
          </div>
        )}
        {!error && !summary && (
          <div className="py-24 text-center text-sm text-neutral-500">Loading January 2026 data from Elexon…</div>
        )}
        {summary && tab === 'day' && (
          <DayView days={days} day={day} onChangeDay={setDay} summary={summary} />
        )}
        {summary && tab === 'accuracy' && (
          <AccuracyView summary={summary} days={days} onOpenDay={openDay} />
        )}
      </main>

      <footer className="mx-auto max-w-6xl px-4 pb-8 text-xs text-neutral-500 dark:text-neutral-400">
        Data: Elexon BMRS (FUELHH wind actuals, WINDFOR forecasts). Decision time = 11:00 UK on the day before delivery.
      </footer>
    </div>
  )
}
