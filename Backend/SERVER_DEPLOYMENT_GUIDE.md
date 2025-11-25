# Server Deployment Guide - AutoCount Accounting 2.1 Backend

Complete step-by-step guide for deploying the backend to your server with AutoCount Accounting installed.

## Prerequisites Verification

Before starting, verify your server has:

- ✅ **Windows Server 2012 R2 or later**
- ✅ **AutoCount Accounting 2.1 installed and licensed**
- ✅ **SQL Server 2012 SP3 or later** (AutoCount uses this)
- ✅ **.NET Framework 4.8** (required by AutoCount)
- ✅ **IIS** (Internet Information Services)
- ✅ **SSL Certificate** (for HTTPS)

### Check Prerequisites

```powershell
# Check Windows version
[System.Environment]::OSVersion.VersionString

# Check .NET Framework 4.8
Get-ChildItem 'HKLM:\SOFTWARE\Microsoft\NET Framework Setup\NDP\v4\Full' | Get-ItemProperty -Name Release

# Check SQL Server
sqlcmd -S localhost -Q "SELECT @@VERSION"

# Check IIS
Get-WindowsFeature Web-Server

# Check AutoCount installation
Get-ChildItem "C:\Program Files\AutoCount" -ErrorAction SilentlyContinue
```

## Step 1: Prepare the Backend Files

### 1.1 Build the Solution

On your development machine:

```bash
cd Backend
dotnet build Backend.sln -c Release
```

### 1.2 Collect Release Files

After successful build, collect these files:

```
Backend/Backend.Api/bin/Release/
├── Backend.Api.dll
├── Backend.Application.dll
├── Backend.Infrastructure.AutoCount.dll
├── Backend.Domain.dll
├── Web.config
├── Global.asax
├── Global.asax.cs
├── bin/
│   ├── AutoCount2.*.dll (all AutoCount DLLs)
│   ├── Newtonsoft.Json.dll
│   └── (other dependencies)
└── (other required files)
```

### 1.3 Create Deployment Package

Create a folder on your server:

```
C:\inetpub\wwwroot\AutoCountBackend\
```

Copy all files from `Backend.Api/bin/Release/` to this folder.

## Step 2: Configure IIS

### 2.1 Create Application Pool

1. Open **IIS Manager** (inetmgr)
2. Right-click **Application Pools** → **Add Application Pool**
3. Configure:
   - **Name**: `AutoCountBackend`
   - **.NET CLR Version**: `.NET Framework v4.0.30319`
   - **Managed Pipeline Mode**: `Integrated`
   - **Identity**: `ApplicationPoolIdentity` (or custom service account)
   - **32-bit Applications**: `False` (use 64-bit)

### 2.2 Create Website

1. Right-click **Sites** → **Add Website**
2. Configure:
   - **Site Name**: `AutoCountBackend`
   - **Application Pool**: `AutoCountBackend`
   - **Physical Path**: `C:\inetpub\wwwroot\AutoCountBackend`
   - **Binding Type**: `https`
   - **IP Address**: `All Unassigned` (or specific IP)
   - **Port**: `443`
   - **Host Name**: `api.thelemonco.online` (or your domain)
   - **SSL Certificate**: Select your certificate

### 2.3 Set Permissions

Grant the Application Pool identity permissions:

```powershell
# Get Application Pool identity
$appPoolName = "AutoCountBackend"
$appPoolIdentity = "IIS AppPool\$appPoolName"

# Grant read/execute permissions
$path = "C:\inetpub\wwwroot\AutoCountBackend"
$acl = Get-Acl $path
$rule = New-Object System.Security.AccessControl.FileSystemAccessRule(
    $appPoolIdentity,
    "ReadAndExecute",
    "ContainerInherit,ObjectInherit",
    "None",
    "Allow"
)
$acl.AddAccessRule($rule)
Set-Acl -Path $path -AclObject $acl
```

## Step 3: Configure Web.config

### 3.1 Update AutoCount Settings

Edit `C:\inetpub\wwwroot\AutoCountBackend\Web.config`:

```xml
<!-- AutoCount Configuration -->
<!-- NOTE: For AutoCount 2.1 with SQL Server (including SQL Server 2012+), DBServerType must be SQL2000. -->
<add key="AutoCount:DBServerType" value="SQL2000" />
<add key="AutoCount:ServerName" value="tcp:LemonCoSrv\A2006" />
<add key="AutoCount:DatabaseName" value="AED_Terraganics" />
<add key="AutoCount:SqlUsername" value="sa" />
<add key="AutoCount:SqlPassword" value="oCt2005-ShenZhou6_A2006" />
<add key="AutoCount:AutoCountUsername" value="ADMIN" />
<add key="AutoCount:AutoCountPassword" value="123@admin" />
<add key="AutoCount:ConnectionTimeoutSeconds" value="30" />
<add key="AutoCount:DebugMode" value="false" />
```

