import { useState } from 'react'
import { fmt } from './lib.js'
import { useDrawer } from './drawer.jsx'
import { ViewHead } from './ui.jsx'

const ORDER = ['Finland', 'Nordics', 'EU-Other', 'UK', 'North America', 'Other']
const LABEL = {
  Finland: 'Finland',
  Nordics: 'Rest of Nordics (SE · DK)',
  'EU-Other': 'Rest of Europe',
  UK: 'United Kingdom',
  'North America': 'North America',
  Other: 'Elsewhere',
}
const METRICS = { reviews: 'Reviews', units: 'Est. units' }
const ACQUIRED = '#5b86bd'
const ACTIVE = 'var(--color-accent)'

export default function RegionMap({ data }) {
  const { open } = useDrawer()
  const [metric, setMetric] = useState('reviews')

  const get = (g) => (metric === 'reviews' ? g.review_count : g.est_units_mid)
  const label = metric === 'reviews' ? 'reviews' : 'est. units'
  const games = data.games.filter((g) => !g.is_our_game && get(g) != null)

  const vals = games.map(get)
  const smin = Math.sqrt(Math.min(...vals)), smax = Math.sqrt(Math.max(...vals))
  const Rf = (v) => (smax === smin ? 30 : 12 + 40 * ((Math.sqrt(v) - smin) / (smax - smin)))
  const maxD = 2 * (smax === smin ? 30 : 52)
  const statusColor = (s) => (s === 'Acquired' ? ACQUIRED : ACTIVE)

  const cards = ORDER.map((r) => {
    const gs = games
      .filter((g) => (ORDER.includes(g.region) ? g.region : 'Other') === r)
      .sort((a, b) => get(b) - get(a))
    const studios = new Set(gs.map((g) => g.company_id)).size
    return gs.length ? { r, name: LABEL[r] || r, gs, studios } : null
  }).filter(Boolean)

  const nordic = new Set(games.filter((g) => g.region === 'Finland' || g.region === 'Nordics').map((g) => g.company_id)).size
  const total = new Set(games.map((g) => g.company_id)).size

  return (
    <div>
      <ViewHead
        title="Regions"
        subtitle={`One bubble per game, grouped by studio home region, sized by ${label}. ${nordic} of ${total} studios here are Nordic — the filed-accounts advantage.`}
        infoWidth={420}
        info={<>Bigger circle = more of the chosen metric. Size uses a <b>square-root scale</b>, so read it as rank and rough magnitude, not a precise ratio. Colour marks whether the studio is still <b>independent</b> or has been <b>acquired</b>. <b>Finland leads</b> because Nordic studios must file public accounts, so their real economics are knowable. Our own game isn't here: a map of what the market <b>did</b> has no room for a game that hasn't shipped.</>}
      />

      <div className="controls" style={{ marginBottom: 20 }}>
        <div className="group">
          <span className="glabel">Size by</span>
          {Object.entries(METRICS).map(([k, l]) => (
            <button key={k} className={'pill' + (metric === k ? ' on' : '')} onClick={() => setMetric(k)}>{l}</button>
          ))}
        </div>
      </div>

      <div className="regiongrid">
        {cards.map(({ r, name, gs, studios }) => (
          <div className="regioncard" key={r}>
            <div className="regionhead">
              <span className="rname">{name}</span>
              <span className="rmeta">{studios} studio{studios !== 1 ? 's' : ''} · {gs.length} game{gs.length !== 1 ? 's' : ''}</span>
            </div>
            <div className="bubbles">
              {gs.map((g) => (
                <div className="bubble clickable" key={g.game_id} onClick={() => open({ type: 'game', id: g.game_id })} title="View sources">
                  <div className="disc-wrap" style={{ height: maxD }}>
                    <span className="disc" style={{ width: 2 * Rf(get(g)), height: 2 * Rf(get(g)), background: statusColor(g.status) }} />
                  </div>
                  <div className="blabel">{g.title}</div>
                  <div className="bstudio">{g.company_name}</div>
                  <div className="btip">
                    <div className="btip-h">{g.title}</div>
                    <div className="btip-sub">{g.company_name} · {g.country || g.region}</div>
                    <div className="btip-rows">
                      <div><span>Status</span><b>{g.status || '—'}</b></div>
                      <div><span>Team</span><b>{g.company_size || '—'}</b></div>
                      <div><span>Founded</span><b>{g.company_founded || '—'}</b></div>
                      <div><span>Reviews</span><b>{fmt(g.review_count)}</b></div>
                      <div><span>Est. units</span><b>{g.est_units_mid != null ? fmt(g.est_units_mid) : '—'}</b></div>
                    </div>
                    <div className="btip-cue">Click for sources ↗</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      <div className="reglegend">
        <span className="lg"><span className="sw" style={{ background: ACTIVE }} /> Active / independent</span>
        <span className="lg"><span className="sw" style={{ background: ACQUIRED }} /> Acquired</span>
        <span className="lg"><span className="sizedot" /> size = {label}</span>
      </div>
    </div>
  )
}
