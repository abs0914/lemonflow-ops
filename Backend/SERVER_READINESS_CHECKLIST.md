# Server Readiness Checklist

Verify your server is ready for AutoCount Backend deployment.

## ✅ Server Environment Checklist

### Operating System
- [ ] Windows Server 2012 R2 or later installed
- [ ] Server is fully patched and updated
- [ ] Server has stable internet connection
- [ ] Server hostname is set correctly
- [ ] Server time is synchronized (NTP)

**Verify**:
```powershell
[System.Environment]::OSVersion.VersionString
```

### .NET Framework
- [ ] .NET Framework 4.8 installed
- [ ] .NET Framework 4.8 is latest version
- [ ] No conflicting .NET versions

**Verify**:
```powershell
Get-ChildItem 'HKLM:\SOFTWARE\Microsoft\NET Framework Setup\NDP\v4\Full' | Get-ItemProperty -Name Release
# Release value should be 528040 or higher for .NET 4.8
```

### SQL Server
- [ ] SQL Server 2012 SP3 or later installed
- [ ] SQL Server is running
- [ ] SQL Server is set to auto-start
- [ ] SQL Server has sufficient disk space (>50GB recommended)
- [ ] SQL Server backups are configured

**Verify**:
```powershell
sqlcmd -S localhost -Q "SELECT @@VERSION"
Get-Service MSSQLSERVER | Select-Object Status, StartType
```

### AutoCount Accounting
- [ ] AutoCount Accounting 2.1 installed
- [ ] AutoCount license is valid and active
- [ ] AutoCount can be started and accessed
- [ ] AutoCount database (AED_Terraganics) exists
- [ ] AutoCount user (ADMIN) exists and can login
- [ ] AutoCount is set to auto-start (if desired)

**Verify**:
```powershell
Get-ChildItem "C:\Program Files\AutoCount" -ErrorAction SilentlyContinue
# Should show AutoCount installation folder
```

### IIS (Internet Information Services)
- [ ] IIS is installed
- [ ] IIS is running
- [ ] IIS is set to auto-start
- [ ] ASP.NET 4.8 is installed in IIS
- [ ] IIS has sufficient disk space (>10GB recommended)

**Verify**:
```powershell
Get-WindowsFeature Web-Server
Get-Service W3SVC | Select-Object Status, StartType
```

### SSL Certificate
- [ ] SSL certificate obtained
- [ ] SSL certificate is valid (not expired)
- [ ] SSL certificate matches domain (api.thelemonco.online)
- [ ] SSL certificate is installed in IIS
- [ ] SSL certificate has private key

**Verify**:
```powershell
Get-ChildItem Cert:\LocalMachine\My | Where-Object {$_.Subject -like "*api.thelemonco.online*"}
```

## ✅ Network & Connectivity Checklist

### Network Configuration
- [ ] Server has static IP address
- [ ] Server has DNS configured
- [ ] Server can reach internet
- [ ] Firewall is configured
- [ ] Firewall allows HTTPS (port 443)
- [ ] Firewall blocks unnecessary ports

**Verify**:
```powershell
ipconfig /all
Test-NetConnection -ComputerName 8.8.8.8 -Port 443
```

### Domain & DNS
- [ ] Domain (thelemonco.online) is registered
- [ ] Domain DNS is configured
- [ ] DNS record for api.thelemonco.online exists
- [ ] DNS resolves correctly
- [ ] DNS propagation is complete

**Verify**:
```powershell
nslookup api.thelemonco.online
```

### Cloudflare
- [ ] Cloudflare account created
- [ ] Domain added to Cloudflare
- [ ] Cloudflare nameservers configured
- [ ] Cloudflare tunnel will be configured

## ✅ Database Checklist

### SQL Server Database
- [ ] Database AED_Terraganics exists
- [ ] Database has sufficient space (>100GB recommended)
- [ ] Database backups are configured
- [ ] Database backup location is secure
- [ ] Database backup is tested and verified

**Verify**:
```powershell
sqlcmd -S localhost -Q "SELECT name, size FROM sys.master_files WHERE name = 'AED_Terraganics'"
```

### SQL Server User
- [ ] SQL user 'sa' exists
- [ ] SQL user password is set correctly
- [ ] SQL user has appropriate permissions
- [ ] SQL user can access AED_Terraganics database

**Verify**:
```powershell
sqlcmd -S localhost -U sa -P "oCt2005-ShenZhou6_A2006" -Q "SELECT @@VERSION"
```

### AutoCount Database
- [ ] AutoCount database is accessible
- [ ] AutoCount user 'ADMIN' exists
- [ ] AutoCount user password is set correctly
- [ ] AutoCount user can login
- [ ] AutoCount data is intact

**Verify**:
```powershell
# Open AutoCount and login with ADMIN / 123@admin
```

## ✅ Credentials Checklist

### AutoCount Credentials
- [ ] AutoCount Server: tcp:LemonCoSrv\A2006
- [ ] AutoCount Database: AED_Terraganics
- [ ] AutoCount User: ADMIN
- [ ] AutoCount Password: 123@admin
- [ ] Credentials are secure and not shared

### SQL Server Credentials
- [ ] SQL Server: tcp:LemonCoSrv\A2006
- [ ] SQL User: sa
- [ ] SQL Password: oCt2005-ShenZhou6_A2006
- [ ] Credentials are secure and not shared

### JWT Credentials
- [ ] JWT Secret: Configured
- [ ] JWT Issuer: LemonCoProductionAPI
- [ ] JWT Audience: LemonCoFrontend
- [ ] Credentials are secure and not shared

