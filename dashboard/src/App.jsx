import { useCallback, useEffect, useMemo, useState } from 'react'
import LaunchCurves from './LaunchCurves.jsx'
import Directory from './Directory.jsx'
import Compare from './Compare.jsx'
import MarketMap from './MarketMap.jsx'
import RegionMap from './RegionMap.jsx'
import Financials from './Financials.jsx'
import PublisherView from './PublisherView.jsx'
import FundingView from './FundingView.jsx'
import Guide from './Guide.jsx'
import OurGameEditor from './OurGameEditor.jsx'
import GamePage from './GamePage.jsx'
import { DrawerProvider } from './drawer.jsx'
import { EditorCtx } from './editor.jsx'
import { RouterProvider, useRoute } from './router.jsx'

const TABS = [
  { id: 'browse', label: 'Browse' },
  { id: 'curves', label: 'Launch curves' },
  { id: 'compare', label: 'Compare' },
  { id: 'market', label: 'Market map' },
  { id: 'regions', label: 'Regions' },
  { id: 'financials', label: 'Financials' },
  { id: 'publishers', label: 'Publishers' },
  { id: 'funding', label: 'Funding' },
  { id: 'guide', label: 'Guide' },
]

export default function App() {
  return (
    <RouterProvider>
      <Dashboard />
    </RouterProvider>
  )
}

function Dashboard() {
  const { route, navigate } = useRoute()
  const [data, setData] = useState(null)
  const [tab, setTab] = useState('browse')
  const [ourEdits, setOurEdits] = useState({})
  const [editOpen, setEditOpen] = useState(false)

  // cache-busted so a local edit's rebuilt data.json is picked up immediately
  const reload = useCallback(
    () => fetch(`${import.meta.env.BASE_URL}data.json?t=${Date.now()}`).then((r) => r.json()).then(setData),
    []
  )
  useEffect(() => { reload() }, [reload])

  // patch our own game with any in-session edits, so every view reads one source
  const view = useMemo(() => {
    if (!data) return null
    if (!Object.keys(ourEdits).length) return data
    return { ...data, games: data.games.map((g) => (g.is_our_game ? { ...g, ...ourEdits } : g)) }
  }, [data, ourEdits])

  if (!view) return <div className="loading">Loading competitor data…</div>

  const ourGame = view.games.find((g) => g.is_our_game)

  return (
    <DrawerProvider data={view} reload={reload}>
    <EditorCtx.Provider value={() => setEditOpen(true)}>
    <div className="app">
      <div className="topbar">
        <div className="brand">
          <span className="mark">Competitor Analysis</span>
          <span className="tag">Indie mining &amp; survival benchmark</span>
        </div>
        {/* The header stays put on every route. On a game page a tab click has to do
            two things: pick the tab AND return to the dashboard URL. */}
        <nav className="nav">
          {TABS.map((t) => (
            <button
              key={t.id}
              className={route.name === 'home' && tab === t.id ? 'on' : ''}
              onClick={() => { setTab(t.id); if (route.name !== 'home') navigate('/') }}
            >
              {t.label}
            </button>
          ))}
        </nav>
      </div>

      {route.name === 'game' ? (
        <GamePage data={view} gameId={route.gameId} />
      ) : (
        <>
          {tab === 'curves' && <LaunchCurves data={view} />}
          {tab === 'browse' && <Directory data={view} />}
          {tab === 'compare' && <Compare data={view} />}
          {tab === 'market' && <MarketMap data={view} />}
          {tab === 'regions' && <RegionMap data={view} />}
          {tab === 'financials' && <Financials data={view} />}
          {tab === 'publishers' && <PublisherView data={view} />}
          {tab === 'funding' && <FundingView data={view} />}
          {tab === 'guide' && <Guide data={view} />}
        </>
      )}

      <footer>
        Data generated {view.generated}. Reviews, dates &amp; prices are HARD (Steam); units &amp; revenue are estimates.
        Built from {view.games.length - 1} competitors. See the Guide tab for what every number means.
      </footer>
    </div>
    <OurGameEditor
      open={editOpen}
      onClose={() => setEditOpen(false)}
      game={ourGame}
      edits={ourEdits}
      setEdits={setOurEdits}
    />
    </EditorCtx.Provider>
    </DrawerProvider>
  )
}
