import csv
import json
import os
import openpyxl
from openpyxl.styles import Font, PatternFill, Alignment, Border, Side
from openpyxl.utils import get_column_letter

output_dir = os.path.dirname(os.path.abspath(__file__))
excel_path = os.path.join(output_dir, "BOA_APID_Organization_Simulation.xlsx")
csv_path = os.path.join(output_dir, "AD_Import.csv")
ps_path = os.path.join(output_dir, "Provision-APID-TestUsers.ps1")
readme_path = os.path.join(output_dir, "README.md")

# ─────────────────────────────────────────────────────────────
# 1. ORG STRUCTURE DEFINITIONS
# ─────────────────────────────────────────────────────────────
DISTRICTS = [
    {"code": "DIS-CEN", "name": "Central District", "hub": "Addis Ababa", "director_title": "Director Central District"},
    {"code": "DIS-ADA", "name": "Adama District", "hub": "Adama / Oromia", "director_title": "Director Adama District"},
    {"code": "DIS-BDR", "name": "Bahir Dar District", "hub": "Bahir Dar / Amhara", "director_title": "Director Bahir Dar District"},
    {"code": "DIS-HAW", "name": "Hawassa District", "hub": "Hawassa / Sidama", "director_title": "Director Hawassa District"},
    {"code": "DIS-DIR", "name": "Dire Dawa District", "hub": "Dire Dawa City", "director_title": "Director Dire Dawa District"},
]

BRANCHES_MAP = {
    "Central District": ["Addis Kazanchis", "Addis Ketema", "Arada", "Africa Avenue"],
    "Adama District": ["Adama Bole", "Adama Boset", "Adama Main", "Adama Moenco"],
    "Bahir Dar District": ["Abay Mado", "Abocabot", "Abune Hara", "Bahir Dar"],
    "Hawassa District": ["Alamura", "Alito Hewano", "Hawassa Arab Sefer", "Awasho"],
    "Dire Dawa District": ["Dilchora", "Dire Airport", "Dire Dawa", "Sabian"],
}

# ─────────────────────────────────────────────────────────────
# 2. GENERATE 150 SYNTHETIC EMPLOYEES
# ─────────────────────────────────────────────────────────────
employees = []
emp_id_counter = 1

def make_emp(emp_num_int, parent_dept, dept, job, position, mgr_num_int):
    global emp_id_counter
    num_str = f"{emp_num_int:08d}"
    mgr_str = f"{mgr_num_int:08d}" if mgr_num_int else ""
    name_str = f"TEST EMPLOYEE {emp_num_int:03d}"
    email_str = f"test.employee{emp_num_int:03d}@apid.test"
    sam_str = f"test.emp{emp_num_int:03d}"
    emp = {
        "EmployeeNumber": num_str,
        "FullName": name_str,
        "Email": email_str,
        "Gender": "",  # Deliberately left blank
        "ParentDepartment": parent_dept,
        "Department": dept,
        "Job": job,
        "Position": position,
        "ManagerEmployeeNumber": mgr_str,
        # AD specific fields
        "SamAccountName": sam_str,
        "GivenName": "Test",
        "Surname": f"Employee{emp_num_int:03d}",
        "UserPrincipalName": f"{sam_str}@apid.test",
        "Title": position,
        "Company": "Bank of Abyssinia",
        "TargetOU": "",
        "ManagerSamAccountName": f"test.emp{mgr_num_int:03d}" if mgr_num_int else "",
    }
    return emp

# A. Head Office (25 employees: 00010001 - 00010025)
ho_roles = [
    # C-Level
    (1, "Executive Office", "Office of the Chief Executive", "Executive Leadership", "Chief Executive Officer", None, "OU=Executive,OU=HeadOffice,OU=APID,DC=apid,DC=test"),
    (2, "Executive Office", "Corporate Strategy & Governance", "Executive Leadership", "Chief Strategy Officer", 1, "OU=Executive,OU=HeadOffice,OU=APID,DC=apid,DC=test"),
    (3, "Retail & Branch Banking", "Retail Banking Directorate", "Retail Executive", "VP Retail & Branch Banking", 1, "OU=Retail,OU=HeadOffice,OU=APID,DC=apid,DC=test"),
    (4, "Technology & Digital Banking", "Information Technology Directorate", "Technology Executive", "Chief Information Officer", 1, "OU=Technology,OU=HeadOffice,OU=APID,DC=apid,DC=test"),
    (5, "Credit & Risk Management", "Risk Management Directorate", "Risk Executive", "Chief Risk Officer", 1, "OU=Risk,OU=HeadOffice,OU=APID,DC=apid,DC=test"),
    (6, "Operations & Treasury", "Operations Directorate", "Operations Executive", "Chief Operating Officer", 1, "OU=Operations,OU=HeadOffice,OU=APID,DC=apid,DC=test"),
    (7, "HR & Corporate Services", "Human Resources Directorate", "HR Executive", "Chief Human Resources Officer", 1, "OU=HumanResources,OU=HeadOffice,OU=APID,DC=apid,DC=test"),
    
    # Tech (8-13)
    (8, "Technology & Digital Banking", "Application Development & API", "Software Engineering", "Engineering Manager", 4, "OU=Technology,OU=HeadOffice,OU=APID,DC=apid,DC=test"),
    (9, "Technology & Digital Banking", "Application Development & API", "Architecture", "Lead Systems Architect", 8, "OU=Technology,OU=HeadOffice,OU=APID,DC=apid,DC=test"),
    (10, "Technology & Digital Banking", "Application Development & API", "Software Engineering", "Senior Software Developer", 8, "OU=Technology,OU=HeadOffice,OU=APID,DC=apid,DC=test"),
    (11, "Technology & Digital Banking", "Application Development & API", "DevOps & Cloud", "DevOps Engineer", 8, "OU=Technology,OU=HeadOffice,OU=APID,DC=apid,DC=test"),
    (12, "Technology & Digital Banking", "Application Development & API", "Database Administration", "Lead Database Administrator", 8, "OU=Technology,OU=HeadOffice,OU=APID,DC=apid,DC=test"),
    (13, "Technology & Digital Banking", "Information Security Directorate", "Cybersecurity", "Senior Cybersecurity Analyst", 4, "OU=Technology,OU=HeadOffice,OU=APID,DC=apid,DC=test"),
    
    # HR (14-17)
    (14, "HR & Corporate Services", "Human Resources Directorate", "Human Resources", "HR Operations Manager", 7, "OU=HumanResources,OU=HeadOffice,OU=APID,DC=apid,DC=test"),
    (15, "HR & Corporate Services", "Human Resources Directorate", "Talent Management", "Talent Development Specialist", 14, "OU=HumanResources,OU=HeadOffice,OU=APID,DC=apid,DC=test"),
    (16, "HR & Corporate Services", "Human Resources Directorate", "Performance Management", "PMS Administration Officer", 14, "OU=HumanResources,OU=HeadOffice,OU=APID,DC=apid,DC=test"),
    (17, "HR & Corporate Services", "Human Resources Directorate", "Learning & Development", "Mentoring Program Coordinator", 14, "OU=HumanResources,OU=HeadOffice,OU=APID,DC=apid,DC=test"),
    
    # Risk & Credit (18-21)
    (18, "Credit & Risk Management", "Credit Appraisal Directorate", "Corporate Credit", "Corporate Credit Manager", 5, "OU=Risk,OU=HeadOffice,OU=APID,DC=apid,DC=test"),
    (19, "Credit & Risk Management", "Credit Appraisal Directorate", "Credit Analysis", "Senior Credit Analyst", 18, "OU=Risk,OU=HeadOffice,OU=APID,DC=apid,DC=test"),
    (20, "Credit & Risk Management", "Compliance Directorate", "Regulatory Compliance", "Regulatory Compliance Manager", 5, "OU=Risk,OU=HeadOffice,OU=APID,DC=apid,DC=test"),
    (21, "Credit & Risk Management", "Compliance Directorate", "AML Compliance", "AML Screening Specialist", 20, "OU=Risk,OU=HeadOffice,OU=APID,DC=apid,DC=test"),
    
    # Operations & Treasury (22-24)
    (22, "Operations & Treasury", "Treasury & International Banking", "Treasury Operations", "Treasury Operations Manager", 6, "OU=Operations,OU=HeadOffice,OU=APID,DC=apid,DC=test"),
    (23, "Operations & Treasury", "Treasury & International Banking", "FX Management", "FX Settlements Specialist", 22, "OU=Operations,OU=HeadOffice,OU=APID,DC=apid,DC=test"),
    (24, "Operations & Treasury", "Central Operations Directorate", "Clearing Operations", "Central Clearing Officer", 22, "OU=Operations,OU=HeadOffice,OU=APID,DC=apid,DC=test"),
    
    # Retail Head Office Director (25)
    (25, "Retail & Branch Banking", "Retail Banking Directorate", "Branch Network", "Director Branch Network & Support", 3, "OU=Retail,OU=HeadOffice,OU=APID,DC=apid,DC=test")
]

