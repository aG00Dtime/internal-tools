const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('nisElectron', {
  getSettings: () => ipcRenderer.invoke('nis:settings:get'),
  saveSettings: (settings) => ipcRenderer.invoke('nis:settings:put', settings),
  resetCalculationDefaults: () => ipcRenderer.invoke('nis:settings:reset-calculation-defaults'),
  generateTxt: (payload) => ipcRenderer.invoke('nis:generate:txt', payload),
  generateXls: (payload) => ipcRenderer.invoke('nis:generate:xls', payload),
  generatePayeCsv: (payload) => ipcRenderer.invoke('nis:paye:generate', payload),
})
