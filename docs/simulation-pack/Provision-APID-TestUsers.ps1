<#
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
