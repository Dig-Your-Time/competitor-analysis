import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { spawn } from 'node:child_process'
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

// base './' keeps asset paths relative so it also works on GitHub / Cloudflare Pages
export default defineConfig({
  base: './',
  plugins: [react(), localEditApi()],
})
