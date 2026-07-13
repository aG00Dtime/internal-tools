'use strict'

/**
 * Desktop release: renderer + PyInstaller backend + electron-builder.
 * - macOS: defers to dist.sh (notarization + unsigned retry).
 * - Windows / Linux: runs the same steps without Git Bash.
 */
const { execSync, spawnSync } = require('child_process')
const path = require('path')
const fs = require('fs')

const desktopDir = path.join(__dirname, '..')
const distSh = path.join(__dirname, 'dist.sh')
const buildBackendCjs = path.join(__dirname, 'build-backend.cjs')

if (process.platform === 'darwin') {
  if (!fs.existsSync(distSh)) {
    console.error('missing', distSh)
    process.exit(1)
  }
  const r = spawnSync('bash', [distSh, ...process.argv.slice(2)], {
    stdio: 'inherit',
    cwd: desktopDir,
    env: process.env,
    shell: false
  })
  process.exit(r.status === null || r.error ? 1 : r.status)
}

execSync('npm run build:renderer', { stdio: 'inherit', cwd: desktopDir, env: process.env, shell: true })
execSync(`node "${buildBackendCjs}"`, { stdio: 'inherit', cwd: desktopDir, env: process.env, shell: true })
const npx = spawnSync('npx', ['electron-builder', ...process.argv.slice(2)], {
  stdio: 'inherit',
  cwd: desktopDir,
  env: process.env,
  shell: true
})
process.exit(npx.status === null ? 1 : npx.status)
