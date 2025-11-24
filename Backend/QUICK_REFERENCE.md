# Quick Reference - AutoCount Backend Deployment

Fast reference guide for deploying and managing the backend.

## 🚀 Quick Start (5 Minutes)

### 1. Build Release Package
```bash
cd Backend
dotnet build Backend.sln -c Release
```

### 2. Copy to Server
```
Copy: Backend/Backend.Api/bin/Release/*
To:   C:\inetpub\wwwroot\AutoCountBackend\
```

### 3. Configure IIS
- Create App Pool: `AutoCountBackend` (.NET 4.8, 64-bit)
- Create Site: `AutoCountBackend` (HTTPS, port 443)
- Physical Path: `C:\inetpub\wwwroot\AutoCountBackend`

### 4. Update Web.config
```xml
<add key="AutoCount:ServerName" value="tcp:LemonCoSrv\A2006" />
<add key="AutoCount:DatabaseName" value="AED_Terraganics" />
<add key="AutoCount:SqlUsername" value="sa" />
<add key="AutoCount:SqlPassword" value="oCt2005-ShenZhou6_A2006" />
<add key="AutoCount:AutoCountUsername" value="ADMIN" />
<add key="AutoCount:AutoCountPassword" value="123@admin" />
```

### 5. Start & Test
```powershell
# Start app pool in IIS Manager
# Test: https://api.thelemonco.online/api/health
```

## 📋 Configuration Quick Reference

### AutoCount Settings
| Setting | Value |
|---------|-------|
| Server | tcp:LemonCoSrv\A2006 |
| Database | AED_Terraganics |
| SQL User | sa |
| SQL Password | oCt2005-ShenZhou6_A2006 |
| AutoCount User | ADMIN |
| AutoCount Password | 123@admin |

### JWT Settings
| Setting | Value |
|---------|-------|
| Issuer | LemonCoProductionAPI |
| Audience | LemonCoFrontend |
| Expiry | 480 minutes |

### Supabase Settings
| Setting | Value |
|---------|-------|
| URL | https://pukezienbcenozlqmunf.supabase.co |
| JWT Issuer | https://pukezienbcenozlqmunf.supabase.co/auth/v1 |

## 🔍 Testing Endpoints

### Health Check
```bash
curl https://api.thelemonco.online/api/health
```

### AutoCount Health
```bash
curl https://api.thelemonco.online/api/health/autocount
```

### Login
```bash
curl -X POST https://api.thelemonco.online/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"test"}'
```

### Get Debtors
```bash
curl https://api.thelemonco.online/api/debtors
```

## 🛠️ Common Tasks

### Restart Backend
```powershell
# In IIS Manager:
# 1. Right-click Application Pools
# 2. Select AutoCountBackend
# 3. Click Restart
```

### View Logs
```powershell
# IIS Logs
Get-Content "C:\inetpub\logs\LogFiles\W3SVC1\u_ex*.log" -Tail 50

# Event Viewer
Get-EventLog -LogName Application -Source "ASP.NET" -Newest 20
```

### Check Status
```powershell
# Check app pool status
Get-WebAppPoolState -Name "AutoCountBackend"

# Check website status
Get-WebsiteState -Name "AutoCountBackend"
```

### Update Configuration
```powershell
# Edit web.config
notepad "C:\inetpub\wwwroot\AutoCountBackend\Web.config"

# Restart app pool to apply changes
Restart-WebAppPool -Name "AutoCountBackend"
```

## 🔐 Security Checklist

- [ ] HTTPS enabled (port 443)
- [ ] SSL certificate valid and not expired
- [ ] Firewall allows HTTPS (port 443)
- [ ] Firewall blocks SQL Server port (1433)
- [ ] Credentials not in code (only in web.config)
- [ ] Debug mode disabled (`DebugMode: false`)
- [ ] Error messages don't leak sensitive data

## 📊 Monitoring

### Key Metrics to Monitor
- Health endpoint response time
- AutoCount connectivity status
- API error rate
- CPU usage
- Memory usage
- Database connection pool

### Alerts to Configure
- Health endpoint down
- AutoCount connectivity lost
- High error rate (>5%)
- High CPU (>80%)
- High memory (>80%)

## 🚨 Troubleshooting

### Backend Won't Start
1. Check Event Viewer for errors
2. Verify .NET Framework 4.8 installed
3. Verify AutoCount DLLs in bin folder
4. Check file permissions

### Cannot Connect to AutoCount
1. Verify AutoCount running on server
2. Verify credentials in web.config
3. Verify database name correct
4. Check SQL Server running

### SSL Certificate Error
1. Verify certificate installed in IIS
2. Check certificate not expired
3. Verify certificate matches domain
4. Renew certificate if needed

### Cloudflare Tunnel Not Working
1. Verify tunnel running: `cloudflared tunnel list`
2. Check tunnel configuration
3. Verify DNS record correct
4. Check firewall allows HTTPS

## 📞 Support Resources

| Resource | Location |
|----------|----------|
| Full Deployment Guide | SERVER_DEPLOYMENT_GUIDE.md |
| Configuration Reference | CONFIGURATION_REFERENCE.md |
| Troubleshooting | README.md (Troubleshooting section) |
| API Documentation | README.md (REST API Endpoints section) |
| Architecture | README.md (Architecture section) |

## 🔗 Important URLs

| URL | Purpose |
|-----|---------|
| https://api.thelemonco.online/api/health | Health check |
| https://api.thelemonco.online/api/health/autocount | AutoCount status |
| https://api.thelemonco.online/api/auth/login | Login endpoint |
| https://api.thelemonco.online/api/debtors | Debtors list |

## 📁 Important Paths

| Path | Purpose |
|------|---------|
| C:\inetpub\wwwroot\AutoCountBackend | Application folder |
| C:\inetpub\wwwroot\AutoCountBackend\Web.config | Configuration file |
| C:\inetpub\logs\LogFiles\W3SVC1 | IIS logs |
| C:\Program Files\AutoCount | AutoCount installation |

## 🔄 Deployment Workflow

1. **Build** → `dotnet build Backend.sln -c Release`
2. **Copy** → Copy Release files to server
3. **Configure** → Update Web.config
4. **Deploy** → Copy to IIS folder
5. **Start** → Start app pool in IIS
6. **Test** → Test health endpoints
7. **Monitor** → Monitor logs and performance

## 📝 Version Info

- **Backend Version**: 1.0.0
- **.NET Framework**: 4.8
- **AutoCount**: 2.1
- **SQL Server**: 2012 SP3+
- **IIS**: 7.5+

## 🎯 Success Criteria

✅ Backend builds successfully
✅ Health endpoint responds (200 OK)
✅ AutoCount health endpoint responds (200 OK)
✅ Authentication endpoint working
✅ Debtors endpoint working
✅ No errors in Event Viewer
✅ Cloudflare tunnel connected
✅ DNS resolving correctly
✅ HTTPS working without warnings

---

**Last Updated**: 2024
**Status**: Ready for Production