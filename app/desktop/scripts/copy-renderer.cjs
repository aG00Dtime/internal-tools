'use strict'

const fs = require('fs')
const path = require('path')

const desktopDir = path.join(__dirname, '..')
const src = path.join(desktopDir, '..', 'frontend', 'dist')
const dst = path.join(desktopDir, 'renderer')

if (!fs.existsSync(src)) {
  console.error(`Missing frontend build at ${src} — run "npm run build" in app/frontend first.`)
  process.exit(1)
}

fs.rmSync(dst, { recursive: true, force: true })
fs.cpSync(src, dst, { recursive: true })
console.log('Copied renderer to', dst)
