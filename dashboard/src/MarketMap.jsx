import { useState } from 'react'
import { fmt, eurStr, toEur, tierColor } from './lib.js'
import { useDrawer } from './drawer.jsx'
import { ViewHead } from './ui.jsx'

const TIERS = { '1-Direct': 'Direct', '2-Adjacent': 'Adjacent', '3-Reference': 'Reference', 'X-Drop?': 'Survival cluster' }

const X0 = 64, X1 = 724, Y0 = 28, Y1 = 390
const GRID = 'rgba(233,233,237,0.08)'
const LBL = '#9397ab'

export default function MarketMap({ data }) {
  const { open } = useDrawer()
  const [metric, setMetric] = useState('units')
  const [log, setLog] = useState(true)
  const [tiers, setTiers] = useState(['1-Direct', '2-Adjacent', '3-Reference', 'X-Drop?'])
  const [hoverId, setHoverId] = useState(null)

  const toggleTier = (t) => setTiers((s) => (s.includes(t) ? s.filter((x) => x !== t) : [...s, t]))

  const our = data.games.find((g) => g.is_our_game)
  const targetPrice = our?.target_price_usd ?? our?.price_usd ?? null

  const pts = []
  data.games
    .filter((g) => !g.is_our_game && TIERS[g.tier] && tiers.includes(g.tier) && g.price_usd != null)
    .forEach((g) => {
      const y = metric === 'units' ? g.est_units_mid : toEur(g.est_revenue_gross_mid, 'USD')
      if (y == null || y <= 0) return
      pts.push({
        g, x: g.price_usd, y,
        low: metric === 'units' ? g.est_units_low : y,
        high: metric === 'units' ? g.est_units_high : y,
        reviews: g.review_count || 1,
      })
    })

  const maxPrice = Math.ceil(Math.max(20, ...data.games.filter((g) => g.price_usd != null).map((g) => g.price_usd)) / 5) * 5
  const tops = pts.map((p) => p.high || p.y)
  const bots = pts.map((p) => p.low || p.y)
  const maxV = tops.length ? Math.max(...tops) : 1
  const minV = bots.length ? Math.min(...bots) : 1
  const dom = log ? [Math.max(1, minV / 1.8), maxV * 1.4] : [0, maxV * 1.1]

  const sx = (px) => X0 + (px / maxPrice) * (X1 - X0)
  const sy = (v) => {
    if (log) {
      const lo = Math.log10(dom[0]), hi = Math.log10(dom[1])
      return Y1 - ((Math.log10(v) - lo) / (hi - lo)) * (Y1 - Y0)
    }
    return Y1 - ((v - dom[0]) / (dom[1] - dom[0])) * (Y1 - Y0)
  }

  const rv = pts.map((p) => Math.sqrt(p.reviews))
  const rmin = Math.min(...rv, 1), rmax = Math.max(...rv, 1)
  const R = (v) => (rmax === rmin ? 8 : 5 + 16 * ((Math.sqrt(v) - rmin) / (rmax - rmin)))

  const yTicks = []
  if (log) {
    const lo = Math.ceil(Math.log10(dom[0])), hi = Math.floor(Math.log10(dom[1]))
    for (let e = lo; e <= hi; e++) {
      const v = Math.pow(10, e), y = sy(v)
      if (y >= Y0 - 2 && y <= Y1 + 2) yTicks.push({ y, label: metric === 'revenue' ? eurStr(v) : fmt(v) })
    }
  } else {
    for (let i = 0; i <= 4; i++) {
      const v = dom[1] * (4 - i) / 4, y = Y0 + (Y1 - Y0) * i / 4
      yTicks.push({ y, label: metric === 'revenue' ? eurStr(v) : fmt(Math.round(v)) })
    }
  }
  const xTicks = []
  const step = maxPrice <= 30 ? 5 : 10
  for (let p = 0; p <= maxPrice; p += step) xTicks.push({ x: sx(p), label: '$' + p })

  const whiskers = metric === 'units'
    ? pts.filter((p) => p.low != null && p.high != null && p.low !== p.high)
    : []

  const hover = hoverId ? pts.find((p) => p.g.game_id === hoverId) : null
  const yAxisLabel = (metric === 'revenue' ? 'est. gross revenue (EUR)' : 'est. units') + (log ? ' · log scale' : ' · linear')

  return (
    <div>
      <ViewHead
        title="Market map"
        badge="EST"
        subtitle="Every game by price and outcome. Bubble size = review count, colour = tier."
        infoWidth={440}
        info={<>Read <b>left to right</b> for price, <b>bottom to top</b> for success. On the units view each dot carries a vertical whisker: the low to high band, so a tall whisker means the estimators disagree. The default <b>log scale</b> means each gridline is ten times the one below it, so equal spacing is equal multiples. Revenue is a single modelled point and is <b>gross</b>, before Valve's cut. The dashed line marks our target price.</>}
      />

      <div className="controls">
        <div className="group">
          <span className="glabel">Vertical axis</span>
          {[['units', 'Est. units'], ['revenue', 'Est. gross revenue']].map(([k, label]) => (
            <button key={k} className={'pill' + (metric === k ? ' on' : '')} onClick={() => setMetric(k)}>{label}</button>
          ))}
        </div>
        <div className="group">
          <span className="glabel">Scale</span>
          <button className={'pill' + (log ? ' on' : '')} onClick={() => setLog(true)}>Log</button>
          <button className={'pill' + (!log ? ' on' : '')} onClick={() => setLog(false)}>Linear</button>
        </div>
      </div>
      <div className="controls" style={{ marginTop: -4 }}>
        <div className="group">
          <span className="glabel">Tiers</span>
          {Object.entries(TIERS).map(([t, label]) => (
            <button key={t} className={'pill' + (tiers.includes(t) ? ' on' : '')} onClick={() => toggleTier(t)}>
              <span className="dot" style={{ background: tierColor(t), width: 9, height: 9, borderRadius: '50%', display: 'inline-block' }} />{label}
            </button>
          ))}
        </div>
      </div>

      <div className="chartwrap" style={{ position: 'relative', padding: '16px 12px 10px' }}>
        <svg viewBox="0 0 760 452" style={{ width: '100%', height: 'auto', display: 'block' }}>
          {yTicks.map((t, i) => (
            <line key={'g' + i} x1={X0} y1={t.y} x2={X1} y2={t.y} stroke={GRID} strokeWidth="1" />
          ))}
          {yTicks.map((t, i) => (
            <text key={'yl' + i} x={54} y={t.y + 4} fill={LBL} fontSize="11" textAnchor="end">{t.label}</text>
          ))}
          {xTicks.map((t, i) => (
            <text key={'xl' + i} x={t.x} y={418} fill={LBL} fontSize="11" textAnchor="middle">{t.label}</text>
          ))}
          <text x={394} y={440} fill={LBL} fontSize="11" textAnchor="middle">Steam price (USD)</text>
          <text x={18} y={209} transform="rotate(-90 18 209)" fill={LBL} fontSize="11" textAnchor="middle">{yAxisLabel}</text>

          {targetPrice != null && (
            <>
              <line x1={sx(targetPrice)} y1={Y0} x2={sx(targetPrice)} y2={Y1} stroke="#9184d9" strokeDasharray="5 4" strokeWidth="1" />
              <text x={sx(targetPrice) + 6} y={40} fill="#b5abfc" fontSize="11" fontWeight="600">our target ${targetPrice}</text>
            </>
          )}

          {whiskers.map((p, i) => (
            <line key={'w' + i} x1={sx(p.x)} y1={sy(p.high)} x2={sx(p.x)} y2={sy(p.low)} stroke={tierColor(p.g.tier)} strokeWidth="1.25" opacity="0.5" />
          ))}
          {pts.map((p) => (
            <circle
              key={p.g.game_id}
              cx={sx(p.x)} cy={sy(p.y)} r={R(p.reviews)}
              fill={tierColor(p.g.tier)} fillOpacity="0.72" stroke={tierColor(p.g.tier)} strokeWidth="1"
              style={{ cursor: 'pointer' }}
              onClick={() => open({ type: 'game', id: p.g.game_id })}
              onMouseEnter={() => setHoverId(p.g.game_id)}
              onMouseLeave={() => setHoverId(null)}
            />
          ))}
        </svg>

        {hover && (
          <div
            className="mtip"
            style={{ left: `${(sx(hover.x) / 760) * 100}%`, top: `${(sy(hover.y) / 452) * 100}%` }}
          >
            <div className="mtip-h"><span className="dot" style={{ background: tierColor(hover.g.tier) }} />{hover.g.title}</div>
            <div className="mtip-row"><span>Price</span><b>${hover.g.price_usd}</b></div>
            <div className="mtip-row"><span>Est. units</span><b>{hover.g.est_units_mid != null ? fmt(hover.g.est_units_mid) : '—'}</b></div>
            <div className="mtip-row"><span>Reviews</span><b>{fmt(hover.g.review_count)}</b></div>
            <div className="mtip-cue">click to open sources</div>
          </div>
        )}
      </div>

      <p className="note" style={{ marginTop: 12, color: 'var(--muted)', fontSize: 12.5 }}>
        Price and reviews are HARD from Steam; units and revenue are EST. Games without a price or unit
        estimate can't be placed and are left out.
      </p>
    </div>
  )
}
