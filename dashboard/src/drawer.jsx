import { createContext, useContext, useEffect, useState } from 'react'
import { fmt, toEur, eurStr, nativeAmt, EUR_PER } from './lib.js'
import { CAN_EDIT, nextSourceId } from './editApi.js'
import { EditForm, EditCue } from './EditForm.jsx'
import {
  companyFields, gameSeedFields, financialFields, fundingFields, sourceFields, newSourceFields, estimateFields,
} from './editSpecs.js'

const Ctx = createContext(null)
export const useDrawer = () => useContext(Ctx)

const relClass = (r) =>
  r === 'Primary' ? 'rel-primary'
    : r === 'Reputable secondary' ? 'rel-secondary'
      : r === 'Self-reported' ? 'rel-self'
        : r === 'Unverified' ? 'rel-unverified'
          : 'rel-other'

const REL_MEANING = {
  Primary: 'The original official record: a company filing, a government registry, or a first-party announcement. The strongest kind of source.',
  'Reputable secondary': 'A trusted third party reporting on it, such as an established news outlet or a company-accounts aggregator.',
  'Self-reported': "The studio's own claim (a tweet, blog, or interview). Useful, but studios mostly announce good news.",
  Unverified: 'A single weak or unconfirmed source. Treat it with caution.',
}

