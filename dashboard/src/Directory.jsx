import { useMemo, useState } from 'react'
import { fmt, TIER_ORDER } from './lib.js'
import { useDrawer } from './drawer.jsx'
import { ViewHead } from './ui.jsx'

const tierShort = (t) => (t || '').split('-')[1]?.toUpperCase() || t

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

  const cards = mode === 'games'
    ? games.map((g) => ({
        key: g.game_id,
        title: g.title,
        sub: g.company_name || g.developer,
        tag: tierShort(g.tier),
        statA: fmt(g.review_count), statALbl: 'reviews',
        statB: g.release_date ? g.release_date.slice(0, 4) : '—', statBLbl: 'released',
        onClick: () => open({ type: 'game', id: g.game_id }),
      }))
    : studios.map((c) => ({
        key: c.company_id,
        title: c.company_name.split('(')[0].trim(),
        sub: (c.country || c.region || '') + (c.city ? ` · ${c.city}` : ''),
        tag: c.status === 'Acquired' ? 'ACQ' : 'IND',
        statA: String(gamesPerCo[c.company_id] || 0), statALbl: 'games',
        statB: c.company_size ? c.company_size.split(' ')[0] : '—', statBLbl: 'team',
        onClick: () => open({ type: 'studio', id: c.company_id }),
      }))

  return (
    <div>
      <ViewHead
        title="Browse"
        subtitle="Every studio and game we track."
        info={<>The full index. Click any <b>game</b> or <b>studio</b> to open everything we hold on it: facts, financials, funding, and every source with a link to visit.</>}
      >
        <input
          className="search browse-search"
          placeholder="Search title, studio, country…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
      </ViewHead>

      <div className="controls" style={{ marginBottom: 22 }}>
        <div className="group">
          <button className={'pill' + (mode === 'games' ? ' on' : '')} onClick={() => setMode('games')}>Games <span className="muted2">{games.length}</span></button>
          <button className={'pill' + (mode === 'studios' ? ' on' : '')} onClick={() => setMode('studios')}>Studios <span className="muted2">{studios.length}</span></button>
        </div>
      </div>

      <div className="gcgrid">
        {cards.map((c) => (
          <button className="gcard-b" key={c.key} onClick={c.onClick} title="View details & sources">
            <div className="gcard-top">
              <span className="gcname">{c.title}</span>
              <span className="minitag">{c.tag}</span>
            </div>
            <div className="gcard-sub">{c.sub}</div>
            <div className="gcard-stats">
              <div className="gcstat"><span className="gcstat-v">{c.statA}</span><span className="gcstat-l">{c.statALbl}</span></div>
              <div className="gcstat-div" />
              <div className="gcstat"><span className="gcstat-v">{c.statB}</span><span className="gcstat-l">{c.statBLbl}</span></div>
            </div>
          </button>
        ))}
      </div>
      {cards.length === 0 && <p className="note" style={{ marginTop: 20 }}>Nothing matches your search.</p>}
    </div>
  )
}
