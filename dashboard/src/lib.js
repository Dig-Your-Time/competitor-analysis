// validated categorical palette (dataviz skill, light surface #ffffff)
// worst adjacent CVD ΔE 23.8, all ≥3:1 on white. Fixed order, stable per game.
export const PALETTE = [
  '#0b8f83', '#6b46e0', '#a9720f', '#bf2f7a',
  '#1c8a4b', '#2f6fd6', '#d13a2c', '#8f39b8',
]

// chart chrome — explicit hex (SVG fill/stroke attrs don't resolve CSS vars reliably)
export const CHROME = { grid: '#e6e8f0', axis: '#c7cbdb', muted: '#767c93', ink2: '#4a4f63' }

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