for idx, p_dept, dept, job, pos, mgr, ou in ho_roles:
    e = make_emp(idx, p_dept, dept, job, pos, mgr)
    e["TargetOU"] = ou
    employees.append(e)

# B. District Directors (5 employees: 00010026 - 00010030)
# Reporting to VP Retail & Branch Banking (00010003)
district_directors = [
    (26, "Retail & Branch Banking", "Central District Office", "District Management", "Director Central District", 3, "Central District"),
    (27, "Retail & Branch Banking", "Adama District Office", "District Management", "Director Adama District", 3, "Adama District"),
    (28, "Retail & Branch Banking", "Bahir Dar District Office", "District Management", "Director Bahir Dar District", 3, "Bahir Dar District"),
    (29, "Retail & Branch Banking", "Hawassa District Office", "District Management", "Director Hawassa District", 3, "Hawassa District"),
    (30, "Retail & Branch Banking", "Dire Dawa District Office", "District Management", "Director Dire Dawa District", 3, "Dire Dawa District"),
]

district_dir_map = {}
for idx, p_dept, dept, job, pos, mgr, d_name in district_directors:
    e = make_emp(idx, p_dept, dept, job, pos, mgr)
    safe_d_name = d_name.replace(" ", "")
    e["TargetOU"] = f"OU=DistrictDirectors,OU={safe_d_name},OU=Districts,OU=APID,DC=apid,DC=test"
    employees.append(e)
    district_dir_map[d_name] = idx

# C. Branch Managers (20 employees: 00010031 - 00010050)
# Reporting to respective District Director
bm_start = 31
branch_manager_map = {}
all_branches_flat = []

for d_name, branch_list in BRANCHES_MAP.items():
    d_mgr_id = district_dir_map[d_name]
    safe_d_name = d_name.replace(" ", "")
    for b_name in branch_list:
        bm_emp_num = bm_start
        dept_str = f"{b_name} Branch Operations"
        pos_str = "Branch Manager"
        job_str = "Branch Management"
        e = make_emp(bm_emp_num, "Retail & Branch Banking", dept_str, job_str, pos_str, d_mgr_id)
        safe_b_name = b_name.replace(" ", "")
        e["TargetOU"] = f"OU=Management,OU={safe_b_name},OU={safe_d_name},OU=Branches,OU=APID,DC=apid,DC=test"
        employees.append(e)
        branch_manager_map[b_name] = bm_emp_num
        all_branches_flat.append({"district": d_name, "branch": b_name, "bm_id": bm_emp_num})
        bm_start += 1

# D. Branch Staff (100 employees: 5 per branch, 00010051 - 00010150)
staff_roles = [
    ("Branch Banking Officer", "Senior Customer Service Officer"),
    ("Branch Banking Officer", "Personal Banker"),
    ("Branch Banking Officer", "Cash Teller Officer"),
    ("Branch Banking Officer", "Customer Service Officer"),
    ("Branch Operations & Control", "Branch Compliance & Operations Officer"),
]

staff_start = 51
for b_info in all_branches_flat:
    b_name = b_info["branch"]
    d_name = b_info["district"]
    bm_id = b_info["bm_id"]
    safe_d_name = d_name.replace(" ", "")
    safe_b_name = b_name.replace(" ", "")
    dept_str = f"{b_name} Branch Operations"
    
    for job_str, pos_str in staff_roles:
        e = make_emp(staff_start, "Retail & Branch Banking", dept_str, job_str, pos_str, bm_id)
        e["TargetOU"] = f"OU=Staff,OU={safe_b_name},OU={safe_d_name},OU=Branches,OU=APID,DC=apid,DC=test"
        employees.append(e)
        staff_start += 1

assert len(employees) == 150, f"Expected 150 employees, got {len(employees)}"

# ─────────────────────────────────────────────────────────────
# 3. GENERATE AD_Import.csv
# ─────────────────────────────────────────────────────────────
csv_fields = [
    "SamAccountName",
    "UserPrincipalName",
    "DisplayName",
    "GivenName",
    "Surname",
    "EmailAddress",
    "EmployeeID",
    "Title",
    "Department",
    "Company",
    "ManagerSamAccountName",
    "TargetOU"
]

