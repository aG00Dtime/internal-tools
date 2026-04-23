'use strict'

const { app, BrowserWindow, ipcMain, dialog } = require('electron')
const path = require('path')
const fs = require('fs')
const { spawn } = require('child_process')

/** @type {{ dbPath: string | null }} */
const desktopContext = { dbPath: null }

function backendBinaryName() {
  return process.platform === 'win32' ? 'nis-backend-cli.exe' : 'nis-backend-cli'
}

function getBackendExec() {
  if (!desktopContext.dbPath) throw new Error('Desktop context not initialized.')
  const env = {
    ...process.env,
    NIS_DB_PATH: desktopContext.dbPath,
    PYTHONUNBUFFERED: '1',
  }

  if (app.isPackaged) {
    const file = path.join(process.resourcesPath, 'backend', backendBinaryName())
    if (!fs.existsSync(file)) {
      throw new Error(`Bundled backend CLI not found: ${file}`)
    }
    return { file, argsPrefix: [], options: { env } }
  }

  const backendDir = path.join(__dirname, '..', 'backend')
  const script = path.join(backendDir, 'desktop_cli.py')
  const py = process.platform === 'win32' ? 'python' : 'python3'
  return { file: py, argsPrefix: [script], options: { cwd: backendDir, env } }
}

function runBackendCommand(command, payload = {}) {
  return new Promise((resolve, reject) => {
    const exec = getBackendExec()
    const child = spawn(exec.file, [...exec.argsPrefix, command], exec.options)
    let stdout = ''
    let stderr = ''

    child.stdout.setEncoding('utf8')
    child.stderr.setEncoding('utf8')
    child.stdout.on('data', (chunk) => {
      stdout += chunk
    })
    child.stderr.on('data', (chunk) => {
      stderr += chunk
    })
    child.on('error', reject)
    child.on('close', (code) => {
      if (code !== 0) {
        reject(new Error((stderr || `Backend command failed (${command})`).trim()))
        return
      }
      try {
        resolve(JSON.parse(stdout || '{}'))
      } catch (e) {
        reject(new Error(`Invalid backend response for ${command}: ${String(e?.message || e)}`))
      }
    })

    try {
      child.stdin.write(JSON.stringify(payload || {}))
      child.stdin.end()
    } catch (e) {
      reject(e)
    }
  })
}

async function createWindow() {
  const userData = app.getPath('userData')
  fs.mkdirSync(userData, { recursive: true })
  desktopContext.dbPath = path.join(userData, 'nis.sqlite3')

  // Ensure DB is initialized early to fail fast on startup issues.
  await runBackendCommand('settings-get')

  const win = new BrowserWindow({
    width: 1280,
    height: 900,
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  })

  if (app.isPackaged) {
    await win.loadFile(path.join(__dirname, 'renderer', 'index.html'))
  } else {
    await win.loadURL('http://127.0.0.1:5173/')
  }

  return win
}

ipcMain.handle('nis:settings:get', async () => {
  const result = await runBackendCommand('settings-get')
  return result.settings
})
ipcMain.handle('nis:settings:put', async (_event, settings) => {
  const result = await runBackendCommand('settings-put', { settings })
  return result.settings
})
ipcMain.handle('nis:settings:reset-calculation-defaults', async () => {
  const result = await runBackendCommand('settings-reset-calculation-defaults')
  return result.settings
})
ipcMain.handle('nis:generate:txt', async (_event, payload) => runBackendCommand('generate-txt', payload))
ipcMain.handle('nis:generate:xls', async (_event, payload) => runBackendCommand('generate-xls', payload))

app.whenReady().then(async () => {
  try {
    await createWindow()
  } catch (e) {
    console.error(e)
    dialog.showErrorBox('NIS Schedule failed to start', String(e?.message ?? e))
    app.quit()
  }

  app.on('activate', async () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      try {
        await createWindow()
      } catch (e) {
        console.error(e)
        dialog.showErrorBox('NIS Schedule failed to open', String(e?.message ?? e))
      }
    }
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
