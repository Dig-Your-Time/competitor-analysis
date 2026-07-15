import { useEffect, useState } from 'react'
import LaunchCurves from './LaunchCurves.jsx'
import Compare from './Compare.jsx'
import Guide from './Guide.jsx'

const TABS = [
  { id: 'curves', label: 'Launch curves' },
  { id: 'compare', label: 'Compare' },
  { id: 'guide', label: 'Guide' },
]

export default function App() {
  const [data, setData] = useState(null)
  const [tab, setTab] = useState('curves')

  useEffect(() => {
    fetch(`${import.meta.env.BASE_URL}data.json`).then((r) => r.json()).then(setData)
  }, [])

  if (!data) return <div className="loading">Loading competitor data…</div>

  return (
    <div className="app">
      <div className="topbar">
        <div className="brand">
          <span className="mark">Dig · Competitor Analysis</span>
          <span className="tag">time is the currency</span>
        </div>
        <nav className="nav">
          {TABS.map((t) => (
            <button key={t.id} className={tab === t.id ? 'on' : ''} onClick={() => setTab(t.id)}>{t.label}</button>
          ))}
        </nav>
      </div>

      {tab === 'curves' && <LaunchCurves data={data} />}
      {tab === 'compare' && <Compare data={data} />}
      {tab === 'guide' && <Guide data={data} />}

      <footer>
        Data generated {data.generated}. Reviews, dates &amp; prices are HARD (Steam); units &amp; revenue are estimates.
        Built from {data.games.length - 1} competitors. See the Guide tab for what every number means.
      </footer>
    </div>
  )
}
