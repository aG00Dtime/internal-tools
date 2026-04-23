/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_BASE?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}

interface Window {
  nisElectron?: {
    getSettings: () => Promise<any>
    saveSettings: (settings: any) => Promise<any>
    resetCalculationDefaults: () => Promise<any>
    generateTxt: (payload: any) => Promise<{ filename: string; contentType: string; contentBase64: string }>
    generateXls: (payload: any) => Promise<{ filename: string; contentType: string; contentBase64: string }>
  }
}
