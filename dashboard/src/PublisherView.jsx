import { useState } from 'react'
import { fmt, toEur, eurStr } from './lib.js'
import { useDrawer } from './drawer.jsx'
import { ViewHead } from './ui.jsx'

// Gamalytic revenue is USD gross; convert to EUR so the whole dashboard speaks one currency
const eurRev = (v) => eurStr(toEur(v, 'USD'))

const SELF = 'var(--color-accent)'
const PUB = '#c9c1ff'

const median = (xs) => {
  const v = xs.filter((x) => x != null).sort((a, b) => a - b)
  if (!v.length) return null
  const m = Math.floor(v.length / 2)
  return v.length % 2 ? v[m] : (v[m - 1] + v[m]) / 2
}
const primaryPub = (g) => (g.publisher || '').split(';')[0].trim() || '—'

function StatTile({ title, hue, games }) {
  const rev = games.map((g) => g.est_revenue_gross_mid)
  const rc = games.map((g) => g.review_count)
  return (
    <div className="ptile" style={{ borderTopColor: hue }}>
      <div className="ptile-h">{title}</div>
      <div className="ptile-n">{games.length} game{games.length !== 1 ? 's' : ''}</div>
      <div className="ptile-big">{eurRev(median(rev))}</div>
      <div className="ptile-lbl">median est. gross revenue <span className="tagpill tag-est">EST</span></div>
      <div className="ptile-row"><span>Median reviews</span><b>{fmt(median(rc))}</b></div>
      <div className="ptile-row"><span>Median est. units</span><b>{fmt(median(games.map((g) => g.est_units_mid)))}</b></div>
    </div>
  )
}

export default function PublisherView({ data }) {
  const { open } = useDrawer()
  const [sort, setSort] = useState('rev')
  const games = data.games.filter((g) => !g.is_our_game)

  const self = games.filter((g) => g.self_published === 'Yes')
  const pub = games.filter((g) => g.self_published === 'No')
  const unknown = games.filter((g) => g.self_published !== 'Yes' && g.self_published !== 'No')

  const selfMed = median(self.map((g) => g.est_revenue_gross_mid))
  const pubMed = median(pub.map((g) => g.est_revenue_gross_mid))

  // publisher track record — only for publisher-backed titles
  const byPub = {}
  pub.forEach((g) => (byPub[primaryPub(g)] ??= []).push(g))
  const pubRows = Object.entries(byPub)
    .map(([name, gs]) => ({
      name, games: gs,
      medRev: median(gs.map((g) => g.est_revenue_gross_mid)),
      medReviews: median(gs.map((g) => g.review_count)),
    }))
    .sort((a, b) =>
      sort === 'count' ? b.games.length - a.games.length || b.medRev - a.medRev : b.medRev - a.medRev
    )

  // distribution: every game as a gross-revenue bar, coloured by publishing model
  const distro = [...self, ...pub]
    .filter((g) => g.est_revenue_gross_mid != null)
    .sort((a, b) => b.est_revenue_gross_mid - a.est_revenue_gross_mid)
  const maxRev = Math.max(...distro.map((g) => g.est_revenue_gross_mid))

  return (
    <div>
      <ViewHead
        title="Publishers"
        badge="EST"
        subtitle="Self-publish, or sign a deal? You can't get deal terms, but you can get a publisher's track record."
        infoWidth={440}
        info={<>The two tiles compare the whole field split by publishing model, using <b>medians</b> (one breakout hit doesn't move a median). The catch: gross revenue is the whole pie. A self-publisher keeps most of each euro; a publisher-backed studio hands over a cut you can't see here, so a higher gross under a publisher does not mean more money reaches the studio. N is small, so read it as a signal, not a verdict.</>}
      />

      <div className="ptiles">
        <StatTile title="Self-published" hue={SELF} games={self} />
        <StatTile title="Publisher-backed" hue={PUB} games={pub} />
      </div>

      <p className="note" style={{ marginTop: 14, marginBottom: 26 }}>
        In this field the median publisher-backed title grosses <strong>{eurRev(pubMed)}</strong> vs{' '}
        <strong>{eurRev(selfMed)}</strong> self-published, but that gap is gross, before the publisher's share,
        and it's shaped by which studios chose to sign. {unknown.length > 0 &&
          `${unknown.length} game${unknown.length !== 1 ? 's have' : ' has'} an unclear arrangement and ${unknown.length !== 1 ? 'are' : 'is'} excluded.`}
      </p>

      <h2 className="finsechead" style={{ marginTop: 0 }}>Publisher track record</h2>
      <div className="controls" style={{ margin: '10px 0 12px' }}>
        <div className="group">
          <span className="glabel">Sort by</span>
          <button className={'pill' + (sort === 'rev' ? ' on' : '')} onClick={() => setSort('rev')}>Median revenue</button>
          <button className={'pill' + (sort === 'count' ? ' on' : '')} onClick={() => setSort('count')}>Catalogue size</button>
        </div>
      </div>

      <div className="cmp-wrap" style={{ maxHeight: 'none', marginBottom: 26 }}>
        <table className="cmp">
          <thead>
            <tr>
              <th className="rowhead">Publisher</th>
              <th>Titles</th>
              <th>Median est. gross</th>
              <th>Median reviews</th>
              <th>Games in this set</th>
            </tr>
          </thead>
          <tbody>
            {pubRows.map((r) => (
              <tr key={r.name}>
                <td className="rowhead">{r.name}</td>
                <td>{r.games.length}{r.games.length > 1 ? ' ★' : ''}</td>
                <td>{eurRev(r.medRev)}</td>
                <td>{fmt(r.medReviews)}</td>
                <td className="pubgames">{r.games.map((g) => g.title).join(', ')}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="note" style={{ marginTop: -14, marginBottom: 26 }}>
        ★ marks a publisher with more than one title in this set, the only ones whose "median" means much.
        Everyone else is a single data point.
      </p>

      <h2 className="finsechead">Every game by gross revenue</h2>
      <p className="note" style={{ marginBottom: 14 }}>
        The full distribution behind the medians, coloured by model.
      </p>
      <div className="magblock" style={{ marginBottom: 26 }}>
        {distro.map((g) => (
          <div className="bar-row clickable" key={g.game_id} onClick={() => open({ type: 'game', id: g.game_id })} title="View sources">
            <div className="bar-label">{g.title} <span className="srccue">ⓘ</span></div>
            <div className="bar-track">
              <div className="bar-fill" style={{ width: `${(g.est_revenue_gross_mid / maxRev) * 100}%`, background: g.self_published === 'Yes' ? SELF : PUB }} />
            </div>
            <div className="bar-val">{eurRev(g.est_revenue_gross_mid)}</div>
          </div>
        ))}
      </div>

      <div className="reglegend">
        <span className="lg"><span className="sw" style={{ background: SELF }} /> Self-published</span>
        <span className="lg"><span className="sw" style={{ background: PUB }} /> Publisher-backed</span>
        <span className="lg" style={{ color: 'var(--muted)' }}>All revenue estimated &amp; gross</span>
      </div>
    </div>
  )
}