with open(csv_path, mode="w", newline="", encoding="utf-8") as f:
    writer = csv.DictWriter(f, fieldnames=csv_fields)
    writer.writeheader()
    for e in employees:
        writer.writerow({
            "SamAccountName": e["SamAccountName"],
            "UserPrincipalName": e["UserPrincipalName"],
            "DisplayName": e["FullName"],
            "GivenName": e["GivenName"],
            "Surname": e["Surname"],
            "EmailAddress": e["Email"],
            "EmployeeID": e["EmployeeNumber"],
            "Title": e["Title"],
            "Department": e["Department"],
            "Company": e["Company"],
            "ManagerSamAccountName": e["ManagerSamAccountName"],
            "TargetOU": e["TargetOU"]
        })

print(f"Generated AD_Import.csv with {len(employees)} accounts.")

# ─────────────────────────────────────────────────────────────
# 4. GENERATE BOA_APID_Organization_Simulation.xlsx
# ─────────────────────────────────────────────────────────────
wb = openpyxl.Workbook()
# Remove default sheet
wb.remove(wb.active)

# Color tokens
HEADER_FILL = PatternFill(start_color="162038", end_color="162038", fill_type="solid")
HEADER_FONT = Font(name="Calibri", size=11, bold=True, color="FFFFFF")
GOLD_FONT = Font(name="Calibri", size=11, bold=True, color="C97A00")
TITLE_FONT = Font(name="Calibri", size=16, bold=True, color="0F172A")
SUBTITLE_FONT = Font(name="Calibri", size=11, italic=True, color="475569")
BOLD_FONT = Font(name="Calibri", size=11, bold=True)
REG_FONT = Font(name="Calibri", size=11)
BORDER_THIN = Border(
    left=Side(style="thin", color="E2E8F0"),
    right=Side(style="thin", color="E2E8F0"),
    top=Side(style="thin", color="E2E8F0"),
    bottom=Side(style="thin", color="E2E8F0")
)

def style_table(ws, start_row, headers, rows):
    # Header row
    for col_idx, h in enumerate(headers, 1):
        cell = ws.cell(row=start_row, column=col_idx, value=h)
        cell.fill = HEADER_FILL
        cell.font = HEADER_FONT
        cell.alignment = Alignment(horizontal="left", vertical="center")
        cell.border = BORDER_THIN
    # Data rows
    for r_idx, row_data in enumerate(rows, start_row + 1):
        for c_idx, val in enumerate(row_data, 1):
            cell = ws.cell(row=r_idx, column=c_idx, value=val)
            cell.font = REG_FONT
            cell.border = BORDER_THIN
            cell.alignment = Alignment(horizontal="left", vertical="center")

def autofit(ws):
    for col in ws.columns:
        max_len = 0
        col_letter = get_column_letter(col[0].column)
        for cell in col:
            val_str = str(cell.value or "")
            if len(val_str) > max_len:
                max_len = len(val_str)
        ws.column_dimensions[col_letter].width = max(max_len + 4, 12)

# SHEET 1: README
ws_readme = wb.create_sheet("README")
ws_readme.views.sheetView[0].showGridLines = True
ws_readme["A1"] = "Bank of Abyssinia — APID Organizational Simulation Package"
ws_readme["A1"].font = TITLE_FONT
ws_readme["A2"] = "Synthetic 150-Employee Test Organization for Active Directory & APID Coaching / Mentoring Simulation"
ws_readme["A2"].font = SUBTITLE_FONT

readme_content = [
    ("Simulation Scope:", "5 Districts • 20 Branches • 150 Employees • 100% Synthetic AD Accounts"),
    ("Target AD Domain:", "apid.test (Windows Server 2022 AD DS)"),
    ("Identity Policy:", "Strictly synthetic accounts (TEST EMPLOYEE 001 - 150). No real employee identities or emails."),
    ("Schema Consistency:", "Sheet 'Employees_Directory' matches the original 9-column format from BOA_Sample_12Employees_Directory.xlsx."),
    ("Hierarchy Structure:", "CEO (00010001) → VP Retail (00010003) → 5 District Directors → 20 Branch Managers → 100 Branch Staff."),
    ("Head Office Cohort:", "25 staff across Executive Leadership, IT & API Engineering, HR & Talent, Risk/Credit, Treasury."),
    ("Branch Pacing:", "5 employees per branch (1 Branch Manager, 1 Senior CSO, 1 Personal Banker, 1 Cash Teller, 1 CSO, 1 Compliance)."),
    ("Included Files:", "Excel Workbook (this file), AD_Import.csv, Provision-APID-TestUsers.ps1, README.md.")
]
for idx, (label, desc) in enumerate(readme_content, 4):
    c1 = ws_readme.cell(row=idx, column=1, value=label)
    c1.font = BOLD_FONT
    c2 = ws_readme.cell(row=idx, column=2, value=desc)
    c2.font = REG_FONT

autofit(ws_readme)

# SHEET 2: Districts
ws_dist = wb.create_sheet("Districts")
dist_headers = ["DistrictCode", "DistrictName", "RegionalHub", "DirectorEmployeeNumber", "DirectorTitle", "BranchCount"]
dist_rows = [
    ["DIS-CEN", "Central District", "Addis Ababa", "00010026", "Director Central District", 4],
    ["DIS-ADA", "Adama District", "Adama / Oromia", "00010027", "Director Adama District", 4],
    ["DIS-BDR", "Bahir Dar District", "Bahir Dar / Amhara", "00010028", "Director Bahir Dar District", 4],
    ["DIS-HAW", "Hawassa District", "Hawassa / Sidama", "00010029", "Director Hawassa District", 4],
    ["DIS-DIR", "Dire Dawa District", "Dire Dawa City", "00010030", "Director Dire Dawa District", 4],
]
style_table(ws_dist, 1, dist_headers, dist_rows)
autofit(ws_dist)

# SHEET 3: Branches
ws_branch = wb.create_sheet("Branches")
branch_headers = ["BranchCode", "BranchName", "DistrictName", "CityLocation", "BranchManagerEmployeeNumber", "StaffCount"]
branch_rows = []
b_idx = 1
for d_name, b_list in BRANCHES_MAP.items():
    for b_name in b_list:
        bm_id = f"{branch_manager_map[b_name]:08d}"
        b_code = f"BR-{b_idx:03d}"
        branch_rows.append([b_code, b_name, d_name, d_name.split()[0], bm_id, 6])
        b_idx += 1
