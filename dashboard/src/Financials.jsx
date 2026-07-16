import { useState } from 'react'
import { fmt, toEur, eurStr, EUR_PER } from './lib.js'
import { useDrawer } from './drawer.jsx'

const LOSS = '#cf3b2e'
const WIN = 'var(--teal)'

// latest disclosed profit sign decides the "winner vs loss-maker" split
const profitSign = (years) => {
  for (let i = years.length - 1; i >= 0; i--) {
    const v = years[i].net_profit ?? years[i].operating_profit
    if (v != null) return v >= 0 ? 'win' : 'loss'
  }
  return 'unknown'
}

function CompanyCard({ f, open }) {
  const cur = f.currency
  const rev = (y) => toEur(y.revenue, cur)
  const revVals = f.years.map(rev).filter((v) => v != null)
  const peak = revVals.length ? Math.max(...revVals) : 0
  const sign = profitSign(f.years)
  const accent = sign === 'win' ? WIN : sign === 'loss' ? LOSS : 'var(--axis)'

  // "lumpy revenue" story (Iron Gate / Valheim): peaked, then fell hard
  const peakYear = f.years.find((y) => rev(y) === peak)
  const latest = f.years[f.years.length - 1]
  const crashed = peak && rev(latest) != null && rev(latest) < 0.6 * peak && latest !== peakYear

  return (
    <div className="fincard" style={{ borderLeftColor: accent }}>
      <div className="finhead">
        <div className="finname-wrap clickable" onClick={() => open({ type: 'studio', id: f.company_id })} title="View sources">
          <div className="finname" title={f.company_name}>{f.company_name} <span className="srccue">ⓘ</span></div>
          <div className="finsub">
            {f.country || f.region}
            {f.status ? ` · ${f.status}` : ''}
            {f.self_published && f.self_published !== 'Unknown' ? ` · self-pub: ${f.self_published}` : ''}
          </div>
        </div>
        <span className={'fintag ' + sign}>
          {sign === 'win' ? 'Profitable' : sign === 'loss' ? 'Loss-making' : 'Revenue only'}
        </span>
      </div>

      <div className="finbars">
        {f.years.map((y) => {
          const eur = rev(y)
          const profit = y.net_profit ?? y.operating_profit
          const isNet = y.net_profit != null
          const pos = profit != null && profit >= 0
          const margin = eur != null && profit != null && y.revenue ? profit / y.revenue : null
          return (
            <div className="finrow" key={y.fiscal_year}>
              <div className="finyr">{y.fiscal_year}</div>
              <div className="fintrack">
                {eur != null ? (
                  <div className="finfill" style={{ width: `${peak ? (eur / peak) * 100 : 0}%` }} />
                ) : (
                  <span className="finna">revenue not disclosed</span>
                )}
              </div>
              <div className="finval" title={eur != null ? `${fmt(y.revenue)} ${cur}` : ''}>
                {eurStr(eur)}
              </div>
              <div className="finprofit">
                {profit != null ? (
                  <span style={{ color: pos ? WIN : LOSS }}>
                    {pos ? '+' : '−'}€{fmt(Math.abs(toEur(profit, cur)))}
                    {margin != null ? <i className="finmargin"> {Math.round(margin * 100)}%</i> : null}
                    {!isNet ? <i className="finop"> op</i> : null}
                  </span>
                ) : (
                  <span className="finna-sm">—</span>
                )}
              </div>
            </div>
          )
        })}
      </div>

      {crashed && (
        <div className="fincrash">
          Lumpy: peaked at <strong>{eurStr(peak)}</strong> in {peakYear.fiscal_year}, then fell to{' '}
          <strong>{eurStr(rev(latest))}</strong> by {latest.fiscal_year}. A hit game's revenue spikes on
          release and major updates, then recedes.
        </div>
      )}
      <div className="fincur">native: {cur} · latest {latest.fiscal_year}</div>
    </div>
  )
}

