// CAN_EDIT is true only under `npm run dev` (import.meta.env.DEV). In the
// production build it is false and dead-code-eliminated, so no edit UI or
// network call ever reaches the deployed static site.
export const CAN_EDIT = import.meta.env.DEV

// Send one edit action to the local dev writer (scripts/apply_edit.py via Vite).
// Resolves with the server's JSON result or throws with a readable message.
export async function saveEdit(action) {
  let res
  try {
    res = await fetch('/api/edit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(action),
    })
  } catch (e) {
    throw new Error('Could not reach the local edit server. Is `npm run dev` running?')
  }
  let data
  try {
    data = await res.json()
  } catch {
    throw new Error('Edit endpoint returned a non-JSON response.')
  }
  if (!data.ok) throw new Error(data.error || 'Edit failed.')
  return data
}

// Add a whole new game (studio row must already exist). Hits the dedicated
// /api/add-game endpoint, which writes the HAND rows, fetches Steam, and rebuilds.
export async function addGame(payload) {
  let res
  try {
    res = await fetch('/api/add-game', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
  } catch (e) {
    throw new Error('Could not reach the local edit server. Is `npm run dev` running?')
  }
  let data
  try {
    data = await res.json()
  } catch {
    throw new Error('Add-game endpoint returned a non-JSON response.')
  }
  if (!data.ok) throw new Error(data.error || 'Add game failed.')
  return data
}

// controlled vocabularies for select fields
export const TIERS = ['1-Direct', '2-Adjacent', '3-Reference', 'X-Drop?', '0-Ours']
export const RELIABILITIES = ['Primary', 'Reputable secondary', 'Self-reported', 'Unverified', 'Other']
export const CONFIDENCE = ['HARD', 'EST', 'ANEC']
export const CURRENCIES = ['EUR', 'SEK', 'NOK', 'DKK', 'GBP', 'USD', 'CZK', 'PLN', 'RON', 'NZD']
export const SOURCE_TYPES = ['Registry', 'Financial filing', 'News', 'Interview', 'Dev post', 'Store', 'Estimate vendor', 'Other']

// suggest the next free source id (S001, S002, …) from the current sources map
export function nextSourceId(sources) {
  let max = 0
  Object.keys(sources || {}).forEach((id) => {
    const m = /^S(\d+)$/.exec(id)
    if (m) max = Math.max(max, Number(m[1]))
  })
  return 'S' + String(max + 1).padStart(3, '0')
}
