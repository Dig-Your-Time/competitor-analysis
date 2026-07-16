import { useState } from 'react'
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer, ReferenceLine,
} from 'recharts'
import { PALETTE, CHROME, fmt, yearOf, calAt, TIER_ORDER } from './lib.js'

const METRICS = {
  cum: { label: 'Cumulative reviews', axis: 'reviews (cumulative)' },
  new: { label: 'New reviews / week', axis: 'reviews that week' },
  pct: { label: '% of lifetime reviews', axis: 'share of lifetime total' },
}
const RANGES = [
  { w: 52, label: 'First year' },
  { w: 104, label: 'First 2 years' },
  { w: 260, label: 'First 5 years' },
  { w: 0, label: 'All' },
]

export default function LaunchCurves({ data }) {
  const [metric, setMetric] = useState('cum')
  const [range, setRange] = useState(104)

  const curves = data.launch_curves
  const curveGames = data.games
    .filter((g) => curves[g.game_id])
    .sort((a, b) => TIER_ORDER.indexOf(a.tier) - TIER_ORDER.indexOf(b.tier))
  const colorOf = (id) => PALETTE[curveGames.findIndex((g) => g.game_id === id) % PALETTE.length]
  const meta = Object.fromEntries(curveGames.map((g) => [g.game_id, g]))
  const titleOf = (id) => meta[id]?.title ?? id

  const [selected, setSelected] = useState(
    () => new Set(curveGames.filter((g) => g.tier === '1-Direct').map((g) => g.game_id))
  )

  const selIds = [...selected]
  const maxW = range || Math.max(0, ...selIds.map((id) => curves[id].at(-1).w))
  const perGame = {}
  selIds.forEach((id) => {
    const m = {}
    curves[id].forEach((p) => { m[p.w] = p[metric] })
    perGame[id] = m
  })
  const rows = []
  for (let w = 0; w <= maxW; w++) {
    const row = { w }
    selIds.forEach((id) => { if (perGame[id][w] !== undefined) row[id] = perGame[id][w] })
    rows.push(row)
  }

  const excluded = data.games.filter((g) => g.curve_coverage === 'recent-tail').length
  const yTick = (v) => (metric === 'pct' ? Math.round(v * 100) + '%' : fmt(v))

  const toggle = (id) => {
    const next = new Set(selected)
    next.has(id) ? next.delete(id) : next.add(id)
    setSelected(next)
  }
  const setTier = (tier) =>
    setSelected(new Set(curveGames.filter((g) => g.tier === tier).map((g) => g.game_id)))

  const byTier = TIER_ORDER.map((t) => [t, curveGames.filter((g) => g.tier === t)]).filter(([, gs]) => gs.length)

  const CustomTooltip = ({ active, payload, label }) => {
    if (!active || !payload?.length) return null
    const items = [...payload].sort((a, b) => (b.value ?? 0) - (a.value ?? 0))
    return (
      <div className="tt">
        <div className="tt-h">Week {label}</div>
        {items.map((p) => (
          <div className="tt-row" key={p.dataKey}>
            <span className="dot" style={{ background: p.color }} />
            <span className="nm">{titleOf(p.dataKey)}</span>
            <span className="vl">{metric === 'pct' ? (p.value * 100).toFixed(1) + '%' : fmt(p.value)}</span>
            <span className="cal">{calAt(meta[p.dataKey]?.release_date, label)}</span>
          </div>
        ))}
      </div>
    )
  }

  return (
    <div>
      <h1>Launch curves: how fast a game like ours sells, and how fast it stops</h1>
      <p className="sub">
        Cumulative Steam <strong>reviews</strong>, week 0 = launch. This is a directly observed
        (<span className="tagpill tag-hard">HARD</span>) proxy for sales speed, not a sales figure.
        What matters is the <em>shape</em>: the launch spike, the decay, and the bumps when a sale or a
        streamer brings it back.
      </p>

      <div className="controls">
        <div className="group">
          <span className="glabel">Metric</span>
          {Object.entries(METRICS).map(([k, m]) => (
            <button key={k} className={'pill' + (metric === k ? ' on' : '')} onClick={() => setMetric(k)}>{m.label}</button>
          ))}
        </div>
        <div className="group">
          <span className="glabel">Window</span>
          {RANGES.map((r) => (
            <button key={r.w} className={'pill' + (range === r.w ? ' on' : '')} onClick={() => setRange(r.w)}>{r.label}</button>
          ))}
        </div>
      </div>
      <p className="hint">
        The x-axis is normalized: week 0 is each game's <em>own</em> launch, so "first year" means each
        game's first 52 weeks, a different calendar year per game. Hover any point to see the real month &amp; year.
      </p>

      <div className="chartwrap">
        <ResponsiveContainer width="100%" height={470}>
          <LineChart data={rows} margin={{ top: 8, right: 26, bottom: 26, left: 10 }}>
            <CartesianGrid stroke={CHROME.grid} strokeDasharray="3 3" />
            <XAxis
              dataKey="w" type="number" domain={[0, maxW]}
              tick={{ fill: CHROME.muted, fontSize: 12 }} stroke={CHROME.axis}
              label={{ value: 'weeks since launch', position: 'insideBottom', offset: -14, fill: CHROME.muted, fontSize: 12 }}
            />
            <YAxis
              tickFormatter={yTick} tick={{ fill: CHROME.muted, fontSize: 12 }} stroke={CHROME.axis} width={62}
              label={{ value: METRICS[metric].axis, angle: -90, position: 'insideLeft', fill: CHROME.muted, fontSize: 12, style: { textAnchor: 'middle' } }}
            />
            <Tooltip content={<CustomTooltip />} />
            <Legend verticalAlign="top" align="left" height={34} iconType="plainline"
              formatter={(id) => <span style={{ color: CHROME.ink2, fontSize: 12.5 }}>{titleOf(id)}</span>} />
            <ReferenceLine x={12} stroke={CHROME.axis} strokeDasharray="4 4"
              label={{ value: '3 months', fill: CHROME.muted, fontSize: 11, position: 'insideTopRight' }} />
            {selIds.map((id) => (
              <Line key={id} type="monotone" dataKey={id} name={id}
                stroke={colorOf(id)} strokeWidth={2} dot={false} connectNulls={false} isAnimationActive={false} />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>

      <p className="note">
        Showing {selIds.length} of {curveGames.length} games with a full review history.
        {excluded > 0 && (
          <> {excluded} million-review giants (Terraria, DayZ, Valheim and more) are <strong>excluded</strong>.
          The reviews API can't recover their launch weeks, so their curve would be a misleading stub.</>
        )}
      </p>

      <div className="selector">
        {byTier.map(([tier, gs]) => (
          <div className="tierblock" key={tier}>
            <div className="tierhead">
              <span>{tier}</span>
              <button className="pill tierbtn" onClick={() => setTier(tier)}>only</button>
            </div>
            <div className="chips">
              {gs.map((g) => {
                const on = selected.has(g.game_id)
                return (
                  <button key={g.game_id} className={'chip' + (on ? ' on' : '')} onClick={() => toggle(g.game_id)}>
                    <span className="dot" style={{ background: on ? colorOf(g.game_id) : 'var(--axis)' }} />
                    {g.title}
                    <span className="yr">{yearOf(g.release_date)}</span>
                  </button>
                )
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
