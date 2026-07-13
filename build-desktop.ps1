# One-shot desktop release build on Windows (run in PowerShell).
# Produces installers under app\desktop\release\
#
# If Node.js is not installed, either install it from https://nodejs.org/ (LTS, 18+)
# or run:  .\build-desktop.ps1 -InstallNode   (uses winget when available)
[CmdletBinding()]
param(
  [switch]$InstallNode
)

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

function Refresh-EnvPath {
  $m = [System.Environment]::GetEnvironmentVariable('Path', 'Machine')
  $u = [System.Environment]::GetEnvironmentVariable('Path', 'User')
  $env:Path = if ($m -and $u) { "$m;$u" } elseif ($m) { $m } elseif ($u) { $u } else { $env:Path }
}

function Add-NodeInstallDirsToPath {
  foreach ($dir in @(
      (Join-Path $env:ProgramFiles 'nodejs')
      (Join-Path ${env:ProgramFiles(x86)} 'nodejs')
    )) {
    if (Test-Path (Join-Path $dir 'node.exe')) {
      if ($env:Path -notlike "*$dir*") {
        $env:Path = $dir + ';' + $env:Path
      }
      return
    }
  }
}

function Test-NodeOnPath {
  $null -ne (Get-Command node -ErrorAction SilentlyContinue)
}

function Install-NodeWithWinget {
  $winget = Get-Command winget -ErrorAction SilentlyContinue
  if (-not $winget) {
    return $false
  }
  Write-Host "==> Installing Node.js LTS with winget (OpenJS.NodeJS.LTS)…"
  $wingetArgs = @(
    'install', '-e', '--id', 'OpenJS.NodeJS.LTS',
    '--accept-source-agreements', '--accept-package-agreements'
  )
  & winget @wingetArgs
  if ($LASTEXITCODE -ne 0) {
    Write-Warning "winget reported a non-zero exit code ($LASTEXITCODE). If Node is already installed, open a new terminal and re-run this script."
  }
  Refresh-EnvPath
  Add-NodeInstallDirsToPath
  return (Test-NodeOnPath)
}

function Ensure-Node {
  if (Test-NodeOnPath) { return }
  Add-NodeInstallDirsToPath
  if (Test-NodeOnPath) { return }

  if ($InstallNode) {
    if (-not (Get-Command winget -ErrorAction SilentlyContinue)) {
      Die "-InstallNode requires the Windows Package Manager (winget / App Installer). Install Node LTS 18+ from https://nodejs.org/ and re-run, or install winget from the Microsoft Store."
    }
    if (Install-NodeWithWinget) { return }
    Die "Node.js is still not on PATH after -InstallNode. Install LTS 18+ from https://nodejs.org/ , then open a new PowerShell window and re-run."
  }

  if (Get-Command winget -ErrorAction SilentlyContinue) {
    Die "missing required command 'node'. Run: .\build-desktop.ps1 -InstallNode  or install LTS 18+ from https://nodejs.org/ and re-run."
  }
  Die "missing required command 'node'. Install Node.js LTS 18+ from https://nodejs.org/ (add to PATH), then re-run."
}

Write-Host "==> NIS desktop build (repo: $Root)"

Ensure-Node
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
