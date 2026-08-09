import { useState, useEffect } from 'react'
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, ReferenceLine,
} from 'recharts'
import { curveStyle, CHROME, fmt, yearOf, calAt, TIER_ORDER } from './lib.js'
import { ViewHead, InfoPopover } from './ui.jsx'

const METRICS = {
  cum: { label: 'Cumulative', axis: 'reviews (cumulative)' },
  new: { label: 'Per week', axis: 'reviews that week' },
  pct: { label: '% lifetime', axis: 'share of lifetime total' },
}
const RANGES = [
  { w: 52, label: '1yr' },
  { w: 104, label: '2yr' },
  { w: 260, label: '5yr' },
  { w: 0, label: 'All' },
]

export default function LaunchCurves({ data }) {
  const [metric, setMetric] = useState('cum')
  const [range, setRange] = useState(104)
  // Off by default. With Early Access folded in, a 1.0 relaunch starts week 0 with
  // years of sales already banked, so its curve isn't comparable to a game that
  // launched cold — and comparing launches is the point of this view.
  const [showEA, setShowEA] = useState(false)
  const [full, setFull] = useState(false)
  // Recharts' ResponsiveContainer measures on mount and does not reliably re-measure
  // when its parent is resized by a class change — entering full screen left the plot
  // stuck at its windowed 1072x470 inside an 1860x815 box. Tracking the viewport and
  // keying the container on it forces a clean remount, which is the path that does
  // measure correctly. Bucketed to 50px so an ordinary drag-resize isn't a remount storm.
  const [vp, setVp] = useState(() => [window.innerWidth || 1280, window.innerHeight || 800])
  useEffect(() => {
    const onResize = () => {
      const [w, h] = [window.innerWidth, window.innerHeight]
      // Ignore degenerate measurements. A hidden or collapsed window reports 0x0, and
      // remounting the chart at zero size leaves it blank until something resizes
      // again — keeping the last good size means it just redraws when the window is back.
      if (w > 0 && h > 0) setVp([w, h])
    }
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])
  const sizeKey = `${full}-${Math.round(vp[0] / 50)}x${Math.round(vp[1] / 50)}`

  useEffect(() => {
    if (!full) return
    const onKey = (e) => { if (e.key === 'Escape') setFull(false) }
    document.addEventListener('keydown', onKey)
    document.body.style.overflow = 'hidden'     // the page behind must not scroll
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = ''
    }
  }, [full])

  const curves = data.launch_curves
  const curveGames = data.games
    .filter((g) => curves[g.game_id])
    .sort((a, b) => TIER_ORDER.indexOf(a.tier) - TIER_ORDER.indexOf(b.tier))
  // style is keyed off position in the FULL list, not the selection, so toggling a
  // game never repaints the ones that stayed on screen
  const styleOf = (id) => curveStyle(curveGames.findIndex((g) => g.game_id === id))
  const colorOf = (id) => styleOf(id).stroke
  const meta = Object.fromEntries(curveGames.map((g) => [g.game_id, g]))
  const titleOf = (id) => meta[id]?.title ?? id

  const [selected, setSelected] = useState(
    () => new Set(curveGames.filter((g) => g.tier === '1-Direct').map((g) => g.game_id))
  )

  // Rebuild each series from its weekly counts rather than reading the stored
  // cumulative, because excluding Early Access has to re-zero the running total:
  // with EA hidden, week 0 must start from nothing, not from the EA tally.
  const seriesFor = (id) => {
    const pts = showEA ? curves[id] : curves[id].filter((p) => p.w >= 0)
    let run = 0
    const out = pts.map((p) => ({ w: p.w, new: p.new, cum: (run += p.new) }))
    const total = run || 1
    out.forEach((p) => { p.pct = p.cum / total })
    return out
  }

  const selIds = [...selected]
  const series = Object.fromEntries(selIds.map((id) => [id, seriesFor(id)]))
  const withData = selIds.filter((id) => series[id].length)
  const maxW = range || Math.max(0, ...withData.map((id) => series[id].at(-1).w))
  // week 0 is a game's Steam release date, so an Early Access title has real
  // history at NEGATIVE weeks -- the axis has to reach left of launch to show it
  const firstW = Math.min(0, ...withData.map((id) => series[id][0].w))
  const minW = range ? Math.max(firstW, -range) : firstW
  const perGame = {}
  selIds.forEach((id) => {
    const m = {}
    series[id].forEach((p) => { m[p.w] = p[metric] })
    perGame[id] = m
  })
  const rows = []
  for (let w = minW; w <= maxW; w++) {
    const row = { w }
    selIds.forEach((id) => { if (perGame[id][w] !== undefined) row[id] = perGame[id][w] })
    rows.push(row)
  }

  const partial = curveGames.filter((g) => g.curve_coverage === 'partial')
  const lateStart = curveGames.filter((g) => (g.reviews_start_week ?? 0) > 4)
  const earlyAccess = curveGames.filter((g) => (g.pre_launch_reviews ?? 0) > 0)
  const preReview = curveGames.filter((g) => g.pre_review_era)
  const caveats = partial.length + lateStart.length + earlyAccess.length + preReview.length
    + (curveGames.length > 8 ? 1 : 0)
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
    <div className={'curvestage' + (full ? ' full' : '')}>
      <ViewHead
        title="Launch curves"
        badge="HARD"
        subtitle="How fast a game like ours sells, and how fast it stops. Week 0 = launch."
        infoWidth={420}
        info={<>Cumulative Steam <b>reviews</b>, a directly observed proxy for sales velocity, <b>not</b> a sales figure. What matters is the <b>shape</b>: the launch spike, the decay, and the bumps when a sale or a streamer brings it back. The x-axis is <b>normalized</b>: it is not a calendar, it is weeks from <b>each game's own release</b>. So "week 52" is every game's own first year — a different real year for each. That is also how one vertical line can mark the release of all of them at once: every game's release week is stacked at 0 by construction. Hover any point to see that game's actual calendar month. <b>Negative weeks are Early Access</b>. Note the line does <b>not</b> mark when each game first went on sale — Early Access launches differ per game, and those are simply where each line begins. Counts come a week at a time from Steam's own review index, so every tracked game is here, including the million-review ones.</>}
      />

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
        <div className="group">
          <span className="glabel">Early access</span>
          <button className={'pill' + (!showEA ? ' on' : '')} onClick={() => setShowEA(false)}
            title="Count only from the 1.0 release date, so every curve starts from zero">
            Exclude
          </button>
          <button className={'pill' + (showEA ? ' on' : '')} onClick={() => setShowEA(true)}
            title="Include the Early Access history that ran before the 1.0 date">
            Include
          </button>
        </div>
        <div className="group">
          <span className="glabel">Games</span>
          <button className={'pill' + (selIds.length === curveGames.length ? ' on' : '')}
            onClick={() => setSelected(new Set(curveGames.map((g) => g.game_id)))}>
            All {curveGames.length}
          </button>
          <button className={'pill' + (selIds.length === 0 ? ' on' : '')}
            onClick={() => setSelected(new Set())}>None</button>
        </div>
      </div>

      {/* The legend lives OUTSIDE the chart. Recharts reserves its height from the
          plot, so with 28 games the labels ate four rows off the top of the graph and
          squashed the curves. Out here it wraps and scrolls on its own, and the plot
          keeps its full height. Each swatch carries the real stroke, dashes included,
          so it identifies a game the same way the line does. */}
      {selIds.length > 0 && (
        <div className="curvelegend">
          {selIds.map((id) => {
            const s = styleOf(id)
            return (
              <span className="cl-item" key={id}>
                <svg width="20" height="8" aria-hidden="true">
                  <line x1="0" y1="4" x2="20" y2="4" stroke={s.stroke} strokeWidth="2"
                    strokeDasharray={s.strokeDasharray} />
                </svg>
                {titleOf(id)}
              </span>
            )
          })}
        </div>
      )}

      <div className="chartwrap">
        {/* Bottom-right of the panel itself, where players of every other chart tool
            already look for it, and where it stays reachable in full screen. */}
        <button className={'chartbtn' + (full ? ' on' : '')} onClick={() => setFull(!full)}
          title={full ? 'Exit full screen (Esc)' : 'Expand the chart to fill the screen'}>
          {full ? '✕ Exit full screen' : '⤢ Full screen'}
        </button>
        <ResponsiveContainer key={sizeKey} width="100%" height={full ? '100%' : 470}>
          <LineChart data={rows} margin={{ top: 8, right: 26, bottom: 26, left: 10 }}>
            <CartesianGrid stroke={CHROME.grid} strokeDasharray="3 3" />
            <XAxis
              dataKey="w" type="number" domain={[minW, maxW]}
              tick={{ fill: CHROME.muted, fontSize: 12 }} stroke={CHROME.axis}
              label={{ value: minW < 0
                         ? "weeks from each game's own release · negative = Early Access"
                         : "weeks from each game's own release",
                       position: 'insideBottom', offset: -14, fill: CHROME.muted, fontSize: 12 }}
            />
            <YAxis
              tickFormatter={yTick} tick={{ fill: CHROME.muted, fontSize: 12 }} stroke={CHROME.axis} width={62}
              label={{ value: METRICS[metric].axis, angle: -90, position: 'insideLeft', fill: CHROME.muted, fontSize: 12, style: { textAnchor: 'middle' } }}
            />
            <Tooltip content={<CustomTooltip />} />
            {/* Both markers are positions on the NORMALIZED axis, not calendar dates.
                x=0 is each game's own release week and x=12 is twelve weeks after it,
                so one line legitimately marks the same milestone for every curve at
                once — that is what normalizing the axis buys. Labels sit on opposite
                edges (one top, one bottom) because at a two-year window the two lines
                are only weeks apart and their text used to collide. */}
            {/* One line, many dates — and that is the point of a normalized axis. x is
                not a calendar position, it is "weeks from THIS game's own release", so
                every game's release week lands on 0 by construction: Techtonica's Nov
                2024, Core Keeper's Aug 2024, both at x=0. The line marks where each
                curve leaves Early Access and becomes the released game.
                Note it does NOT mark when each game first went on sale — the Early
                Access launches differ per game and are simply where each line starts. */}
            {minW < 0 && (
              <ReferenceLine x={0} stroke={CHROME.ink2} strokeWidth={1.5}
                label={{ value: "each game's release", fill: CHROME.ink2, fontSize: 11,
                         position: 'insideTopLeft', dy: 2 }} />
            )}
            {selIds.map((id) => {
              const s = styleOf(id)
              return (
                <Line key={id} type="monotone" dataKey={id} name={id}
                  stroke={s.stroke} strokeDasharray={s.strokeDasharray} strokeWidth={2}
                  dot={false} connectNulls={false} isAnimationActive={false} />
              )
            })}
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* a div, not a p: this line hosts an InfoPopover, and a popover panel nested
          inside a <p> gets silently un-nested by the browser */}
      <div className="showing">
        Showing {selIds.length} of {curveGames.length} tracked games. Click any game below to add it.
        {caveats > 0 && (
          <InfoPopover width={400}>
            {earlyAccess.length > 0 && (
              <p>
                <b>Early Access.</b> {earlyAccess.length} of these games sold for years before the 1.0
                date Steam calls their release — {earlyAccess.slice(0, 3).map((g) => g.title).join(', ')}
                {earlyAccess.length > 3 ? ' and others' : ''}, marked <b>EA</b> below.{' '}
                {showEA
                  ? 'That history is currently included, so their line starts left of week 0 and the jump at week 0 is a 1.0 relaunch rather than a first day on sale.'
                  : 'It is currently excluded, so every curve starts from zero at its 1.0 date and launches stay comparable. Switch Early access to Include to see the run-up.'}
              </p>
            )}
            {curveGames.length > 8 && (
              <p>
                <b>Line styles.</b> There are only eight colours that stay reliably distinct, including
                for colour-blind readers. Past eight games the colours repeat with a <b>dashed, then
                dotted, then dash-dot</b> stroke, so every game keeps a unique identity. The style means
                nothing about the game itself — it is just how the ninth line onward stays tellable apart.
              </p>
            )}
            {preReview.length > 0 && (
              <p>
                <b>Pre-2013 releases.</b> {preReview.map((g) => g.title).join(', ')} shipped before
                Steam's review system went live in Nov 2013. Those early weeks are real — Steam kept
                the old Community recommendations and their dates — but there is a <b>one-off spike
                the week the feature launched</b> (Terraria's is 9× its baseline). That bump is Steam
                shipping a feature, not a sale. Reviewing habits differed then too, so compare shape
                across that boundary, not height.
              </p>
            )}
            {lateStart.length > 0 && (
              <p>
                <b>No launch week.</b> {lateStart.map((g) => g.title).join(', ')} — the reviews start
                well after the release date, so there is no launch spike to read. The line begins
                where the data does rather than running flat along the axis.
              </p>
            )}
            {partial.length > 0 && (
              <p>
                <b>Partial capture.</b> {partial.map((g) => g.title).join(', ')} — the weekly counts
                recover under 90% of the game's lifetime review total. Read the shape, not the height.
              </p>
            )}
          </InfoPopover>
        )}
      </div>

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
                const ea = (g.pre_launch_reviews ?? 0) > 0
                const late = (g.reviews_start_week ?? 0) > 4
                return (
                  <button key={g.game_id} className={'chip' + (on ? ' on' : '')} onClick={() => toggle(g.game_id)}
                    title={ea ? `${fmt(g.pre_launch_reviews)} reviews before the 1.0 date` :
                           late ? 'Shipped before Steam reviews existed — no launch week' : undefined}>
                    <span className="dot" style={{ background: on ? colorOf(g.game_id) : 'var(--color-neutral-600, #75798c)' }} />
                    {g.title}
                    {ea && <span className="flag">EA</span>}
                    {late && <span className="flag">no wk 0</span>}
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
