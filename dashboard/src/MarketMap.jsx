import { useMemo, useState } from 'react'
import {
  ScatterChart, Scatter, XAxis, YAxis, ZAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, ReferenceLine, ErrorBar,
} from 'recharts'
import { CHROME, fmt, eurStr, toEur, TIER_ORDER } from './lib.js'
import { useDrawer } from './drawer.jsx'
import { EditOurGame } from './editor.jsx'

// friendly labels + a fixed colour per tier
const TIERS = {
  '1-Direct': { label: 'Direct competitors', color: '#0b8f83' },
  '2-Adjacent': { label: 'Adjacent', color: '#6b46e0' },
  '3-Reference': { label: 'Reference / ceiling', color: '#a9720f' },
  'X-Drop?': { label: 'Survival cluster', color: '#bf2f7a' },
}

const METRICS = {
  units: { label: 'Est. units sold', axis: 'est. units', badge: 'EST' },
  revenue: { label: 'Est. gross revenue', axis: 'est. gross revenue (EUR)', badge: 'EST' },
}

export default function MarketMap({ data }) {
  const { open } = useDrawer()
  const [metric, setMetric] = useState('units')
  const [log, setLog] = useState(true)
  const [on, setOn] = useState(() => new Set(Object.keys(TIERS)))

  const our = data.games.find((g) => g.is_our_game)
  const targetPrice = our?.target_price_usd ?? our?.price_usd ?? null

  const toggleTier = (t) => {
    const next = new Set(on)
    next.has(t) ? next.delete(t) : next.add(t)
    setOn(next)
  }

  // one datum per plottable game; y is the chosen metric, with a units band where we have one
  const byTier = useMemo(() => {
    const groups = {}
    data.games
      .filter((g) => !g.is_our_game && TIERS[g.tier])
      .forEach((g) => {
        if (g.price_usd == null) return
        const y = metric === 'units' ? g.est_units_mid : toEur(g.est_revenue_gross_mid, 'USD')
        if (y == null || y <= 0) return
        const d = {
          id: g.game_id, title: g.title, tier: g.tier,
          x: g.price_usd, y,
          reviews: g.review_count || 1,
          // sqrt so million-review giants don't dwarf small games into invisible dots
          z: Math.sqrt(g.review_count || 1),
          units_mid: g.est_units_mid, units_low: g.est_units_low, units_high: g.est_units_high,
          rev_eur: toEur(g.est_revenue_gross_mid, 'USD'),
        }
        // ErrorBar wants [distance below, distance above] in data units; only units has a real band
        if (metric === 'units' && g.est_units_low != null && g.est_units_high != null) {
          d.errY = [g.est_units_mid - g.est_units_low, g.est_units_high - g.est_units_mid]
        }
        ;(groups[g.tier] = groups[g.tier] || []).push(d)
      })
    return groups
  }, [data, metric])

  const maxPrice = Math.max(20, ...data.games.filter((g) => g.price_usd != null).map((g) => g.price_usd))
  const yTick = (v) => (metric === 'revenue' ? eurStr(v) : fmt(v))

  // pad the y range so the biggest bubble + its whisker aren't clipped at the top edge
  const pts = TIER_ORDER.filter((t) => TIERS[t] && on.has(t)).flatMap((t) => byTier[t] || [])
  const tops = pts.map((p) => (metric === 'units' ? (p.units_high ?? p.y) : p.y)).filter((v) => v > 0)
  const bots = pts.map((p) => (metric === 'units' ? (p.units_low ?? p.y) : p.y)).filter((v) => v > 0)
  const maxV = tops.length ? Math.max(...tops) : 1
  const minV = bots.length ? Math.min(...bots) : 1
  const yDomain = log ? [Math.max(1, minV / 1.8), maxV * 1.4] : [0, maxV * 1.1]

  const Tip = ({ active, payload }) => {
    if (!active || !payload?.length) return null
    const d = payload[0].payload
    return (
      <div className="tt">
        <div className="tt-h">
          <span className="dot" style={{ background: TIERS[d.tier].color }} /> {d.title}
        </div>
        <div className="tt-line"><span>Price</span><b>${d.x}</b></div>
        <div className="tt-line">
          <span>Est. units</span>
          <b>{d.units_mid != null ? fmt(d.units_mid) : '—'}</b>
        </div>
        {d.units_low != null && (
          <div className="tt-sub">band {fmt(d.units_low)} to {fmt(d.units_high)}</div>
        )}
        <div className="tt-line"><span>Est. gross rev</span><b>{eurStr(d.rev_eur)}</b></div>
        <div className="tt-line"><span>Reviews</span><b>{fmt(d.reviews)}</b></div>
        <div className="tt-cue">click to open sources</div>
      </div>
    )
  }

  return (
    <div>
      <h1>Market map: every game by price and outcome</h1>
      <p className="sub">
        One dot per game. <strong>Price</strong> sets the horizontal position (the lever you control);
        the vertical axis is the <strong>{METRICS[metric].label.toLowerCase()}</strong>{' '}
        <span className="tagpill tag-est">EST</span>. Bubble size is the Steam <strong>review count</strong>,
        and colour is the tier. Click any dot for its sources.
      </p>

      <div className="controls">
        <div className="group">
          <span className="glabel">Vertical axis</span>
          {Object.entries(METRICS).map(([k, m]) => (
            <button key={k} className={'pill' + (metric === k ? ' on' : '')} onClick={() => setMetric(k)}>{m.label}</button>
          ))}
        </div>
        <div className="group">
          <span className="glabel">Scale</span>
          <button className={'pill' + (log ? ' on' : '')} onClick={() => setLog(true)}>Log</button>
          <button className={'pill' + (!log ? ' on' : '')} onClick={() => setLog(false)}>Linear</button>
        </div>
      </div>

      <div className="controls" style={{ marginTop: -6 }}>
        <div className="group">
          <span className="glabel">Tiers</span>
          {Object.entries(TIERS).map(([t, { label, color }]) => (
            <button
              key={t}
              className={'pill' + (on.has(t) ? ' on' : '')}
              onClick={() => toggleTier(t)}
              style={on.has(t) ? { background: color, borderColor: color, color: '#fff' } : undefined}
            >
              <span
                className="dot"
                style={{ background: on.has(t) ? '#fff' : color, marginRight: 6 }}
              />{label}
            </button>
          ))}
        </div>
      </div>

      <div className="howto">
        <strong>How to read this.</strong> Read <em>left to right</em> for price and <em>bottom to top</em>
        {' '}for success. On the units view each dot carries a <strong>vertical whisker</strong>: that is the
        low to high estimate band, so a tall whisker means the estimators disagree and the number is soft.
        The default <strong>log scale</strong> means each gridline is <em>ten times</em> the one below it
        (10k, then 100k, then 1M, then 10M), so equal spacing is equal <em>multiples</em>, not equal amounts.
        That is what keeps a 30k game and a 30M game both readable on one chart; switch to <strong>linear</strong>
        and the giants stretch the axis until everything small collapses onto the floor. Revenue is a single
        modelled point (there is no published low to high band for it) and is <strong>gross</strong>, before
        Valve's cut.
        {targetPrice != null && <> The dashed line marks <strong>our target price of ${targetPrice}</strong>
        <EditOurGame />, so you can see who else lives in that column.</>}
      </div>

      <div className="chartwrap">
        <ResponsiveContainer width="100%" height={500}>
          <ScatterChart margin={{ top: 16, right: 24, bottom: 44, left: 8 }}>
            <CartesianGrid stroke={CHROME.grid} />
            <XAxis
              type="number" dataKey="x" name="Price" unit="$"
              domain={[0, Math.ceil(maxPrice / 5) * 5]}
              tick={{ fontSize: 12, fill: CHROME.ink2 }} stroke={CHROME.axis}
              label={{ value: 'Steam price (USD)', position: 'bottom', offset: 22, fill: CHROME.muted, fontSize: 12 }}
            />
            <YAxis
              type="number" dataKey="y"
              scale={log ? 'log' : 'linear'} domain={yDomain}
              allowDataOverflow tickFormatter={yTick}
              tick={{ fontSize: 12, fill: CHROME.ink2 }} stroke={CHROME.axis}
              width={64}
              label={{ value: `${METRICS[metric].axis} (${log ? 'log' : 'linear'} scale)`, angle: -90, position: 'insideLeft', offset: -2, fill: CHROME.muted, fontSize: 12, style: { textAnchor: 'middle' } }}
            />
            <ZAxis type="number" dataKey="z" range={[40, 640]} name="reviews" />
            <Tooltip content={<Tip />} cursor={{ strokeDasharray: '3 3', stroke: CHROME.axis }} />
            {targetPrice != null && (
              <ReferenceLine
                x={targetPrice} stroke="#6b46e0" strokeDasharray="5 4"
                label={{ value: `our target $${targetPrice}`, position: 'top', fill: '#6b46e0', fontSize: 11, fontWeight: 600 }}
              />
            )}
            {TIER_ORDER.filter((t) => TIERS[t] && on.has(t)).map((t) => (
              <Scatter
                key={t} name={TIERS[t].label} data={byTier[t] || []}
                fill={TIERS[t].color} fillOpacity={0.72}
                onClick={(d) => d?.id && open({ type: 'game', id: d.id })}
                cursor="pointer"
              >
                {metric === 'units' && (
                  <ErrorBar dataKey="errY" direction="y" width={3} strokeWidth={1.25} stroke={TIERS[t].color} opacity={0.55} />
                )}
              </Scatter>
            ))}
          </ScatterChart>
        </ResponsiveContainer>
      </div>

      <p className="note">
        Units and revenue are estimates <span className="tagpill tag-est">EST</span>, not sales figures; price
        and reviews are <span className="tagpill tag-hard">HARD</span> from Steam. Games without a price or a
        unit estimate can't be placed and are left out.
      </p>
    </div>
  )
}
