# ============================================================================
# Lemon-co API Deployment Script
# Copies published files from dev PC to production server
# ============================================================================

param(
    [string]$ServerIP = "192.168.0.126",
    [string]$SourcePath = "C:\LemonCoApiPublish",
    [string]$DestinationPath = "C:\inetpub\wwwroot\AutoCountBackend",
    [string]$IISAppPoolName = "DefaultAppPool",
    [string]$IISSiteName = "Default Web Site"
)

Write-Host "============================================" -ForegroundColor Cyan
Write-Host "  Lemon-co API Deployment Script" -ForegroundColor Cyan
Write-Host "============================================" -ForegroundColor Cyan
Write-Host ""

# Verify source exists
if (-not (Test-Path $SourcePath)) {
    Write-Host "ERROR: Source path not found: $SourcePath" -ForegroundColor Red
    Write-Host "Run the build script first to create the publish folder." -ForegroundColor Yellow
    exit 1
}

Write-Host "Source: $SourcePath" -ForegroundColor Green
Write-Host "Server: $ServerIP" -ForegroundColor Green
Write-Host "Destination: $DestinationPath" -ForegroundColor Green
Write-Host ""

# ============================================================================
# Option 1: Copy via network share (simpler, requires shared folder)
# ============================================================================
Write-Host "Attempting deployment via network share..." -ForegroundColor Yellow

$networkPath = "\\$ServerIP\C$\inetpub\wwwroot\AutoCountBackend"

try {
    # Test network connectivity
    if (-not (Test-Connection -ComputerName $ServerIP -Count 1 -Quiet)) {
        throw "Cannot reach server at $ServerIP"
    }

    # Test if we can access the admin share
    if (-not (Test-Path "\\$ServerIP\C$")) {
        Write-Host "Admin share (C$) not accessible. You may need to:" -ForegroundColor Yellow
        Write-Host "  1. Run this script as Administrator" -ForegroundColor Yellow
        Write-Host "  2. Ensure you have admin access to the server" -ForegroundColor Yellow
        Write-Host "  3. Or create a regular share on the server" -ForegroundColor Yellow
        throw "Cannot access admin share"
    }

    # Create destination folder if it doesn't exist
    if (-not (Test-Path $networkPath)) {
        Write-Host "Creating destination folder on server..." -ForegroundColor Yellow
        New-Item -ItemType Directory -Path $networkPath -Force | Out-Null
    }

    # Stop IIS App Pool before copying (optional, prevents file locks)
    Write-Host "Attempting to stop IIS App Pool on server..." -ForegroundColor Yellow
    try {
        Invoke-Command -ComputerName $ServerIP -ScriptBlock {
            param($poolName)
            Import-Module WebAdministration -ErrorAction SilentlyContinue
            if (Get-WebAppPoolState -Name $poolName -ErrorAction SilentlyContinue) {
                Stop-WebAppPool -Name $poolName -ErrorAction SilentlyContinue
                Start-Sleep -Seconds 2
            }
        } -ArgumentList $IISAppPoolName -ErrorAction SilentlyContinue
    } catch {
        Write-Host "Could not stop App Pool remotely (may need manual stop)" -ForegroundColor Yellow
    }

    # Copy files
    Write-Host "Copying files to server..." -ForegroundColor Yellow
    Copy-Item -Path "$SourcePath\*" -Destination $networkPath -Recurse -Force

    Write-Host ""
    Write-Host "Files copied successfully!" -ForegroundColor Green

    # Start IIS App Pool after copying
    Write-Host "Attempting to start IIS App Pool on server..." -ForegroundColor Yellow
    try {
        Invoke-Command -ComputerName $ServerIP -ScriptBlock {
            param($poolName)
            Import-Module WebAdministration -ErrorAction SilentlyContinue
            if (Get-WebAppPoolState -Name $poolName -ErrorAction SilentlyContinue) {
                Start-WebAppPool -Name $poolName -ErrorAction SilentlyContinue
            }
        } -ArgumentList $IISAppPoolName -ErrorAction SilentlyContinue
    } catch {
        Write-Host "Could not start App Pool remotely (may need manual start)" -ForegroundColor Yellow
    }

    Write-Host ""
    Write-Host "============================================" -ForegroundColor Green
    Write-Host "  DEPLOYMENT COMPLETE!" -ForegroundColor Green
    Write-Host "============================================" -ForegroundColor Green
    Write-Host ""
    Write-Host "Files deployed to: $networkPath" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "Next steps on the server:" -ForegroundColor Yellow
    Write-Host "  1. Open IIS Manager" -ForegroundColor White
    Write-Host "  2. Ensure App Pool '$IISAppPoolName' uses .NET 4.0 Integrated" -ForegroundColor White
    Write-Host "  3. Ensure site '$IISSiteName' points to $DestinationPath" -ForegroundColor White
    Write-Host "  4. Update Web.config with production settings" -ForegroundColor White
    Write-Host "  5. Test: http://$ServerIP/api/health" -ForegroundColor White
    Write-Host ""

} catch {
    Write-Host ""
    Write-Host "Network deployment failed: $($_.Exception.Message)" -ForegroundColor Red
    Write-Host ""
    Write-Host "ALTERNATIVE: Manual copy using Remote Desktop" -ForegroundColor Yellow
    Write-Host "  1. Connect to $ServerIP via Remote Desktop" -ForegroundColor White
    Write-Host "  2. Copy $SourcePath from this PC" -ForegroundColor White
    Write-Host "  3. Paste to $DestinationPath on the server" -ForegroundColor White
    Write-Host ""
    exit 1
}

