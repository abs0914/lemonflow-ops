# 🚀 START HERE - Backend Deployment Guide

Welcome! Your AutoCount Accounting 2.1 backend is ready for deployment to your server.

## ⚡ Quick Overview

You have:
- ✅ Complete .NET backend solution (50+ files)
- ✅ AutoCount 2.1 integration (production-ready)
- ✅ REST API with 16+ endpoints
- ✅ JWT authentication with Supabase support
- ✅ Comprehensive documentation (13 files)
- ✅ Production configuration (already configured)

## 🎯 Your Server Configuration

```
AutoCount Server: tcp:LemonCoSrv\A2006
Database: AED_Terraganics
AutoCount User: ADMIN
SQL User: sa
API URL: https://api.thelemonco.online
```

## 📋 Deployment Steps (5 Steps)

### Step 1: Verify Server Readiness (15 minutes)
**File**: `Backend/SERVER_READINESS_CHECKLIST.md`

This checklist verifies your server has:
- ✅ Windows Server 2012 R2+
- ✅ .NET Framework 4.8
- ✅ SQL Server 2012 SP3+
- ✅ AutoCount Accounting 2.1 (licensed)
- ✅ IIS installed
- ✅ SSL certificate

**Action**: Open the file and check all items. Run the verification tests.

### Step 2: Build Release Package (5 minutes)
**Command**:
```bash
cd Backend
dotnet build Backend.sln -c Release
```

**Output**: `Backend/Backend.Api/bin/Release/`

This creates the production-ready package with all DLLs and configuration files.

### Step 3: Deploy to IIS (10 minutes)
**File**: `Backend/SERVER_DEPLOYMENT_GUIDE.md` (Steps 1-3)

**Actions**:
1. Create IIS Application Pool: `AutoCountBackend`
   - .NET Framework: v4.0.30319
   - Pipeline Mode: Integrated
   - 32-bit: False (use 64-bit)

2. Create IIS Website: `AutoCountBackend`
   - Physical Path: `C:\inetpub\wwwroot\AutoCountBackend\`
   - Binding: HTTPS, port 443
   - Host: `api.thelemonco.online`
   - SSL Certificate: Your certificate

3. Copy Release files to IIS folder

### Step 4: Configure Web.config (5 minutes)
**File**: `Backend/Backend.Api/Web.config`

**Already Configured With**:
```xml
<!-- AutoCount -->
<add key="AutoCount:ServerName" value="tcp:LemonCoSrv\A2006" />
<add key="AutoCount:DatabaseName" value="AED_Terraganics" />
<add key="AutoCount:SqlUsername" value="sa" />
<add key="AutoCount:SqlPassword" value="oCt2005-ShenZhou6_A2006" />
<add key="AutoCount:AutoCountUsername" value="ADMIN" />
<add key="AutoCount:AutoCountPassword" value="123@admin" />

<!-- JWT -->
<add key="Jwt:Issuer" value="LemonCoProductionAPI" />
<add key="Jwt:Audience" value="LemonCoFrontend" />
<add key="Jwt:ExpiryMinutes" value="480" />

<!-- Supabase -->
<add key="Supabase:Url" value="https://pukezienbcenozlqmunf.supabase.co" />
```

**Action**: Verify all settings are correct. No changes needed if using provided configuration.

### Step 5: Start & Test (10 minutes)
**File**: `Backend/QUICK_REFERENCE.md`

**Actions**:
1. Start app pool in IIS Manager
2. Test health endpoint:
   ```bash
   curl https://api.thelemonco.online/api/health
   ```
   Expected: 200 OK

3. Test AutoCount health:
   ```bash
   curl https://api.thelemonco.online/api/health/autocount
   ```
   Expected: 200 OK

4. Test authentication:
   ```bash
   curl -X POST https://api.thelemonco.online/api/auth/login \
     -H "Content-Type: application/json" \
     -d '{"email":"test@example.com","password":"test"}'
   ```
   Expected: 200 OK with JWT token

## 📚 Documentation Files

### Essential Files (Read These First)
1. **SERVER_READINESS_CHECKLIST.md** - Verify server is ready
2. **SERVER_DEPLOYMENT_GUIDE.md** - Step-by-step deployment
3. **QUICK_REFERENCE.md** - Quick commands and troubleshooting

### Reference Files
4. **DEPLOYMENT_CHECKLIST.md** - Comprehensive checklist
5. **CONFIGURATION_REFERENCE.md** - All configuration settings
6. **AUTHENTICATION.md** - JWT and authentication details
7. **README.md** - Full documentation and architecture

### Additional Files
8. **QUICKSTART.md** - Quick start guide
9. **IMPLEMENTATION_NOTES.md** - Technical details
10. **FILE_STRUCTURE.md** - File organization
11. **PRODUCTION_READY.md** - Production status
12. **COMPLETION_SUMMARY.md** - Completion status
13. **INDEX.md** - Documentation index

## 🔍 Testing Endpoints

After deployment, test these endpoints:

```bash
# Health Check
curl https://api.thelemonco.online/api/health

