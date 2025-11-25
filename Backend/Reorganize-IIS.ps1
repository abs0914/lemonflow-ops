Write-Host "=== Reorganizing IIS Folder Structure ===" -ForegroundColor Cyan

$iisPath = "C:\inetpub\wwwroot\AutoCountBackend"
$backendApiPath = "$iisPath\Backend\Backend.Api"

Write-Host "`nCurrent structure:"
Write-Host "  $iisPath\Backend\Backend.Api\*"

# Check if Backend.Api folder exists
if (-not (Test-Path $backendApiPath)) {
    Write-Host "`n✗ Backend.Api folder not found at: $backendApiPath" -ForegroundColor Red
    Write-Host "  Current contents of $iisPath :"
    Get-ChildItem $iisPath -Recurse | Select-Object FullName
    exit 1
}

Write-Host "`n[1/3] Copying files from Backend.Api to root..." -ForegroundColor Yellow
$files = Get-ChildItem "$backendApiPath\bin\*" -Recurse
foreach ($file in $files) {
    $relativePath = $file.FullName.Substring("$backendApiPath\bin\".Length)
    $destPath = "$iisPath\$relativePath"
    $destDir = Split-Path $destPath
    
    if (-not (Test-Path $destDir)) {
        New-Item -ItemType Directory -Path $destDir -Force | Out-Null
    }
    
    Copy-Item -Path $file.FullName -Destination $destPath -Force
}
Write-Host "  ✓ Files copied"

Write-Host "`n[2/3] Copying Web.config..." -ForegroundColor Yellow
Copy-Item -Path "$backendApiPath\Web.config" -Destination "$iisPath\Web.config" -Force
Write-Host "  ✓ Web.config copied"

Write-Host "`n[3/3] Cleaning up old structure..." -ForegroundColor Yellow
Remove-Item "$iisPath\Backend" -Recurse -Force -ErrorAction SilentlyContinue
Write-Host "  ✓ Old structure removed"

Write-Host "`n=== Reorganization Complete ===" -ForegroundColor Green
Write-Host "New structure:"
Get-ChildItem $iisPath -Filter "*.dll" | Select-Object -First 5 | ForEach-Object {
    Write-Host "  ✓ $_"
}
Write-Host "  ✓ Web.config"
Write-Host "`nIIS folder is now ready!"