style_table(ws_branch, 1, branch_headers, branch_rows)
autofit(ws_branch)

# SHEET 4: Employees_Directory (EXACT 9 COLUMNS)
ws_emp = wb.create_sheet("Employees_Directory")
emp_headers = [
    "EmployeeNumber",
    "FullName",
    "Email",
    "Gender",
    "ParentDepartment",
    "Department",
    "Job",
    "Position",
    "ManagerEmployeeNumber"
]
emp_rows = [
    [
        e["EmployeeNumber"],
        e["FullName"],
        e["Email"],
        e["Gender"],
        e["ParentDepartment"],
        e["Department"],
        e["Job"],
        e["Position"],
        e["ManagerEmployeeNumber"]
    ]
    for e in employees
]
style_table(ws_emp, 1, emp_headers, emp_rows)
autofit(ws_emp)

# SHEET 5: Reporting_Relationships
ws_rel = wb.create_sheet("Reporting_Relationships")
rel_headers = ["ManagerEmployeeNumber", "ManagerFullName", "ManagerTitle", "DirectReportsCount", "ReportingTier", "FunctionalOversight"]
mgr_tally = {}
for e in employees:
    mgr_num = e["ManagerEmployeeNumber"]
    if mgr_num:
        mgr_tally[mgr_num] = mgr_tally.get(mgr_num, 0) + 1

emp_lookup = {e["EmployeeNumber"]: e for e in employees}
rel_rows = []
for mgr_num, count in sorted(mgr_tally.items()):
    mgr = emp_lookup.get(mgr_num, {})
    tier = "C-Suite / Executive" if mgr_num == "00010001" else ("Director / VP Level" if int(mgr_num) <= 30 else "Branch Management")
    rel_rows.append([
        mgr_num,
        mgr.get("FullName", ""),
        mgr.get("Position", ""),
        count,
        tier,
        f"Manages operations and coaching quota for {count} direct subordinates"
    ])
style_table(ws_rel, 1, rel_headers, rel_rows)
autofit(ws_rel)

# SHEET 6: AD_Import
ws_ad = wb.create_sheet("AD_Import")
ad_headers = [
    "SamAccountName",
    "UserPrincipalName",
    "DisplayName",
    "GivenName",
    "Surname",
    "EmailAddress",
    "EmployeeID",
    "Title",
    "Department",
    "Company",
    "ManagerSamAccountName",
    "TargetOU"
]
ad_rows = [
    [
        e["SamAccountName"],
        e["UserPrincipalName"],
        e["FullName"],
        e["GivenName"],
        e["Surname"],
        e["Email"],
        e["EmployeeNumber"],
        e["Title"],
        e["Department"],
        e["Company"],
        e["ManagerSamAccountName"],
        e["TargetOU"]
    ]
    for e in employees
]
style_table(ws_ad, 1, ad_headers, ad_rows)
autofit(ws_ad)

# SHEET 7: AD_Group_Membership
ws_grp = wb.create_sheet("AD_Group_Membership")
grp_headers = ["GroupName", "GroupScope", "GroupCategory", "Description", "MemberCount", "SampleMembers"]
grp_rows = [
    ["SG-All-Employees", "Global", "Security", "All Bank of Abyssinia simulated test employees", 150, "test.emp001 through test.emp150"],
    ["SG-HeadOffice", "Global", "Security", "Head Office executive, IT, HR, risk, operations staff", 25, "test.emp001 - test.emp025"],
    ["SG-DistrictDirectors", "Global", "Security", "Regional district leadership overseeing branch clusters", 5, "test.emp026 - test.emp030"],
    ["SG-BranchManagers", "Global", "Security", "Designated branch managers acting as PMS coaches", 20, "test.emp031 - test.emp050"],
    ["SG-BranchStaff", "Global", "Security", "Branch frontline tellers, personal bankers, CSOs", 100, "test.emp051 - test.emp150"],
    ["SG-APID-Coaches", "Global", "Security", "Designated coaches authorized to schedule 1-on-1 and joint remediation", 25, "test.emp026 - test.emp050"],
    ["SG-APID-Mentors", "Global", "Security", "Qualified internal trainers and mentors for skill development cohorts", 30, "test.emp008 - test.emp037"],
    ["SG-APID-PmsAdmins", "Global", "Security", "PMS Administrators managing appraisals, referrals, and policies", 4, "test.emp001, test.emp007, test.emp014, test.emp016"],
]
style_table(ws_grp, 1, grp_headers, grp_rows)
autofit(ws_grp)

