import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { spawn } from 'node:child_process'
import { copyFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

const SCRIPT = (name) => fileURLToPath(new URL(`../scripts/${name}`, import.meta.url))
const PYTHON = process.platform === 'win32' ? 'python' : 'python3'

// pipe a request body into `python <script>` and return its stdout JSON
function pipeToPython(script, req, res) {
  let body = ''
  req.setEncoding('utf-8')
  req.on('data', (c) => (body += c))
  req.on('end', () => {
    const py = spawn(PYTHON, [SCRIPT(script)])
    let out = '', err = ''
    py.stdout.on('data', (d) => (out += d))
    py.stderr.on('data', (d) => (err += d))
    py.on('error', (e) => {
      res.statusCode = 500
      res.setHeader('Content-Type', 'application/json')
      res.end(JSON.stringify({ ok: false, error: `could not run ${PYTHON}: ${e.message}` }))
    })
    py.on('close', (code) => {
      res.setHeader('Content-Type', 'application/json')
      if (out.trim()) { res.statusCode = 200; res.end(out.trim()) }
      else { res.statusCode = 500; res.end(JSON.stringify({ ok: false, error: err || `python exited ${code}` })) }
    })
    py.stdin.write(body)
    py.stdin.end()
  })
}

// Local edit API — DEV SERVER ONLY (`apply: 'serve'`). It never ships in the
// production build, so the deployed site stays a read-only static site.
// Every write goes through Python scripts, which are the only writers allowed to
// touch the HAND-owned CSVs (and physically refuse the script-owned ones).
function localEditApi() {
  return {
    name: 'local-edit-api',
    apply: 'serve',
    configureServer(server) {
      server.middlewares.use('/api/edit', (req, res, next) => {
        if (req.method !== 'POST') return next()
        pipeToPython('apply_edit.py', req, res)
      })
      server.middlewares.use('/api/add-game', (req, res, next) => {
        if (req.method !== 'POST') return next()
        pipeToPython('add_game.py', req, res)
      })
    },
  }
}

// GitHub Pages serves this as a PROJECT site under /<repo>/, and .github/workflows/
// deploy.yml publishes there on every push to main. A relative base ('./') is fine for
// assets but breaks client-side routing: the router cannot tell "/competitor-analysis/"
// (the app root) from "/1637320" (a game), so a deep link renders the wrong view.
// An absolute base fixes that. Override with VITE_BASE=/ if this ever moves to a
// domain root such as Cloudflare Pages.
const PAGES_BASE = process.env.VITE_BASE || '/competitor-analysis/'

// GitHub Pages has no SPA fallback and ignores _redirects. Serving a copy of index.html
// as 404.html is the standard trick: an unknown path (a game route) gets the app instead
// of a 404, and the router reads the URL from there.
function spaFallback(outDir) {
  return {
    name: 'spa-404-fallback',
    apply: 'build',
    closeBundle() {
      const src = new URL(`./${outDir}/index.html`, import.meta.url)
      const dst = new URL(`./${outDir}/404.html`, import.meta.url)
      copyFileSync(src, dst)
      console.log(`  spa-404-fallback: wrote ${outDir}/404.html`)
    },
  }
}

export default defineConfig(({ command }) => ({
  base: command === 'build' ? PAGES_BASE : '/',
  plugins: [react(), localEditApi(), spaFallback('dist')],
}))
