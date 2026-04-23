import { useEffect, useMemo, useRef, useState } from 'react'

// ── Calculation helpers ──────────────────────────────────────────────────────

const TERMS_ACCEPT_KEY = 'nis_terms_accepted_v1'

function getCookie(name) {
  const parts = String(document.cookie || '').split('; ')
  for (const part of parts) {
    const eq = part.indexOf('=')
    if (eq < 0) continue
    const k = decodeURIComponent(part.slice(0, eq))
    if (k !== name) continue
    return decodeURIComponent(part.slice(eq + 1))
  }
  return null
}

function setCookie(name, value, { maxAgeSeconds = 60 * 60 * 24 * 365, path = '/' } = {}) {
  const secure = typeof window !== 'undefined' && window.location?.protocol === 'https:' ? '; Secure' : ''
  document.cookie =
    `${encodeURIComponent(name)}=${encodeURIComponent(value)}; Path=${path}; Max-Age=${maxAgeSeconds}; SameSite=Lax${secure}`
}

function hasAcceptedTerms() {
  try {
    if (getCookie(TERMS_ACCEPT_KEY) === '1') return true
  } catch {
    // ignore
  }
  try {
    return window.localStorage.getItem(TERMS_ACCEPT_KEY) === '1'
  } catch {
    return false
  }
}

// VBA Round() is banker's rounding (round-half-to-even)
function bankersRound(x) {
  const floor = Math.floor(x)
  const diff = x - floor
  if (Math.abs(diff - 0.5) < 1e-10) return floor % 2 === 0 ? floor : floor + 1
  return Math.round(x)
}

function getCeiling(wageCeilings, year, month, scheduleType) {
  const applicable = [...wageCeilings]
    .filter(c => c.from_year < year || (c.from_year === year && c.from_month <= month))
    .sort((a, b) => b.from_year - a.from_year || b.from_month - a.from_month)[0]
  if (!applicable) return Infinity
  return scheduleType === 'Weekly' ? applicable.weekly : applicable.monthly
}

function getRate(contributionRates, year, month) {
  const applicable = [...contributionRates]
    .filter(r => r.from_year < year || (r.from_year === year && r.from_month <= month))
    .sort((a, b) => b.from_year - a.from_year || b.from_month - a.from_month)[0]
  return applicable ?? { employer_pct: 7.8, employee_pct: 5.2 }
}

function calcRow(emp, year, month, scheduleType, settings) {
  if (!settings) return { totalActual: 0, totalInsurable: 0, er: 0, ee: 0 }
  const ceiling = getCeiling(settings.wageCeilings, year, month, scheduleType)
  const rate = getRate(settings.contributionRates, year, month)
  let totalActual = 0, totalInsurable = 0, er = 0, ee = 0
  for (const wage of emp.wages) {
    const w = Number(wage) || 0
    totalActual += w
    const capped = Math.min(w, ceiling)
    totalInsurable += capped
    if (emp.over60 === 'Yes') {
      er += bankersRound(capped * settings.over60EmployerPct / 100)
    } else {
      er += bankersRound(capped * rate.employer_pct / 100)
      ee += bankersRound(capped * rate.employee_pct / 100)
    }
  }
  return { totalActual, totalInsurable, er, ee }
}

function addDays(iso, n) {
  if (!iso) return ''
  const d = new Date(iso + 'T00:00:00')
  d.setDate(d.getDate() + n)
  return d.toISOString().slice(0, 10)
}

function fmtMoney(n) {
  if (n == null || n === 0) return '—'
  return '$' + Number(n).toLocaleString()
}

const MONTH_NAMES = [
  'January','February','March','April','May','June',
  'July','August','September','October','November','December',
]

let _id = 0
function newEmployee() {
  return { id: ++_id, over60: 'No', ssn: '', surname: '', firstname: '', wages: ['','','','',''], weeksWorked: '' }
}

function base64ToUint8Array(base64) {
  const binary = atob(base64)
  const out = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i += 1) out[i] = binary.charCodeAt(i)
  return out
}

// ── Styles ───────────────────────────────────────────────────────────────────

const C = {
  nearBlack: '#141413',
  parchment: '#f5f4ed',
  ivory: '#faf9f5',
  white: '#ffffff',
  warmSand: '#e8e6dc',
  borderCream: '#f0eee6',
  ringWarm: '#d1cfc5',
  oliveGray: '#5e5d59',
  stoneGray: '#87867f',
  terracotta: '#c96442',
  focusBlue: '#3898ec',
  darkSurface: '#30302e',
}