function SourceCard({ src, roles, onEdit }) {
  if (!src) return null
  return (
    <div className="srccard">
      <div className="srccard-top">
        <span className={'relbadge ' + relClass(src.reliability)} title={REL_MEANING[src.reliability] || ''}>{src.reliability || 'source'}</span>
        {roles?.length ? <span className="srcroles">{roles.join(' · ')}</span> : null}
        {CAN_EDIT && onEdit ? <EditCue label="Edit source" onClick={onEdit} /> : null}
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

// dev-only "＋ add" / "✎ edit" section button
function AddBtn({ label, onClick }) {
  if (!CAN_EDIT) return null
  return <button className="add-btn" onClick={onClick}>＋ {label}</button>
}

function StudioBody({ data, cid, hideGames }) {
  const { open, reload } = useDrawer()
  const [form, setForm] = useState(null)
  const c = (data.companies || []).find((x) => x.company_id === cid)
  const fin = (data.financials || []).find((x) => x.company_id === cid)
  const fund = (data.funding || []).find((x) => x.company_id === cid)
  const games = data.games.filter((g) => g.company_id === cid && !g.is_our_game)
  const srcs = studioSourceRoles(data, cid)
  const finRate = fin && fin.currency !== 'EUR' ? EUR_PER[fin.currency] : null
  if (!c) return <p className="note">No studio record.</p>

  const done = async () => { await reload(); setForm(null) }

  const editStudio = () => setForm({
    title: `Edit studio · ${c.company_name}`, table: 'companies', op: 'update',
    match: { company_id: cid }, initial: c, fields: companyFields, submitLabel: 'Save studio',
  })
  const editFinYear = (y) => setForm({
    title: `Edit FY${y.fiscal_year} · ${c.company_name}`, table: 'financials', op: 'update',
    match: { company_id: cid, fiscal_year: y.fiscal_year }, initial: { ...y, currency: fin.currency },
    fields: financialFields, submitLabel: 'Save year',
  })
  const addFinYear = () => setForm({
    title: `Add fiscal year · ${c.company_name}`, table: 'financials', op: 'add',
    extra: { company_id: cid }, initial: { currency: fin?.currency || 'EUR' },
    fields: financialFields, submitLabel: 'Add year',
  })
  const editRound = (r) => setForm({
    title: `Edit funding · ${c.company_name}`, table: 'funding', op: 'update',
    match: { company_id: cid, funding_stage: r.funding_stage, round_date: r.round_date ?? '', amount: r.amount ?? '', investors: r.investors ?? '' },
    initial: r, fields: fundingFields, submitLabel: 'Save round',
  })
  const addRound = () => setForm({
    title: `Add funding round · ${c.company_name}`, table: 'funding', op: 'add',
    extra: { company_id: cid }, initial: {}, fields: fundingFields, submitLabel: 'Add round',
  })
  const editSource = (sid) => setForm({
    title: `Edit source ${sid}`, table: 'sources', op: 'update',
    match: { source_id: sid }, initial: data.sources[sid], fields: sourceFields, submitLabel: 'Save source',
  })
  const addSource = () => setForm({
    title: 'Add source', table: 'sources', op: 'add', initial: { source_id: nextSourceId(data.sources) },
    fields: newSourceFields, submitLabel: 'Add source',
  })

  return (
    <>
      {CAN_EDIT ? (
        <div className="edit-bar">
          <button className="edit-btn" onClick={editStudio}>✎ Edit studio</button>
        </div>
      ) : null}

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

      {(fin?.years?.length || CAN_EDIT) ? (
        <div className="dsection">
          <div className="dsec-h">Filed financials <span className="tagpill tag-hard">HARD</span><AddBtn label="year" onClick={addFinYear} /></div>
          {fin?.years?.length ? (
            <div className="dmini">
              {fin.years.map((y) => (
                <div className="dminirow" key={y.fiscal_year}>
                  <span>FY{y.fiscal_year}</span>
                  <b>{y.revenue != null ? eurStr(toEur(y.revenue, fin.currency)) : 'revenue n/d'}</b>
                  <i>{y.revenue != null ? `${fmt(y.revenue)} ${fin.currency}` : (y.net_profit != null ? `net ${fmt(y.net_profit)} ${fin.currency}` : '')}</i>
                  {CAN_EDIT ? <EditCue label="Edit year" onClick={() => editFinYear(y)} /> : null}
                </div>
              ))}
            </div>
          ) : <p className="note">No filed financials yet.</p>}
          {finRate ? (
            <div className="dnote">
              Euro figures converted at a fixed 1 {fin.currency} = €{finRate} (approximate; filings span several
              years at different real rates, so treat as roughly comparable, not exact). Native {fin.currency} shown alongside.
            </div>
          ) : fin?.years?.length ? <div className="dnote">Filed in EUR, no conversion needed.</div> : null}
        </div>
      ) : null}

      {(fund?.rounds?.length || CAN_EDIT) ? (
        <div className="dsection">
          <div className="dsec-h">Funding &amp; ownership<AddBtn label="round" onClick={addRound} /></div>
          {fund?.rounds?.length ? (
            <div className="dmini">
              {fund.rounds.map((r, i) => (
                <div className="dminirow" key={i}>
                  <span>{r.funding_stage}</span>
                  <b>{r.amount != null ? nativeAmt(r.amount, r.currency) : 'undisclosed'}</b>
                  <i>{r.investors?.split(/[,(]/)[0]}</i>
                  {CAN_EDIT ? <EditCue label="Edit round" onClick={() => editRound(r)} /> : null}
                </div>
              ))}
            </div>
          ) : <p className="note">No funding rounds recorded.</p>}
        </div>
      ) : null}

      <div className="dsection">
        <div className="dsec-h">Sources ({srcs.length})<AddBtn label="source" onClick={addSource} /></div>
        {srcs.length ? srcs.map(({ sid, roles }) => (
          <SourceCard key={sid} src={data.sources[sid]} roles={roles} onEdit={() => editSource(sid)} />
        )) : <p className="note">No filed / cited sources for this studio yet.</p>}
      </div>

      {CAN_EDIT && form ? <EditForm {...form} onCancel={() => setForm(null)} onDone={done} /> : null}
    </>
  )
}

function GameBody({ data, gid }) {
  const { reload } = useDrawer()
  const [form, setForm] = useState(null)
  const g = data.games.find((x) => x.game_id === gid)
  if (!g) return <p className="note">No game record.</p>
  const steamUrl = g.is_our_game ? null : `https://store.steampowered.com/app/${g.game_id}/`
  const estBase = g.src_est ? data.sources[g.src_est] : null
  const est = estBase
    ? { ...estBase, url: (estBase.outlet || '').includes('Gamalytic') && !g.is_our_game ? `https://gamalytic.com/game/${g.game_id}` : estBase.url }
    : null

  const done = async () => { await reload(); setForm(null) }
  const editGame = () => setForm({
    title: `Edit game · ${g.title}`, table: 'games_manual_seed', op: 'update',
    match: { game_id: g.game_id }, initial: g, fields: gameSeedFields, submitLabel: 'Save game',
  })
  const editEstimate = () => setForm({
    title: `Edit estimate · ${g.title}`, table: 'gamalytic_stats', op: 'upsert',
    extra: { game_id: g.game_id }, initial: g, fields: estimateFields, submitLabel: 'Save estimate',
  })

  return (
    <>
      {CAN_EDIT && !g.is_our_game ? (
        <div className="edit-bar">
          <button className="edit-btn" onClick={editGame}>✎ Edit game</button>
          <span className="edit-note">judgement fields only — Steam facts &amp; estimates are script-owned</span>
        </div>
      ) : null}

      <div className="dfacts">
        <div><span>Tier</span><b>{g.tier}</b></div>
        <div><span>Released</span><b>{g.release_date || (g.is_our_game ? 'unreleased' : '—')}</b></div>
        <div><span>Price</span><b>{g.price_usd != null ? `$${g.price_usd}` : '—'}</b></div>
        <div><span>Reviews</span><b>{fmt(g.review_count)} {g.review_pct != null ? `· ${Math.round(g.review_pct * 100)}%` : ''}</b></div>
        <div><span>Est. units</span><b>{g.est_units_mid != null ? `${fmt(g.est_units_low)}–${fmt(g.est_units_high)}` : '—'}</b></div>
        <div><span>Est. gross rev</span><b>{g.est_revenue_gross_mid != null ? `${eurStr(toEur(g.est_revenue_gross_mid, 'USD'))}` : '—'}</b></div>
      </div>

      {g.est_revenue_gross_mid != null ? (
        <div className="dnote">
          Est. gross revenue is <b>{eurStr(toEur(g.est_revenue_gross_mid, 'USD'))}</b>, converted from a
          native <b>{nativeAmt(g.est_revenue_gross_mid, 'USD')}</b> at a fixed 1 USD = €{EUR_PER.USD}{' '}
          (approximate). This is <b>gross</b>, before Valve's 30%+ cut and any discounts.
        </div>
      ) : null}

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

      {(est || CAN_EDIT) && !g.is_our_game ? (
        <div className="dsection">
          <div className="dsec-h">
            Units &amp; revenue estimate <span className="tagpill tag-est">EST</span>
            {g.est_units_source === 'manual' ? <span className="minitag">hand-set</span> : null}
            {CAN_EDIT ? <button className="add-btn" onClick={editEstimate}>✎ estimate</button> : null}
          </div>
          {est ? <SourceCard src={est} roles={['est. units', 'est. gross revenue']} /> : <p className="note">No estimate recorded yet.</p>}
        </div>
      ) : null}

      {g.company_id && !g.is_our_game ? (
        <div className="dsection dstudio-block">
          <div className="dsec-h">Studio: {g.company_name}</div>
          <StudioBody data={data} cid={g.company_id} />
        </div>
      ) : null}

      {CAN_EDIT && form ? <EditForm {...form} onCancel={() => setForm(null)} onDone={done} /> : null}
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

export function DrawerProvider({ data, reload, children }) {
  const [sel, setSel] = useState(null)
  const open = (s) => setSel(s)
  const close = () => setSel(null)
  return (
    <Ctx.Provider value={{ open, close, reload: reload || (() => Promise.resolve()) }}>
      {children}
      <DetailDrawer data={data} sel={sel} onClose={close} />
    </Ctx.Provider>
  )
}