# AutoCount Health
curl https://api.thelemonco.online/api/health/autocount

# Login
curl -X POST https://api.thelemonco.online/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"test"}'

# Get Debtors
curl https://api.thelemonco.online/api/debtors

# Get Sales Invoices
curl https://api.thelemonco.online/api/sales-invoices
```

## 🛠️ Common Commands

### Build
```bash
dotnet build Backend.sln -c Release
```

### Check .NET Framework
```powershell
Get-ChildItem 'HKLM:\SOFTWARE\Microsoft\NET Framework Setup\NDP\v4\Full' | Get-ItemProperty -Name Release
```

### Check SQL Server
```powershell
sqlcmd -S localhost -Q "SELECT @@VERSION"
```

### Check IIS Status
```powershell
Get-WebAppPoolState -Name "AutoCountBackend"
Get-WebsiteState -Name "AutoCountBackend"
```

### View IIS Logs
```powershell
Get-Content "C:\inetpub\logs\LogFiles\W3SVC1\u_ex*.log" -Tail 50
```

### Restart App Pool
```powershell
Restart-WebAppPool -Name "AutoCountBackend"
```

## 🚨 Troubleshooting

### Backend Won't Start
1. Check Event Viewer: `Get-EventLog -LogName Application -Source "ASP.NET" -Newest 20`
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

### Health Endpoint Not Responding
1. Check IIS website is started
2. Check app pool is started
3. Check firewall allows HTTPS (port 443)
4. Check Event Viewer for errors

## ✅ Success Criteria

After deployment, verify:
- ✅ Health endpoint responds (200 OK)
- ✅ AutoCount health responds (200 OK)
- ✅ Authentication endpoint working
- ✅ Debtors endpoint working
- ✅ Sales Invoices endpoint working
- ✅ No errors in Event Viewer
- ✅ Cloudflare tunnel configured
- ✅ DNS resolving correctly
- ✅ HTTPS working without warnings

## 📞 Need Help?

| Issue | File |
|-------|------|
| Server not ready | SERVER_READINESS_CHECKLIST.md |
| Deployment steps | SERVER_DEPLOYMENT_GUIDE.md |
| Quick commands | QUICK_REFERENCE.md |
| Configuration | CONFIGURATION_REFERENCE.md |
| Troubleshooting | README.md or QUICK_REFERENCE.md |
| API endpoints | README.md |
| Authentication | AUTHENTICATION.md |

## 🎯 Next Steps

1. **Now**: Read `SERVER_READINESS_CHECKLIST.md`
2. **Then**: Follow `SERVER_DEPLOYMENT_GUIDE.md`
3. **Test**: Use `QUICK_REFERENCE.md`
4. **Monitor**: Set up health check monitoring
5. **Deploy Frontend**: Update frontend to call backend

## 📊 Project Status

✅ **PRODUCTION READY**

- Complete .NET solution
- AutoCount 2.1 integration
- REST API with 16+ endpoints
- JWT authentication
- Comprehensive documentation
- Production configuration
- Ready for deployment

## 🚀 You're Ready!

Your backend is complete, tested, documented, and ready for production deployment.

**Start with**: `Backend/SERVER_READINESS_CHECKLIST.md`

---

**Version**: 1.0.0
**Status**: ✅ PRODUCTION READY
**Last Updated**: 2024

