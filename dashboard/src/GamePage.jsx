import { useMemo, useState } from 'react'
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine,
} from 'recharts'
import { CHROME, fmt, tierColor, eurStr, toEur } from './lib.js'
import { ViewHead, InfoPopover } from './ui.jsx'
import { Link, useRoute } from './router.jsx'

// Steam's language codes are not readable; the page shows these instead.
const LANG_LABEL = {
  english: 'English', schinese: 'Chinese (Simpl.)', tchinese: 'Chinese (Trad.)',
  russian: 'Russian', spanish: 'Spanish (Spain)', latam: 'Spanish (LatAm)',
  brazilian: 'Portuguese (BR)', portuguese: 'Portuguese (PT)', german: 'German',
  french: 'French', japanese: 'Japanese', koreana: 'Korean', polish: 'Polish',
  turkish: 'Turkish', italian: 'Italian', czech: 'Czech', dutch: 'Dutch',
  danish: 'Danish', swedish: 'Swedish', norwegian: 'Norwegian', finnish: 'Finnish',
  hungarian: 'Hungarian', romanian: 'Romanian', bulgarian: 'Bulgarian',
  greek: 'Greek', thai: 'Thai', vietnamese: 'Vietnamese', indonesian: 'Indonesian',
  ukrainian: 'Ukrainian', arabic: 'Arabic', malay: 'Malay',
  chinese_all: 'Chinese (all)', other: 'Others',
}
const label = (c) => LANG_LABEL[c] || c

const CURVE_METRICS = {
  cum: { label: 'Cumulative', axis: 'reviews (cumulative)' },
  new: { label: 'Per week', axis: 'reviews that week' },
}

