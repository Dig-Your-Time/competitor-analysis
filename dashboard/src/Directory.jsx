import { useMemo, useState } from 'react'
import { fmt, TIER_ORDER } from './lib.js'
import { useDrawer } from './drawer.jsx'

export default function Directory({ data }) {
  const { open } = useDrawer()
  const [mode, setMode] = useState('games')
  const [q, setQ] = useState('')

  const gamesPerCo = useMemo(() => {
    const m = {}
    data.games.forEach((g) => { if (!g.is_our_game) m[g.company_id] = (m[g.company_id] || 0) + 1 })
    return m
  }, [data])

  const needle = q.trim().toLowerCase()
  const match = (...fields) => !needle || fields.some((f) => (f || '').toLowerCase().includes(needle))

  const games = data.games
    .filter((g) => !g.is_our_game)
    .filter((g) => match(g.title, g.company_name, g.tier, g.comparable_class))
    .sort((a, b) =>
      TIER_ORDER.indexOf(a.tier) - TIER_ORDER.indexOf(b.tier) || (b.review_count || 0) - (a.review_count || 0)
    )

  const studios = (data.companies || [])
    .filter((c) => match(c.company_name, c.country, c.region, c.status))
    .sort((a, b) => (a.company_name || '').localeCompare(b.company_name || ''))

  return (
    <div>
      <h1>Browse: every studio and game we track</h1>
      <p className="sub">
        The full index. Click any <strong>game</strong> or <strong>studio</strong> to open everything we
        hold on it: facts, financials, funding, and every <strong>source</strong> with a link to visit.
      </p>

      <div className="controls" style={{ marginBottom: 16, justifyContent: 'space-between' }}>
        <div className="group">
          <button className={'pill' + (mode === 'games' ? ' on' : '')} onClick={() => setMode('games')}>Games ({games.length})</button>
          <button className={'pill' + (mode === 'studios' ? ' on' : '')} onClick={() => setMode('studios')}>Studios ({studios.length})</button>
        </div>
        <input className="search" placeholder="Search title, studio, country…" value={q} onChange={(e) => setQ(e.target.value)} />
      </div>

      {mode === 'games' ? (
        <div className="dirgrid">
          {games.map((g) => (
            <button className="dircard" key={g.game_id} onClick={() => open({ type: 'game', id: g.game_id })} title="View details & sources">
              <div className="dircard-top">
                <span className="dirname">{g.title}</span>
                <span className="srccue">ⓘ</span>
              </div>
              <div className="dirmeta">{g.company_name || g.developer}</div>
              <div className="dirtags">
                <span className="dirtag">{g.tier}</span>
                {g.release_date ? <span className="dirtag ghost">{g.release_date.slice(0, 4)}</span> : null}
                <span className="dirtag ghost">{fmt(g.review_count)} reviews</span>
              </div>
            </button>
          ))}
          {games.length === 0 && <p className="note">No games match “{q}”.</p>}
        </div>
      ) : (
        <div className="dirgrid">
          {studios.map((c) => (
            <button className="dircard" key={c.company_id} onClick={() => open({ type: 'studio', id: c.company_id })} title="View details & sources">
              <div className="dircard-top">
                <span className="dirname">{c.company_name.split('(')[0].trim()}</span>
                <span className="srccue">ⓘ</span>
              </div>
              <div className="dirmeta">{c.country || c.region}{c.city ? ` · ${c.city}` : ''}</div>
              <div className="dirtags">
                <span className={'dirtag' + (c.status === 'Acquired' ? ' acq' : '')}>{c.status}</span>
                {c.company_size ? <span className="dirtag ghost">{c.company_size}</span> : null}
                <span className="dirtag ghost">{gamesPerCo[c.company_id] || 0} game{(gamesPerCo[c.company_id] || 0) !== 1 ? 's' : ''}</span>
              </div>
            </button>
          ))}
          {studios.length === 0 && <p className="note">No studios match “{q}”.</p>}
        </div>
      )}
    </div>
  )
}
