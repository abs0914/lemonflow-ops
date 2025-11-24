# NuGet Package Restoration Guide

## Quick Start (Recommended)

Run this PowerShell script on the AutoCount server:

```powershell
cd C:\Users\USER\lemonflow-ops\Backend
powershell -ExecutionPolicy Bypass -File restore-packages.ps1
```

This will automatically download and extract all required NuGet packages.

---

## Manual Method (If Script Fails)

If the script doesn't work, follow these steps:

### Step 1: Create Package Directory

```powershell
New-Item -ItemType Directory -Path "C:\Users\USER\lemonflow-ops\Backend\packages" -Force
```

### Step 2: Download Each Package

Download these files from https://www.nuget.org/packages/:

1. **Microsoft.AspNet.WebApi.Core 5.2.7**
   - URL: https://www.nuget.org/api/v2/package/Microsoft.AspNet.WebApi.Core/5.2.7
   - Save as: `packages\Microsoft.AspNet.WebApi.Core.5.2.7.nupkg`

2. **Microsoft.AspNet.WebApi.WebHost 5.2.7**
   - URL: https://www.nuget.org/api/v2/package/Microsoft.AspNet.WebApi.WebHost/5.2.7
   - Save as: `packages\Microsoft.AspNet.WebApi.WebHost.5.2.7.nupkg`

3. **Microsoft.AspNet.Cors 5.2.7**
   - URL: https://www.nuget.org/api/v2/package/Microsoft.AspNet.Cors/5.2.7
   - Save as: `packages\Microsoft.AspNet.Cors.5.2.7.nupkg`

4. **Newtonsoft.Json 12.0.3**
   - URL: https://www.nuget.org/api/v2/package/Newtonsoft.Json/12.0.3
   - Save as: `packages\Newtonsoft.Json.12.0.3.nupkg`

5. **NUnit 3.13.3**
   - URL: https://www.nuget.org/api/v2/package/NUnit/3.13.3
   - Save as: `packages\NUnit.3.13.3.nupkg`

6. **Moq 4.16.1**
   - URL: https://www.nuget.org/api/v2/package/Moq/4.16.1
   - Save as: `packages\Moq.4.16.1.nupkg`

### Step 3: Extract Each Package

For each `.nupkg` file, extract it to a folder with the same name:

```powershell
$packages = @(
    "Microsoft.AspNet.WebApi.Core.5.2.7",
    "Microsoft.AspNet.WebApi.WebHost.5.2.7",
    "Microsoft.AspNet.Cors.5.2.7",
    "Newtonsoft.Json.12.0.3",
    "NUnit.3.13.3",
    "Moq.4.16.1"
)

foreach ($pkg in $packages) {
    $nupkgPath = "C:\Users\USER\lemonflow-ops\Backend\packages\$pkg.nupkg"
    $extractPath = "C:\Users\USER\lemonflow-ops\Backend\packages\$pkg"
    
    if (Test-Path $nupkgPath) {
        Expand-Archive -Path $nupkgPath -DestinationPath $extractPath -Force
        Remove-Item $nupkgPath
        Write-Host "Extracted: $pkg"
    }
}
```

### Step 4: Verify Structure

After extraction, verify the folder structure:

```
C:\Users\USER\lemonflow-ops\Backend\packages\
├── Microsoft.AspNet.WebApi.Core.5.2.7\
│   └── lib\net45\System.Web.Http.dll
├── Microsoft.AspNet.WebApi.WebHost.5.2.7\
│   └── lib\net45\System.Web.Http.WebHost.dll
├── Microsoft.AspNet.Cors.5.2.7\
│   └── lib\net45\System.Net.Http.Formatting.dll
├── Newtonsoft.Json.12.0.3\
│   └── lib\net45\Newtonsoft.Json.dll
├── NUnit.3.13.3\
│   └── lib\net45\nunit.framework.dll
└── Moq.4.16.1\
    └── lib\net45\Moq.dll
```

---

## Verify Installation

After restoration, run:

```powershell
cd C:\Users\USER\lemonflow-ops\Backend
& "C:\Windows\Microsoft.NET\Framework64\v4.0.30319\MSBuild.exe" Backend.sln /p:Configuration=Release
```

You should see no warnings about missing packages.

---

## Troubleshooting

### "Could not find a part of the path"

Make sure the `packages` directory exists:
```powershell
Test-Path "C:\Users\USER\lemonflow-ops\Backend\packages"
```

### "Access Denied" when extracting

Run PowerShell as Administrator.

### Download fails with SSL error

Run this first:
```powershell
[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
```