export default function Financials({ data }) {
  const { open } = useDrawer()
  const [filter, setFilter] = useState('all')
  const fin = data.financials || []

  const withRev = fin.filter((f) => f.has_revenue)
  const restricted = fin.filter((f) => !f.has_revenue)

  const peakEur = (f) => {
    const vs = f.years.map((y) => toEur(y.revenue, f.currency)).filter((v) => v != null)
    return vs.length ? Math.max(...vs) : 0
  }
  const shown = withRev
    .filter((f) => filter === 'all' || profitSign(f.years) === filter)
    .sort((a, b) => peakEur(b) - peakEur(a))

  const wins = withRev.filter((f) => profitSign(f.years) === 'win').length
  const losses = withRev.filter((f) => profitSign(f.years) === 'loss').length

  return (
    <div>
      <h1>Company financials: the numbers that aren't estimates</h1>
      <p className="sub">
        Filed annual accounts, <span className="tagpill tag-hard">HARD</span>. Nordic and EU studios must
        publish real revenue and profit, so for this slice of the field we have <strong>facts, not
        Boxleiter guesses</strong>. Converted to <strong>euros</strong> for comparison; the native currency
        is on every bar.
      </p>

      <div className="howto">
        <strong>How to read this.</strong> Each card is one studio; each bar is one filed fiscal year, sized
        by <strong>revenue</strong> (in EUR). The number on the right is <strong>net profit</strong>
        (green) or loss (red), with margin. An <em>op</em> tag means only operating profit was disclosed.
        The left edge marks whether the studio's latest filing was <span style={{ color: WIN, fontWeight: 600 }}>profitable</span> or
        <span style={{ color: LOSS, fontWeight: 600 }}> loss-making</span>. Euro figures use fixed approximate
        rates across years of filings, so read them as <em>roughly comparable</em>, not exact accounting.
        Disclosure differs by country: small German studios file no P&amp;L, and Danish ones report gross profit
        instead of revenue, so those sit in the restricted list at the bottom.
      </div>

      <div className="controls" style={{ marginBottom: 18 }}>
        <div className="group">
          <span className="glabel">Show</span>
          <button className={'pill' + (filter === 'all' ? ' on' : '')} onClick={() => setFilter('all')}>All ({withRev.length})</button>
          <button className={'pill' + (filter === 'win' ? ' on' : '')} onClick={() => setFilter('win')}>Profitable ({wins})</button>
          <button className={'pill' + (filter === 'loss' ? ' on' : '')} onClick={() => setFilter('loss')}>Loss-making ({losses})</button>
        </div>
      </div>

      <div className="fingrid">
        {shown.map((f) => <CompanyCard key={f.company_id} f={f} open={open} />)}
      </div>

      {restricted.length > 0 && (
        <>
          <h2 className="finsechead">Filed, but revenue not publicly disclosed</h2>
          <p className="note" style={{ marginBottom: 14 }}>
            These studios file accounts, but the filing type hides the top line. A small German GmbH files
            an abbreviated balance sheet with no P&amp;L; Danish companies report gross profit, not revenue.
            Still <span className="tagpill tag-hard">HARD</span>, just partial.
          </p>
          <div className="fingrid restricted">
            {restricted.map((f) => {
              const last = f.years[f.years.length - 1]
              return (
                <div className="fincard muted" key={f.company_id} style={{ borderLeftColor: 'var(--axis)' }}>
                  <div className="finhead">
                    <div className="finname-wrap clickable" onClick={() => open({ type: 'studio', id: f.company_id })} title="View sources">
                      <div className="finname">{f.company_name} <span className="srccue">ⓘ</span></div>
                      <div className="finsub">{f.country || f.region} · {f.status} · {f.currency}</div>
                    </div>
                  </div>
                  <div className="finnote">{last?.note || 'Revenue not publicly disclosed.'}</div>
                </div>
              )
            })}
          </div>
        </>
      )}

      <p className="note" style={{ marginTop: 22 }}>
        Rates used (native per €1): {Object.entries(EUR_PER).filter(([k]) => k !== 'EUR').map(([k, v]) => `${(1 / v).toFixed(2)} ${k}`).join(' · ')}.
        Fixed and approximate, for comparison, not accounting.
      </p>
    </div>
  )
}