### Supabase Credentials
- [ ] Supabase URL: https://pukezienbcenozlqmunf.supabase.co
- [ ] Supabase Anon Key: Configured
- [ ] Supabase JWT Secret: Configured
- [ ] Credentials are secure and not shared

## ✅ Disk Space Checklist

### Disk Space Requirements
- [ ] System Drive: >50GB free space
- [ ] SQL Server Drive: >100GB free space
- [ ] IIS Drive: >20GB free space
- [ ] Backup Drive: >200GB free space

**Verify**:
```powershell
Get-Volume | Select-Object DriveLetter, Size, SizeRemaining
```

## ✅ Performance Checklist

### CPU & Memory
- [ ] Server has >4 CPU cores
- [ ] Server has >8GB RAM
- [ ] CPU usage is <50% at idle
- [ ] Memory usage is <50% at idle

**Verify**:
```powershell
Get-ComputerInfo | Select-Object CsNumberOfProcessors, CsTotalPhysicalMemory
Get-Process | Measure-Object -Property CPU -Sum
```

### Network Performance
- [ ] Network latency is <50ms
- [ ] Network bandwidth is >10Mbps
- [ ] No packet loss
- [ ] Connection is stable

**Verify**:
```powershell
Test-NetConnection -ComputerName 8.8.8.8 -TraceRoute
```

## ✅ Security Checklist

### Windows Security
- [ ] Windows Defender is enabled
- [ ] Windows Firewall is enabled
- [ ] Windows updates are current
- [ ] No unnecessary services running
- [ ] User accounts are secured

**Verify**:
```powershell
Get-MpComputerStatus
Get-NetFirewallProfile
```

### SQL Server Security
- [ ] SQL Server authentication is configured
- [ ] SQL Server is not exposed to internet
- [ ] SQL Server port (1433) is blocked from internet
- [ ] SQL Server backups are encrypted
- [ ] SQL Server audit logging is enabled

### IIS Security
- [ ] IIS is not exposed to internet (behind Cloudflare)
- [ ] IIS has HTTPS only
- [ ] IIS has security headers configured
- [ ] IIS has CORS configured appropriately

## ✅ Monitoring & Logging Checklist

### Event Viewer
- [ ] Event Viewer is accessible
- [ ] Application log is configured
- [ ] System log is configured
- [ ] Security log is configured
- [ ] Log retention is configured

### Logging
- [ ] IIS logging is enabled
- [ ] IIS log location is configured
- [ ] IIS log rotation is configured
- [ ] Application logging will be configured

### Monitoring
- [ ] Monitoring tools will be installed
- [ ] Alerts will be configured
- [ ] Dashboard will be created
- [ ] On-call rotation will be established

## ✅ Backup & Recovery Checklist

### Backup Configuration
- [ ] SQL Server backups are configured
- [ ] Backup frequency is daily
- [ ] Backup location is secure and off-site
- [ ] Backup encryption is enabled
- [ ] Backup retention is 30 days

### Disaster Recovery
- [ ] Disaster recovery plan is documented
- [ ] Recovery procedures are tested
- [ ] RTO (Recovery Time Objective) is defined
- [ ] RPO (Recovery Point Objective) is defined
- [ ] Failover procedures are documented

## ✅ Pre-Deployment Testing

### Connectivity Tests
- [ ] Can ping server from development machine
- [ ] Can RDP to server
- [ ] Can access IIS on server
- [ ] Can access SQL Server from server
- [ ] Can access AutoCount from server

**Verify**:
```powershell
ping <server-ip>
Test-NetConnection -ComputerName <server-ip> -Port 3389
Test-NetConnection -ComputerName <server-ip> -Port 443
```

### Service Tests
- [ ] SQL Server service starts successfully
- [ ] AutoCount starts successfully
- [ ] IIS starts successfully
- [ ] All services auto-start correctly

**Verify**:
```powershell
Get-Service MSSQLSERVER, W3SVC | Select-Object Name, Status, StartType
```

### Database Tests
- [ ] Can connect to SQL Server
- [ ] Can access AED_Terraganics database
- [ ] Can query database
- [ ] Can backup database

**Verify**:
```powershell
sqlcmd -S localhost -U sa -P "password" -Q "SELECT COUNT(*) FROM AED_Terraganics.dbo.Debtor"
```

## ✅ Documentation Checklist

- [ ] Server configuration documented
- [ ] Credentials stored securely
- [ ] Deployment steps documented
- [ ] Troubleshooting guide created
- [ ] Runbooks created for common issues
- [ ] Contact information documented

## 🎯 Final Verification

Before deployment, verify:

- [ ] All checklist items are checked
- [ ] All tests pass successfully
- [ ] Server is stable and responsive
- [ ] No errors in Event Viewer
- [ ] Backups are working
- [ ] Monitoring is configured
- [ ] Team is trained and ready

## 📋 Sign-Off

- [ ] System Administrator: _________________ Date: _______
- [ ] Database Administrator: _________________ Date: _______
- [ ] Network Administrator: _________________ Date: _______
- [ ] Security Officer: _________________ Date: _______
- [ ] Project Manager: _________________ Date: _______

## 🚀 Ready for Deployment

Once all items are checked, the server is ready for backend deployment.

**Next Steps**:
1. Follow [SERVER_DEPLOYMENT_GUIDE.md](SERVER_DEPLOYMENT_GUIDE.md)
2. Use [QUICK_REFERENCE.md](QUICK_REFERENCE.md) for quick commands
3. Reference [DEPLOYMENT_CHECKLIST.md](DEPLOYMENT_CHECKLIST.md) for comprehensive checklist

---

**Version**: 1.0.0
**Last Updated**: 2024
**Status**: Ready for Verification

