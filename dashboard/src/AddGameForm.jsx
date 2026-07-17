import { useMemo, useState } from 'react'
import { addGame, TIERS } from './editApi.js'

// Dev-only modal to add a new competitor game. The studio must already exist
// (add it first via ＋ studio). Writes the manual seed + gamalytic rows, then
// optionally fetches Steam facts and rebuilds.
export function AddGameForm({ data, onDone, onCancel }) {
  const companies = useMemo(
    () => [...(data.companies || [])].sort((a, b) => (a.company_name || '').localeCompare(b.company_name || '')),
    [data]
  )
  const [v, setV] = useState({
    game_id: '', title: '', company_id: '', tier: '1-Direct',
    comparable_class: '', production_tier: '', relevance_note: '',
    copies_sold: '', revenue_gross: '', units_low: '', units_mid: '', units_high: '',
    reviews: '', review_score: '',
  })
  const [fetch, setFetch] = useState(true)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const set = (k, val) => setV((s) => ({ ...s, [k]: val }))

  const submit = async () => {
    if (!v.game_id.trim()) return setErr('Steam appid (game_id) is required.')
    if (!v.title.trim()) return setErr('Title is required.')
    if (!v.company_id) return setErr('Pick a studio (add it first if new).')
    setBusy(true); setErr('')
    try {
      await addGame({
        seed: {
          title: v.title, game_id: v.game_id.trim(), company_id: v.company_id,
          tier: v.tier, comparable_class: v.comparable_class,
          production_tier: v.production_tier, relevance_note: v.relevance_note,
        },
        gamalytic: {
          copies_sold: v.copies_sold, revenue_gross: v.revenue_gross,
          units_low: v.units_low, units_mid: v.units_mid, units_high: v.units_high,
          reviews: v.reviews, review_score: v.review_score,
        },
        fetch,
      })
      await onDone()
    } catch (e) {
      setErr(e.message || String(e))
      setBusy(false)
    }
  }

  // plain function (NOT a nested component) so inputs keep focus across renders
  const field = (k, label, { type = 'text', hint, wide } = {}) => (
    <label className={'edit-field' + (wide ? ' wide' : '')} key={k}>
      <span className="edit-label">{label}</span>
      {type === 'textarea'
        ? <textarea rows={2} value={v[k]} onChange={(e) => set(k, e.target.value)} />
        : <input type={type} value={v[k]} onChange={(e) => set(k, e.target.value)} />}
      {hint ? <span className="edit-hint">{hint}</span> : null}
    </label>
  )

  return (
    <div className="edit-scrim" onMouseDown={onCancel}>
      <div className="edit-modal" onMouseDown={(e) => e.stopPropagation()} role="dialog" aria-modal="true">
        <div className="edit-modal-h">
          <h3>Add game</h3>
          <button className="drawer-x" onClick={onCancel} aria-label="Close">✕</button>
        </div>

        <div className="edit-grouplbl">Game</div>
        <div className="edit-fields">
          {field('game_id', 'Steam appid', { hint: 'the numeric id in the store URL — this is the game_id' })}
          {field('title', 'Title')}
          <label className="edit-field">
            <span className="edit-label">Studio</span>
            <select value={v.company_id} onChange={(e) => set('company_id', e.target.value)}>
              <option value="">—</option>
              {companies.map((c) => <option key={c.company_id} value={c.company_id}>{c.company_name}</option>)}
            </select>
            <span className="edit-hint">add the studio first via ＋ studio if it's new</span>
          </label>
          <label className="edit-field">
            <span className="edit-label">Tier</span>
            <select value={v.tier} onChange={(e) => set('tier', e.target.value)}>
              {TIERS.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
          </label>
          {field('comparable_class', 'Comparable class', { hint: 'e.g. Mining/Digging' })}
          {field('production_tier', 'Production tier', { hint: 'e.g. Small team' })}
          {field('relevance_note', 'Relevance note', { type: 'textarea', wide: true })}
        </div>

        <div className="edit-grouplbl">Estimate <span className="tagpill tag-est">EST</span> <span className="edit-hint">optional — from Gamalytic</span></div>
        <div className="edit-fields">
          {field('copies_sold', 'Copies sold (mid point)', { type: 'number' })}
          {field('revenue_gross', 'Gross revenue (USD)', { type: 'number' })}
          {field('units_low', 'Units — low', { type: 'number', hint: 'blank = modelled band' })}
          {field('units_mid', 'Units — mid', { type: 'number' })}
          {field('units_high', 'Units — high', { type: 'number' })}
          {field('reviews', 'Gamalytic reviews', { type: 'number' })}
        </div>

        <label className="edit-check">
          <input type="checkbox" checked={fetch} onChange={(e) => setFetch(e.target.checked)} />
          <span>Fetch Steam facts &amp; launch curve now <span className="edit-hint">(uses the network; a popular game can take a few minutes)</span></span>
        </label>

        {err ? <p className="edit-err">{err}</p> : null}
        <div className="edit-actions">
          <button className="pill" onClick={onCancel} disabled={busy}>Cancel</button>
          <button className="pill edit-primary" onClick={submit} disabled={busy}>
            {busy ? (fetch ? 'Adding & fetching…' : 'Adding…') : 'Add game'}
          </button>
        </div>
      </div>
    </div>
  )
}
