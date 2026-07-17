import { useState } from 'react'
import { saveEdit } from './editApi.js'

// A small dev-only modal that edits or adds one CSV row.
//
// Props:
//   title      heading
//   fields     [{ key, col, label, type, options?, placeholder?, hint? }]
//                key = property to prefill from `initial`; col = CSV column to write
//   initial    object to prefill field values from (optional)
//   table      HAND table name (companies, games_manual_seed, financials, funding, sources, gamalytic_stats)
//   op         'add' | 'update' | 'delete'
//   match      CSV-column-keyed object locating the row (update/delete)
//   extra      fixed CSV columns to always send (e.g. company_id on add)
//   submitLabel
//   onDone     async () => reload data + close
//   onCancel   () => close
export function EditForm({ title, fields = [], initial, table, op = 'update', match, extra = {}, submitLabel, onDone, onCancel }) {
  const [vals, setVals] = useState(() =>
    Object.fromEntries(fields.map((f) => [f.key, initial?.[f.key] ?? '']))
  )
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')

  const set = (k, v) => setVals((s) => ({ ...s, [k]: v }))

  const submit = async () => {
    setBusy(true); setErr('')
    try {
      const values = { ...extra }
      fields.forEach((f) => { values[f.col] = vals[f.key] })
      await saveEdit({ table, op, match, values })
      await onDone()
    } catch (e) {
      setErr(e.message || String(e))
      setBusy(false)
    }
  }

  return (
    <div className="edit-scrim" onMouseDown={onCancel}>
      <div className="edit-modal" onMouseDown={(e) => e.stopPropagation()} role="dialog" aria-modal="true">
        <div className="edit-modal-h">
          <h3>{title}</h3>
          <button className="drawer-x" onClick={onCancel} aria-label="Close">✕</button>
        </div>
        <div className="edit-fields">
          {fields.map((f) => (
            <label className={'edit-field' + (f.type === 'textarea' ? ' wide' : '')} key={f.key}>
              <span className="edit-label">{f.label}</span>
              {f.type === 'select' ? (
                <select value={vals[f.key] ?? ''} onChange={(e) => set(f.key, e.target.value)}>
                  <option value="">—</option>
                  {(vals[f.key] && !f.options.includes(vals[f.key]) ? [vals[f.key], ...f.options] : f.options)
                    .map((o) => <option key={o} value={o}>{o}</option>)}
                </select>
              ) : f.type === 'textarea' ? (
                <textarea rows={3} value={vals[f.key] ?? ''} placeholder={f.placeholder} onChange={(e) => set(f.key, e.target.value)} />
              ) : (
                <input
                  type={f.type === 'number' ? 'number' : 'text'}
                  value={vals[f.key] ?? ''}
                  placeholder={f.placeholder}
                  onChange={(e) => set(f.key, e.target.value)}
                />
              )}
              {f.hint ? <span className="edit-hint">{f.hint}</span> : null}
            </label>
          ))}
        </div>
        {err ? <p className="edit-err">{err}</p> : null}
        <div className="edit-actions">
          <button className="pill" onClick={onCancel} disabled={busy}>Cancel</button>
          <button className="pill edit-primary" onClick={submit} disabled={busy}>
            {busy ? 'Saving…' : (submitLabel || 'Save')}
          </button>
        </div>
      </div>
    </div>
  )
}

// A tiny dev-only "edit" affordance (pencil) used inline next to things.
export function EditCue({ label = 'Edit', onClick }) {
  return (
    <button className="editcue" title={label} onClick={(e) => { e.stopPropagation(); onClick() }}>✎</button>
  )
}
