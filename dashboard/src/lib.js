// validated categorical palette (dataviz skill, light surface #ffffff)
// worst adjacent CVD ΔE 23.8, all ≥3:1 on white. Fixed order, stable per game.
export const PALETTE = [
  '#0b8f83', '#6b46e0', '#a9720f', '#bf2f7a',
  '#1c8a4b', '#2f6fd6', '#d13a2c', '#8f39b8',
]

// Nocturne dark-ground palettes (from the design handoff)
export const CURVE_PALETTE = [
  '#968ae0', '#57b6c9', '#e2a24f', '#df8fb5',
  '#74c79a', '#b9a0e8', '#8fb2ea', '#d98f8f',
]
export const TIER_COLOR = {
  '1-Direct': '#968ae0',
  '2-Adjacent': '#57b6c9',
  '3-Reference': '#e2a24f',
  'X-Drop?': '#df8fb5',
  '0-Ours': '#e7e5fe',
}
export const tierColor = (t) => TIER_COLOR[t] || '#9397ab'

// chart chrome — explicit hex (SVG fill/stroke attrs don't resolve CSS vars reliably)
// tuned for the Nocturne dark ground
export const CHROME = { grid: '#2a2d3b', axis: '#595d6c', muted: '#9397ab', ink2: '#c2c3cc' }

export const fmt = (n) => {
  if (n == null) return '—'
  const a = Math.abs(n)
  if (a >= 1e6) return (n / 1e6).toFixed(a >= 1e7 ? 0 : 1) + 'M'
  if (a >= 1e3) return (n / 1e3).toFixed(a >= 1e4 ? 0 : 1) + 'k'
  return String(n)
}

export const yearOf = (iso) => (iso ? iso.slice(0, 4) : '')

// calendar month/year at `week` weeks after an ISO launch date
export const calAt = (iso, week) => {
  if (!iso) return ''
  const d = new Date(iso + 'T00:00:00')
  d.setDate(d.getDate() + week * 7)
  return d.toLocaleString('en-US', { month: 'short', year: 'numeric' })
}

export const TIER_ORDER = ['1-Direct', '2-Adjacent', '3-Reference', 'X-Drop?', '0-Ours']

// Approximate, FIXED euro rates (mid-2026). Per CLAUDE.md, data stays in native
// currency and conversion happens here — so a rate refresh never rewrites the CSVs.
// These are for cross-studio comparison, not accounting; filings span several years
// at different real rates, so treat EUR figures as "roughly comparable", not exact.
export const EUR_PER = {
  EUR: 1, SEK: 0.087, NOK: 0.086, DKK: 0.134, GBP: 1.17,
  USD: 0.92, CZK: 0.040, PLN: 0.235, RON: 0.201, NZD: 0.55,
}
export const CUR_SYMBOL = { USD: '$', EUR: '€', GBP: '£' }
// native amount as a short string, e.g. "$40M", "910M GBP", "€1.5M"
export const nativeAmt = (v, cur) => {
  if (v == null) return null
  const sym = CUR_SYMBOL[cur]
  return sym ? sym + fmt(v) : `${fmt(v)} ${cur}`
}
export const toEur = (v, cur) => (v == null ? null : v * (EUR_PER[cur] ?? 1))
export const eurStr = (v) => (v == null ? '—' : '€' + fmt(v))
