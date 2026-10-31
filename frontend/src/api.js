// Backend address. Set at build time with VITE_API_URL
// (e.g. https://dev-gridbricks.dhql6p.easypanel.host).
// Empty in local dev: Vite forwards /api to localhost:8000 (see vite.config.js).
const BASE = (import.meta.env.VITE_API_URL ?? '').replace(/\/$/, '')

async function get(path) {
  const res = await fetch(`${BASE}${path}`)
  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw new Error(body.detail ?? `Request failed (${res.status})`)
  }
  return res.json()
}

export const getDays = () => get('/api/days')
export const getSummary = () => get('/api/summary')
export const getDay = (date) => get(`/api/day?date=${date}`)
