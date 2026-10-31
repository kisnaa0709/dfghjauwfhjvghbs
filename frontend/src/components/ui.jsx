export function Card({ title, subtitle, action, children, className = '' }) {
  return (
    <section
      className={`rounded-xl border border-neutral-200 bg-white p-4 sm:p-5 dark:border-neutral-800 dark:bg-neutral-900 ${className}`}
    >
      {(title || action) && (
        <header className="mb-4 flex flex-wrap items-start justify-between gap-2">
          <div>
            {title && <h2 className="text-sm font-semibold text-neutral-900 dark:text-neutral-100">{title}</h2>}
            {subtitle && <p className="mt-0.5 text-xs text-neutral-500 dark:text-neutral-400">{subtitle}</p>}
          </div>
          {action}
        </header>
      )}
      {children}
    </section>
  )
}

export function StatTile({ label, value, hint, tone }) {
  const toneClass =
    tone === 'warn'
      ? 'text-red-700 dark:text-red-400'
      : 'text-neutral-900 dark:text-neutral-50'
  return (
    <div className="rounded-xl border border-neutral-200 bg-white p-4 dark:border-neutral-800 dark:bg-neutral-900">
      <div className="text-xs font-medium text-neutral-500 dark:text-neutral-400">{label}</div>
      <div className={`mt-1 text-2xl font-semibold tracking-tight ${toneClass}`}>{value}</div>
      {hint && <div className="mt-1 text-xs leading-snug text-neutral-500 dark:text-neutral-400">{hint}</div>}
    </div>
  )
}

export function TooltipBox({ title, rows }) {
  return (
    <div className="min-w-44 rounded-lg border border-neutral-200 bg-white/95 px-3 py-2 text-xs shadow-lg backdrop-blur dark:border-neutral-700 dark:bg-neutral-900/95">
      <div className="mb-1.5 font-semibold text-neutral-900 dark:text-neutral-100">{title}</div>
      {rows.map((r) => (
        <div key={r.label} className="flex items-center justify-between gap-4 py-0.5">
          <span className="flex items-center gap-1.5 text-neutral-500 dark:text-neutral-400">
            {r.color && <span className="inline-block h-2 w-2 rounded-full" style={{ background: r.color }} />}
            {r.label}
          </span>
          <span className="font-medium text-neutral-900 dark:text-neutral-100">{r.value}</span>
        </div>
      ))}
    </div>
  )
}

export function Legend({ items }) {
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-neutral-600 dark:text-neutral-400">
      {items.map((i) => (
        <span key={i.label} className="flex items-center gap-1.5">
          {i.kind === 'line' && <span className="inline-block h-0.5 w-4 rounded" style={{ background: i.color }} />}
          {i.kind === 'band' && <span className="inline-block h-2.5 w-4 rounded-sm" style={{ background: i.color }} />}
          {(!i.kind || i.kind === 'box') && <span className="inline-block h-2.5 w-2.5 rounded-sm" style={{ background: i.color }} />}
          {i.label}
        </span>
      ))}
    </div>
  )
}

export const axisProps = {
  stroke: 'var(--grid)',
  tick: { fill: 'var(--axis)', fontSize: 11 },
  tickLine: false,
}
