import { useEffect, useState } from 'react'
import LaunchCurves from './LaunchCurves.jsx'
import Directory from './Directory.jsx'
import Compare from './Compare.jsx'
import RegionMap from './RegionMap.jsx'
import Financials from './Financials.jsx'
import PublisherView from './PublisherView.jsx'
import FundingView from './FundingView.jsx'
import Guide from './Guide.jsx'
import { DrawerProvider } from './drawer.jsx'

const TABS = [
  { id: 'browse', label: 'Browse' },
  { id: 'curves', label: 'Launch curves' },
  { id: 'compare', label: 'Compare' },
  { id: 'regions', label: 'Regions' },
  { id: 'financials', label: 'Financials' },
  { id: 'publishers', label: 'Publishers' },
  { id: 'funding', label: 'Funding' },
  { id: 'guide', label: 'Guide' },
]

export default function App() {
  const [data, setData] = useState(null)
  const [tab, setTab] = useState('browse')

  useEffect(() => {
    fetch(`${import.meta.env.BASE_URL}data.json`).then((r) => r.json()).then(setData)
  }, [])

  if (!data) return <div className="loading">Loading competitor data…</div>

  return (
    <DrawerProvider data={data}>
    <div className="app">
      <div className="topbar">
        <div className="brand">
          <span className="mark">Competitor Analysis</span>
        </div>
        <nav className="nav">
          {TABS.map((t) => (
            <button key={t.id} className={tab === t.id ? 'on' : ''} onClick={() => setTab(t.id)}>{t.label}</button>
          ))}
        </nav>
      </div>

      {tab === 'curves' && <LaunchCurves data={data} />}
      {tab === 'browse' && <Directory data={data} />}
      {tab === 'compare' && <Compare data={data} />}
      {tab === 'regions' && <RegionMap data={data} />}
      {tab === 'financials' && <Financials data={data} />}
      {tab === 'publishers' && <PublisherView data={data} />}
      {tab === 'funding' && <FundingView data={data} />}
      {tab === 'guide' && <Guide data={data} />}

      <footer>
        Data generated {data.generated}. Reviews, dates &amp; prices are HARD (Steam); units &amp; revenue are estimates.
        Built from {data.games.length - 1} competitors. See the Guide tab for what every number means.
      </footer>
    </div>
    </DrawerProvider>
  )
}
