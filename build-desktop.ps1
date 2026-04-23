# One-shot desktop release build on Windows (run in PowerShell).
# Produces installers under app\desktop\release\
$ErrorActionPreference = 'Stop'

$Root = if ($PSScriptRoot) { $PSScriptRoot } else { Split-Path -Parent $MyInvocation.MyCommand.Path }
$Desktop = Join-Path $Root 'app\desktop'
$Frontend = Join-Path $Root 'app\frontend'

function Die($msg) {
  Write-Error $msg
  exit 1
}

function Need-Cmd($name) {
  if (-not (Get-Command $name -ErrorAction SilentlyContinue)) {
    Die "missing required command '$name'"
  }
}

Write-Host "==> NIS desktop build (repo: $Root)"

Need-Cmd 'node'
Need-Cmd 'npm'
Need-Cmd 'python'

$nodeMajor = [int]((node -p "parseInt(process.versions.node.split('.')[0],10)" 2>$null))
if ($nodeMajor -lt 18) {
  Die "Node.js 18+ recommended (found $(node -v))"
}

if (-not (Test-Path (Join-Path $Frontend 'package-lock.json'))) {
  Die "missing $Frontend\package-lock.json (npm ci requires a lockfile)"
}

Write-Host '==> Installing desktop npm dependencies…'
Push-Location $Desktop
try {
  npm install
  Write-Host '==> Building release (frontend + PyInstaller CLI + electron-builder)…'
  npm run dist
}
finally {
  Pop-Location
}

Write-Host "==> Done. Artifacts: $Desktop\release\"
