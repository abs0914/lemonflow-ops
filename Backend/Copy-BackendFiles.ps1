Write-Host "=== Copying Backend Files to IIS ===" -ForegroundColor Cyan

$source = "C:\Users\USER\lemonflow-ops\Backend\Backend.Api\bin\*"
$destination = "\\LemonCoSrv\c$\inetpub\wwwroot\AutoCountBackend\"

Write-Host "`nSource: $source"
Write-Host "Destination: $destination"

if (-not (Test-Path "C:\Users\USER\lemonflow-ops\Backend\Backend.Api\bin")) {
    Write-Host "`nERROR: Source directory not found!" -ForegroundColor Red
    exit 1
}

Write-Host "`n[1/3] Creating destination directory..." -ForegroundColor Yellow
New-Item -ItemType Directory -Path $destination -Force -ErrorAction SilentlyContinue | Out-Null
Write-Host "  OK"

Write-Host "`n[2/3] Copying backend files..." -ForegroundColor Yellow
Write-Host "  Enter server credentials when prompted..."
$cred = Get-Credential -Message "Enter credentials for LemonCoSrv" -UserName "LemonCo"

# Map network drive
New-PSDrive -Name Z -PSProvider FileSystem -Root "\\LemonCoSrv\c$" -Credential $cred -Force | Out-Null
Write-Host "  Mapped network drive"

# Copy files
Copy-Item -Path $source -Destination "Z:\inetpub\wwwroot\AutoCountBackend\" -Recurse -Force -ErrorAction Stop
Write-Host "  OK - Files copied"

# Disconnect
Remove-PSDrive -Name Z -Force -ErrorAction SilentlyContinue

Write-Host "`n[3/3] Verifying files..." -ForegroundColor Yellow
$files = Get-ChildItem "Z:\inetpub\wwwroot\AutoCountBackend\" -Filter "*.dll" -ErrorAction SilentlyContinue
Write-Host "  Found $($files.Count) DLL files"

Write-Host "`n=== Copy Complete ===" -ForegroundColor Green
Write-Host "Backend files are now in: C:\inetpub\wwwroot\AutoCountBackend\"

