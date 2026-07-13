function parseCsvLine(line) {
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

export function parsePayeCsv(text) {
  const lines = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n').filter(l => l.trim())
  if (lines.length < 2) return null

  const header = parseCsvLine(lines[0])
  const colIdx = {}
  header.forEach((h, i) => { colIdx[h.trim()] = i })
  const get = (f, name, fallback = '') => { const i = colIdx[name]; return i != null ? (f[i] || fallback) : fallback }

  let dataLines = lines.slice(1)
  let companyInfo = null

  // Detect our own summary row: col 1 (Employee_Number) empty, col 3 (Last_Name) empty, col 7 is a count
  const lastFields = parseCsvLine(dataLines[dataLines.length - 1])
  if (!lastFields[colIdx['Employee_Number'] ?? 1] && !lastFields[colIdx['Last_Name'] ?? 3] && /^\d+$/.test(lastFields[colIdx['Period_Employed'] ?? 7])) {
    const dateStr = (lastFields[colIdx['Other_Names'] ?? 4] || '').replace(/^'/, '')
    const m = dateStr.match(/^(\d{1,2})\/(\d{4})$/)
    companyInfo = {
      tin: get(lastFields, 'TIN'),
      name: get(lastFields, 'First_Name'),
      address: get(lastFields, 'Address'),
      year: m ? m[2] : (/^\d{4}$/.test(dateStr) ? dateStr : ''),
      period: m ? m[1] : '',
    }
    dataLines = dataLines.slice(0, -1)
  }

  const employees = dataLines
    .map(line => parseCsvLine(line))
    .filter(f => f.some(v => v.trim()))
    .map(f => ({
      tin: get(f, 'TIN'),
      employeeNumber: get(f, 'Employee_Number'),
      firstName: get(f, 'First_Name'),
      lastName: get(f, 'Last_Name'),
      otherNames: get(f, 'Other_Names'),
      address: get(f, 'Address'),
      payFrequency: get(f, 'Pay_Frequency') || 'Monthly',
      periodEmployed: get(f, 'Period_Employed'),
      employeeType: get(f, 'Employee_Type') || 'Full-Time',
      primarySecondary: get(f, 'Primary_Secondary_Job') || 'Primary',
      value7A: get(f, 'Value_7A_Salaries_Wages'),
      totalOvertime: get(f, 'Total_Overtime'),
      secondJobDeduction: get(f, 'Second_Job_Deduction'),
      overtimeDeduction: get(f, 'Overtime_Deduction'),
      value7B: get(f, 'Value_7B_Board_Lodge'),
      value7CTaxable: get(f, 'Value_7C_Other_Taxable_Allowances'),
      value7CNonTaxable: get(f, 'Value_7C_Other_Non_Taxable_Allowances'),
      personalAllowance: get(f, 'Personal_Allowance'),
      employeeNIS: get(f, 'Employee_NIS_Contribution'),
      medicalInsurance: get(f, 'Medical_Life_Insurance_Premiums_Deduction'),
      childrenDeduction: get(f, 'Children_Deduction'),
      taxDeducted: get(f, 'Tax_Deducted'),
      dateOfBirth: get(f, 'Date_Of_Birth'),
      bankName: get(f, 'Bank_Name'),
      bankAccountNo: get(f, 'Bank_Account_No'),
      bankRouting: get(f, 'Bank_Account_Routing_Sort_code'),
      bankTransit: get(f, 'Bank_Account_Transit_No'),
      childDeclarationNo: get(f, 'Child_Declaration_No'),
    }))

  return { companyInfo, employees }
}

const COLUMN_HEADERS = [
  'TIN', 'Employee_Number', 'First_Name', 'Last_Name', 'Other_Names',
  'Address', 'Pay_Frequency', 'Period_Employed', 'Employee_Type',
  'Primary_Secondary_Job', 'Value_7A_Salaries_Wages', 'Total_Overtime',
  'Second_Job_Deduction', 'Overtime_Deduction', 'Adjusted_7A_Salaries_Wages',
  'Value_7B_Board_Lodge', 'Value_7C_Other_Taxable_Allowances',
  'Value_7C_Other_Non_Taxable_Allowances', 'Total_Income', 'Personal_Allowance',
  'Employee_NIS_Contribution', 'Medical_Life_Insurance_Premiums_Deduction',
  'Children_Deduction', 'Total_Deductions', 'Tax_Deducted', 'Date_Of_Birth',
  'Bank_Name', 'Bank_Account_No', 'Bank_Account_Routing_Sort_code',
  'Bank_Account_Transit_No', 'Child_Declaration_No',
]

function toInt(v) {
  if (v == null || v === '') return 0
  const n = parseInt(v, 10)
  return isNaN(n) ? 0 : n
}

function csvRow(fields) {
  return fields.map(f => {
    const s = String(f == null ? '' : f)
    return '"' + s.replace(/"/g, '""') + '"'
  }).join(',')
}

export function buildFilename(companyName, year, period) {
  const safe = (companyName || 'PAYE').replace(/ /g, '_').replace(/^_+|_+$/g, '') || 'PAYE'
  if (period && year) return `${safe}_${String(period).padStart(2, '0')}_${year}.csv`
  return year ? `${safe}_${year}.csv` : `${safe}.csv`
}

export function generateCsv(companyName, companyTin, companyAddress, year, period, employees) {
  const rows = [csvRow(COLUMN_HEADERS)]
  const tot = { v7a:0, ot:0, sjd:0, otd:0, adj7a:0, v7b:0, v7ct:0, v7cn:0, income:0, pa:0, nis:0, medical:0, children:0, deductions:0, tax:0 }

  for (const emp of employees) {
    const v7a = toInt(emp.value7A)
    const ot = toInt(emp.totalOvertime)
    const sjd = toInt(emp.secondJobDeduction)
    const otd = toInt(emp.overtimeDeduction)
    const adj7a = v7a + ot - sjd - otd
    const v7b = toInt(emp.value7B)
    const v7ct = toInt(emp.value7CTaxable)
    const v7cn = toInt(emp.value7CNonTaxable)
    const income = adj7a + v7b + v7ct + v7cn
    const pa = toInt(emp.personalAllowance)
    const nis = toInt(emp.employeeNIS)
    const medical = toInt(emp.medicalInsurance)
    const children = toInt(emp.childrenDeduction)
    const deductions = pa + nis + medical + children
    const tax = toInt(emp.taxDeducted)

    rows.push(csvRow([
      emp.tin || '', emp.employeeNumber || '', emp.firstName || '', emp.lastName || '',
      emp.otherNames || '', emp.address || '', emp.payFrequency || '',
      emp.periodEmployed || '', emp.employeeType || '', emp.primarySecondary || '',
      v7a, ot, sjd, otd, adj7a, v7b, v7ct, v7cn, income,
      pa, nis, medical, children, deductions, tax,
      emp.dateOfBirth || '', emp.bankName || '', emp.bankAccountNo || '',
      emp.bankRouting || '', emp.bankTransit || '', emp.childDeclarationNo || '',
    ]))

    tot.v7a += v7a; tot.ot += ot; tot.sjd += sjd; tot.otd += otd; tot.adj7a += adj7a
    tot.v7b += v7b; tot.v7ct += v7ct; tot.v7cn += v7cn; tot.income += income
    tot.pa += pa; tot.nis += nis; tot.medical += medical; tot.children += children
    tot.deductions += deductions; tot.tax += tax
  }

  const submissionDate = period && year
    ? `${String(period).padStart(2, '0')}/${year}`
    : (year ? String(year) : '')

  rows.push(csvRow([
    companyTin, '', companyName, '', submissionDate, companyAddress,
    '', employees.length, '', '',
    tot.v7a, tot.ot, tot.sjd, tot.otd, tot.adj7a,
    tot.v7b, tot.v7ct, tot.v7cn, tot.income,
    tot.pa, tot.nis, tot.medical, tot.children, tot.deductions, tot.tax,
    '', '', '', '', '', '',
  ]))

  return rows.join('\n')
}