# SHEET 8: Position_Catalog
ws_pos = wb.create_sheet("Position_Catalog")
pos_headers = ["PositionTitle", "JobFamily", "OrgTier", "StandardHeadcount", "ValidationStatus"]
pos_rows = [
    ["Chief Executive Officer", "Executive Leadership", "Executive", 1, "Verified Standard Executive Title"],
    ["Chief Strategy Officer", "Executive Leadership", "Executive", 1, "Verified Standard Executive Title"],
    ["VP Retail & Branch Banking", "Retail Banking", "Executive", 1, "Verified Standard Executive Title"],
    ["Chief Information Officer", "Technology", "Executive", 1, "Verified Standard Executive Title"],
    ["Chief Risk Officer", "Risk & Credit", "Executive", 1, "Verified Standard Executive Title"],
    ["Chief Operating Officer", "Operations", "Executive", 1, "Verified Standard Executive Title"],
    ["Chief Human Resources Officer", "Human Resources", "Executive", 1, "Verified Standard Executive Title"],
    ["Director Central District", "Retail District", "Director Level", 1, "Standard Regional Leadership"],
    ["Director Adama District", "Retail District", "Director Level", 1, "Standard Regional Leadership"],
    ["Director Bahir Dar District", "Retail District", "Director Level", 1, "Standard Regional Leadership"],
    ["Director Hawassa District", "Retail District", "Director Level", 1, "Standard Regional Leadership"],
    ["Director Dire Dawa District", "Retail District", "Director Level", 1, "Standard Regional Leadership"],
    ["Branch Manager", "Branch Leadership", "Managerial", 20, "Standard BoA Branch Leadership"],
    ["Senior Customer Service Officer", "Branch Operations", "Professional", 20, "Verified Frontline Role"],
    ["Personal Banker", "Branch Retail", "Professional", 20, "Verified Frontline Role"],
    ["Cash Teller Officer", "Branch Cash Management", "Operational", 20, "Verified Frontline Role"],
    ["Customer Service Officer", "Branch Frontline", "Operational", 20, "Verified Frontline Role"],
    ["Branch Compliance & Operations Officer", "Branch Control", "Control & Audit", 20, "Verified Operational Control Role"],
    ["Engineering Manager", "Technology", "Managerial", 1, "Technical Team Lead"],
    ["Lead Systems Architect", "Technology", "Senior Specialist", 1, "Architecture Governance"],
    ["Senior Software Developer", "Technology", "Specialist", 1, "Core App Engineering"],
    ["DevOps Engineer", "Technology", "Specialist", 1, "Infrastructure & CI/CD"],
    ["Lead Database Administrator", "Technology", "Specialist", 1, "Data Persistence"],
    ["Senior Cybersecurity Analyst", "Information Security", "Specialist", 1, "Security & Compliance"],
    ["HR Operations Manager", "Human Resources", "Managerial", 1, "People Operations"],
    ["Talent Development Specialist", "Human Resources", "Specialist", 1, "Capacity Building"],
    ["PMS Administration Officer", "Human Resources", "Specialist", 1, "Performance Management"],
    ["Mentoring Program Coordinator", "Human Resources", "Specialist", 1, "Mentorship Operations"],
    ["Corporate Credit Manager", "Risk & Credit", "Managerial", 1, "Credit Underwriting"],
    ["Senior Credit Analyst", "Risk & Credit", "Specialist", 1, "Risk Assessment"],
    ["Regulatory Compliance Manager", "Risk & Credit", "Managerial", 1, "Banking Compliance"],
    ["AML Screening Specialist", "Risk & Credit", "Specialist", 1, "Anti-Money Laundering"],
    ["Treasury Operations Manager", "Operations & Treasury", "Managerial", 1, "Liquidity & Funds"],
    ["FX Settlements Specialist", "Operations & Treasury", "Specialist", 1, "FX Reconciliation"],
    ["Central Clearing Officer", "Operations & Treasury", "Specialist", 1, "National Switch Clearing"],
    ["Director Branch Network & Support", "Retail Banking", "Director Level", 1, "Branch Support Governance"]
]
style_table(ws_pos, 1, pos_headers, pos_rows)
autofit(ws_pos)

# SHEET 9: Sources_and_Assumptions
ws_assump = wb.create_sheet("Sources_and_Assumptions")
assump_headers = ["Category", "Item / Topic", "Verified Fact vs Simulation Assumption", "Details & Technical Notes"]
assump_rows = [
    ["Branch Names", "20 Selected Branches", "Verified BoA Annex Facts", "Branch names (Addis Kazanchis, Africa Avenue, Adama Main, Bahir Dar, Hawassa Arab Sefer, etc.) are authentic Bank of Abyssinia branch locations."],
    ["District Grouping", "5 Districts Mapping", "Simulation Assumption", "Geographic clusters (Central, Adama, Bahir Dar, Hawassa, Dire Dawa) simulate real regional administrative hubs for testing."],
    ["Employee Names", "150 Account Identities", "Synthetic Identity Rule", "Strictly synthetic names ('TEST EMPLOYEE 001' to '150') to guarantee compliance with data privacy. No real person identities used."],
    ["Email & Domain", "apid.test", "Simulation Domain", "All emails formatted as test.employeeXXX@apid.test to avoid mail spoofing or delivery against real bank servers."],
    ["Gender", "Gender Field", "Deliberately Blank", "Per design requirement, Gender is kept blank ('') across all records."],
    ["Manager Attributes", "Direct Reporting Lines", "AD Native Hierarchy", "Every employee's ManagerEmployeeNumber reflects their direct line supervisor (Staff → BM → District Director → VP Retail → CEO). Functional oversight remains separated."],
    ["Security Passwords", "Initial Provisioning", "Security Best Practice", "Script assigns a complex temporary password (e.g. Abyssinia@2026!) and enforces -ChangePasswordAtLogon $true."]
]
style_table(ws_assump, 1, assump_headers, assump_rows)
autofit(ws_assump)

# SHEET 10: Data_Dictionary
ws_dict = wb.create_sheet("Data_Dictionary")
dict_headers = ["FieldName", "SheetOrigin", "DataType", "Nullable", "Description", "ExampleValue"]
dict_rows = [
    ["EmployeeNumber", "Employees_Directory", "VARCHAR(8)", "No", "Unique 8-digit synthetic employee ID formatted with leading zeros", "00010001"],
    ["FullName", "Employees_Directory", "VARCHAR(100)", "No", "Standard synthetic display name", "TEST EMPLOYEE 001"],
    ["Email", "Employees_Directory", "VARCHAR(120)", "No", "Simulation corporate email address on @apid.test", "test.employee001@apid.test"],
    ["Gender", "Employees_Directory", "VARCHAR(10)", "Yes", "Gender designation (deliberately empty in test pack)", ""],
    ["ParentDepartment", "Employees_Directory", "VARCHAR(100)", "No", "Executive directorate or primary division", "Retail & Branch Banking"],
    ["Department", "Employees_Directory", "VARCHAR(100)", "No", "Branch operations unit or specific head office department", "Addis Kazanchis Branch Operations"],
    ["Job", "Employees_Directory", "VARCHAR(80)", "No", "Job family or functional classification", "Branch Management"],
    ["Position", "Employees_Directory", "VARCHAR(100)", "No", "Official job title", "Branch Manager"],
    ["ManagerEmployeeNumber", "Employees_Directory", "VARCHAR(8)", "Yes", "Employee number of the direct line supervisor", "00010026"],
    ["SamAccountName", "AD_Import", "VARCHAR(20)", "No", "Windows pre-Windows 2000 logon name", "test.emp001"],
    ["UserPrincipalName", "AD_Import", "VARCHAR(150)", "No", "Active Directory user principal name for domain authentication", "test.emp001@apid.test"],
    ["TargetOU", "AD_Import", "VARCHAR(255)", "No", "Full Distinguished Name (DN) of target Organizational Unit", "OU=Staff,OU=Arada,OU=CentralDistrict,OU=Branches,OU=APID,DC=apid,DC=test"],
    ["DistrictCode", "Districts", "VARCHAR(10)", "No", "Unique identifier for the district hub", "DIS-CEN"],
    ["BranchCode", "Branches", "VARCHAR(10)", "No", "Unique branch operational code", "BR-001"],
]
style_table(ws_dict, 1, dict_headers, dict_rows)
autofit(ws_dict)

