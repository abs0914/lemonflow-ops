Write-Host "=== Backend Testing Script ===" -ForegroundColor Cyan

# Check if running as Administrator
$isAdmin = ([Security.Principal.WindowsPrincipal] [Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole] "Administrator")
if (-not $isAdmin) {
    Write-Host "ERROR: This script must be run as Administrator!" -ForegroundColor Red
    exit 1
}

Import-Module WebAdministration -ErrorAction Stop

Write-Host "`n[1/4] Checking IIS Website..." -ForegroundColor Yellow
$site = Get-Website -Name "AutoCountBackend" -ErrorAction SilentlyContinue
if ($site) {
    Write-Host "  ✓ Website found: $($site.Name)"
    Write-Host "    State: $($site.State)"
    Write-Host "    Physical Path: $($site.PhysicalPath)"
}
else {
    Write-Host "  ✗ Website not found" -ForegroundColor Red
    exit 1
}

Write-Host "`n[2/4] Checking Application Pool..." -ForegroundColor Yellow
$pool = Get-WebAppPool -Name "AutoCountBackend" -ErrorAction SilentlyContinue
if ($pool) {
    Write-Host "  ✓ App Pool found: $($pool.Name)"
    Write-Host "    State: $($pool.State)"
    Write-Host "    .NET Version: $($pool.managedRuntimeVersion)"
}
else {
    Write-Host "  ✗ App Pool not found" -ForegroundColor Red
    exit 1
}

Write-Host "`n[3/4] Starting Application Pool..." -ForegroundColor Yellow
if ($pool.State -ne "Started") {
    Start-WebAppPool -Name "AutoCountBackend"
    Write-Host "  ✓ App Pool started"
}
else {
    Write-Host "  ✓ App Pool already running"
}

Write-Host "`n[4/4] Starting Website..." -ForegroundColor Yellow
if ($site.State -ne "Started") {
    Start-Website -Name "AutoCountBackend"
    Write-Host "  ✓ Website started"
}
else {
    Write-Host "  ✓ Website already running"
}

Write-Host "`n=== Testing Endpoints ===" -ForegroundColor Cyan

$baseUrl = "https://api.thelemonco.online"
$endpoints = @(
    "/api/health",
    "/api/auth/login"
)

foreach ($endpoint in $endpoints) {
    Write-Host "`nTesting: $baseUrl$endpoint" -ForegroundColor Yellow
    try {
        $response = Invoke-WebRequest -Uri "$baseUrl$endpoint" -Method GET -SkipCertificateCheck -TimeoutSec 10 -ErrorAction Stop
        Write-Host "  ✓ Status: $($response.StatusCode)"
    }
    catch {
        Write-Host "  ✗ Error: $($_.Exception.Message)" -ForegroundColor Red
    }
}

Write-Host "`n=== Backend Ready ===" -ForegroundColor Green
Write-Host "Website: https://api.thelemonco.online"
Write-Host "Status: Running"

