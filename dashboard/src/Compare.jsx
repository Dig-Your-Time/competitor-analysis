import { Fragment, useState } from 'react'
import { fmt, toEur, eurStr, TIER_ORDER } from './lib.js'
import { useDrawer } from './drawer.jsx'
import { useEditor } from './editor.jsx'
import { ViewHead, InfoPopover } from './ui.jsx'

const nowYear = (iso) => Number((iso || '').slice(0, 4))

export default function Compare({ data }) {
  const { open } = useDrawer()
  const openEditor = useEditor()

  const genYear = Number((data.generated || '').slice(0, 4))
  const all = [...data.games].sort((a, b) => TIER_ORDER.indexOf(a.tier) - TIER_ORDER.indexOf(b.tier))
  const byId = Object.fromEntries(all.map((g) => [g.game_id, g]))
  const defaults = ['1637320', '1621690', '881100', 'our-game'].filter((id) => byId[id])
  const [sel, setSel] = useState(defaults.length ? defaults : all.slice(0, 3).map((g) => g.game_id))
  const toggle = (id) => setSel((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]))

  const games = sel.map((id) => byId[id]).filter(Boolean)
  const revMax = Math.max(1, ...games.map((g) => g.review_count || 0))
  const uMax = Math.max(1, ...games.map((g) => g.est_units_high || g.est_units_mid || 0))

  const SECTIONS = [
    ['Overview', null, [
      ['Tier', (g) => g.tier],
      ['Class', (g) => g.comparable_class || '—'],
      ['Released', (g) => (g.is_our_game ? 'unreleased (target)' : g.release_date ? `${g.release_date} · ${genYear - nowYear(g.release_date)}y ago` : '—')],
      ['Price', (g) => (g.price_usd != null ? `$${g.price_usd}${g.is_our_game ? ' (target)' : ''}` : '—')],
      ['Platforms', (g) => g.platforms || '—'],
    ]],
    ['Studio', null, [
      ['Studio', (g) => g.company_name || g.developer || '—'],
      ['Region', (g) => g.region || g.country || '—'],
      ['Status', (g) => g.status || '—'],
      ['Team size', (g) => g.company_size || '—'],
      ['Founded', (g) => (g.company_founded ? `${g.company_founded} · ${g.company_age}y` : '—')],
      ['Self-published', (g) => g.self_published || '—'],
      ['Publisher', (g) => g.publisher || '—'],
    ]],
    ['Traction', 'HARD', [
      ['Reviews', (g) => fmt(g.review_count)],
      ['Positive', (g) => (g.review_pct != null ? Math.round(g.review_pct * 100) + '%' : '—')],
      ['Steam rating', (g) => g.review_desc || '—'],
    ]],
    ['Estimates', 'EST', [
      ['Est. units (low–high)', (g) => (g.est_units_mid != null ? `${fmt(g.est_units_low)}–${fmt(g.est_units_high)}` : '—')],
      ['Est. units (mid)', (g) => (g.est_units_mid != null ? fmt(g.est_units_mid) : '—')],
      ['Est. gross revenue', (g) => (g.est_revenue_gross_mid != null ? eurStr(toEur(g.est_revenue_gross_mid, 'USD')) : '—')],
      ['Gamalytic ÷ Boxleiter', (g) => (g.est_ratio != null ? g.est_ratio + '×' : '—')],
    ]],
  ]

  const Pencil = () => (
    <span className="noc-pencil" title="Edit our game (in-session what-if)" onClick={(e) => { e.stopPropagation(); openEditor() }}>✎</span>
  )

  return (
    <div>
      <ViewHead
        title="Compare"
        subtitle="Every metric, side by side, including our own game."
        infoWidth={430}
        info={<>Reviews bars are a single solid fill, a <b>HARD</b> fact. The units bar is a <b>band</b>, not a point: it spans the low to high estimate and the tick marks the mid. A <b>wide band means the estimators disagree</b>, so read the width as "how much to trust this." Revenue is <b>gross</b>: Valve takes 30%+, so real take-home is well under half.</>}
      />

      <div className="cmp-chips">
        <span className="glabel">Pick games</span>
        {all.map((g) => {
          const on = sel.includes(g.game_id)
          const dot = on ? (g.is_our_game ? '#e7e5fe' : 'var(--color-accent)') : 'var(--color-neutral-600, #75798c)'
          return (
            <button key={g.game_id} className={'chip' + (on ? ' on' : '')} onClick={() => toggle(g.game_id)}>
              <span className="dot" style={{ background: dot }} />{g.title}
              {g.is_our_game ? <Pencil /> : null}
            </button>
          )
        })}
      </div>

      {games.length === 0 ? (
        <p className="note">Pick at least one game above.</p>
      ) : (
        <>
          <div className="magrow">
            <div className="magblock">
              <div className="magtitle-row"><span className="magtitle">Reviews</span><span className="tagpill tag-hard">HARD</span></div>
              {games.map((g) => (
                <div className="bar-row" key={g.game_id}>
                  <span className="bar-label">{g.title}</span>
                  <div className="bar-track"><div className="bar-fill" style={{ width: `${((g.review_count || 0) / revMax) * 100}%`, background: 'linear-gradient(90deg,var(--color-accent-600),var(--color-accent))' }} /></div>
                  <span className="bar-val">{fmt(g.review_count)}</span>
                </div>
              ))}
            </div>
            <div className="magblock">
              <div className="magtitle-row">
                <span className="magtitle">Est. units</span><span className="tagpill tag-est">EST</span>
                <InfoPopover width={290}>The shaded band spans the <b>low to high</b> estimate; the tick is the mid. Wider band = more disagreement between estimators = trust it less.</InfoPopover>
              </div>
              {games.map((g) => {
                if (g.est_units_mid == null) return (
                  <div className="bar-row" key={g.game_id}><span className="bar-label">{g.title}</span><div className="bar-track" /><span className="bar-val">—</span></div>
                )
                return (
                  <div className="bar-row" key={g.game_id}>
                    <span className="bar-label">{g.title}</span>
                    <div className="bar-track">
                      <div className="bar-band" style={{ left: `${(g.est_units_low / uMax) * 100}%`, width: `${((g.est_units_high - g.est_units_low) / uMax) * 100}%`, background: 'color-mix(in srgb,var(--color-accent) 40%,transparent)', opacity: 1 }} />
                      <div className="bar-mid" style={{ left: `${(g.est_units_mid / uMax) * 100}%`, background: 'var(--color-accent-300)' }} />
                    </div>
                    <span className="bar-val">{fmt(g.est_units_mid)}</span>
                  </div>
                )
              })}
            </div>
          </div>

          <div className="cmp-wrap">
            <table className="cmp">
              <thead>
                <tr>
                  <th className="rowhead" />
                  {games.map((g) => (
                    <th key={g.game_id} className={g.is_our_game ? 'ours clickable' : 'clickable'} onClick={() => open({ type: 'game', id: g.game_id })}>
                      {g.title} <span className="srccue">ⓘ</span>{g.is_our_game ? <Pencil /> : null}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {SECTIONS.map(([title, badge, rows]) => (
                  <Fragment key={title}>
                    <tr className="sec"><td colSpan={games.length + 1}>{title} {badge ? <span className={'tagpill tag-' + badge.toLowerCase()}>{badge}</span> : null}</td></tr>
                    {rows.map(([label, get]) => (
                      <tr key={label}>
                        <td className="rowhead">{label}</td>
                        {games.map((g) => <td key={g.game_id} className={g.is_our_game ? 'ours' : ''}>{get(g)}</td>)}
                      </tr>
                    ))}
                  </Fragment>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  )
}
