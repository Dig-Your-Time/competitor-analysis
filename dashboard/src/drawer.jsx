import { createContext, useContext, useEffect, useState } from 'react'
import { fmt, toEur, eurStr, nativeAmt, EUR_PER } from './lib.js'

const Ctx = createContext(null)
export const useDrawer = () => useContext(Ctx)

const relClass = (r) =>
  r === 'Primary' ? 'rel-primary'
    : r === 'Reputable secondary' ? 'rel-secondary'
      : r === 'Self-reported' ? 'rel-self'
        : r === 'Unverified' ? 'rel-unverified'
          : 'rel-other'

// plain-language meaning of each reliability label (hover tooltip only; the full
// glossary lives on the Guide page, so it isn't repeated as a block here)
const REL_MEANING = {
  Primary: 'The original official record: a company filing, a government registry, or a first-party announcement. The strongest kind of source.',
  'Reputable secondary': 'A trusted third party reporting on it, such as an established news outlet or a company-accounts aggregator.',
  'Self-reported': "The studio's own claim (a tweet, blog, or interview). Useful, but studios mostly announce good news.",
  Unverified: 'A single weak or unconfirmed source. Treat it with caution.',
}

function SourceCard({ src, roles }) {
  if (!src) return null
  return (
    <div className="srccard">
      <div className="srccard-top">
        <span className={'relbadge ' + relClass(src.reliability)} title={REL_MEANING[src.reliability] || ''}>{src.reliability || 'source'}</span>
        {roles?.length ? <span className="srcroles">{roles.join(' · ')}</span> : null}
      </div>
      <div className="srctitle">{src.title}</div>
      <div className="srcmeta">
        {[src.outlet, src.source_type, src.date_published].filter(Boolean).join(' · ')}
      </div>
      {src.notes ? <div className="srcnotes">{src.notes}</div> : null}
      <div className="srclinks">
        {src.url ? <a href={src.url} target="_blank" rel="noreferrer" className="srclink">Visit ↗</a> : <span className="srclink dead">no link</span>}
        {src.archive_url ? <a href={src.archive_url} target="_blank" rel="noreferrer" className="srclink arch">Archived ↗</a> : null}
      </div>
    </div>
  )
}

// collect a studio's sources with the role(s) each one documents, deduped by id
function studioSourceRoles(data, cid) {
  const roles = new Map()
  const add = (sid, role) => {
    if (!sid) return
    if (!roles.has(sid)) roles.set(sid, [])
    if (!roles.get(sid).includes(role)) roles.get(sid).push(role)
  }
  const c = (data.companies || []).find((x) => x.company_id === cid) || {}
  add(c.src_registry, 'Registry')
  add(c.src_headcount, 'Headcount')
  const fin = (data.financials || []).find((x) => x.company_id === cid)
  fin?.years.forEach((y) => add(y.source_id, `Financials FY${y.fiscal_year}`))
  const fund = (data.funding || []).find((x) => x.company_id === cid)
  fund?.rounds.forEach((r) => add(r.source_id, `Funding: ${r.funding_stage}`))
  return [...roles.entries()].map(([sid, r]) => ({ sid, roles: r }))
}

