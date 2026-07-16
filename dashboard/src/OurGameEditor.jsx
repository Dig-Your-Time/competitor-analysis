import { useEffect } from 'react'
import { toEur, EUR_PER } from './lib.js'

// fields worth tweaking for a "what if we shipped like this?" experiment.
// Most fields just read/write one key. A few are special:
//  - price drives both the Compare price row and the Market map target line
//  - "positive" is stored as a fraction (0.90) but edited as a percent (90)
//  - est units is a point target, so low/mid/high all move together
//  - revenue is stored in USD (it's converted to EUR for display), so we edit
//    in EUR and store the USD-equivalent, keeping every view's number correct
const FIELDS = [
  { k: 'title', label: 'Title', type: 'text' },
  { k: 'price_usd', label: 'Price (USD)', type: 'number', step: '1', apply: (v) => ({ price_usd: v, target_price_usd: v }) },
  { k: 'comparable_class', label: 'Comparable class', type: 'text' },
  { k: 'platforms', label: 'Platforms', type: 'text' },
  { k: 'region', label: 'Region', type: 'text' },
  { k: 'country', label: 'Country', type: 'text' },
  { k: 'company_size', label: 'Team size', type: 'text' },
  { k: 'self_published', label: 'Self-published?', type: 'text' },
  { k: 'company_founded', label: 'Studio founded (year)', type: 'number', step: '1' },
  { k: 'ea_window', label: 'Early-access window', type: 'text' },
  { section: 'Traction & estimates (targets)' },
  { k: 'review_count', label: 'Reviews', type: 'number', step: '100' },
  {
    k: 'review_pct', label: 'Positive (%)', type: 'number', step: '1',
    display: (g) => (g.review_pct == null ? '' : Math.round(g.review_pct * 100)),
    apply: (v) => ({ review_pct: v == null ? null : v / 100 }),
  },
  {
    k: 'est_units_mid', label: 'Est. units', type: 'number', step: '1000',
    apply: (v) => ({ est_units_low: v, est_units_mid: v, est_units_high: v }),
  },
  {
    k: 'est_revenue_gross_mid', label: 'Est. gross revenue (EUR)', type: 'number', step: '10000',
    display: (g) => (g.est_revenue_gross_mid == null ? '' : Math.round(toEur(g.est_revenue_gross_mid, 'USD'))),
    apply: (v) => ({ est_revenue_gross_mid: v == null ? null : Math.round(v / EUR_PER.USD) }),
  },
]

export default function OurGameEditor({ open, onClose, game, edits, setEdits }) {
  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  if (!open || !game) return null

  const set = (f, raw) => {
    const v = f.type === 'number' ? (raw === '' ? null : Number(raw)) : raw
    const patch = f.apply ? f.apply(v) : { [f.k]: v }
    setEdits((prev) => ({ ...prev, ...patch }))
  }

  const dirty = Object.keys(edits).length > 0

  return (
    <>
      <div className="drawer-scrim" onClick={onClose} />
      <aside className="drawer" role="dialog" aria-modal="true">
        <div className="drawer-h">
          <div>
            <div className="drawer-kind">Our game · in-session what-if</div>
            <div className="drawer-title">Edit our game</div>
          </div>
          <button className="drawer-x" onClick={onClose} aria-label="Close">✕</button>
        </div>
        <div className="drawer-body">
          <p className="note" style={{ marginTop: 0 }}>
            Changes apply <strong>live</strong> to Compare, the Market map, and everywhere else our game
            appears. They are <strong>not saved</strong>: a refresh resets to the defaults baked into the
            data. This is a scratchpad for "where would we land if we shipped like this?".
          </p>

          <div className="editform">
            {FIELDS.map((f) =>
              f.section ? (
                <div className="editsection" key={f.section}>{f.section}</div>
              ) : (
                <label className="editrow" key={f.k}>
                  <span className="editlabel">{f.label}</span>
                  <input
                    className="editinput"
                    type={f.type}
                    step={f.step}
                    value={f.display ? f.display(game) : (game[f.k] ?? '')}
                    onChange={(e) => set(f, e.target.value)}
                  />
                </label>
              )
            )}
          </div>

          <div className="editactions">
            <button className="pill" onClick={() => setEdits({})} disabled={!dirty}>
              Reset to defaults
            </button>
            <span className="editstate">{dirty ? 'Edited (unsaved)' : 'Showing defaults'}</span>
          </div>

          <p className="drawer-foot">
            Our game's real values live in <code>scripts/build_data.py</code>. To make an experiment
            permanent, copy the number in there and rebuild the data.
          </p>
        </div>
      </aside>
    </>
  )
}
