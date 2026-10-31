const UK = 'Europe/London'

const mwFormat = new Intl.NumberFormat('en-GB', { maximumFractionDigits: 0 })

export const mw = (n) => (n == null ? '–' : `${mwFormat.format(n)} MW`)
export const signedMw = (n) => (n == null ? '–' : `${n > 0 ? '+' : ''}${mwFormat.format(n)} MW`)
export const gw = (n) => (n == null ? '–' : `${(n / 1000).toFixed(1)} GW`)

export const time = (iso) =>
  new Date(iso).toLocaleTimeString('en-GB', { timeZone: UK, hour: '2-digit', minute: '2-digit' })

export const shortDate = (iso) =>
  new Date(iso).toLocaleDateString('en-GB', { timeZone: UK, day: 'numeric', month: 'short' })

export const longDate = (iso) =>
  new Date(iso).toLocaleDateString('en-GB', {
    timeZone: UK, weekday: 'short', day: 'numeric', month: 'short', year: 'numeric',
  })

export const dateTime = (iso) => `${time(iso)}, ${longDate(iso)}`

// "1h 30m"
export const duration = (ms) => {
  const mins = Math.round(ms / 60000)
  const h = Math.floor(mins / 60)
  const m = mins % 60
  return h ? `${h}h${m ? ` ${m}m` : ''}` : `${m}m`
}

// Hour of day in UK time, 0-23
export const ukHour = (iso) =>
  Number(new Date(iso).toLocaleString('en-GB', { timeZone: UK, hour: '2-digit', hourCycle: 'h23' }))

// Axis ticks in GW: 2100 -> "2.1"
export const gwTick = (v) => `${+(v / 1000).toFixed(1)}`