### 3.2 Update Supabase Settings

```xml
<!-- Supabase Configuration -->
<add key="Supabase:Url" value="https://pukezienbcenozlqmunf.supabase.co" />
<add key="Supabase:AnonKey" value="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..." />
<add key="Supabase:JwtSecret" value="OhYO147mYGunXEVYGmZ3cYnUb6qyH0E8cvhhoogELnF+uyLuHCNhjEBQpzUgNRqlfSNzf4WzPhZk5gONyxRj7w==" />
<add key="Supabase:JwtIssuer" value="https://pukezienbcenozlqmunf.supabase.co/auth/v1" />
```

### 3.3 Update JWT Settings

```xml
<!-- JWT Configuration -->
<add key="Jwt:Secret" value="OhYO147mYGunXEVYGmZ3cYnUb6qyH0E8cvhhoogELnF+uyLuHCNhjEBQpzUgNRqlfSNzf4WzPhZk5gONyxRj7w==" />
<add key="Jwt:Issuer" value="LemonCoProductionAPI" />
<add key="Jwt:Audience" value="LemonCoFrontend" />
<add key="Jwt:ExpiryMinutes" value="480" />
```

## Step 4: Verify Connectivity

### 4.1 Test SQL Server Connection

```powershell
# Test SQL Server connectivity
$connectionString = "Server=tcp:LemonCoSrv\A2006;Database=AED_Terraganics;User Id=sa;Password=oCt2005-ShenZhou6_A2006;"
$connection = New-Object System.Data.SqlClient.SqlConnection($connectionString)
try {
    $connection.Open()
    Write-Host "SQL Server connection successful"
    $connection.Close()
} catch {
    Write-Host "SQL Server connection failed: $_"
}
```

### 4.2 Test AutoCount Access

1. Open AutoCount Accounting on the server
2. Verify you can login with credentials: `ADMIN` / `123@admin`
3. Verify database `AED_Terraganics` is accessible

### 4.3 Test Network Connectivity

```powershell
# Test if backend server is reachable
Test-NetConnection -ComputerName "api.thelemonco.online" -Port 443
```

## Step 5: Start the Backend

### 5.1 Start Application Pool

1. Open **IIS Manager**
2. Select **Application Pools**
3. Right-click `AutoCountBackend` → **Start**

### 5.2 Verify Application Started

1. Select **Sites** → `AutoCountBackend`
2. Check status shows "Started"
3. Check Event Viewer for errors:
   - Open **Event Viewer**
   - Navigate to **Windows Logs** → **Application**
   - Look for errors from `ASP.NET` or `IIS`

## Step 6: Test the Backend

### 6.1 Test Health Endpoint

```powershell
# Test basic health
$uri = "https://api.thelemonco.online/api/health"
$response = Invoke-WebRequest -Uri $uri -SkipCertificateCheck
$response.StatusCode  # Should be 200
$response.Content     # Should show health status
```

### 6.2 Test AutoCount Health

```powershell
# Test AutoCount connectivity
$uri = "https://api.thelemonco.online/api/health/autocount"
$response = Invoke-WebRequest -Uri $uri -SkipCertificateCheck
$response.StatusCode  # Should be 200
$response.Content     # Should show AutoCount status
```

### 6.3 Test Authentication

```powershell
# Test login endpoint
$uri = "https://api.thelemonco.online/api/auth/login"
$body = @{
    email = "test@example.com"
    password = "test"
} | ConvertTo-Json

$response = Invoke-WebRequest -Uri $uri -Method Post -Body $body -ContentType "application/json" -SkipCertificateCheck
$response.StatusCode  # Should be 200
$token = ($response.Content | ConvertFrom-Json).accessToken
Write-Host "Token: $token"
```

### 6.4 Test Debtors Endpoint

```powershell
# Get debtors
$uri = "https://api.thelemonco.online/api/debtors"
$response = Invoke-WebRequest -Uri $uri -SkipCertificateCheck
$response.StatusCode  # Should be 200
$response.Content | ConvertFrom-Json | Format-Table
```

## Step 7: Configure Cloudflare Tunnel

### 7.1 Install Cloudflare Tunnel

On your server:

```powershell
# Download Cloudflare Tunnel
# https://developers.cloudflare.com/cloudflare-one/connections/connect-apps/install-and-setup/tunnel-guide/local-management/windows/

# Or use Chocolatey
choco install cloudflared
```

### 7.2 Create Tunnel

```powershell
# Authenticate with Cloudflare
cloudflared tunnel login

# Create tunnel
cloudflared tunnel create lemonflow-api

# Get tunnel credentials
cloudflared tunnel info lemonflow-api
```

### 7.3 Configure Tunnel

Create `C:\Users\<username>\.cloudflared\config.yml`:

```yaml
tunnel: lemonflow-api
credentials-file: C:\Users\<username>\.cloudflared\<tunnel-id>.json

ingress:
  - hostname: api.thelemonco.online
    service: https://localhost:443
    disableChunkedEncoding: true
  - service: http_status:404
```

### 7.4 Run Tunnel

```powershell
# Run tunnel
cloudflared tunnel run lemonflow-api

# Or install as Windows service
cloudflared service install --logfile C:\cloudflared.log
```

## Step 8: Configure DNS

### 8.1 Add DNS Record in Cloudflare

1. Go to Cloudflare Dashboard
2. Select your domain
3. Go to **DNS** → **Records**
4. Add CNAME record:
   - **Name**: `api`
   - **Target**: `<tunnel-id>.cfargotunnel.com`
   - **Proxy Status**: Proxied

### 8.2 Verify DNS Resolution

```powershell
# Test DNS resolution
nslookup api.thelemonco.online
```

## Step 9: Monitor and Verify

### 9.1 Check IIS Logs

```powershell
# View IIS logs
Get-Content "C:\inetpub\logs\LogFiles\W3SVC1\u_ex*.log" -Tail 50
```

### 9.2 Check Event Viewer

```powershell
# View application events
Get-EventLog -LogName Application -Source "ASP.NET" -Newest 20
```

### 9.3 Monitor Performance

```powershell
# Monitor CPU and memory
Get-Process w3wp | Select-Object Name, CPU, Memory
```

## Troubleshooting

### Backend Not Starting

**Error**: Application pool won't start

**Solution**:
1. Check Event Viewer for errors
2. Verify .NET Framework 4.8 is installed
3. Verify AutoCount DLLs are in bin folder
4. Check file permissions on application folder

### Cannot Connect to AutoCount

**Error**: "Failed to connect to AutoCount"

**Solution**:
1. Verify AutoCount is running on server
2. Verify credentials in web.config
3. Verify database name is correct
4. Check SQL Server is running
5. Test connection with SQL Server Management Studio

### SSL Certificate Error

**Error**: "SSL certificate not found" or "Certificate expired"

**Solution**:
1. Verify certificate is installed in IIS
2. Check certificate expiry date
3. Renew certificate if expired
4. Verify certificate matches domain name

### Cloudflare Tunnel Not Working

**Error**: "Cannot reach backend through tunnel"

**Solution**:
1. Verify tunnel is running: `cloudflared tunnel list`
2. Check tunnel configuration
3. Verify DNS record points to tunnel
4. Check firewall allows HTTPS (port 443)

## Rollback Plan

If deployment fails:

1. **Stop Application Pool**: Right-click `AutoCountBackend` → **Stop**
2. **Restore Previous Version**: Copy previous files back to `C:\inetpub\wwwroot\AutoCountBackend`
3. **Restore Web.config**: Restore previous configuration
4. **Start Application Pool**: Right-click `AutoCountBackend` → **Start**
5. **Verify**: Test health endpoints

## Post-Deployment Checklist

- [ ] Backend application started successfully
- [ ] Health endpoint responding (200 OK)
- [ ] AutoCount health endpoint responding (200 OK)
- [ ] Authentication endpoint working
- [ ] Debtors endpoint working
- [ ] Sales Invoices endpoint working
- [ ] No errors in Event Viewer
- [ ] Cloudflare tunnel connected
- [ ] DNS resolving correctly
- [ ] HTTPS working (no certificate warnings)
- [ ] Monitoring configured
- [ ] Alerts configured
- [ ] Backup configured

## Support

For issues or questions:

1. Check **DEPLOYMENT_CHECKLIST.md** for comprehensive checklist
2. Check **README.md** for architecture and design
3. Check **QUICKSTART.md** for quick reference
4. Check **CONFIGURATION_REFERENCE.md** for configuration details

---

**Version**: 1.0.0
**Last Updated**: 2024
**Status**: Ready for Deployment

