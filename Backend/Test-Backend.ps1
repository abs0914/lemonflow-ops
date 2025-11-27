Write-Host "=== Backend Testing Script ===" -ForegroundColor Cyan

# Ensure the script is running as Administrator
$currentIdentity = [Security.Principal.WindowsIdentity]::GetCurrent()
$principal = New-Object Security.Principal.WindowsPrincipal($currentIdentity)
if (-not $principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) {
    Write-Host "ERROR: This script must be run as Administrator!" -ForegroundColor Red
    exit 1
}

Import-Module WebAdministration -ErrorAction Stop

$siteName = "AutoCountBackend"
$appPoolName = "AutoCountBackend"

Write-Host ""
Write-Host "[1/4] Checking IIS Website..." -ForegroundColor Yellow
$site = Get-Website -Name $siteName -ErrorAction SilentlyContinue
if ($null -ne $site) {
    Write-Host ("  Website: {0}" -f $site.Name)
    Write-Host ("  State  : {0}" -f $site.State)
    Write-Host ("  Path   : {0}" -f $site.PhysicalPath)
}
else {
    Write-Host "  Website not found" -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "[2/4] Checking Application Pool..." -ForegroundColor Yellow
$pool = Get-WebAppPool -Name $appPoolName -ErrorAction SilentlyContinue
if ($null -ne $pool) {
    Write-Host ("  App Pool: {0}" -f $pool.Name)
    Write-Host ("  State   : {0}" -f $pool.State)
    Write-Host ("  .NET    : {0}" -f $pool.managedRuntimeVersion)
}
else {
    Write-Host "  App Pool not found" -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "[3/4] Ensuring Application Pool is started..." -ForegroundColor Yellow
if ($pool.State -ne "Started") {
    Start-WebAppPool -Name $appPoolName
    Write-Host "  Application Pool started"
}
else {
    Write-Host "  Application Pool already running"
}

Write-Host ""
Write-Host "[4/4] Ensuring Website is started..." -ForegroundColor Yellow
if ($site.State -ne "Started") {
    Start-Website -Name $siteName
    Write-Host "  Website started"
}
else {
    Write-Host "  Website already running"
}

Write-Host ""
Write-Host "=== Testing Endpoints ===" -ForegroundColor Cyan

$baseUrl = "https://api.thelemonco.online"
$endpoints = @(
    "/api/health",
    "/api/auth/login"
)

foreach ($endpoint in $endpoints) {
    Write-Host ""
    Write-Host ("Testing: {0}{1}" -f $baseUrl, $endpoint) -ForegroundColor Yellow
    try {
        $uri = $baseUrl + $endpoint
        $response = Invoke-WebRequest -Uri $uri -Method Get -TimeoutSec 15 -ErrorAction Stop
        Write-Host ("  Status: {0}" -f $response.StatusCode)
    }
    catch {
        Write-Host ("  Error : {0}" -f $_.Exception.Message) -ForegroundColor Red
    }
}

Write-Host ""
Write-Host "=== Backend Ready ===" -ForegroundColor Green
Write-Host ("Website: {0}" -f $baseUrl)
Write-Host "Status: Running"