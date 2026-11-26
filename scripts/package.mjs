#!/usr/bin/env node
/**
 * Assemble the hosting package: release/stagehand-obs/ containing the built app and the
 * host files. Run `npm run package` (which builds first). The release workflow zips this folder.
 */
import { cpSync, existsSync, readFileSync, rmSync, writeFileSync, mkdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

const root = fileURLToPath(new URL('..', import.meta.url))
const { version } = JSON.parse(readFileSync(`${root}package.json`, 'utf8'))
const out = `${root}release/stagehand-obs`

if (!existsSync(`${root}dist/index.html`)) {
  console.error('Error: no build found in dist/. Run `npm run build` first (or use `npm run package`).')
  process.exit(1)
}

rmSync(`${root}release`, { recursive: true, force: true })
mkdirSync(out, { recursive: true })
cpSync(`${root}dist`, `${out}/app`, { recursive: true })
for (const f of ['server.mjs', 'start.bat', 'install-autostart.bat', 'remove-autostart.bat', 'add-firewall-rule.bat', 'host-config.json']) {
  cpSync(`${root}host/${f}`, `${out}/${f}`)
}
writeFileSync(`${out}/README-host.txt`, readFileSync(`${root}host/README-host.txt`, 'utf8').replace('{{VERSION}}', `v${version}`).replace(/\r?\n/g, '\r\n'))
cpSync(`${root}LICENSE`, `${out}/LICENSE.txt`)
writeFileSync(`${out}/VERSION`, `${version}\n`)
console.log(`Packaged v${version} in release/stagehand-obs/`)
