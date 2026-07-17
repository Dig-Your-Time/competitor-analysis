import { useEffect, useRef, useState } from 'react'

// Phosphor "info" glyph, matching the design handoff
const INFO_PATH =
  'M128,24A104,104,0,1,0,232,128,104.11,104.11,0,0,0,128,24Zm-4,48a12,12,0,1,1-12,12A12,12,0,0,1,124,72Zm12,112a16,16,0,0,1-16-16V128a8,8,0,0,1,0-16,16,16,0,0,1,16,16v40a8,8,0,0,1,0,16Z'

// tiny pub/sub so only one popover is open at a time (matches the design's
// single `info` key). Opening one closes the rest.
let counter = 0
const listeners = new Set()
const announceOpen = (id) => listeners.forEach((fn) => fn(id))

// A small circular ⓘ button that toggles a floating popover of help text.
// Clicking anywhere outside it (or pressing Escape) closes it.
export function InfoPopover({ children, width }) {
  const [open, setOpen] = useState(false)
  const idRef = useRef(++counter)
  const wrapRef = useRef(null)

  useEffect(() => {
    const onOther = (id) => { if (id !== idRef.current) setOpen(false) }
    listeners.add(onOther)
    return () => listeners.delete(onOther)
  }, [])

  useEffect(() => {
    if (!open) return
    const onDoc = (e) => { if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false) }
    const onKey = (e) => { if (e.key === 'Escape') setOpen(false) }
    document.addEventListener('mousedown', onDoc)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDoc)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  const toggle = () => {
    const next = !open
    setOpen(next)
    if (next) announceOpen(idRef.current)
  }

  return (
    <span className="noc-i-wrap" ref={wrapRef}>
      <button
        className={'noc-i' + (open ? ' on' : '')}
        onClick={toggle}
        aria-label="About this view"
      >
        <svg viewBox="0 0 256 256" fill="currentColor"><path d={INFO_PATH} /></svg>
      </button>
      {open && <div className="noc-pop" style={width ? { width } : undefined}>{children}</div>}
    </span>
  )
}

// The standard view header: title + optional confidence badge + ⓘ popover,
// with a short muted subtitle underneath.
export function ViewHead({ title, badge, subtitle, info, infoWidth, children }) {
  return (
    <div className="vhead">
      <div className="vhead-t">
        <h1>{title}</h1>
        {badge ? <span className={'tagpill tag-' + badge.toLowerCase()}>{badge}</span> : null}
        {info ? <InfoPopover width={infoWidth}>{info}</InfoPopover> : null}
        {children}
      </div>
      {subtitle ? <p className="sub">{subtitle}</p> : null}
    </div>
  )
}