const S = {
  page: {
    width: '100%',
    maxWidth: 'none',
    margin: 0,
    padding: '24px 24px 80px',
    boxSizing: 'border-box',
    color: C.nearBlack,
    background: C.parchment,
    fontFamily: 'system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif',
    letterSpacing: '-0.14px',
  },
  topRow: { display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 12, marginBottom: 20 },
  h1: { margin: 0, fontSize: 32, fontWeight: 500, lineHeight: 1.15, letterSpacing: '-0.26px', fontFamily: 'Georgia, Times, serif' },
  subtitle: { marginTop: 6, fontSize: 14, color: C.oliveGray, lineHeight: 1.5, maxWidth: 820 },
  mono: { fontFamily: 'ui-monospace, SF Mono, Menlo, monospace', textTransform: 'uppercase', letterSpacing: '0.54px', fontSize: 12 },
  card: { background: C.ivory, border: `1px solid ${C.borderCream}`, borderRadius: 12, padding: 20, marginTop: 16, boxShadow: 'rgba(0,0,0,0.05) 0px 4px 24px' },
  cardHead: { display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 8, marginBottom: 12 },
  headerFooterRow: { display: 'flex', justifyContent: 'flex-end', marginTop: 14, paddingTop: 12, borderTop: `1px solid ${C.borderCream}` },
  payableBox: { textAlign: 'right' },
  grid4: { display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: 12 },
  grid5: { display: 'grid', gridTemplateColumns: 'repeat(5, minmax(0, 1fr))', gap: 12 },
  label: { display: 'block', fontSize: 12, fontWeight: 500, letterSpacing: '0.3px', textTransform: 'uppercase', marginBottom: 6, color: C.stoneGray },
  input: { width: '100%', boxSizing: 'border-box', border: `1px solid ${C.borderCream}`, borderRadius: 12, padding: '10px 12px', fontSize: 14, outline: 'none', background: C.white, color: C.nearBlack, boxShadow: `${C.white} 0px 0px 0px 0px, ${C.ringWarm} 0px 0px 0px 1px` },
  inputSm: { width: '100%', boxSizing: 'border-box', border: `1px solid ${C.borderCream}`, borderRadius: 12, padding: '7px 10px', fontSize: 13, outline: 'none', background: C.white, fontFamily: 'inherit', color: C.nearBlack, boxShadow: `${C.white} 0px 0px 0px 0px, ${C.ringWarm} 0px 0px 0px 1px` },
  inputCalc: { width: '100%', boxSizing: 'border-box', border: '1px solid transparent', borderRadius: 5, padding: '5px 7px', fontSize: 13, outline: 'none', background: 'transparent', color: '#000', fontFamily: 'inherit' },
  pill: { borderRadius: 12, border: `1px solid ${C.terracotta}`, padding: '10px 16px', background: C.terracotta, color: C.ivory, cursor: 'pointer', fontSize: 14, fontFamily: 'inherit', boxShadow: `${C.terracotta} 0px 0px 0px 0px, ${C.terracotta} 0px 0px 0px 1px` },
  pillWhite: { borderRadius: 12, border: `1px solid ${C.borderCream}`, padding: '10px 16px', background: C.warmSand, color: C.nearBlack, cursor: 'pointer', fontSize: 14, fontFamily: 'inherit', boxShadow: `${C.warmSand} 0px 0px 0px 0px, ${C.ringWarm} 0px 0px 0px 1px` },
  pillSm: { borderRadius: 12, border: `1px solid ${C.borderCream}`, padding: '7px 12px', background: C.warmSand, color: C.nearBlack, cursor: 'pointer', fontSize: 12, fontFamily: 'inherit', boxShadow: `${C.warmSand} 0px 0px 0px 0px, ${C.ringWarm} 0px 0px 0px 1px` },
  pillSmWhite: { borderRadius: 12, border: `1px solid ${C.borderCream}`, padding: '7px 12px', background: C.white, color: C.nearBlack, cursor: 'pointer', fontSize: 12, fontFamily: 'inherit', boxShadow: `${C.white} 0px 0px 0px 0px, ${C.ringWarm} 0px 0px 0px 1px` },
  btnRow: { display: 'flex', gap: 10, marginTop: 16, flexWrap: 'wrap', alignItems: 'center' },
  btnRowSplit: { display: 'flex', justifyContent: 'space-between', gap: 10, marginTop: 16, flexWrap: 'wrap', alignItems: 'center' },
  btnGroup: { display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' },
  tableWrap: { overflowX: 'auto', marginTop: 10 },
  table: { width: '100%', borderCollapse: 'collapse', fontSize: 13 },
  th: { textAlign: 'left', fontSize: 10, fontWeight: 500, letterSpacing: '0.5px', textTransform: 'uppercase', borderBottom: `1px solid ${C.borderCream}`, padding: '0 8px 8px', whiteSpace: 'nowrap', color: C.stoneGray },
  thCalc: { textAlign: 'right', fontSize: 10, fontWeight: 500, letterSpacing: '0.5px', textTransform: 'uppercase', borderBottom: `1px solid ${C.borderCream}`, padding: '0 8px 8px', whiteSpace: 'nowrap', color: C.stoneGray },
  td: { padding: '6px 6px', verticalAlign: 'middle', borderBottom: `1px solid ${C.borderCream}` },
  tdCalc: { padding: '6px 8px', verticalAlign: 'middle', borderBottom: `1px solid ${C.borderCream}`, textAlign: 'right', fontSize: 13, whiteSpace: 'nowrap' },
  tdRemove: { padding: '6px 8px', verticalAlign: 'middle', borderBottom: `1px solid ${C.borderCream}`, textAlign: 'center' },
  totalRow: { fontSize: 13, fontWeight: 600, borderTop: `1px solid ${C.borderCream}` },
  totalLabel: { padding: '10px 8px', textAlign: 'right', fontSize: 12, color: C.oliveGray, whiteSpace: 'nowrap' },
  totalVal: { padding: '10px 8px', textAlign: 'right', fontWeight: 600 },
  payable: { fontSize: 20, fontWeight: 500, letterSpacing: '-0.2px', marginTop: 4, fontFamily: 'Georgia, Times, serif' },
  sectionLabel: { fontSize: 12, fontWeight: 600, marginTop: 16, marginBottom: 6, color: C.oliveGray },
  settingsInputNarrow: { boxSizing: 'border-box', border: `1px solid ${C.borderCream}`, borderRadius: 12, padding: '8px 10px', fontSize: 13, outline: 'none', width: '100%', fontFamily: 'inherit', background: C.white, boxShadow: `${C.white} 0px 0px 0px 0px, ${C.ringWarm} 0px 0px 0px 1px` },
  linkBtn: { border: 'none', background: 'none', cursor: 'pointer', padding: 0, fontSize: 12, textDecoration: 'underline', opacity: 0.7 },
}

function withDisabled(style, disabled) {
  if (!disabled) return style
  return { ...style, opacity: 0.5, cursor: 'not-allowed', filter: 'grayscale(0.2)' }
}

function withLockedInputStyle(style, locked) {
  if (!locked) return style
  return {
    ...style,
    opacity: 0.55,
    cursor: 'not-allowed',
    background: '#f3f2eb',
  }
}

function ConfirmModal({ open, title, body, confirmLabel, cancelLabel, onConfirm, onCancel }) {
  if (!open) return null
  return (
    <div
      onClick={onCancel}
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.45)',
        zIndex: 260,
        display: 'flex',
        alignItems: 'flex-start',
        justifyContent: 'center',
        padding: '56px 16px',
        overflowY: 'auto',
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          background: C.ivory,
          border: `1px solid ${C.borderCream}`,
          borderRadius: 16,
          width: 'min(560px, 100%)',
          padding: 20,
          boxShadow: 'rgba(0,0,0,0.12) 0px 12px 40px',
        }}
      >
        <div style={{ ...S.mono, marginBottom: 10 }}>{title}</div>
        <div style={{ fontSize: 13, lineHeight: 1.5, opacity: 0.9, whiteSpace: 'pre-wrap' }}>{body}</div>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 16 }}>
          <button style={S.pillSmWhite} onClick={onCancel}>{cancelLabel}</button>
          <button style={S.pillSm} onClick={onConfirm}>{confirmLabel}</button>
        </div>
      </div>
    </div>
  )
}

