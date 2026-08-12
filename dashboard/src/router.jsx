// A small router, deliberately not react-router.
//
// CLAUDE.md: "Do not introduce a framework... Every dependency is a thing the
// developer has to maintain while also shipping a game." This app has exactly two
// kinds of URL -- the tabbed dashboard at "/" and a game page at "/<appid>" -- which
// the History API covers directly.
//
// Route state lives in ONE context. An earlier draft had Link call the hook itself,
// which quietly gave every link its own private copy of the state, so navigating
// updated the link and nothing else.
//
// Deep links work because the dev server falls back to index.html for unknown paths.
// Static hosting needs that fallback configured too -- see public/_redirects and the
// note in docs/game-pages-and-gamesensor.md.
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'

// The app is served from a subdirectory on GitHub Pages (/competitor-analysis/) and from
// the root in dev, so BASE has to come from Vite rather than being assumed.
const BASE = import.meta.env.BASE_URL.replace(/^\.\/?$/, '/').replace(/\/$/, '')

export function parsePath(pathname) {
  // Match on the LAST path segment rather than stripping BASE off the front. Both work
  // when the base is configured correctly, but this one still works when it isn't —
  // and a base misconfigured at deploy time is invisible locally and breaks every game
  // link in production. There are no other routes, so a bare number is unambiguous.
  const seg = pathname.replace(/\/+$/, '').split('/').pop() || ''
  return /^\d+$/.test(seg) ? { name: 'game', gameId: seg } : { name: 'home' }
}

const Ctx = createContext(null)
export const useRoute = () => useContext(Ctx)

export function RouterProvider({ children }) {
  const [route, setRoute] = useState(() => parsePath(window.location.pathname))

  useEffect(() => {
    const onPop = () => setRoute(parsePath(window.location.pathname))
    window.addEventListener('popstate', onPop)
    return () => window.removeEventListener('popstate', onPop)
  }, [])

  const navigate = useCallback((to) => {
    const url = (BASE || '') + to
    if (url !== window.location.pathname) window.history.pushState({}, '', url)
    setRoute(parsePath(url))
    window.scrollTo(0, 0)
  }, [])

  const value = useMemo(() => ({ route, navigate }), [route, navigate])
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

// A real <a href>, so middle-click, ctrl-click and "copy link address" all behave --
// the point of giving games their own URL is that the URL can be shared.
export function Link({ to, children, ...rest }) {
  const { navigate } = useRoute()
  return (
    <a
      href={(BASE || '') + to}
      onClick={(e) => {
        if (e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return  // let the browser handle it
        e.preventDefault()
        navigate(to)
      }}
      {...rest}
    >
      {children}
    </a>
  )
}
