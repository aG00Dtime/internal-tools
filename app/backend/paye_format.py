from __future__ import annotations

import csv
import io
from dataclasses import dataclass


COLUMN_HEADERS = [
    "TIN", "Employee_Number", "First_Name", "Last_Name", "Other_Names",
    "Address", "Pay_Frequency", "Period_Employed", "Employee_Type",
    "Primary_Secondary_Job", "Value_7A_Salaries_Wages", "Total_Overtime",
    "Second_Job_Deduction", "Overtime_Deduction", "Adjusted_7A_Salaries_Wages",
    "Value_7B_Board_Lodge", "Value_7C_Other_Taxable_Allowances",
    "Value_7C_Other_Non_Taxable_Allowances", "Total_Income", "Personal_Allowance",
    "Employee_NIS_Contribution", "Medical_Life_Insurance_Premiums_Deduction",
    "Children_Deduction", "Total_Deductions", "Tax_Deducted", "Date_Of_Birth",
    "Bank_Name", "Bank_Account_No", "Bank_Account_Routing_Sort_code",
    "Bank_Account_Transit_No", "Child_Declaration_No",
]


def _int(v) -> int:
    if v is None or v == "":
        return 0
    try:
        return int(float(str(v)))
    except (ValueError, TypeError):
        return 0


def generate_csv(
    company_name: str,
    company_tin: str,
    company_address: str,
    year: str,
    period: str,
    employees: list[dict],
) -> str:
    buf = io.StringIO()
    writer = csv.writer(buf, lineterminator="\n")

    writer.writerow(COLUMN_HEADERS)

    tot: dict[str, int] = {k: 0 for k in [
        "v7a", "ot", "sjd", "otd", "adj7a", "v7b", "v7ct", "v7cn",
        "income", "pa", "nis", "medical", "children", "deductions", "tax",
    ]}

    for emp in employees:
        v7a = _int(emp.get("value7A"))
        ot = _int(emp.get("totalOvertime"))
        sjd = _int(emp.get("secondJobDeduction"))
        otd = _int(emp.get("overtimeDeduction"))
        adj7a = v7a + ot - sjd - otd

        v7b = _int(emp.get("value7B"))
        v7ct = _int(emp.get("value7CTaxable"))
        v7cn = _int(emp.get("value7CNonTaxable"))
        income = adj7a + v7b + v7ct + v7cn

        pa = _int(emp.get("personalAllowance"))
        nis = _int(emp.get("employeeNIS"))
        medical = _int(emp.get("medicalInsurance"))
        children = _int(emp.get("childrenDeduction"))
        deductions = pa + nis + medical + children

        tax = _int(emp.get("taxDeducted"))

        writer.writerow([
            emp.get("tin", ""),
            emp.get("employeeNumber", ""),
            emp.get("firstName", ""),
            emp.get("lastName", ""),
            emp.get("otherNames", ""),
            emp.get("address", ""),
            emp.get("payFrequency", ""),
            emp.get("periodEmployed", ""),
            emp.get("employeeType", ""),
            emp.get("primarySecondary", ""),
            v7a, ot, sjd, otd, adj7a,
            v7b, v7ct, v7cn,
            income, pa, nis, medical, children,
            deductions, tax,
            emp.get("dateOfBirth", ""),
            emp.get("bankName", ""),
            emp.get("bankAccountNo", ""),
            emp.get("bankRouting", ""),
            emp.get("bankTransit", ""),
            emp.get("childDeclarationNo", ""),
        ])

        tot["v7a"] += v7a
        tot["ot"] += ot
        tot["sjd"] += sjd
        tot["otd"] += otd
        tot["adj7a"] += adj7a
        tot["v7b"] += v7b
        tot["v7ct"] += v7ct
        tot["v7cn"] += v7cn
        tot["income"] += income
        tot["pa"] += pa
        tot["nis"] += nis
        tot["medical"] += medical
        tot["children"] += children
        tot["deductions"] += deductions
        tot["tax"] += tax

    # Summary row — mirrors VBA column placement
    # A=TIN, B=empty, C=name, D=empty, E=submissionDate, F=address,
    # G=empty, H=numEntries, I–J=empty,
    # K=v7a, L=ot, M=sjd, N=otd, O=adj7a, P=v7b, Q=v7ct, R=v7cn,
    # S=income, T=pa, U=nis, V=medical, W=children, X=deductions, Y=tax, Z–AE=empty
    if period and year:
        submission_date = f"'{period.zfill(2)}/{year}"
    else:
        submission_date = str(year) if year else ""

    writer.writerow([
        company_tin, "", company_name, "", submission_date, company_address,
        "", len(employees), "", "",
        tot["v7a"], tot["ot"], tot["sjd"], tot["otd"], tot["adj7a"],
        tot["v7b"], tot["v7ct"], tot["v7cn"],
        tot["income"], tot["pa"], tot["nis"], tot["medical"], tot["children"],
        tot["deductions"], tot["tax"],
        "", "", "", "", "", "",
    ])

    return buf.getvalue()


def build_filename(company_name: str, year: str, period: str) -> str:
    safe = (company_name or "PAYE").replace(" ", "_").strip("_") or "PAYE"
    if period and year:
        return f"{safe}_{period.zfill(2)}_{year}.csv"
    return f"{safe}_{year}.csv" if year else f"{safe}.csv"
