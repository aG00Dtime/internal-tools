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
    if (s.includes(',') || s.includes('"') || s.includes('\n')) {
      return '"' + s.replace(/"/g, '""') + '"'
    }
    return s
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
    ? `'${String(period).padStart(2, '0')}/${year}`
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