// ── Focus style ───────────────────────────────────────────────────────────────

function useDashedFocus() {
  useEffect(() => {
    const style = document.createElement('style')
    style.textContent = `:focus-visible { outline: 2px solid ${C.focusBlue}; outline-offset: 2px; } button,input,select { font: inherit; }`
    document.head.appendChild(style)
    return () => style.remove()
  }, [])
}

/** @param {string} apiBase */
function buildApiUrl(apiBase, path) {
  const envBase =
    typeof import.meta !== 'undefined' && import.meta.env?.VITE_API_BASE
      ? String(import.meta.env.VITE_API_BASE).replace(/\/$/, '')
      : ''
  const base = (apiBase || envBase || '').replace(/\/$/, '')
  if (!base) return path
  return `${base}${path.startsWith('/') ? path : `/${path}`}`
}

/** @param {string} apiBase */
async function apiJson(path, init, apiBase) {
  const res = await fetch(buildApiUrl(apiBase, path), init)
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  return res.json()
}

/** Desktop bridge (no HTTP API) + browser fallback config. */
function useDesktopBridge() {
  const viteBase =
    typeof import.meta !== 'undefined' && import.meta.env?.VITE_API_BASE
      ? String(import.meta.env.VITE_API_BASE)
      : ''
  const bridge = typeof window !== 'undefined' ? (window.nisElectron || null) : null
  return { bridge, apiBase: viteBase }
}

// ── App ───────────────────────────────────────────────────────────────────────