function StudioBody({ data, cid, hideGames }) {
  const { open } = useDrawer()
  const c = (data.companies || []).find((x) => x.company_id === cid)
  const fin = (data.financials || []).find((x) => x.company_id === cid)
  const fund = (data.funding || []).find((x) => x.company_id === cid)
  const games = data.games.filter((g) => g.company_id === cid && !g.is_our_game)
  const srcs = studioSourceRoles(data, cid)
  const finRate = fin && fin.currency !== 'EUR' ? EUR_PER[fin.currency] : null
  if (!c) return <p className="note">No studio record.</p>

  return (
    <>
      <div className="dfacts">
        <div><span>Region</span><b>{c.country || c.region || '—'}{c.city ? ` · ${c.city}` : ''}</b></div>
        <div><span>Status</span><b>{c.status}{c.parent_company ? ` · ${c.parent_company.split('(')[0].trim()}` : ''}</b></div>
        <div><span>Team</span><b>{c.company_size || '—'}</b></div>
        <div><span>Founded</span><b>{c.founded_year || '—'}</b></div>
        <div><span>Self-published</span><b>{c.self_published || '—'}</b></div>
        {c.website ? <div><span>Site</span><b><a href={c.website} target="_blank" rel="noreferrer" className="srclink">{c.website.replace(/^https?:\/\//, '')} ↗</a></b></div> : null}
      </div>

      {!hideGames && games.length ? (
        <div className="dsection">
          <div className="dsec-h">Games in this set ({games.length})</div>
          <div className="dgames">
            {games.map((g) => (
              <button className="dgame" key={g.game_id} onClick={() => open({ type: 'game', id: g.game_id })}>
                <span className="dgame-t">{g.title}</span>
                <span className="dgame-m">{g.release_date ? g.release_date.slice(0, 4) : '—'} · {fmt(g.review_count)} reviews ↗</span>
              </button>
            ))}
          </div>
        </div>
      ) : null}

      {fin?.years?.length ? (
        <div className="dsection">
          <div className="dsec-h">Filed financials <span className="tagpill tag-hard">HARD</span></div>
          <div className="dmini">
            {fin.years.map((y) => (
              <div className="dminirow" key={y.fiscal_year}>
                <span>FY{y.fiscal_year}</span>
                <b>{y.revenue != null ? eurStr(toEur(y.revenue, fin.currency)) : 'revenue n/d'}</b>
                <i>{y.revenue != null ? `${fmt(y.revenue)} ${fin.currency}` : (y.net_profit != null ? `net ${fmt(y.net_profit)} ${fin.currency}` : '')}</i>
              </div>
            ))}
          </div>
          <div className="dnote">
            {finRate
              ? `Euro figures converted at a fixed 1 ${fin.currency} = €${finRate} (approximate; filings span several years at different real rates, so treat as roughly comparable, not exact). Native ${fin.currency} shown alongside.`
              : `Filed in EUR, no conversion needed.`}
          </div>
        </div>
      ) : null}

      {fund?.rounds?.length ? (
        <div className="dsection">
          <div className="dsec-h">Funding &amp; ownership</div>
          <div className="dmini">
            {fund.rounds.map((r, i) => (
              <div className="dminirow" key={i}>
                <span>{r.funding_stage}</span>
                <b>{r.amount != null ? nativeAmt(r.amount, r.currency) : 'undisclosed'}</b>
                <i>{r.investors?.split(/[,(]/)[0]}</i>
              </div>
            ))}
          </div>
        </div>
      ) : null}

      <div className="dsection">
        <div className="dsec-h">Sources ({srcs.length})</div>
        {srcs.length ? srcs.map(({ sid, roles }) => (
          <SourceCard key={sid} src={data.sources[sid]} roles={roles} />
        )) : <p className="note">No filed / cited sources for this studio yet.</p>}
      </div>
    </>
  )
}

function GameBody({ data, gid }) {
  const g = data.games.find((x) => x.game_id === gid)
  if (!g) return <p className="note">No game record.</p>
  const steamUrl = g.is_our_game ? null : `https://store.steampowered.com/app/${g.game_id}/`
  const estBase = g.src_est ? data.sources[g.src_est] : null
  // Gamalytic pages are per-game at gamalytic.com/game/<steam appid>; game_id IS the appid
  const est = estBase
    ? { ...estBase, url: (estBase.outlet || '').includes('Gamalytic') && !g.is_our_game ? `https://gamalytic.com/game/${g.game_id}` : estBase.url }
    : null

  return (
    <>
      <div className="dfacts">
        <div><span>Tier</span><b>{g.tier}</b></div>
        <div><span>Released</span><b>{g.release_date || (g.is_our_game ? 'unreleased' : '—')}</b></div>
        <div><span>Price</span><b>{g.price_usd != null ? `$${g.price_usd}` : '—'}</b></div>
        <div><span>Reviews</span><b>{fmt(g.review_count)} {g.review_pct != null ? `· ${Math.round(g.review_pct * 100)}%` : ''}</b></div>
        <div><span>Est. units</span><b>{g.est_units_mid != null ? `${fmt(g.est_units_low)}–${fmt(g.est_units_high)}` : '—'}</b></div>
        <div><span>Est. gross rev</span><b>{g.est_revenue_gross_mid != null ? `${eurStr(toEur(g.est_revenue_gross_mid, 'USD'))}` : '—'}</b></div>
      </div>

      <div className="dsection">
        <div className="dsec-h">Steam facts <span className="tagpill tag-hard">HARD</span></div>
        {steamUrl ? (
          <div className="srccard">
            <div className="srccard-top"><span className="relbadge rel-primary">Primary</span><span className="srcroles">Dates · price · reviews · tags</span></div>
            <div className="srctitle">Steam store &amp; reviews API</div>
            <div className="srcmeta">store.steampowered.com · directly observed</div>
            <div className="srclinks"><a href={steamUrl} target="_blank" rel="noreferrer" className="srclink">Open store page ↗</a></div>
          </div>
        ) : <p className="note">Our own game, no Steam page yet.</p>}
      </div>

      {est ? (
        <div className="dsection">
          <div className="dsec-h">Units &amp; revenue estimate <span className="tagpill tag-est">EST</span></div>
          <SourceCard src={est} roles={['est. units', 'est. gross revenue']} />
          {g.est_revenue_gross_mid != null ? (
            <div className="dnote">
              Est. gross revenue is <b>{eurStr(toEur(g.est_revenue_gross_mid, 'USD'))}</b>, converted from a
              native <b>{nativeAmt(g.est_revenue_gross_mid, 'USD')}</b> at a fixed 1 USD = €{EUR_PER.USD}{' '}
              (approximate). This is <b>gross</b>, before Valve's 30%+ cut and any discounts.
            </div>
          ) : null}
        </div>
      ) : null}

      {g.company_id && !g.is_our_game ? (
        <div className="dsection dstudio-block">
          <div className="dsec-h">Studio: {g.company_name}</div>
          <StudioBody data={data} cid={g.company_id} />
        </div>
      ) : null}
    </>
  )
}

function DetailDrawer({ data, sel, onClose }) {
  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  if (!sel) return null
  const title = sel.type === 'game'
    ? data.games.find((x) => x.game_id === sel.id)?.title
    : (data.companies || []).find((x) => x.company_id === sel.id)?.company_name
  const subtitle = sel.type === 'game' ? 'Game · sources & provenance' : 'Studio · sources & provenance'

  return (
    <>
      <div className="drawer-scrim" onClick={onClose} />
      <aside className="drawer" role="dialog" aria-modal="true">
        <div className="drawer-h">
          <div>
            <div className="drawer-kind">{subtitle}</div>
            <div className="drawer-title">{title || sel.id}</div>
          </div>
          <button className="drawer-x" onClick={onClose} aria-label="Close">✕</button>
        </div>
        <div className="drawer-body">
          {sel.type === 'game' ? <GameBody data={data} gid={sel.id} /> : <StudioBody data={data} cid={sel.id} />}
          <p className="drawer-foot">
            Sources hold a stable id; the URL lives once in <code>sources.csv</code>. Where a link is fragile
            (a dev tweet, a studio blog), an <b>Archived</b> copy is kept because those pages die.
          </p>
        </div>
      </aside>
    </>
  )
}

export function DrawerProvider({ data, children }) {
  const [sel, setSel] = useState(null)
  const open = (s) => setSel(s)
  const close = () => setSel(null)
  return (
    <Ctx.Provider value={{ open, close }}>
      {children}
      <DetailDrawer data={data} sel={sel} onClose={close} />
    </Ctx.Provider>
  )
}
