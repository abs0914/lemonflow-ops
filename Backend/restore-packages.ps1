# PowerShell script to restore NuGet packages for Backend solution
# Run this on the AutoCount server to download required DLLs

$packagesDir = "C:\Users\USER\lemonflow-ops\Backend\packages"
$nugetUrl = "https://www.nuget.org/api/v2/package"

# Create packages directory if it doesn't exist
if (-not (Test-Path $packagesDir)) {
    New-Item -ItemType Directory -Path $packagesDir -Force | Out-Null
    Write-Host "Created packages directory: $packagesDir"
}

# Define packages to download
$packages = @(
    @{ Name = "Microsoft.AspNet.WebApi.Core"; Version = "5.2.7" },
    @{ Name = "Microsoft.AspNet.WebApi.WebHost"; Version = "5.2.7" },
    @{ Name = "Microsoft.AspNet.Cors"; Version = "5.2.7" },
    @{ Name = "Newtonsoft.Json"; Version = "12.0.3" },
    @{ Name = "NUnit"; Version = "3.13.3" },
    @{ Name = "Moq"; Version = "4.16.1" }
)

Write-Host "Starting NuGet package restoration..."
Write-Host ""

foreach ($pkg in $packages) {
    $pkgName = $pkg.Name
    $pkgVersion = $pkg.Version
    $pkgDir = Join-Path $packagesDir "$pkgName.$pkgVersion"
    $nupkgFile = Join-Path $packagesDir "$pkgName.$pkgVersion.nupkg"

    Write-Host "Processing: $pkgName v$pkgVersion"

    # Skip if already exists
    if (Test-Path $pkgDir) {
        Write-Host "  Already exists at $pkgDir"
        continue
    }

    # Download package
    $downloadUrl = "$nugetUrl/$pkgName/$pkgVersion"
    Write-Host "  Downloading from: $downloadUrl"

    [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
    Invoke-WebRequest -Uri $downloadUrl -OutFile $nupkgFile -ErrorAction SilentlyContinue | Out-Null

    if (Test-Path $nupkgFile) {
        Write-Host "  Downloaded to: $nupkgFile"

        # Rename to .zip for extraction (nupkg is just a renamed zip)
        $zipFile = $nupkgFile -replace '\.nupkg$', '.zip'
        Rename-Item -Path $nupkgFile -NewName $zipFile -Force

        # Extract zip file
        Write-Host "  Extracting..."
        Expand-Archive -Path $zipFile -DestinationPath $pkgDir -Force
        Write-Host "  Extracted to: $pkgDir"

        # Clean up zip file
        Remove-Item $zipFile -Force
        Write-Host "  Cleaned up archive file"
    }
    else {
        Write-Host "  ERROR: Failed to download package"
    }

    Write-Host ""
}

Write-Host "Package restoration complete!"
Write-Host "Packages directory: $packagesDir"
Get-ChildItem $packagesDir | Select-Object Name