wb.save(excel_path)
print(f"Generated BOA_APID_Organization_Simulation.xlsx successfully with 10 sheets.")

# ─────────────────────────────────────────────────────────────
# 5. GENERATE Provision-APID-TestUsers.ps1
# ─────────────────────────────────────────────────────────────
ps_content = r'''<#
.SYNOPSIS
    Provisions 150 synthetic Bank of Abyssinia test users, OUs, and security groups on Windows Server 2022.
.DESCRIPTION
    Automates domain structure creation for domain 'apid.test':
    - Validates AD DS environment and domain apid.test
    - Creates Organizational Units (Head Office, Districts, 20 Branches, Groups)
    - Creates Security Groups (SG-All-Employees, SG-HeadOffice, SG-DistrictDirectors, SG-BranchManagers, etc.)
    - Imports 150 test users from AD_Import.csv with secure initial passwords
    - Establishes direct line manager relationships
    - Populates security group memberships
.NOTES
    Target Domain: apid.test
    Execution Environment: Windows Server 2022 Domain Controller with ActiveDirectory module
#>

[CmdletBinding()]
param(
    [string]$CsvPath = "$PSScriptRoot\AD_Import.csv",
    [string]$DomainName = "apid.test",
    [string]$DefaultPassword = "Abyssinia@2026!Password",
    [switch]$Force
)

# Start logging
$logFile = "$PSScriptRoot\Provisioning-Log-$(Get-Date -Format 'yyyyMMdd-HHmmss').log"
Start-Transcript -Path $logFile -Append

Write-Host "=====================================================================" -ForegroundColor Cyan
Write-Host " Bank of Abyssinia - APID Active Directory Simulation Provisioner   " -ForegroundColor Cyan
Write-Host " Target Domain : $DomainName" -ForegroundColor Yellow
Write-Host " Total Accounts: 150 Synthetic Employees" -ForegroundColor Yellow
Write-Host "=====================================================================" -ForegroundColor Cyan

# 1. Verify Active Directory Module
if (-not (Get-Module -ListAvailable -Name ActiveDirectory)) {
    Write-Error "ActiveDirectory PowerShell module is not installed. Please install RSAT-AD-PowerShell on Windows Server 2022."
    Stop-Transcript
    exit 1
}
Import-Module ActiveDirectory

# 2. Verify Domain Context
$currentDomain = (Get-ADDomain).DNSRoot
if ($currentDomain -ne $DomainName -and -not $Force) {
    Write-Warning "Current domain is '$currentDomain', but target domain is '$DomainName'."
    $confirm = Read-Host "Do you want to proceed provisioning against '$currentDomain'? (Y/N)"
    if ($confirm -ne "Y" -and $confirm -ne "y") {
        Write-Host "Provisioning cancelled by administrator." -ForegroundColor Yellow
        Stop-Transcript
        exit 0
    }
}

# 3. Verify CSV File Exists
if (-not (Test-Path $CsvPath)) {
    Write-Error "CSV file not found at '$CsvPath'."
    Stop-Transcript
    exit 1
}

$adData = Import-Csv -Path $CsvPath
Write-Host "Loaded $($adData.Count) employee records from CSV." -ForegroundColor Green

# 4. Create Organizational Unit (OU) Hierarchy
Write-Host "`n[Step 1/5] Building Organizational Unit (OU) structure..." -ForegroundColor Cyan

$domainDN = (Get-ADDomain).DistinguishedName
$rootOUs = @(
    "OU=APID,$domainDN",
    "OU=HeadOffice,OU=APID,$domainDN",
    "OU=Executive,OU=HeadOffice,OU=APID,$domainDN",
    "OU=Technology,OU=HeadOffice,OU=APID,$domainDN",
    "OU=HumanResources,OU=HeadOffice,OU=APID,$domainDN",
    "OU=Risk,OU=HeadOffice,OU=APID,$domainDN",
    "OU=Operations,OU=HeadOffice,OU=APID,$domainDN",
    "OU=Retail,OU=HeadOffice,OU=APID,$domainDN",
    "OU=Districts,OU=APID,$domainDN",
    "OU=Branches,OU=APID,$domainDN",
    "OU=Groups,OU=APID,$domainDN"
)

# Collect all distinct TargetOUs from CSV
$allOUs = ($adData | Select-Object -ExpandProperty TargetOU -Unique)
$allOUsSorted = $rootOUs + ($allOUs | Where-Object { $_ -notin $rootOUs })

function Ensure-OU {
    param([string]$OuDN)
    if (-not [string]::IsNullOrWhiteSpace($OuDN)) {
        try {
            [void](Get-ADOrganizationalUnit -Identity $OuDN -ErrorAction Stop)
        } catch {
            $parts = $OuDN -split ",", 2
            $ouName = ($parts[0] -split "=")[1]
            $parentPath = $parts[1]
            Ensure-OU -OuDN $parentPath
            Write-Host "  Creating OU: $ouName under $parentPath" -ForegroundColor DarkGray
            New-ADOrganizationalUnit -Name $ouName -Path $parentPath -ProtectedFromAccidentalDeletion $false
        }
    }
}

foreach ($ou in $allOUsSorted) {
    Ensure-OU -OuDN $ou
}
Write-Host "Organizational Unit hierarchy verified and created." -ForegroundColor Green

# 5. Create Security Groups
Write-Host "`n[Step 2/5] Creating APID Security Groups..." -ForegroundColor Cyan
$groupsOU = "OU=Groups,OU=APID,$domainDN"

$securityGroups = @(
    @{ Name = "SG-All-Employees"; Desc = "All synthetic test accounts across the bank" },
    @{ Name = "SG-HeadOffice"; Desc = "Head Office leadership, IT, HR, and Operations staff" },
    @{ Name = "SG-DistrictDirectors"; Desc = "District Directors overseeing regional branch clusters" },
    @{ Name = "SG-BranchManagers"; Desc = "Designated branch managers acting as PMS coaches" },
    @{ Name = "SG-BranchStaff"; Desc = "Branch frontline customer service and teller staff" },
    @{ Name = "SG-APID-Coaches"; Desc = "Staff authorized for coaching session coordination" },
    @{ Name = "SG-APID-Mentors"; Desc = "Staff authorized as internal mentors and trainers" },
    @{ Name = "SG-APID-PmsAdmins"; Desc = "Administrators authorized for appraisal uploads and referrals" }
)

foreach ($g in $securityGroups) {
    try {
        [void](Get-ADGroup -Identity $g.Name -ErrorAction Stop)
        Write-Host "  Group already exists: $($g.Name)" -ForegroundColor DarkGray
    } catch {
        Write-Host "  Creating Security Group: $($g.Name)" -ForegroundColor Yellow
        New-ADGroup -Name $g.Name -GroupScope Global -GroupCategory Security -Path $groupsOU -Description $g.Desc
    }
}

# 6. Provision Active Directory User Accounts
Write-Host "`n[Step 3/5] Provisioning 150 Active Directory User Accounts..." -ForegroundColor Cyan
$secPassword = ConvertTo-SecureString $DefaultPassword -AsPlainText -Force

$createdCount = 0
$updatedCount = 0

foreach ($row in $adData) {
    $sam = $row.SamAccountName
    $upn = $row.UserPrincipalName
    $targetOU = $row.TargetOU

    try {
        $existing = Get-ADUser -Identity $sam -ErrorAction SilentlyContinue
        if ($existing) {
            Write-Host "  Updating existing user: $sam ($($row.DisplayName))" -ForegroundColor DarkGray
            Set-ADUser -Identity $sam `
                -DisplayName $row.DisplayName `
                -GivenName $row.GivenName `
                -Surname $row.Surname `
                -EmailAddress $row.EmailAddress `
                -EmployeeID $row.EmployeeID `
                -Title $row.Title `
                -Department $row.Department `
                -Company $row.Company
            $updatedCount++
        } else {
            Write-Host "  Creating user: $sam ($($row.DisplayName)) in $targetOU" -ForegroundColor Green
            New-ADUser `
                -SamAccountName $sam `
                -UserPrincipalName $upn `
                -Name $row.DisplayName `
                -DisplayName $row.DisplayName `
                -GivenName $row.GivenName `
                -Surname $row.Surname `
                -EmailAddress $row.EmailAddress `
                -EmployeeID $row.EmployeeID `
                -Title $row.Title `
                -Department $row.Department `
                -Company $row.Company `
                -Path $targetOU `
                -AccountPassword $secPassword `
                -Enabled $true `
                -ChangePasswordAtLogon $true
            $createdCount++
        }
    } catch {
        Write-Error "Failed to process user '$sam': $_"
    }
}

# 7. Configure Direct Line Manager Attributes
Write-Host "`n[Step 4/5] Establishing Line Manager relationships..." -ForegroundColor Cyan
$mgrAssigned = 0

foreach ($row in $adData) {
    $sam = $row.SamAccountName
    $mgrSam = $row.ManagerSamAccountName

    if (-not [string]::IsNullOrWhiteSpace($mgrSam)) {
        try {
            $mgrUser = Get-ADUser -Identity $mgrSam -ErrorAction Stop
            Set-ADUser -Identity $sam -Manager $mgrUser.DistinguishedName
            $mgrAssigned++
        } catch {
            Write-Warning "Could not assign manager '$mgrSam' to '$sam': $_"
        }
    }
}
Write-Host "Assigned direct managers for $mgrAssigned employees." -ForegroundColor Green

# 8. Assign Group Memberships
Write-Host "`n[Step 5/5] Assigning Security Group Memberships..." -ForegroundColor Cyan

foreach ($row in $adData) {
    $sam = $row.SamAccountName
    $empId = [int]($row.EmployeeID)

    # All employees
    Add-ADGroupMember -Identity "SG-All-Employees" -Members $sam -ErrorAction SilentlyContinue

    # Head Office (1-25)
    if ($empId -ge 1 -and $empId -le 25) {
        Add-ADGroupMember -Identity "SG-HeadOffice" -Members $sam -ErrorAction SilentlyContinue
    }
    # District Directors (26-30)
    if ($empId -ge 26 -and $empId -le 30) {
        Add-ADGroupMember -Identity "SG-DistrictDirectors" -Members $sam -ErrorAction SilentlyContinue
        Add-ADGroupMember -Identity "SG-APID-Coaches" -Members $sam -ErrorAction SilentlyContinue
    }
    # Branch Managers (31-50)
    if ($empId -ge 31 -and $empId -le 50) {
        Add-ADGroupMember -Identity "SG-BranchManagers" -Members $sam -ErrorAction SilentlyContinue
        Add-ADGroupMember -Identity "SG-APID-Coaches" -Members $sam -ErrorAction SilentlyContinue
    }
    # Branch Staff (51-150)
    if ($empId -ge 51 -and $empId -le 150) {
        Add-ADGroupMember -Identity "SG-BranchStaff" -Members $sam -ErrorAction SilentlyContinue
    }
    # Mentors sample (8-37)
    if ($empId -ge 8 -and $empId -le 37) {
        Add-ADGroupMember -Identity "SG-APID-Mentors" -Members $sam -ErrorAction SilentlyContinue
    }
    # PMS Admins sample
    if ($empId -in @(1, 7, 14, 16)) {
        Add-ADGroupMember -Identity "SG-APID-PmsAdmins" -Members $sam -ErrorAction SilentlyContinue
    }
}
Write-Host "Security Group memberships populated successfully." -ForegroundColor Green

Write-Host "`n=====================================================================" -ForegroundColor Cyan
Write-Host " Provisioning Complete!" -ForegroundColor Green
Write-Host " Created Accounts: $createdCount" -ForegroundColor Green
Write-Host " Updated Accounts: $updatedCount" -ForegroundColor Green
Write-Host " Managers Linked : $mgrAssigned" -ForegroundColor Green
Write-Host " Log Saved To    : $logFile" -ForegroundColor Cyan
Write-Host "=====================================================================" -ForegroundColor Cyan

Stop-Transcript
'''

