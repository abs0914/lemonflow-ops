# IIS Deployment Script for AutoCount Backend
# Run this as Administrator on the server (tcp:LemonCoSrv\A2006)

# Check if running as Administrator
$isAdmin = ([Security.Principal.WindowsPrincipal] [Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole] "Administrator")
if (-not $isAdmin) {
    Write-Host "ERROR: This script must be run as Administrator!" -ForegroundColor Red
    exit 1
}

Write-Host "=== IIS Deployment Script ===" -ForegroundColor Cyan

# Import WebAdministration module
Import-Module WebAdministration -ErrorAction Stop

# Step 1: Create Application Pool
Write-Host "`n[1/5] Creating Application Pool..." -ForegroundColor Yellow
$poolName = "AutoCountBackend"
$poolExists = Get-WebAppPool -Name $poolName -ErrorAction SilentlyContinue

if ($poolExists) {
    Write-Host "  ✓ Application Pool '$poolName' already exists"
}
else {
    New-WebAppPool -Name $poolName -Force
    Write-Host "  ✓ Application Pool '$poolName' created"
}

# Configure the pool
$pool = Get-Item "IIS:\AppPools\$poolName"
$pool.managedRuntimeVersion = "v4.0"
$pool | Set-Item
Set-ItemProperty "IIS:\AppPools\$poolName" -Name autoStart -Value $true
Write-Host "  ✓ Pool configured: .NET 4.0, autoStart enabled"

# Step 2: Create physical directory
Write-Host "`n[2/5] Creating physical directory..." -ForegroundColor Yellow
$sitePath = "C:\inetpub\wwwroot\AutoCountBackend"
if (Test-Path $sitePath) {
    Write-Host "  ✓ Directory already exists: $sitePath"
}
else {
    New-Item -ItemType Directory -Path $sitePath -Force | Out-Null
    Write-Host "  ✓ Directory created: $sitePath"
}

# Step 3: Create IIS Website
Write-Host "`n[3/5] Creating IIS Website..." -ForegroundColor Yellow
$siteExists = Get-Website -Name $poolName -ErrorAction SilentlyContinue

if ($siteExists) {
    Write-Host "  ✓ Website '$poolName' already exists"
}
else {
    New-Website -Name $poolName -PhysicalPath $sitePath -ApplicationPool $poolName -Force
    Write-Host "  ✓ Website '$poolName' created"
}

# Step 4: Configure HTTPS Binding
Write-Host "`n[4/5] Configuring HTTPS binding..." -ForegroundColor Yellow

# Get SSL certificate
$cert = Get-ChildItem Cert:\LocalMachine\My | Where-Object {$_.Subject -like "*api.thelemonco.online*"} | Select-Object -First 1

if ($cert) {
    $thumbprint = $cert.Thumbprint
    Write-Host "  ✓ Found certificate: $($cert.Subject)"
    Write-Host "    Thumbprint: $thumbprint"

    # Remove HTTP binding if exists
    Remove-WebBinding -Name $poolName -BindingInformation "*:80:" -Protocol http -ErrorAction SilentlyContinue

    # Add HTTPS binding
    New-WebBinding -Name $poolName -Protocol https -Port 443 -HostHeader "api.thelemonco.online" -SslFlags 1 -ErrorAction SilentlyContinue

    # Bind certificate
    $binding = Get-WebBinding -Name $poolName -Protocol https
    if ($binding) {
        $binding.AddSslCertificate($thumbprint, "My")
        Write-Host "  ✓ HTTPS binding configured with SSL certificate"
    }
}
else {
    Write-Host "  ✗ SSL certificate not found for api.thelemonco.online" -ForegroundColor Red
    Write-Host "    Please install the certificate first"
}

# Step 5: Set Folder Permissions
Write-Host "`n[5/5] Setting folder permissions..." -ForegroundColor Yellow
$acl = Get-Acl $sitePath
$rule = New-Object System.Security.AccessControl.FileSystemAccessRule(
    "IIS AppPool\$poolName",
    "FullControl",
    "ContainerInherit,ObjectInherit",
    "None",
    "Allow"
)
$acl.SetAccessRule($rule)
Set-Acl -Path $sitePath -AclObject $acl
Write-Host "  ✓ Permissions configured for IIS AppPool"

Write-Host "`n=== IIS Setup Complete ===" -ForegroundColor Green
Write-Host "Website: $poolName"
Write-Host "URL: https://api.thelemonco.online"
Write-Host "Physical Path: $sitePath"
Write-Host "`nNext: Copy backend files to $sitePath"

