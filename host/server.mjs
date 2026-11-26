#!/usr/bin/env node
/**
 * Stagehand: a small web server for hosting the app on the OBS PC (or any PC).
 * Uses only Node.js's built-in modules, so there's nothing to install apart from Node itself.
 *
 *   node server.mjs [--port 8080] [--dir ./app]
 *
 * Settings come from host-config.json next to this file (see README-host.txt); command-line
 * options override them.
 */
import { createServer } from 'node:http'
import { readFile, stat } from 'node:fs/promises'
import { existsSync, readFileSync } from 'node:fs'
import { networkInterfaces } from 'node:os'
import { extname, join, normalize, resolve, sep } from 'node:path'
import { fileURLToPath } from 'node:url'

const HERE = fileURLToPath(new URL('.', import.meta.url))

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
  '.txt': 'text/plain; charset=utf-8',
  '.map': 'application/json; charset=utf-8',
}

export const DEFAULTS = { port: 8080, obsHost: 'same', obsPort: 4455 }

/** Read host-config.json (missing or broken file → defaults, with a warning). */
export function loadConfig(file = join(HERE, 'host-config.json')) {
  if (!existsSync(file)) return { ...DEFAULTS }
  try {
    return { ...DEFAULTS, ...JSON.parse(readFileSync(file, 'utf8')) }
  } catch (e) {
    console.warn(`Warning: couldn't read ${file} (${e.message}); using defaults.`)
    return { ...DEFAULTS }
  }
}

/**
 * Create the server (not yet listening).
 * @param {{ dir: string, version?: string, obsHost?: string | null, obsPort?: number }} opts
 */
export function createAppServer({ dir, version = 'unknown', obsHost = 'same', obsPort = 4455 }) {
  const root = resolve(dir)

  return createServer(async (req, res) => {
    const send = (status, body, headers = {}) => {
      res.writeHead(status, { 'X-Content-Type-Options': 'nosniff', ...headers })
      res.end(req.method === 'HEAD' ? undefined : body)
    }

    if (req.method !== 'GET' && req.method !== 'HEAD') return send(405, 'Method not allowed', { Allow: 'GET, HEAD' })

    let path
    try {
      path = decodeURIComponent(new URL(req.url ?? '/', 'http://x').pathname)
    } catch {
      return send(400, 'Bad request')
    }

    // Tells the app it's being served by this host, so it can suggest the OBS address.
    if (path === '/host.json') {
      return send(200, JSON.stringify({ app: 'stagehand-obs', version, obsHost, obsPort }), {
        'Content-Type': TYPES['.json'],
        'Cache-Control': 'no-cache',
      })
    }

    // Map the URL to a file inside the app folder, refusing anything that escapes it.
    let file = normalize(join(root, path))
    if (file !== root && !file.startsWith(root + sep)) return send(403, 'Forbidden')
    try {
      if ((await stat(file)).isDirectory()) file = join(file, 'index.html')
      const body = await readFile(file)
      const ext = extname(file).toLowerCase()
      // Built assets have content hashes in their names, so they can be cached forever;
      // everything else (index.html) is re-checked so updates show up straight away.
      const immutable = path.startsWith('/assets/')
      return send(200, body, {
        'Content-Type': TYPES[ext] ?? 'application/octet-stream',
        'Cache-Control': immutable ? 'public, max-age=31536000, immutable' : 'no-cache',
      })
    } catch {
      return send(404, 'Not found', { 'Content-Type': TYPES['.txt'] })
    }
  })
}

/** LAN addresses (IPv4) other computers can use to reach this one. */
export function lanAddresses() {
  return Object.values(networkInterfaces())
    .flat()
    .filter((a) => a && a.family === 'IPv4' && !a.internal)
    .map((a) => a.address)
}

function readVersion() {
  for (const f of [join(HERE, 'VERSION'), join(HERE, '..', 'package.json')]) {
    try {
      const text = readFileSync(f, 'utf8')
      return f.endsWith('.json') ? JSON.parse(text).version : text.trim()
    } catch { /* try next */ }
  }
  return 'unknown'
}

function parseArgs(argv) {
  const out = {}
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--port') out.port = Number(argv[++i])
    else if (argv[i] === '--dir') out.dir = argv[++i]
    else if (argv[i] === '--help' || argv[i] === '-h') out.help = true
  }
  return out
}

// ---- command line ----
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const args = parseArgs(process.argv.slice(2))
  if (args.help) {
    console.log('Usage: node server.mjs [--port 8080] [--dir ./app]\nSettings: host-config.json next to this file.')
    process.exit(0)
  }
  const config = loadConfig()
  const port = args.port ?? Number(process.env.PORT ?? config.port)
  const dir = args.dir ?? join(HERE, existsSync(join(HERE, 'app')) ? 'app' : '../dist')
  const version = readVersion()

  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    console.error(`Error: "${port}" isn't a valid port (1-65535).`)
    process.exit(1)
  }
  if (!existsSync(join(dir, 'index.html'))) {
    console.error(`Error: can't find the app in ${resolve(dir)} (no index.html).`)
    process.exit(1)
  }

  const server = createAppServer({ dir, version, obsHost: config.obsHost, obsPort: config.obsPort })
  server.on('error', (e) => {
    if (e.code === 'EADDRINUSE') console.error(`Error: port ${port} is already in use. Is the server already running? Or choose another port in host-config.json.`)
    else console.error(`Error: ${e.message}`)
    process.exit(1)
  })
  server.listen(port, '0.0.0.0', () => {
    console.log(`Stagehand v${version} is running.`)
    console.log(`  On this PC:        http://localhost:${port}`)
    for (const ip of lanAddresses()) console.log(`  From other PCs:    http://${ip}:${port}`)
    console.log('Keep this window open while it is in use. Close it (or press Ctrl+C) to stop.')
  })
}
