import { Fragment, useState } from 'react'
import { PALETTE, fmt, TIER_ORDER } from './lib.js'

const nowYear = (iso) => Number((iso || '').slice(0, 4))

// metric table definition — grouped rows, each a getter over a game object
const SECTIONS = (genYear) => [
  {
    title: 'Overview', rows: [
      ['Tier', (g) => g.tier],
      ['Class', (g) => g.comparable_class || '—'],
      ['Released', (g) => g.is_our_game ? 'unreleased (target)'
        : g.release_date ? `${g.release_date} · ${genYear - nowYear(g.release_date)}y ago` : '—'],
      ['Price', (g) => g.price_usd != null ? `$${g.price_usd}${g.is_our_game ? ' (target)' : ''}` : '—'],
      ['Platforms', (g) => g.platforms || '—'],
    ],
  },
  {
    title: 'Studio', rows: [
      ['Studio', (g) => g.company_name || g.developer || '—'],
      ['Region', (g) => g.region ? `${g.region}${g.country && g.country !== g.region ? ` (${g.country})` : ''}` : (g.country || '—')],
      ['Status', (g) => g.status ? `${g.status}${g.parent_company ? ` · ${g.parent_company}` : ''}` : '—'],
      ['Team size', (g) => g.company_size || '—'],
      ['Founded', (g) => g.company_founded ? `${g.company_founded} · ${g.company_age}y` : '—'],
      ['Self-published', (g) => g.self_published || '—'],
      ['Publisher', (g) => g.publisher || '—'],
    ],
  },
  {
    title: 'Traction', badge: 'HARD', rows: [
      ['Reviews', (g) => fmt(g.review_count)],
      ['Positive', (g) => g.review_pct != null ? Math.round(g.review_pct * 100) + '%' : '—'],
      ['Steam rating', (g) => g.review_desc || '—'],
    ],
  },
  {
    title: 'Estimates', badge: 'EST', rows: [
      ['Est. units (low–high)', (g) => g.est_units_mid != null ? `${fmt(g.est_units_low)} – ${fmt(g.est_units_high)}` : '—'],
      ['Est. units (mid)', (g) => g.est_units_mid != null ? fmt(g.est_units_mid) : '—'],
      ['Est. gross revenue', (g) => g.est_revenue_gross_mid != null ? '$' + fmt(g.est_revenue_gross_mid) : '—'],
      ['Gamalytic ÷ Boxleiter', (g) => g.est_ratio != null ? g.est_ratio + '×' : '—'],
    ],
  },
]

function Badge({ kind }) {
  if (!kind) return null
  const cls = kind === 'HARD' ? 'tag-hard' : kind === 'EST' ? 'tag-est' : 'tag-anec'
  return <span className={`tagpill ${cls}`}>{kind}</span>
}

// horizontal magnitude bars — one measure across games (single hue, per dataviz)
function MagnitudeBars({ games, title, badge, get, band, hue, prefix = '', accessor }) {
  const vals = games.map((g) => get(g)).filter((v) => v != null)
  const max = Math.max(1, ...games.map((g) => (band ? (accessor(g)?.high ?? 0) : (get(g) ?? 0))))
  return (
    <div className="magblock">
      <div className="magtitle">{title} <Badge kind={badge} /></div>
      {games.map((g) => {
        const v = get(g)
        const b = band ? accessor(g) : null
        return (
          <div className="bar-row" key={g.game_id}>
            <div className="bar-label" title={g.title}>{g.title}</div>
            <div className="bar-track">
              {v == null ? (
                <span className="bar-na">{g.is_our_game ? 'unreleased' : 'no data'}</span>
              ) : band ? (
                <>
                  <div className="bar-band" style={{ left: `${(b.low / max) * 100}%`, width: `${((b.high - b.low) / max) * 100}%`, background: hue }} />
                  <div className="bar-mid" style={{ left: `${(b.mid / max) * 100}%`, background: hue }} />
                </>
              ) : (
                <div className="bar-fill" style={{ width: `${(v / max) * 100}%`, background: hue }} />
              )}
            </div>
            <div className="bar-val">{v == null ? '' : prefix + fmt(v)}</div>
          </div>
        )
      })}
    </div>
  )
}

