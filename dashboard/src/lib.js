// validated categorical palette (dataviz skill, light surface #ffffff)
// worst adjacent CVD ΔE 23.8, all ≥3:1 on white. Fixed order, stable per game.
export const PALETTE = [
  '#0b8f83', '#6b46e0', '#a9720f', '#bf2f7a',
  '#1c8a4b', '#2f6fd6', '#d13a2c', '#8f39b8',
]

// Curve hues for the Nocturne dark ground (chart surface #232532).
// Validated with the dataviz validator: lightness band, chroma floor, adjacent
// CVD separation, normal-vision floor and contrast all PASS.
// The handoff's original eight did NOT pass — its #8fb2ea and #b9a0e8 sat ΔE 6.8
// apart in normal vision and 0.4 under deuteranopia, i.e. two of the eight launch
// curves were the same colour. These are stepped in OKLCH to keep the house look
// (slot 1 is the Nocturne accent) while actually being tellable apart.
export const CURVE_PALETTE = [
  '#8968d4', '#00a8a9', '#cf752d', '#bc4385',
  '#2ca470', '#346ecd', '#d95960', '#9b5bb6',
]

// Composite encoding for series 9+. A 9th series never gets an invented hue --
// the palette repeats with a different stroke, so identity is (hue x dash) and
// stays unique and stable per game however many are on screen at once.
export const CURVE_DASH = [undefined, '7 4', '2 3', '10 3 2 3']
export const curveStyle = (i) => ({
  stroke: CURVE_PALETTE[i % CURVE_PALETTE.length],
  strokeDasharray: CURVE_DASH[Math.floor(i / CURVE_PALETTE.length) % CURVE_DASH.length],
})
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