with open(ps_path, mode="w", encoding="utf-8") as f:
    f.write(ps_content)

print("Generated Provision-APID-TestUsers.ps1 successfully.")

# ─────────────────────────────────────────────────────────────
# 6. GENERATE README.md
# ─────────────────────────────────────────────────────────────
readme_md_content = """# Bank of Abyssinia — APID Organizational Simulation Package

This package provides a synthetic, complete **150-employee test organization** designed to mirror the organizational hierarchy, branch network, and Active Directory architecture of the Bank of Abyssinia (BoA) for the **APID (Abyssinia Personal Intelligence & Development)** system.

---

## 1. Simulation Architecture Overview

| Parameter | Specification | Details |
| :--- | :--- | :--- |
| **Total Test Accounts** | **150 Employees** | 100% synthetic identities (`TEST EMPLOYEE 001` through `150`) |
| **Target Active Directory Domain** | `apid.test` | Windows Server 2022 AD DS Domain Controller |
| **Districts** | **5 Regional Districts** | Central, Adama, Bahir Dar, Hawassa, Dire Dawa |
| **Branches** | **20 Branches** | 4 authentic BoA branches per regional district |
| **Head Office Cohort** | **25 Employees** | Executive Leadership, Technology, HR, Risk, Treasury, Operations |
| **District Leadership** | **5 Directors** | 1 District Director per district reporting to VP Retail |
| **Branch Leadership** | **20 Managers** | 1 Branch Manager per branch acting as designated PMS coaches |
| **Frontline Staff** | **100 Employees** | 5 employees per branch across CSOs, Personal Bankers, Cash Tellers |
| **Gender Field** | **Blank (`""`)** | Deliberately empty across all records |
| **Manager Attributes** | **Direct Line Manager** | Reflected in both Excel directory and Active Directory `-Manager` |

---

## 2. District & Branch Network Distribution

### 1. Central District (Hub: Addis Ababa)
- **District Director**: `00010026` (`TEST EMPLOYEE 026`)
- **Branches**:
  1. **Addis Kazanchis Branch** (Manager: `00010031`, Staff: `00010051` - `00010055`)
  2. **Addis Ketema Branch** (Manager: `00010032`, Staff: `00010056` - `00010060`)
  3. **Arada Branch** (Manager: `00010033`, Staff: `00010061` - `00010065`)
  4. **Africa Avenue Branch** (Manager: `00010034`, Staff: `00010066` - `00010070`)

### 2. Adama District (Hub: Adama / Oromia)
- **District Director**: `00010027` (`TEST EMPLOYEE 027`)
- **Branches**:
  1. **Adama Bole Branch** (Manager: `00010035`, Staff: `00010071` - `00010075`)
  2. **Adama Boset Branch** (Manager: `00010036`, Staff: `00010076` - `00010080`)
  3. **Adama Main Branch** (Manager: `00010037`, Staff: `00010081` - `00010085`)
  4. **Adama Moenco Branch** (Manager: `00010038`, Staff: `00010086` - `00010090`)

### 3. Bahir Dar District (Hub: Bahir Dar / Amhara)
- **District Director**: `00010028` (`TEST EMPLOYEE 028`)
- **Branches**:
  1. **Abay Mado Branch** (Manager: `00010039`, Staff: `00010091` - `00010095`)
  2. **Abocabot Branch** (Manager: `00010040`, Staff: `00010096` - `00010100`)
  3. **Abune Hara Branch** (Manager: `00010041`, Staff: `00010101` - `00010105`)
  4. **Bahir Dar Branch** (Manager: `00010042`, Staff: `00010106` - `00010110`)

### 4. Hawassa District (Hub: Hawassa / Sidama)
- **District Director**: `00010029` (`TEST EMPLOYEE 029`)
- **Branches**:
  1. **Alamura Branch** (Manager: `00010043`, Staff: `00010111` - `00010115`)
  2. **Alito Hewano Branch** (Manager: `00010044`, Staff: `00010116` - `00010120`)
  3. **Hawassa Arab Sefer Branch** (Manager: `00010045`, Staff: `00010121` - `00010125`)
  4. **Awasho Branch** (Manager: `00010046`, Staff: `00010126` - `00010130`)

### 5. Dire Dawa District (Hub: Dire Dawa City)
- **District Director**: `00010030` (`TEST EMPLOYEE 030`)
- **Branches**:
  1. **Dilchora Branch** (Manager: `00010047`, Staff: `00010131` - `00010135`)
  2. **Dire Airport Branch** (Manager: `00010048`, Staff: `00010136` - `00010140`)
  3. **Dire Dawa Branch** (Manager: `00010049`, Staff: `00010141` - `00010145`)
  4. **Sabian Branch** (Manager: `00010050`, Staff: `00010146` - `00010150`)

---

## 3. Package File Manifest

1. **`BOA_APID_Organization_Simulation.xlsx`**:
   Comprehensive 10-sheet master workbook including:
   - `README`
   - `Districts`
   - `Branches`
   - `Employees_Directory` *(preserves starting 9-column schema)*
   - `Reporting_Relationships`
   - `AD_Import`
   - `AD_Group_Membership`
   - `Position_Catalog`
   - `Sources_and_Assumptions`
   - `Data_Dictionary`
2. **`AD_Import.csv`**:
   Ready-to-use CSV file formatted with standard Active Directory attributes for bulk provisioning.
3. **`Provision-APID-TestUsers.ps1`**:
   Production-grade PowerShell script for Windows Server 2022 that creates the OU tree, security groups, 150 accounts, and manager attributes.
4. **`README.md`**:
   This technical execution guide.

---

## 4. Execution Steps on Windows Server 2022

### Step A: Configure AD DS on the VM
1. Open PowerShell as Administrator on the Windows Server 2022 VM.
2. Ensure Active Directory Domain Services role and RSAT tools are installed:
   ```powershell
   Install-WindowsFeature -Name AD-Domain-Services, RSAT-AD-PowerShell -IncludeManagementTools
   ```
3. Promote to Domain Controller for forest `apid.test` (if not already completed).

### Step B: Run Provisioning Script
1. Copy `AD_Import.csv` and `Provision-APID-TestUsers.ps1` to `C:\\APID-Setup\\`.
2. Open PowerShell as Administrator and run:
   ```powershell
   Set-ExecutionPolicy RemoteSigned -Scope Process -Force
   cd C:\\APID-Setup
   .\\Provision-APID-TestUsers.ps1 -DomainName "apid.test"
   ```
3. The script will:
   - Validate domain `apid.test`.
   - Build the nested OU structure under `OU=APID,DC=apid,DC=test`.
   - Create 8 Security Groups under `OU=Groups,OU=APID,DC=apid,DC=test`.
   - Create all 150 user accounts with password `Abyssinia@2026!Password` and `-ChangePasswordAtLogon $true`.
   - Link direct line managers.
   - Populate group memberships.

---

## 5. Integrating with APID

Once Active Directory is provisioned:
1. **LDAPS Authentication**: Configure APID Spring Boot backend with `SPRING_LDAP_URLS=ldaps://<server-ip>:636`.
2. **Directory Sync**: Import the `Employees_Directory` sheet from `BOA_APID_Organization_Simulation.xlsx` directly into the APID Admin Portal (`/admin/organization/import`) to automatically populate PostgreSQL `core.employees`, reporting lines, and department hierarchies.
"""

with open(readme_path, mode="w", encoding="utf-8") as f:
    f.write(readme_md_content)

print("Generated README.md successfully.")
print("Simulation Package build complete!")
