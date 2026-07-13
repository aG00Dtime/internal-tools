// CP1252 decode table: index = byte value, value = unicode code point
const _CP1252 = [
  ...Array.from({ length: 128 }, (_, i) => i),
  0x20AC, 0x0081, 0x201A, 0x0192, 0x201E, 0x2026, 0x2020, 0x2021,
  0x02C6, 0x2030, 0x0160, 0x2039, 0x0152, 0x008D, 0x017D, 0x008F,
  0x0090, 0x2018, 0x2019, 0x201C, 0x201D, 0x2022, 0x2013, 0x2014,
  0x02DC, 0x2122, 0x0161, 0x203A, 0x0153, 0x009D, 0x017E, 0x0178,
  ...Array.from({ length: 96 }, (_, i) => i + 0xA0),
]
const _U2CP = new Map(_CP1252.map((cp, b) => [cp, b]))

export function toCP1252Bytes(text) {
  const out = new Uint8Array(text.length)
  for (let i = 0; i < text.length; i++) {
    out[i] = _U2CP.get(text.charCodeAt(i)) ?? 0x3F
  }
  return out
}

function lpad(value, padChar, paddedLength) {
  if (value.length > paddedLength) throw new Error(`Value too long to lpad: "${value}" (${value.length}>${paddedLength})`)
  return padChar.repeat(paddedLength - value.length) + value
}

function rpad(value, padChar, paddedLength) {
  if (value.length > paddedLength) throw new Error(`Value too long to rpad: "${value}" (${value.length}>${paddedLength})`)
  return value + padChar.repeat(paddedLength - value.length)
}

export function bankersRound(x) {
  const floor = Math.floor(x)
  const diff = x - floor
  if (Math.abs(diff - 0.5) < 1e-10) return floor % 2 === 0 ? floor : floor + 1
  return Math.round(x)
}

export function processSsn(ssn) {
  let s = ssn || ''
  if (s.includes('-')) s = s.replace('-', '')
  else if (s.includes(' ')) s = s.replace(' ', '')
  if (s.includes('O')) s = s.replace('O', '')
  let count = 0
  while (s.length >= 3 && count < 2 && (s[2] === 'L' || s[2] === 'O')) {
    s = s.slice(0, 2) + s.slice(3)
    count++
    if (s.length >= 3 && /\d/.test(s[2])) break
  }
  return s.toUpperCase()
}

function yyyymmddOrSpaces(value) {
  if (value == null || value === '' || value === 0) return '        '
  const dt = new Date(value + 'T00:00:00')
  if (isNaN(dt.getTime())) return '        '
  const y = String(dt.getFullYear()).padStart(4, '0')
  const m = String(dt.getMonth() + 1).padStart(2, '0')
  const d = String(dt.getDate()).padStart(2, '0')
  return `${y}${m}${d}`
}

const MONTH_NAME_TO_NUMBER = {
  January: '01', February: '02', March: '03', April: '04',
  May: '05', June: '06', July: '07', August: '08',
  September: '09', October: '10', November: '11', December: '12',
}

function formatMoneyCellAsCentsString(value) {
  let rawInt = 0
  if (value != null && value !== '') rawInt = bankersRound(Number(value) || 0)
  if (rawInt < 0) rawInt = 0
  if (rawInt > 99_999_999) rawInt = 99_999_999
  const raw = rawInt !== 0 ? String(rawInt) : ''
  return lpad(`${raw}00`, '0', 10)
}

function formatRoundedContribution(value) {
  const rounded = bankersRound(Number(value) || 0)
  return lpad(`${rounded}00`, '0', 10)
}

export function buildFilename(regNoRaw, contYear, contMonthName, schedType, n) {
  const mon = contMonthName.slice(0, 3).toUpperCase()
  const schedChar = (schedType || '').slice(0, 1).toUpperCase()
  return `${regNoRaw}_${contYear}_${mon}_${schedChar}_ABOVE_${n}.txt`
}

