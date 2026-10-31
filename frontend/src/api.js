async function get(path) {
  const res = await fetch(path)
  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw new Error(body.detail ?? `Request failed (${res.status})`)
  }
  return res.json()
}

export const getDays = () => get('/api/days')
export const getSummary = () => get('/api/summary')
export const getDay = (date) => get(`/api/day?date=${date}`)
