'use strict'

/**
 * Cross-platform PyInstaller build for the bundled backend (no Git Bash on Windows).
 * Parity with build-backend.sh.
 */
const { execFileSync, spawnSync } = require('child_process')
const fs = require('fs')
const path = require('path')

const desktopDir = path.join(__dirname, '..')
const backendDir = path.join(desktopDir, '..', 'backend')
const out = path.join(desktopDir, 'bundle', 'backend')
const work = path.join(desktopDir, 'bundle', 'pyinstaller-work')
const venvRoot = path.join(desktopDir, 'bundle', 'build-venv')
const requirements = path.join(backendDir, 'requirements.txt')

function venvPython(venv) {
  const nix = path.join(venv, 'bin', 'python')
  if (fs.existsSync(nix)) return nix
  const win = path.join(venv, 'Scripts', 'python.exe')
  if (fs.existsSync(win)) return win
  return null
}

function findBase() {
  const check = (cmd) =>
    spawnSync(cmd, { shell: true, encoding: 'utf8' })

  if (check('python3 -c "import sys; assert sys.version_info>=(3,8)"').status === 0) {
    return { argv: ['python3'] }
  }
  if (check('py -3 -c "import sys; assert sys.version_info>=(3,8)"').status === 0) {
    return { argv: ['py', '-3'] }
  }
  if (check('python -c "import sys; assert sys.version_info>=(3,8)"').status === 0) {
    return { argv: ['python'] }
  }
  console.error('error: need Python 3.8+ on PATH (try python3, py -3, or python).')
  process.exit(1)
}

function ensureVenv(base) {
  let p = venvPython(venvRoot)
  if (!p) {
    fs.rmSync(venvRoot, { recursive: true, force: true })
    execFileSync(base.argv[0], [...base.argv.slice(1), '-m', 'venv', venvRoot], { stdio: 'inherit' })
    p = venvPython(venvRoot)
    if (!p) {
      console.error('error: venv was created but no interpreter was found in', venvRoot)
      process.exit(1)
    }
  }
  return p
}

function run (py, args, opts) {
  execFileSync(py, args, { stdio: 'inherit', windowsHide: true, ...opts })
}

const base = findBase()
const py = ensureVenv(base)

fs.rmSync(out, { recursive: true, force: true })
fs.mkdirSync(out, { recursive: true })

run(py, ['-m', 'pip', 'install', '--upgrade', 'pip'])
run(py, ['-m', 'pip', 'install', '-r', requirements, 'pyinstaller'])
run(
  py,
  [
    '-m', 'PyInstaller', '--noconfirm', '--clean',
    '--onefile',
    '--name', 'nis-backend-cli',
    '--distpath', out,
    '--workpath', work,
    'desktop_cli.py',
    '--hidden-import=xlwt'
  ],
  { cwd: backendDir }
)

console.log('Backend bundle written to', out)