export default function Compare({ data }) {
  const genYear = nowYear(data.generated)
  const allGames = [...data.games].sort((a, b) => TIER_ORDER.indexOf(a.tier) - TIER_ORDER.indexOf(b.tier))
  const byId = Object.fromEntries(allGames.map((g) => [g.game_id, g]))

  const [selected, setSelected] = useState(['1637320', '1621690', '881100', 'our-game'])
  const games = selected.map((id) => byId[id]).filter(Boolean)

  const toggle = (id) =>
    setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]))

  const byTier = TIER_ORDER.map((t) => [t, allGames.filter((g) => g.tier === t)]).filter(([, gs]) => gs.length)
  const sections = SECTIONS(genYear)

  return (
    <div>
      <h1>Compare — every metric, side by side</h1>
      <p className="sub">
        Pick any games (including <strong>our own</strong>, so "where do we land?" is the same view).
        <span className="tagpill tag-hard">HARD</span> facts and <span className="tagpill tag-est">EST</span> estimates
        are labelled — estimates show a low–high band, and revenue is <em>gross</em>.
      </p>

      <div className="howto">
        <strong>How to read this.</strong> The two bar charts rank your picks on one measure each.
        <span className="tagpill tag-hard">HARD</span> bars (reviews) are a single solid fill — a fact.
        The <span className="tagpill tag-est">EST</span> units bar is <em>not</em> a single number: the
        shaded band spans the <strong>low–high estimate</strong> and the vertical tick is the
        <strong> mid</strong>. A <em>wide</em> band means the two estimators disagree — nobody really knows;
        a tight one means they roughly agree. Read the width as "how much to trust this." Revenue below is
        <em> gross</em> (Valve takes 30%+, so real take-home is well under half). The full table underneath
        breaks every row out per game — scroll it sideways for more games, down for more metrics; the game
        names stay pinned at the top.
      </div>

      <div className="selector" style={{ marginBottom: 22 }}>
        {byTier.map(([tier, gs]) => (
          <div className="tierblock" key={tier}>
            <div className="tierhead"><span>{tier}</span></div>
            <div className="chips">
              {gs.map((g) => {
                const on = selected.includes(g.game_id)
                return (
                  <button key={g.game_id} className={'chip' + (on ? ' on' : '')} onClick={() => toggle(g.game_id)}>
                    <span className="dot" style={{ background: on ? 'var(--violet)' : 'var(--axis)' }} />
                    {g.title}
                  </button>
                )
              })}
            </div>
          </div>
        ))}
      </div>

      {games.length === 0 ? (
        <p className="note">Pick at least one game above.</p>
      ) : (
        <>
          <div className="magrow">
            <MagnitudeBars games={games} title="Reviews" badge="HARD" hue="var(--teal)" get={(g) => g.review_count} />
            <MagnitudeBars games={games} title="Est. units" badge="EST" hue="var(--violet)" band
              get={(g) => g.est_units_mid} accessor={(g) => (g.est_units_mid == null ? null : { low: g.est_units_low, mid: g.est_units_mid, high: g.est_units_high })} />
          </div>

          <div className="cmp-wrap">
            <table className="cmp">
              <thead>
                <tr>
                  <th className="rowhead" />
                  {games.map((g) => (
                    <th key={g.game_id} className={g.is_our_game ? 'ours' : ''}>{g.title}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {sections.map((sec) => (
                  <Fragment key={sec.title}>
                    <tr className="sec">
                      <td colSpan={games.length + 1}>{sec.title} <Badge kind={sec.badge} /></td>
                    </tr>
                    {sec.rows.map(([label, get]) => (
                      <tr key={label}>
                        <td className="rowhead">{label}</td>
                        {games.map((g) => (
                          <td key={g.game_id} className={g.is_our_game ? 'ours' : ''}>{get(g)}</td>
                        ))}
                      </tr>
                    ))}
                  </Fragment>
                ))}
              </tbody>
            </table>
          </div>
          <p className="note">
            The <strong>Gamalytic ÷ Boxleiter</strong> ratio is the disagreement between the two estimators —
            above 1 means Gamalytic reads higher than reviews×30 would suggest (common for small games), a signal
            of how uncertain the unit estimate is.
          </p>
        </>
      )}
    </div>
  )
}