export default function App() {
  useDashedFocus()
  const { bridge, apiBase } = useDesktopBridge()

  // Header
  const [employerName, setEmployerName] = useState('')
  const [header, setHeader] = useState({
    regNoRaw: '',
    contributionYear: new Date().getFullYear(),
    contributionMonthName: MONTH_NAMES[new Date().getMonth()],
    scheduleType: 'Monthly',
  })

  // Period dates (always 5 slots; 2-5 auto-filled in Weekly mode)
  const [periods, setPeriods] = useState(['', '', '', '', ''])
  const period1Ref = useRef(null)
  const [period1Required, setPeriod1Required] = useState(false)
  const [exportHint, setExportHint] = useState('')

  // Employees
  const [employees, setEmployees] = useState([newEmployee()])

  // Settings
  const [settings, setSettings] = useState(null)
  const [settingsErr, setSettingsErr] = useState('')
  const [settingsSaving, setSettingsSaving] = useState(false)
  const [settingsSaved, setSettingsSaved] = useState(false)
  const [showSettings, setShowSettings] = useState(false)
  const [showDisclaimer, setShowDisclaimer] = useState(() => !hasAcceptedTerms())
  const [calcSettingsUnlocked, setCalcSettingsUnlocked] = useState(false)
  const [confirmState, setConfirmState] = useState(null)

  function confirmModal({ title, body, confirmLabel = 'Confirm', cancelLabel = 'Cancel' }) {
    return new Promise(resolve => {
      setConfirmState({
        title,
        body,
        confirmLabel,
        cancelLabel,
        resolve,
      })
    })
  }

  // Generate
  const [busy, setBusy] = useState(false)

  // Load settings and auto-fill defaults into empty form fields
  useEffect(() => {
    ;(async () => {
      try {
        const s = bridge
          ? await bridge.getSettings()
          : await apiJson('/api/settings', undefined, apiBase)
        setSettings(s)
        if (s.defaultEmployerName) setEmployerName(n => n || s.defaultEmployerName)
        if (s.defaultRegNo) setHeader(h => ({ ...h, regNoRaw: h.regNoRaw || s.defaultRegNo }))
      } catch (e) {
        setSettingsErr(String(e?.message ?? e))
      }
    })()
  }, [apiBase, bridge])

  useEffect(() => {
    if (showSettings) setCalcSettingsUnlocked(false)
  }, [showSettings])

  const isWeekly = header.scheduleType === 'Weekly'

  // Auto-fill period dates 2-5 when period 1 changes (Weekly mode)
  function onPeriod1Change(val) {
    setPeriod1Required(false)
    if (isWeekly && val) {
      setPeriods([val, addDays(val, 7), addDays(val, 14), addDays(val, 21), addDays(val, 28)])
    } else {
      setPeriods(p => [val, isWeekly ? p[1] : '', isWeekly ? p[2] : '', isWeekly ? p[3] : '', isWeekly ? p[4] : ''])
    }
  }

  // When schedule type changes, clear/keep periods
  function onScheduleTypeChange(val) {
    setHeader(h => ({ ...h, scheduleType: val }))
    if (val === 'Monthly') {
      setPeriods(p => [p[0], '', '', '', ''])
      setEmployees(emps => emps.map(e => ({ ...e, wages: [e.wages[0], '', '', '', ''], weeksWorked: '' })))
    } else {
      // Auto-fill if period 1 is set
      if (periods[0]) {
        setPeriods([periods[0], addDays(periods[0], 7), addDays(periods[0], 14), addDays(periods[0], 21), addDays(periods[0], 28)])
      }
    }
  }

  // Per-row calculations
  const calcYear = header.contributionYear
  const calcMonth = MONTH_NAMES.indexOf(header.contributionMonthName) + 1

  const rowCalcs = useMemo(
    () => employees.map(emp => calcRow(emp, calcYear, calcMonth, header.scheduleType, settings)),
    [employees, calcYear, calcMonth, header.scheduleType, settings],
  )

  const totalPayable = useMemo(
    () => rowCalcs.reduce((sum, c) => sum + c.er + c.ee, 0),
    [rowCalcs],
  )
  const hasAnyEmployerContribution = useMemo(
    () => rowCalcs.some(c => (c?.er ?? 0) !== 0),
    [rowCalcs],
  )

  // Employee table mutations
  function updateEmp(id, patch) {
    setEmployees(emps => emps.map(e => e.id === id ? { ...e, ...patch } : e))
  }
  function updateWage(id, wageIdx, val) {
    setEmployees(emps => emps.map(e => {
      if (e.id !== id) return e
      const wages = [...e.wages]
      wages[wageIdx] = val
      return { ...e, wages }
    }))
  }
  function addEmployee() {
    setEmployees(emps => [...emps, newEmployee()])
  }
  function removeEmployee(id) {
    setEmployees(emps => emps.length > 1 ? emps.filter(e => e.id !== id) : emps)
  }
  function clearAll() {
    ;(async () => {
      const ok = await confirmModal({
        title: 'Clear all?',
        body: 'Clear all employee data and reset the form?',
        confirmLabel: 'Clear all',
        cancelLabel: 'Cancel',
      })
      if (!ok) return
      setEmployerName(settings?.defaultEmployerName || '')
      setHeader({ regNoRaw: settings?.defaultRegNo || '', contributionYear: new Date().getFullYear(), contributionMonthName: MONTH_NAMES[new Date().getMonth()], scheduleType: 'Monthly' })
      setPeriods(['', '', '', '', ''])
      setEmployees([newEmployee()])
    })()
  }

  async function downloadFromApi(path) {
    if (!periods[0]) {
      setPeriod1Required(true)
      setExportHint('Set Period 1 before generating files.')
      period1Ref.current?.focus?.()
      return
    }
    if (!hasAnyEmployerContribution) {
      setExportHint('No rows have an Employer Contribution. Add wages (or check Over 60) to generate a file.')
      return
    }

    setBusy(true)
    try {
      setExportHint('')
      const payload = {
        employerName,
        header,
        periodDates: periods,
        employees: employees.map((emp, i) => ({
          over60: emp.over60,
          ssn: emp.ssn,
          surname: emp.surname,
          firstname: emp.firstname,
          wages: emp.wages.map(w => Number(w) || 0),
          weeksWorked: emp.weeksWorked,
          eeContribution: rowCalcs[i].ee,
          erContribution: rowCalcs[i].er,
        })),
        sequence: 1,
      }
      let filename = 'nis.txt'
      let blob
      if (bridge) {
        const generated = path === '/api/generate-xls'
          ? await bridge.generateXls(payload)
          : await bridge.generateTxt(payload)
        filename = generated?.filename || filename
        const bytes = base64ToUint8Array(generated?.contentBase64 || '')
        blob = new Blob([bytes], { type: generated?.contentType || 'application/octet-stream' })
      } else {
        const res = await fetch(buildApiUrl(apiBase, path), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        })
        if (!res.ok) throw new Error(`Generate failed (HTTP ${res.status})`)
        blob = await res.blob()
        filename = res.headers.get('content-disposition')?.match(/filename="?([^"]+)"?/)?.[1] ?? filename
      }
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = filename
      document.body.appendChild(a)
      a.click()
      a.remove()
      URL.revokeObjectURL(url)
    } finally {
      setBusy(false)
    }
  }

  // Generate file (TXT)
  async function onGenerate() {
    return downloadFromApi('/api/generate')
  }

  // Settings mutations
  function updateCeiling(idx, field, raw) {
    if (!calcSettingsUnlocked) return
    setSettings(s => {
      const next = s.wageCeilings.map((c, i) => i === idx ? { ...c, [field]: parseInt(raw, 10) || 0 } : c)
      return { ...s, wageCeilings: next }
    })
    setSettingsSaved(false)
  }
  function addCeiling() {
    if (!calcSettingsUnlocked) return
    setSettings(s => ({ ...s, wageCeilings: [...s.wageCeilings, { from_year: new Date().getFullYear(), from_month: 1, monthly: 0, weekly: 0 }] }))
    setSettingsSaved(false)
  }
  function removeCeiling(idx) {
    if (!calcSettingsUnlocked) return
    setSettings(s => ({ ...s, wageCeilings: s.wageCeilings.filter((_, i) => i !== idx) }))
    setSettingsSaved(false)
  }
  function updateRate(idx, field, raw) {
    if (!calcSettingsUnlocked) return
    setSettings(s => {
      const next = s.contributionRates.map((r, i) =>
        i === idx ? { ...r, [field]: field.endsWith('pct') ? parseFloat(raw) || 0 : parseInt(raw, 10) || 0 } : r,
      )
      return { ...s, contributionRates: next }
    })
    setSettingsSaved(false)
  }
  function addRate() {
    if (!calcSettingsUnlocked) return
    setSettings(s => ({ ...s, contributionRates: [...s.contributionRates, { from_year: new Date().getFullYear(), from_month: 1, employer_pct: 0, employee_pct: 0 }] }))
    setSettingsSaved(false)
  }
  function removeRate(idx) {
    if (!calcSettingsUnlocked) return
    setSettings(s => ({ ...s, contributionRates: s.contributionRates.filter((_, i) => i !== idx) }))
    setSettingsSaved(false)
  }
  async function saveSettings() {
    setSettingsSaving(true)
    setSettingsSaved(false)
    try {
      const updated = bridge
        ? await bridge.saveSettings(settings)
        : await apiJson('/api/settings', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(settings),
          }, apiBase)
      setSettings(updated)
      setSettingsSaved(true)
    } catch (e) {
      setSettingsErr(String(e?.message ?? e))
    } finally {
      setSettingsSaving(false)
    }
  }

  const wageCount = isWeekly ? 5 : 1

  return (
    <div style={S.page}>
      {/* ── Page title ── */}
      <div style={S.topRow}>
        <div>
          <div style={S.mono}>NIS</div>
          <h1 style={S.h1}>V75 Internal NIS Electronic Schedule</h1>
          <div style={S.subtitle}>
            Based on <span style={S.mono}>NIS_ELECTRONIC_SCHEDULE_2026_v2.0.xls</span> (Year: <span style={S.mono}>2026</span>, Version: <span style={S.mono}>v2.0</span>).
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <button style={S.linkBtn} onClick={() => setShowDisclaimer(true)}>Disclaimer / Terms</button>
          <button style={{ ...S.pillSmWhite, alignSelf: 'center' }} onClick={() => setShowSettings(true)}>Settings</button>
        </div>
      </div>

      {/* ── Schedule header ── */}
      <div style={S.card}>
        <div style={S.mono}>Schedule Header</div>
        <div style={{ height: 12 }} />
        <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr 1fr', gap: 12 }}>
          <div>
            <label style={S.label}>Employer Name</label>
            <input style={S.input} value={employerName} onChange={e => setEmployerName(e.target.value)} placeholder="e.g. Acme Ltd" />
          </div>
          <div>
            <label style={S.label}>Registration #</label>
            <input style={S.input} value={header.regNoRaw} onChange={e => setHeader(h => ({ ...h, regNoRaw: e.target.value }))} placeholder="123456" />
          </div>
          <div>
            <label style={S.label}>Year</label>
            <input style={S.input} type="number" value={header.contributionYear} onChange={e => setHeader(h => ({ ...h, contributionYear: Number(e.target.value) || 0 }))} />
          </div>
          <div>
            <label style={S.label}>Month</label>
            <select style={S.input} value={header.contributionMonthName} onChange={e => setHeader(h => ({ ...h, contributionMonthName: e.target.value }))}>
              {MONTH_NAMES.map(m => <option key={m}>{m}</option>)}
            </select>
          </div>
          <div>
            <label style={S.label}>Schedule Type</label>
            <select style={S.input} value={header.scheduleType} onChange={e => onScheduleTypeChange(e.target.value)}>
              <option>Monthly</option>
              <option>Weekly</option>
            </select>
          </div>
        </div>

        <div style={{ height: 16 }} />
        <div style={S.mono}>Pay Period Dates</div>
        <div style={{ height: 10 }} />
        <div style={isWeekly ? S.grid5 : { maxWidth: 220 }}>
          <div>
            <label style={S.label}>Period 1</label>
            <input
              ref={period1Ref}
              style={{
                ...S.input,
                ...(period1Required ? { borderColor: C.focusBlue, boxShadow: `${C.white} 0px 0px 0px 0px, ${C.focusBlue} 0px 0px 0px 2px` } : null),
              }}
              type="date"
              value={periods[0]}
              onChange={e => onPeriod1Change(e.target.value)}
            />
            {period1Required && (
              <div style={{ marginTop: 6, fontSize: 12, color: C.oliveGray }}>
                Period 1 is required before generating files.
              </div>
            )}
          </div>
          {isWeekly && [1,2,3,4].map(i => (
            <div key={i}>
              <label style={S.label}>Period {i + 1}</label>
              <input style={{ ...S.input, opacity: 0.6 }} type="date" value={periods[i]} readOnly />
            </div>
          ))}
        </div>

        <div style={S.headerFooterRow}>
          <div style={S.payableBox}>
            <div style={S.mono}>Total Payable</div>
            <div style={S.payable}>{fmtMoney(totalPayable)}</div>
          </div>
        </div>
      </div>

      {/* ── Employee table ── */}
      <div style={S.card}>
        <div style={S.cardHead}>
          <div style={S.mono}>Employees</div>
          <button style={S.pillSm} onClick={addEmployee}>+ Add employee</button>
        </div>

        <div style={S.tableWrap}>
          <table style={S.table}>
            <thead>
              <tr>
                <th style={{ ...S.th, width: 60 }}>Over 60 flag</th>
                <th style={{ ...S.th, minWidth: 140 }}>SSN</th>
                <th style={{ ...S.th, minWidth: 130 }}>Surname</th>
                <th style={{ ...S.th, minWidth: 110 }}>First Name</th>
                {Array.from({ length: wageCount }, (_, i) => (
                  <th key={i} style={{ ...S.th, width: 130 }}>Wages Period {i + 1}</th>
                ))}
                {isWeekly && <th style={{ ...S.th, width: 90 }}>Weeks Worked</th>}
                <th style={S.thCalc}>Total Actual Wages</th>
                <th style={S.thCalc}>Total Insurable Wages</th>
                <th style={S.thCalc}>Employee Contribution</th>
                <th style={S.thCalc}>Employer Contribution</th>
                <th style={{ ...S.th, width: 32 }} />
              </tr>
            </thead>
            <tbody>
              {employees.map((emp, rowIdx) => {
                const calc = rowCalcs[rowIdx]
                return (
                  <tr key={emp.id}>
                    <td style={S.td}>
                      <select style={S.inputSm} value={emp.over60} onChange={e => updateEmp(emp.id, { over60: e.target.value })}>
                        <option>No</option>
                        <option>Yes</option>
                      </select>
                    </td>
                    <td style={S.td}>
                      <input style={S.inputSm} value={emp.ssn} onChange={e => updateEmp(emp.id, { ssn: e.target.value })} placeholder="123456789" />
                    </td>
                    <td style={S.td}>
                      <input style={S.inputSm} value={emp.surname} onChange={e => updateEmp(emp.id, { surname: e.target.value.toUpperCase() })} placeholder="DOE" />
                    </td>
                    <td style={S.td}>
                      <input style={S.inputSm} value={emp.firstname} onChange={e => updateEmp(emp.id, { firstname: e.target.value.toUpperCase() })} placeholder="JANE" />
                    </td>
                    {Array.from({ length: wageCount }, (_, i) => (
                      <td key={i} style={S.td}>
                        <input style={S.inputSm} type="number" min="0" value={emp.wages[i]} onChange={e => updateWage(emp.id, i, e.target.value)} placeholder="0" />
                      </td>
                    ))}
                    {isWeekly && (
                      <td style={S.td}>
                        <input style={S.inputSm} type="number" min="1" max="5" value={emp.weeksWorked} onChange={e => updateEmp(emp.id, { weeksWorked: e.target.value })} placeholder="1" />
                      </td>
                    )}
                    <td style={S.tdCalc}>{fmtMoney(calc.totalActual)}</td>
                    <td style={S.tdCalc}>{fmtMoney(calc.totalInsurable)}</td>
                    <td style={S.tdCalc}>{fmtMoney(calc.ee)}</td>
                    <td style={S.tdCalc}>{fmtMoney(calc.er)}</td>
                    <td style={S.tdRemove}>
                      <button
                        style={{ border: 'none', background: 'none', cursor: 'pointer', fontSize: 16, opacity: 0.35, padding: 2 }}
                        onClick={() => removeEmployee(emp.id)}
                        title="Remove row"
                      >×</button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
            {employees.length > 1 && (
              <tfoot>
                <tr style={S.totalRow}>
                  <td colSpan={4 + wageCount + (isWeekly ? 1 : 0)} style={S.totalLabel}>Totals</td>
                  <td style={{ ...S.totalVal, textAlign: 'right', padding: '8px 6px' }}>{fmtMoney(rowCalcs.reduce((s, c) => s + c.totalActual, 0))}</td>
                  <td style={{ ...S.totalVal, textAlign: 'right', padding: '8px 6px' }}>{fmtMoney(rowCalcs.reduce((s, c) => s + c.totalInsurable, 0))}</td>
                  <td style={{ ...S.totalVal, textAlign: 'right', padding: '8px 6px' }}>{fmtMoney(rowCalcs.reduce((s, c) => s + c.ee, 0))}</td>
                  <td style={{ ...S.totalVal, textAlign: 'right', padding: '8px 6px' }}>{fmtMoney(rowCalcs.reduce((s, c) => s + c.er, 0))}</td>
                  <td />
                </tr>
              </tfoot>
            )}
          </table>
        </div>

        {!settings && (
          <div style={{ fontSize: 12, opacity: 0.5, marginTop: 10 }}>
            Contributions will calculate once settings load.
          </div>
        )}

        <div style={S.btnRowSplit}>
          <div style={S.btnGroup}>
            <button style={withDisabled(S.pillWhite, busy)} onClick={clearAll} disabled={busy}>Clear all</button>
          </div>

          <div style={{ ...S.btnGroup, justifyContent: 'flex-end' }}>
            {exportHint
              ? <span style={{ fontSize: 12, color: C.oliveGray, maxWidth: 520, textAlign: 'right' }}>{exportHint}</span>
              : (!periods[0] && <span style={{ fontSize: 12, opacity: 0.6 }}>Set a period date to generate</span>)
            }
            <button style={withDisabled(S.pill, busy || !periods[0])} onClick={onGenerate} disabled={busy || !periods[0]}>
              {busy ? 'Generating…' : 'Generate file'}
            </button>
          </div>
        </div>
      </div>

      {/* ── Settings modal ── */}
      {showSettings && (
        <div
          onClick={() => setShowSettings(false)}
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 200, display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: '48px 16px', overflowY: 'auto' }}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{ background: C.ivory, border: `1px solid ${C.borderCream}`, borderRadius: 16, width: 'min(680px, 100%)', padding: 24, boxShadow: 'rgba(0,0,0,0.05) 0px 4px 24px' }}
          >
            <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 20 }}>
              <div style={S.mono}>Settings</div>
              <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                {settingsSaved && <span style={{ fontSize: 12, opacity: 0.5 }}>Saved</span>}
                {settingsErr && <span style={{ fontSize: 12, color: '#c00' }}>{settingsErr}</span>}
                {settings && (
                  <button style={S.pillSm} onClick={saveSettings} disabled={settingsSaving}>
                    {settingsSaving ? 'Saving…' : 'Save'}
                  </button>
                )}
                <button onClick={() => setShowSettings(false)} style={{ border: 'none', background: 'none', cursor: 'pointer', fontSize: 22, lineHeight: 1, opacity: 0.5, padding: '0 4px' }}>×</button>
              </div>
            </div>

            {!settings && !settingsErr && <div style={{ fontSize: 13, opacity: 0.4 }}>Loading…</div>}

            {settings && (
              <>
                <div style={S.sectionLabel}>Default employer info</div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 4 }}>
                  <div>
                    <label style={S.label}>Employer name</label>
                    <input
                      style={S.settingsInputNarrow}
                      placeholder="Optional — auto-fills the form"
                      value={settings.defaultEmployerName}
                      onChange={e => { setSettings(s => ({ ...s, defaultEmployerName: e.target.value })); setSettingsSaved(false) }}
                    />
                  </div>
                  <div>
                    <label style={S.label}>Registration number</label>
                    <input
                      style={S.settingsInputNarrow}
                      placeholder="Optional — auto-fills the form"
                      value={settings.defaultRegNo}
                      onChange={e => { setSettings(s => ({ ...s, defaultRegNo: e.target.value })); setSettingsSaved(false) }}
                    />
                  </div>
                </div>
                <div style={{ marginBottom: 10 }} />

                <div style={{ ...S.sectionLabel, marginTop: 18, display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 12 }}>
                  <span>Calculation settings</span>
                  {!calcSettingsUnlocked && (
                    <span style={{ fontSize: 12, opacity: 0.6 }}>Locked to prevent accidental changes.</span>
                  )}
                </div>
                <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap', marginBottom: 10 }}>
                  <button
                    style={S.pillSmWhite}
                    onClick={async () => {
                      if (calcSettingsUnlocked) return setCalcSettingsUnlocked(false)
                      const ok = await confirmModal({
                        title: 'Unlock calculation settings?',
                        body:
                          'The settings below control contribution calculations (over-60 rate, wage ceilings, and contribution rates).\n\nChanging them can produce incorrect results.\n\nOnly continue if you know what you are doing.',
                        confirmLabel: 'Unlock',
                        cancelLabel: 'Cancel',
                      })
                      if (ok) setCalcSettingsUnlocked(true)
                    }}
                  >
                    {calcSettingsUnlocked ? 'Lock calculation settings' : 'Unlock calculation settings'}
                  </button>
                  <button
                    style={S.pillSmWhite}
                    onClick={async () => {
                      const ok = await confirmModal({
                        title: 'Reset calculation defaults?',
                        body:
                          'Reset calculation settings (over-60 rate, wage ceilings, contribution rates) back to the built-in defaults?\n\nThis will overwrite the saved values.',
                        confirmLabel: 'Reset',
                        cancelLabel: 'Cancel',
                      })
                      if (!ok) return
                      try {
                        const updated = bridge
                          ? await bridge.resetCalculationDefaults()
                          : await apiJson('/api/settings/reset-calculation-defaults', { method: 'POST' }, apiBase)
                        setSettings(updated)
                        setSettingsSaved(false)
                        setCalcSettingsUnlocked(false)
                      } catch (e) {
                        setSettingsErr(String(e?.message ?? e))
                      }
                    }}
                  >
                    Reset calculation defaults
                  </button>
                </div>

                <div style={{ ...S.sectionLabel, marginTop: 6 }}>Over-60 employer rate (%)</div>
                <input
                  style={withLockedInputStyle({ ...S.settingsInputNarrow, width: 120 }, !calcSettingsUnlocked)}
                  type="number" step="0.1"
                  value={settings.over60EmployerPct}
                  disabled={!calcSettingsUnlocked}
                  onChange={e => { setSettings(s => ({ ...s, over60EmployerPct: parseFloat(e.target.value) || 0 })); setSettingsSaved(false) }}
                />

                <div style={{ ...S.sectionLabel, marginTop: 20 }}>Wage ceilings</div>
                <div style={S.tableWrap}>
                  <table style={S.table}>
                    <thead>
                      <tr>
                        {['From year','From month','Monthly ($)','Weekly ($)',''].map(h => <th key={h} style={S.th}>{h}</th>)}
                      </tr>
                    </thead>
                    <tbody>
                      {settings.wageCeilings.map((c, i) => (
                        <tr key={i}>
                          {['from_year','from_month','monthly','weekly'].map(f => (
                            <td key={f} style={S.td}>
                              <input
                                style={withLockedInputStyle(S.inputSm, !calcSettingsUnlocked)}
                                type="number"
                                value={c[f]}
                                disabled={!calcSettingsUnlocked}
                                onChange={e => updateCeiling(i, f, e.target.value)}
                              />
                            </td>
                          ))}
                          <td style={S.tdRemove}>
                            <button style={{ border: 'none', background: 'none', cursor: calcSettingsUnlocked ? 'pointer' : 'not-allowed', fontSize: 16, opacity: 0.35, padding: 2 }} onClick={() => calcSettingsUnlocked && removeCeiling(i)} disabled={!calcSettingsUnlocked}>×</button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div style={{ marginTop: 8 }}>
                  <button style={withDisabled(S.pillSmWhite, !calcSettingsUnlocked)} onClick={addCeiling} disabled={!calcSettingsUnlocked}>+ Add row</button>
                </div>

                <div style={{ ...S.sectionLabel, marginTop: 20 }}>Contribution rates (%)</div>
                <div style={S.tableWrap}>
                  <table style={S.table}>
                    <thead>
                      <tr>
                        {['From year','From month','Employer %','Employee %',''].map(h => <th key={h} style={S.th}>{h}</th>)}
                      </tr>
                    </thead>
                    <tbody>
                      {settings.contributionRates.map((r, i) => (
                        <tr key={i}>
                          {['from_year','from_month','employer_pct','employee_pct'].map(f => (
                            <td key={f} style={S.td}>
                              <input
                                style={withLockedInputStyle(S.inputSm, !calcSettingsUnlocked)}
                                type="number"
                                step={f.endsWith('pct') ? '0.1' : '1'}
                                value={r[f]}
                                disabled={!calcSettingsUnlocked}
                                onChange={e => updateRate(i, f, e.target.value)}
                              />
                            </td>
                          ))}
                          <td style={S.tdRemove}>
                            <button style={{ border: 'none', background: 'none', cursor: calcSettingsUnlocked ? 'pointer' : 'not-allowed', fontSize: 16, opacity: 0.35, padding: 2 }} onClick={() => calcSettingsUnlocked && removeRate(i)} disabled={!calcSettingsUnlocked}>×</button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div style={{ marginTop: 8 }}>
                  <button style={withDisabled(S.pillSmWhite, !calcSettingsUnlocked)} onClick={addRate} disabled={!calcSettingsUnlocked}>+ Add row</button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* ── Disclaimer / Terms modal ── */}
      {showDisclaimer && (
        <div
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 220, display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: '48px 16px', overflowY: 'auto' }}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{ background: C.ivory, border: `1px solid ${C.borderCream}`, borderRadius: 16, width: 'min(760px, 100%)', padding: 24, boxShadow: 'rgba(0,0,0,0.05) 0px 4px 24px' }}
          >
            <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 14 }}>
              <div style={S.mono}>Disclaimer / Terms of Use</div>
            </div>

            <div style={{ fontSize: 13, lineHeight: 1.5 }}>
              <div style={{ marginBottom: 12 }}>
                This web app is a convenience tool based on the Excel template <span style={S.mono}>NIS_ELECTRONIC_SCHEDULE_2026_v2.0.xls</span>.
                It is provided “as-is” for internal use.
              </div>

              <div style={S.sectionLabel}>Not official advice</div>
              <div style={{ opacity: 0.85 }}>
                This app is <b>not</b> affiliated with, endorsed by, or a substitute for guidance from the National Insurance Scheme (NIS) or any government agency.
                You are responsible for verifying that your submissions meet current NIS rules and requirements.
              </div>

              <div style={S.sectionLabel}>Accuracy & verification</div>
              <div style={{ opacity: 0.85 }}>
                Calculations and file generation are intended to mirror the referenced Excel workbook and its business logic.
                Always review outputs before submission, especially when values are unusual or exceptionally large.
              </div>

              <div style={S.sectionLabel}>Limitation of liability</div>
              <div style={{ opacity: 0.85 }}>
                To the maximum extent permitted by law, the authors/maintainers are not liable for any loss, penalties, or damages arising from use of this app or the files it generates.
              </div>

              <div style={S.sectionLabel}>Privacy</div>
              <div style={{ opacity: 0.85 }}>
                Social Security Numbers and employee data you enter may be processed to generate output files.
                Use this app only on devices/environments you trust and follow your organisation’s data handling policies.
              </div>

              <div style={S.sectionLabel}>Source reference</div>
              <div style={{ opacity: 0.85 }}>
                Source template: <span style={S.mono}>NIS_ELECTRONIC_SCHEDULE_2026_v2.0.xls</span> • Year: <span style={S.mono}>2026</span> • Version: <span style={S.mono}>v2.0</span>
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 18 }}>
              <button
                style={S.pill}
                onClick={() => {
                  try {
                    setCookie(TERMS_ACCEPT_KEY, '1')
                  } catch {
                    // ignore
                  }
                  try {
                    window.localStorage.setItem(TERMS_ACCEPT_KEY, '1')
                  } catch {
                    // ignore
                  }
                  setShowDisclaimer(false)
                }}
              >
                I Understand
              </button>
            </div>
          </div>
        </div>
      )}

      <ConfirmModal
        open={!!confirmState}
        title={confirmState?.title ?? ''}
        body={confirmState?.body ?? ''}
        confirmLabel={confirmState?.confirmLabel ?? 'Confirm'}
        cancelLabel={confirmState?.cancelLabel ?? 'Cancel'}
        onCancel={() => {
          confirmState?.resolve(false)
          setConfirmState(null)
        }}
        onConfirm={() => {
          confirmState?.resolve(true)
          setConfirmState(null)
        }}
      />
    </div>
  )
}