export function generateLines({ header, periodDates, employees }) {
  const regRaw = String(header.regNoRaw || '').trim()
  if (regRaw.length > 6) throw new Error('Employer registration number must be at most 6 characters.')
  const regno = lpad(regRaw, '0', 6)
  const contYear = String(header.contributionYear)
  const contMonth = MONTH_NAME_TO_NUMBER[header.contributionMonthName]
  const sched = (header.scheduleType || '').slice(0, 1).toUpperCase()

  const dates = [...(periodDates || []), null, null, null, null, null].slice(0, 5)
  const periods = dates.map(yyyymmddOrSpaces)

  const out = []
  for (const emp of employees) {
    const erValue = Number(emp.erContribution) || 0
    if (bankersRound(erValue) === 0) continue

    let ssnClean = processSsn(String(emp.ssn || '')).trim()
    if (ssnClean.length > 9) ssnClean = ssnClean.slice(0, 9)
    const ssn = rpad(ssnClean, ' ', 9)
    const surname = rpad((emp.surname || '').trim(), ' ', 20)
    const firstname = rpad((emp.firstname || '').trim(), ' ', 15)

    const wages = [...(emp.wages || []), '', '', '', '', ''].slice(0, 5)
    const wagesFmt = wages.map(formatMoneyCellAsCentsString)

    const eeFmt = formatRoundedContribution(emp.eeContribution || 0)
    const erFmt = formatRoundedContribution(erValue)

    const wks = emp.weeksWorked
    const wksStr = (wks == null || wks === '') ? ' ' : String(wks)

    out.push(
      regno + contYear + contMonth + sched + ssn + surname + firstname +
      periods.join('') + wagesFmt.join('') + eeFmt + erFmt + wksStr
    )
  }
  return out
}

export function generateFileBytes(lines) {
  return toCP1252Bytes(lines.join('\n'))
}

// ── NIS CSV round-trip ────────────────────────────────────────────────────────

const NIS_CSV_HEADERS = [
  'Over_60', 'SSN', 'Surname', 'First_Name',
  'Wages_1', 'Wages_2', 'Wages_3', 'Wages_4', 'Wages_5', 'Weeks_Worked',
]

function csvField(v) {
  const s = String(v == null ? '' : v)
  return '"' + s.replace(/"/g, '""') + '"'
}
function csvRow(fields) { return fields.map(csvField).join(',') }

export function generateNisCsv(employerName, regNoRaw, contributionYear, contributionMonthName, scheduleType, employees) {
  const rows = [csvRow(NIS_CSV_HEADERS)]
  for (const emp of employees) {
    rows.push(csvRow([
      emp.over60 || 'No',
      emp.ssn || '',
      emp.surname || '',
      emp.firstname || '',
      ...(emp.wages || ['', '', '', '', '']).slice(0, 5).map(w => w ?? ''),
      emp.weeksWorked || '',
    ]))
  }
  // metadata sentinel row — Over_60 = '__meta__'
  rows.push(csvRow([
    '__meta__',
    employerName || '',
    regNoRaw || '',
    String(contributionYear || ''),
    contributionMonthName || '',
    scheduleType || 'Monthly',
    '', '', '', '',
  ]))
  return rows.join('\n')
}

export function parseNisCsv(text) {
  const lines = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n').filter(l => l.trim())
  if (lines.length < 2) return null

  function parseLine(line) {
    const fields = []
    let i = 0
    while (i <= line.length) {
      if (i >= line.length) { fields.push(''); break }
      if (line[i] === '"') {
        let val = ''
        i++
        while (i < line.length) {
          if (line[i] === '"' && line[i + 1] === '"') { val += '"'; i += 2 }
          else if (line[i] === '"') { i++; break }
          else { val += line[i++] }
        }
        fields.push(val)
        if (line[i] === ',') i++
      } else {
        const end = line.indexOf(',', i)
        if (end === -1) { fields.push(line.slice(i)); break }
        fields.push(line.slice(i, end))
        i = end + 1
      }
    }
    return fields
  }

  const header = parseLine(lines[0])
  const colIdx = {}
  header.forEach((h, i) => { colIdx[h.trim()] = i })
  const get = (f, name, fallback = '') => { const i = colIdx[name]; return i != null ? (f[i] ?? fallback) : fallback }

  let dataLines = lines.slice(1)
  let scheduleInfo = null

  const lastFields = parseLine(dataLines[dataLines.length - 1])
  if (get(lastFields, 'Over_60') === '__meta__') {
    scheduleInfo = {
      employerName: get(lastFields, 'SSN'),
      regNoRaw: get(lastFields, 'Surname'),
      contributionYear: get(lastFields, 'First_Name'),
      contributionMonthName: get(lastFields, 'Wages_1'),
      scheduleType: get(lastFields, 'Wages_2') || 'Monthly',
    }
    dataLines = dataLines.slice(0, -1)
  }

  const employees = dataLines
    .map(parseLine)
    .filter(f => f.some(v => v.trim()))
    .map(f => ({
      over60: get(f, 'Over_60') || 'No',
      ssn: get(f, 'SSN'),
      surname: get(f, 'Surname'),
      firstname: get(f, 'First_Name'),
      wages: [
        get(f, 'Wages_1'),
        get(f, 'Wages_2'),
        get(f, 'Wages_3'),
        get(f, 'Wages_4'),
        get(f, 'Wages_5'),
      ],
      weeksWorked: get(f, 'Weeks_Worked'),
    }))

  return { scheduleInfo, employees }
}
