import { useState } from 'react'
import { fmt } from './lib.js'

// Finland first — the dataset's unfair advantage — then the rest of the Nordics,
// then everyone else. Any unknown region falls through to 'Other'.
const REGION_ORDER = ['Finland', 'Nordics', 'EU-Other', 'UK', 'North America', 'Other']
const REGION_LABEL = {
  'Finland': 'Finland',
  'Nordics': 'Rest of Nordics (SE · DK)',
  'EU-Other': 'Rest of Europe',
  'UK': 'United Kingdom',
  'North America': 'North America',
  'Other': 'Elsewhere',
}

const METRICS = {
  reviews: { label: 'Reviews', badge: 'HARD', get: (g) => g.review_count },
  units: { label: 'Est. units', badge: 'EST', get: (g) => g.est_units_mid },
}

const statusColor = (s) =>
  s === 'Active' ? 'var(--teal)' : s === 'Acquired' ? 'var(--violet)' : 'var(--muted)'

export default function RegionMap({ data }) {
  const [metric, setMetric] = useState('reviews')
  const get = METRICS[metric].get

  // one bubble per tracked game that has the chosen metric; our own game has no
  // market data yet, so it isn't a bubble on a map of what the market did.
  const games = data.games.filter((g) => !g.is_our_game && get(g) != null)

  // perceptual size: sqrt (area-ish), stretched across the visible min/max so the
  // mid-field stays legible instead of being crushed by the million-review giants.
  const vals = games.map(get)
  const smin = Math.sqrt(Math.min(...vals))
  const smax = Math.sqrt(Math.max(...vals))
  const R = (v) => {
    if (smax === smin) return 30
    return 12 + 46 * ((Math.sqrt(v) - smin) / (smax - smin))
  }
  const maxD = 2 * (smax === smin ? 30 : 58) // tallest disc — keeps every bubble on one baseline

  const byRegion = REGION_ORDER.map((r) => {
    const gs = games
      .filter((g) => (REGION_ORDER.includes(g.region) ? g.region : 'Other') === r)
      .sort((a, b) => get(b) - get(a))
    const studios = new Set(gs.map((g) => g.company_id)).size
    return { region: r, games: gs, studios }
  }).filter((b) => b.games.length)

  const nordicStudios = new Set(
    games.filter((g) => g.region === 'Finland' || g.region === 'Nordics').map((g) => g.company_id)
  ).size
  const totalStudios = new Set(games.map((g) => g.company_id)).size

  return (
    <div>
      <h1>Regions — where the studios are, and how big they got</h1>
      <p className="sub">
        One bubble per game, grouped by the studio's home region and <strong>sized by {METRICS[metric].label.toLowerCase()}</strong>,
        <span className={'tagpill ' + (METRICS[metric].badge === 'HARD' ? 'tag-hard' : 'tag-est')}>{METRICS[metric].badge}</span>.
        Colour is the studio's <strong>status</strong>. <strong>Finland leads</strong> because that is this
        dataset's edge — Nordic studios must file public accounts, so their real economics are knowable.
      </p>

      <div className="howto">
        <strong>How to read this.</strong> Bigger circle = more {METRICS[metric].label.toLowerCase()}.
        Size uses a square-root scale so mid-sized games stay visible next to the giants — read it as
        <em> rank and rough magnitude</em>, not a precise ratio. Colour marks whether the studio is still
        <span className="lg"><span className="sw" style={{ background: 'var(--teal)' }} /> independent</span> or has been
        <span className="lg"><span className="sw" style={{ background: 'var(--violet)' }} /> acquired</span>. Hover any
        bubble for the studio's age, size, publishing, and both the HARD review count and the EST unit band.
        Our own game isn't here — a map of what the market <em>did</em> has no room for a game that hasn't shipped.
      </div>

      <p className="note" style={{ marginBottom: 20 }}>
        <strong>{nordicStudios} of {totalStudios}</strong> studios in this field are Nordic (Finland + Sweden + Denmark) —
        and several sit in the direct-comparable tier. That filed-financials advantage is the reason this whole project
        can talk about real revenue, not just estimates.
      </p>

      <div className="controls" style={{ marginBottom: 18 }}>
        <div className="group">
          <span className="glabel">Size by</span>
          {Object.entries(METRICS).map(([k, m]) => (
            <button key={k} className={'pill' + (metric === k ? ' on' : '')} onClick={() => setMetric(k)}>
              {m.label}
            </button>
          ))}
        </div>
      </div>

      <div className="regiongrid">
        {byRegion.map(({ region, games: gs, studios }) => (
          <div className="regioncard" key={region}>
            <div className="regionhead">
              <span className="rname">{REGION_LABEL[region] ?? region}</span>
              <span className="rmeta">{studios} studio{studios !== 1 ? 's' : ''} · {gs.length} game{gs.length !== 1 ? 's' : ''}</span>
            </div>
            <div className="bubbles">
              {gs.map((g) => {
                const d = 2 * R(get(g))
                return (
                  <div className="bubble" key={g.game_id}>
                    <div className="disc-wrap" style={{ height: maxD }}>
                      <span
                        className="disc"
                        style={{ width: d, height: d, background: statusColor(g.status) }}
                      />
                    </div>
                    <div className="blabel" title={g.title}>{g.title}</div>
                    <div className="bstudio" title={g.company_name}>{g.company_name}</div>

                    <div className="btip">
                      <div className="btip-h">{g.title}</div>
                      <div className="btip-sub">{g.company_name} · {g.country || g.region}</div>
                      <div className="btip-rows">
                        <div><span>Status</span><b>{g.status}{g.parent_company ? ` (${g.parent_company})` : ''}</b></div>
                        <div><span>Team</span><b>{g.company_size || '—'}</b></div>
                        <div><span>Founded</span><b>{g.company_founded ? `${g.company_founded} · ${g.company_age}y` : '—'}</b></div>
                        <div><span>Self-published</span><b>{g.self_published || '—'}</b></div>
                        <div><span>Tier</span><b>{g.tier}</b></div>
                        <div className="hard"><span>Reviews <i className="tagpill tag-hard">HARD</i></span><b>{fmt(g.review_count)}</b></div>
                        <div className="est"><span>Est. units <i className="tagpill tag-est">EST</i></span><b>{g.est_units_mid != null ? `${fmt(g.est_units_low)}–${fmt(g.est_units_high)}` : '—'}</b></div>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        ))}
      </div>

      <div className="reglegend">
        <span className="lg"><span className="sw" style={{ background: 'var(--teal)' }} /> Active / independent</span>
        <span className="lg"><span className="sw" style={{ background: 'var(--violet)' }} /> Acquired</span>
        <span className="lg"><span className="sizedot" /> size = {METRICS[metric].label.toLowerCase()} ({METRICS[metric].badge})</span>
      </div>
    </div>
  )
}