export default function GamePage({ data, gameId }) {
  const { navigate } = useRoute()
  const [showEA, setShowEA] = useState(false)
  const [metric, setMetric] = useState('cum')
  const [sourcesOpen, setSourcesOpen] = useState(false)

  const g = data.games.find((x) => String(x.game_id) === String(gameId))
  if (!g) {
    return (
      <div className="gp-missing">
        <h2>No game with appid {gameId}</h2>
        <p>It isn’t in the tracked set. <Link to="/">Back to the dashboard</Link>.</p>
      </div>
    )
  }

  const gs = data.gamesensor?.[gameId]
  const langs = data.languages?.[gameId] || []
  const baseline = data.language_baseline || {}
  const curve = data.launch_curves?.[gameId]
  const sources = data.sources || {}

  // ---- unit estimates: three models, kept apart ----
  const estimators = [
    { name: 'Boxleiter', value: g.est_units_boxleiter, note: 'reviews × 30', src: null },
    { name: 'GameSensor', value: gs?.copies, note: gs?.shown?.copies ? `shown as ${gs.shown.copies}` : '', src: gs?.src_est },
    { name: 'Gamalytic', value: g.est_units_gamalytic, note: 'vendor model', src: g.src_est },
  ].filter((e) => e.value)
  const lo = Math.min(...estimators.map((e) => e.value))
  const hi = Math.max(...estimators.map((e) => e.value))
  const spread = lo ? hi / lo : null

  // ---- revenue: two vendors, gross is the only comparable figure ----
  const revenues = [
    { name: 'Gamalytic', gross: g.rev_gross_gamalytic, net: null, src: g.src_est, shown: null },
    { name: 'GameSensor', gross: gs?.gross, net: gs?.net, src: gs?.src_est, shown: gs?.shown },
  ].filter((r) => r.gross)
  const revLo = revenues.length ? Math.min(...revenues.map((r) => r.gross)) : null
  const revHi = revenues.length ? Math.max(...revenues.map((r) => r.gross)) : null

  const series = useMemo(() => {
    if (!curve) return []
    const pts = showEA ? curve : curve.filter((p) => p.w >= 0)
    let run = 0
    return pts.map((p) => ({ w: p.w, cum: (run += p.new), new: p.new }))
  }, [curve, showEA])

  const gsByLang = Object.fromEntries((gs?.langs || []).filter((r) => r.lang).map((r) => [r.lang, r]))
  // GameSensor files both Chinese scripts under one row it calls "Traditional Chinese".
  // Show that number where they put it, flagged, rather than blanking it — but never
  // let it land on Simplified, which is the larger of the two for most games.
  const gsFor = (lang) =>
    lang === 'tchinese' && gsByLang.chinese_all
      ? { ...gsByLang.chinese_all, merged: true }
      : gsByLang[lang]
  const totalReviews = langs.reduce((a, r) => a + (r.n || 0), 0) || 1
  const shareOf = (code) => ((langs.find((r) => r.lang === code)?.n || 0) / totalReviews) * 100

  // resolved in build_data so every link points at THIS game, not a landing page
  const usedSources = g.sources_used || []
  const countries = data.countries?.[gameId] || []
  const gamalytic = data.gamalytic_detail?.[gameId]

  return (
    <div className="gamepage">
      <div className="gp-top">
        <Link to="/" className="gp-back">← All games</Link>
        <span className="gp-tier" style={{ background: tierColor(g.tier) }} />
        <span className="gp-tiername">{g.tier}</span>
        <button className={'pill gp-srcbtn' + (sourcesOpen ? ' on' : '')} onClick={() => setSourcesOpen(!sourcesOpen)}>
          {sourcesOpen ? '✕ Hide sources' : `⌸ Sources (${usedSources.length})`}
        </button>
      </div>

      {/* Sources open as a slide-over sidebar, matching the detail drawer, so you can
          read a link's provenance without losing your place on the page. */}
      {sourcesOpen && (
        <>
          <div className="gp-srcscrim" onClick={() => setSourcesOpen(false)} />
          <aside className="gp-srcbar" role="dialog" aria-label="Sources">
            <div className="gp-srcbar-top">
              <h3>Sources for {g.title}</h3>
              <button className="gp-srcclose" onClick={() => setSourcesOpen(false)} aria-label="Close">✕</button>
            </div>
            <p className="gp-srcbar-lede">
              Every link below goes to <b>this game’s</b> page or endpoint, not a landing page.
            </p>
            {usedSources.map((s) => (
              <div className="gp-src" key={s.id}>
                <div className="gp-src-head">
                  <span className="gp-src-id">{s.id}</span>
                  <span className={'gp-src-rel rel-' + (s.reliability || '').split(' ')[0].toLowerCase()}>
                    {s.reliability}
                  </span>
                </div>
                <div className="gp-src-what">{s.what}</div>
                <div className="gp-src-title">{s.title}</div>
                <div className="gp-src-links">
                  {s.url && <a href={s.url} target="_blank" rel="noreferrer noopener">{s.outlet || 'open'} ↗</a>}
                  {s.archive_url && <a href={s.archive_url} target="_blank" rel="noreferrer noopener">archived ↗</a>}
                  {s.retrieved_date && <span className="dim">retrieved {s.retrieved_date}</span>}
                </div>
                {s.notes && <p className="gp-src-notes">{s.notes}</p>}
              </div>
            ))}
          </aside>
        </>
      )}

      <ViewHead
        title={g.title}
        badge={g.curve_coverage === 'full' ? 'HARD + EST' : 'EST'}
        subtitle={[g.developer, g.country, g.release_date].filter(Boolean).join(' · ')}
        infoWidth={420}
        info={<>Everything here is labelled by how it is known. <b>Steam facts</b> — price, reviews, dates, language mix, which languages the game ships in — are directly observed from Valve's own APIs. <b>Units and revenue are estimates</b> from models that disagree, shown side by side rather than averaged. Hit <b>Sources</b> at the top for the exact endpoint behind each number.</>}
      />

      <div className="gp-facts">
        <div><span>Price (list)</span><b>{g.price_usd != null ? `$${g.price_usd}` : '—'}
          {g.price_eur != null && <span className="alt-price"> · €{g.price_eur}</span>}</b></div>
        <div><span>Released</span><b>{g.release_date || '—'}</b></div>
        <div><span>Reviews</span><b>{fmt(g.review_count)}{g.review_pct != null ? ` · ${Math.round(g.review_pct * 100)}%` : ''}</b></div>
        <div><span>Studio</span><b>{g.company_name || g.developer || '—'}</b></div>
        <div><span>Publisher</span><b>{g.publisher || '—'}</b></div>
        <div><span>Ships in</span><b>{g.supported_languages?.length || 0} languages</b></div>
      </div>

      {/* ---- unit estimates ---- */}
      {estimators.length > 0 && (
        <section className="gp-block">
          <h3>
            Copies sold — {estimators.length} estimates
            <InfoPopover width={430}>
              <p>Valve publishes no sales data, so every one of these is a <b>model</b>, not a
                measurement. They are listed separately on purpose: averaging models that
                disagree by multiples manufactures a confidence none of them has.</p>
              <p><b>Boxleiter</b> is review count × 30. <b>GameSensor</b> and <b>Gamalytic</b> are
                vendor models. Across all 28 tracked games the two vendors land within ~20% of
                each other on million-review games and diverge <b>2–4×</b> on small ones — the
                size bracket that matters most here.</p>
            </InfoPopover>
          </h3>
          <div className="gp-est">
            {estimators.map((e) => (
              <div className="gp-est-row" key={e.name}>
                <span className="nm">{e.name}</span>
                <div className="bar"><div className="fill" style={{ width: `${(e.value / hi) * 100}%` }} /></div>
                <span className="vl">{fmt(e.value)}</span>
                <span className="nt">{e.note}</span>
              </div>
            ))}
          </div>
          {spread && (
            <p className={'gp-spread' + (spread >= 2 ? ' wide' : '')}>
              {spread >= 2
                ? <>These models disagree by <b>{spread.toFixed(1)}×</b> ({fmt(lo)} – {fmt(hi)}). Nobody knows this game’s unit count; treat any single figure here as one opinion.</>
                : <>The models agree within <b>{spread.toFixed(2)}×</b> ({fmt(lo)} – {fmt(hi)}), about as much confidence as this kind of estimate ever supports.</>}
            </p>
          )}
        </section>
      )}

      {/* ---- revenue, both vendors ---- */}
      {revenues.length > 0 && (
        <section className="gp-block">
          <h3>
            Revenue — {revenues.length > 1 ? 'two vendor estimates' : 'vendor estimate'}
            <InfoPopover width={440}>
              <p><b>Gross</b> is before Valve's 30% cut, regional pricing and refunds — the only
                figure both vendors publish, so it is the only one that can be compared.
                <b> Net</b> is GameSensor's own modelled take-home; Gamalytic does not give one,
                and the two are not interchangeable.</p>
              <p>Both are a model on top of a model, and GameSensor displays roughly
                <b> one significant figure</b>. Never compare a competitor's gross to a net
                figure for our own game.</p>
            </InfoPopover>
          </h3>
          <table className="gp-rev">
            <thead>
              <tr><th>Vendor</th><th>Gross (USD)</th><th>Gross (EUR)</th><th>Net</th><th>As shown</th></tr>
            </thead>
            <tbody>
              {revenues.map((r) => (
                <tr key={r.name}>
                  <td>{r.name}</td>
                  <td className="num">${fmt(r.gross)}</td>
                  <td className="num dim">{eurStr(toEur(r.gross, 'USD'))}</td>
                  <td className="num">{r.net ? `$${fmt(r.net)}` : <span className="dim">not published</span>}</td>
                  <td className="num dim">{r.shown?.gross ? `${r.shown.gross} / ${r.shown.net}` : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {revenues.length > 1 && revLo && (
            <p className={'gp-spread' + (revHi / revLo >= 2 ? ' wide' : '')}>
              Gross estimates differ by <b>{(revHi / revLo).toFixed(1)}×</b> (${fmt(revLo)} – ${fmt(revHi)}).
            </p>
          )}
        </section>
      )}

      {/* ---- launch curve ---- */}
      {series.length > 1 && (
        <section className="gp-block">
          <h3>
            Launch curve
            <span className="gp-toggle">
              {Object.entries(CURVE_METRICS).map(([k, m]) => (
                <button key={k} className={'pill' + (metric === k ? ' on' : '')} onClick={() => setMetric(k)}>{m.label}</button>
              ))}
              <span className="gp-toggle-sep" />
              <button className={'pill' + (!showEA ? ' on' : '')} onClick={() => setShowEA(false)}>Exclude EA</button>
              <button className={'pill' + (showEA ? ' on' : '')} onClick={() => setShowEA(true)}>Include EA</button>
            </span>
          </h3>
          <div className="chartwrap">
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={series} margin={{ top: 8, right: 20, bottom: 26, left: 6 }}>
                <CartesianGrid stroke={CHROME.grid} strokeDasharray="3 3" />
                <XAxis dataKey="w" type="number" tick={{ fill: CHROME.muted, fontSize: 12 }} stroke={CHROME.axis}
                  label={{ value: "weeks from this game's release", position: 'insideBottom', offset: -14, fill: CHROME.muted, fontSize: 12 }} />
                <YAxis tickFormatter={fmt} tick={{ fill: CHROME.muted, fontSize: 12 }} stroke={CHROME.axis} width={56}
                  label={{ value: CURVE_METRICS[metric].axis, angle: -90, position: 'insideLeft', fill: CHROME.muted, fontSize: 11, style: { textAnchor: 'middle' } }} />
                <Tooltip contentStyle={{ background: 'var(--surface)', border: '1px solid var(--border-strong)', borderRadius: 10 }}
                  labelFormatter={(w) => `Week ${w}`} formatter={(v) => [fmt(v), metric === 'cum' ? 'cumulative' : 'that week']} />
                {showEA && series[0].w < 0 && (
                  <ReferenceLine x={0} stroke={CHROME.ink2} strokeWidth={1.5}
                    label={{ value: 'release', fill: CHROME.ink2, fontSize: 11, position: 'insideTopLeft' }} />
                )}
                <Line type="monotone" dataKey={metric} stroke={tierColor(g.tier)} strokeWidth={2} dot={false} isAnimationActive={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
          <p className="gp-note">
            {metric === 'cum'
              ? 'Cumulative reviews — the total so far. Good for reading overall scale and how quickly a game stopped growing.'
              : 'Reviews in each individual week — the spikes are launch, sales, updates and streamer attention. Noisier, but this is where events show up.'}
          </p>
        </section>
      )}

      {/* ---- language mix ---- */}
      {langs.length > 0 && (
        <section className="gp-block">
          <h3>
            Language mix
            <InfoPopover width={450}>
              <p><b>Measured</b> is this game's share of Steam reviews by language, counted
                directly from Valve's reviews API (S053); it sums to 100%. <b>Steam</b> is
                Valve's platform-wide share from the Hardware &amp; Software Survey (S054), and
                <b> index</b> divides one by the other — above 1.0× means this game
                over-performs the platform in that language. <b>Ships?</b> is
                Steam's own supported-languages list for the game (S052).</p>
              <p>It is <b>reviews, not players</b>: review propensity differs by language
                community and there is no ground truth to correct with. Comparing games to each
                other is sound; reading an absolute share of players off it is not. The survey
                also measures a user's <em>client language</em>, while reviews measure the
                language someone wrote in.</p>
              <p>GameSensor's columns are shown for comparison. Its copies-share matches our
                measured share to a <b>0.26pp median</b> across 228 pairs, so it is the same
                signal, not a second opinion.</p>
            </InfoPopover>
          </h3>
          <table className="gp-lang">
            <thead>
              <tr>
                <th>Language</th><th>Measured</th><th>Steam</th><th>Index</th>
                <th>Positive</th><th>GS copies</th><th>GS revenue</th><th>Ships?</th>
              </tr>
            </thead>
            <tbody>
              {langs.filter((r) => r.n).slice(0, 14).map((r) => {
                const share = (r.n / totalReviews) * 100
                const base = baseline[r.lang]
                const idx = base ? share / base : null
                const m = gsFor(r.lang)
                const ships = g.supported_languages?.includes(r.lang)
                return (
                  <tr key={r.lang}>
                    <td>{label(r.lang)}</td>
                    <td className="num">{share.toFixed(1)}%</td>
                    <td className="num dim">{base != null ? `${base.toFixed(2)}%` : '—'}</td>
                    <td className={'num' + (idx ? (idx >= 1.25 ? ' up' : idx <= 0.75 ? ' down' : '') : '')}>
                      {idx ? `${idx.toFixed(2)}×` : '—'}
                    </td>
                    <td className="num dim">{r.n ? `${Math.round((r.pos / r.n) * 100)}%` : '—'}</td>
                    <td className="num dim">{m?.copies_pct != null ? <>{m.copies_pct}%{m.merged && <sup className="gp-dag">†</sup>}</> : '—'}</td>
                    <td className="num dim">{m?.revenue_pct != null ? <>{m.revenue_pct}%{m.merged && <sup className="gp-dag">†</sup>}</> : '—'}</td>
                    <td className="num">{ships ? '✓' : '·'}</td>
                  </tr>
                )
              })}
              {/* GameSensor buckets its own long tail into "Others". We have no
                  equivalent — our table is the full list — so it gets its own row
                  with the measured columns blank rather than being dropped. */}
              {gsByLang.other && (
                <tr className="gp-lang-other">
                  <td>Others <span className="dim">(GameSensor bucket)</span></td>
                  <td className="num dim">—</td>
                  <td className="num dim">—</td>
                  <td className="num dim">—</td>
                  <td className="num dim">—</td>
                  <td className="num dim">{gsByLang.other.copies_pct != null ? `${gsByLang.other.copies_pct}%` : '—'}</td>
                  <td className="num dim">{gsByLang.other.revenue_pct != null ? `${gsByLang.other.revenue_pct}%` : '—'}</td>
                  <td className="num dim">·</td>
                </tr>
              )}
            </tbody>
          </table>
          {gsByLang.other && (
            <p className="gp-note">
              GameSensor lists only its top languages and rolls the rest into <b>“Others”
              ({gsByLang.other.copies_pct}% of copies, {gsByLang.other.revenue_pct}% of revenue)</b>.
              Our own table has no such bucket — it is the complete list, reconciled to 100% of
              this game’s reviews — so the two “others” are not comparable.
            </p>
          )}
          {gsByLang.chinese_all && (
            <p className="gp-note">
              <b className="gp-dag">†</b> GameSensor files <b>both Chinese scripts under one row</b> it
              labels “Traditional Chinese” — {gsByLang.chinese_all.copies_pct}% of copies,{' '}
              {gsByLang.chinese_all.revenue_pct}% of revenue. It is shown on the Traditional row
              because that is where they put it, but Steam’s own split for this game is{' '}
              <b>{shareOf('schinese').toFixed(1)}% Simplified + {shareOf('tchinese').toFixed(1)}% Traditional</b>,
              so the label is wrong and the figure covers both. Never read it as Traditional alone.
            </p>
          )}
        </section>
      )}

      {/* ---- players by country (Gamalytic, modelled) ---- */}
      {countries.length > 0 && (
        <section className="gp-block">
          <h3>
            Players by country — Gamalytic estimate
            <InfoPopover width={450}>
              <p><b>This is modelled, not measured, and it is the softest data on the page.</b>
                Steam publishes no per-country figures for any game you don't own — there is no
                country field anywhere in its APIs. Gamalytic infers this, most plausibly from
                language and regional pricing, and prefixes every figure with “~”.</p>
              <p>The free tier shows only the <b>top 3 countries</b> plus an “others” bucket, so
                the long tail is genuinely unavailable, not omitted here.</p>
              <p>Worth holding next to the language table: Gamalytic puts China at {' '}
                {countries.find((c) => c.cc === 'CN')?.pct ?? '—'}% of this game's players, while
                Steam's own review-language share for Chinese is {shareOf('schinese').toFixed(1)}%.
                Those measure different things, and the gap is the modelling.</p>
            </InfoPopover>
          </h3>
          <div className="gp-country-rows">
            {countries.map((c) => (
              <div className={'gp-cty' + (c.cc === 'OTHERS' ? ' other' : '')} key={c.cc}>
                <span className="cc">{c.cc === 'OTHERS' ? '—' : c.cc}</span>
                <span className="nm">{c.name}</span>
                <div className="bar"><div className="fill" style={{ width: `${c.pct}%` }} /></div>
                <span className="vl">~{c.pct}%</span>
              </div>
            ))}
          </div>
          <p className="gp-note">
            Gamalytic’s free tier caps this at the top 3 countries; “all other countries” is{' '}
            <b>{countries.find((c) => c.cc === 'OTHERS')?.pct ?? '—'}%</b> of players and is not
            broken down. Read these as a rough ranking, not as measured geography.
          </p>
        </section>
      )}

      <div className="gp-nav">
        <button className="pill" onClick={() => navigate('/')}>← Back to all games</button>
        <button className="pill" onClick={() => setSourcesOpen(true)}>⌸ Sources</button>
      </div>
    </div>
  )
}
