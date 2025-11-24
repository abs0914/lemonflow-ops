# Quick Start Guide

Get the AutoCount Accounting 2.1 backend running in 5 minutes.

## Prerequisites

- Windows Server 2012 R2 or later
- .NET Framework 4.8 installed
- SQL Server 2012 SP3 or later running
- AutoCount Accounting 2.1 installed and configured
- Visual Studio 2019 or later (for development)

## Step 1: Clone and Open the Solution

```bash
cd Backend
```

Open `Backend.sln` in Visual Studio.

## Step 2: Configure AutoCount Connection

Edit `Backend.Api/Web.config` and update the `<appSettings>` section:

```xml
<appSettings>
  <add key="AutoCount:DBServerType" value="SQL2012" />
  <add key="AutoCount:ServerName" value="YOUR_SQL_SERVER" />
  <add key="AutoCount:DatabaseName" value="YOUR_AUTOCOUNT_DB" />
  <add key="AutoCount:SqlUsername" value="sa" />
  <add key="AutoCount:SqlPassword" value="YOUR_SQL_PASSWORD" />
  <add key="AutoCount:AutoCountUsername" value="YOUR_AUTOCOUNT_USER" />
  <add key="AutoCount:AutoCountPassword" value="YOUR_AUTOCOUNT_PASSWORD" />
</appSettings>
```

**Example**:
```xml
<add key="AutoCount:ServerName" value="MYSERVER\SQLEXPRESS" />
<add key="AutoCount:DatabaseName" value="AutoCount_Demo" />
<add key="AutoCount:SqlUsername" value="sa" />
<add key="AutoCount:SqlPassword" value="MyPassword123" />
<add key="AutoCount:AutoCountUsername" value="admin" />
<add key="AutoCount:AutoCountPassword" value="admin123" />
```

## Step 3: Build the Solution

In Visual Studio:
1. Right-click on `Backend.sln`
2. Select "Build Solution" (or press Ctrl+Shift+B)

Wait for the build to complete. You should see "Build succeeded" in the output.

## Step 4: Run the Backend

### Option A: IIS Express (Development)

1. In Visual Studio, right-click on `Backend.Api` project
2. Select "Set as Startup Project"
3. Press F5 to start debugging
4. IIS Express will start and open the browser

### Option B: IIS (Production-like)

1. Open IIS Manager
2. Create a new Application Pool:
   - Name: `AutoCountBackend`
   - .NET CLR Version: `.NET Framework v4.0.30319`
   - Managed Pipeline Mode: `Integrated`
3. Create a new Website:
   - Name: `AutoCountBackend`
   - Physical Path: `C:\path\to\Backend\Backend.Api`
   - Binding: `https://localhost:44300`
4. Start the website

## Step 5: Test the Backend

### Test Health Endpoint

Open a browser or use curl:

```bash
curl https://localhost:44300/api/health
```

Expected response:
```json
{
  "status": "healthy",
  "timestamp": "2024-01-15T10:30:00Z",
  "version": "1.0.0"
}
```

### Test AutoCount Connection

```bash
curl https://localhost:44300/api/health/autocount
```

Expected response (if connected):
```json
{
  "status": "healthy",
  "autocount_connected": true,
  "timestamp": "2024-01-15T10:30:00Z",
  "message": "Backend is connected to AutoCount Accounting 2.1"
}
```

If you get an error, check:
1. AutoCount credentials in `web.config`
2. SQL Server is running and accessible
3. AutoCount database exists
4. Check Windows Event Viewer for errors

## Step 6: Test API Endpoints

### Create a Debtor

```bash
curl -X POST https://localhost:44300/api/debtors \
  -H "Content-Type: application/json" \
  -d '{
    "code": "CUST001",
    "name": "Test Customer",
    "email": "test@example.com",
    "phone": "555-0123",
    "currencyCode": "USD",
    "isActive": true
  }'
```

### Get All Debtors

```bash
curl https://localhost:44300/api/debtors
```

### Get Specific Debtor

```bash
curl https://localhost:44300/api/debtors/CUST001
```

### Create a Sales Invoice

```bash
curl -X POST https://localhost:44300/api/sales-invoices \
  -H "Content-Type: application/json" \
  -d '{
    "documentNo": "INV001",
    "debtorCode": "CUST001",
    "invoiceDate": "2024-01-15",
    "dueDate": "2024-02-15",
    "currencyCode": "USD",
    "lines": [
      {
        "lineNo": 1,
        "itemCode": "ITEM001",
        "description": "Test Item",
        "quantity": 1,
        "unitOfMeasure": "PCS",
        "unitPrice": 100,
        "taxCode": "SR"
      }
    ]
  }'
```

## Step 7: Run Tests

### Unit Tests

In Visual Studio:
1. Open Test Explorer (Test > Test Explorer)
2. Click "Run All Tests"

Or from command line:
```bash
cd Backend\Backend.Tests
nunit3-console Backend.Tests.dll
```

### Integration Tests

1. Edit `Backend.Tests/App.config` (or `web.config`)
2. Add: `<add key="EnableIntegrationTests" value="true" />`
3. Run tests with `[Category("Integration")]` filter

## Troubleshooting

### "Failed to login to AutoCount"

- Check AutoCount username and password in `web.config`
- Verify the user exists in AutoCount
- Check AutoCount is running

### "Cannot connect to SQL Server"

- Verify SQL Server is running
- Check server name (use `SERVERNAME\INSTANCENAME` for named instances)
- Verify SQL login credentials
- Check firewall allows SQL Server port (default 1433)

### "UserSession already initialized"

- This means the application started twice
- Restart IIS or IIS Express
- Check for multiple instances running

### "Tax code not found"

- Verify the tax code exists in AutoCount
- Check that SubProjectStartup was called (it is, in Global.asax.cs)
- Enable debug mode to see detailed errors

## Next Steps

1. **Deploy to Production**: See README.md for deployment instructions
2. **Configure Cloudflare**: Expose backend at `https://api.thelemonco.online`
3. **Set Up Monitoring**: Monitor health endpoints and log errors
4. **Integrate with Frontend**: Update frontend to call backend endpoints
5. **Add More Features**: Extend with additional AutoCount operations

## Documentation

- **README.md** - Full documentation and architecture
- **IMPLEMENTATION_NOTES.md** - Detailed implementation notes
- **AutoCount Docs** - https://wiki.autocountsoft.com/wiki/AutoCount_Accounting_2.1_API

## Support

If you encounter issues:

1. Check the troubleshooting section above
2. Review the logs in Windows Event Viewer
3. Enable debug mode in `web.config` (development only)
4. Check AutoCount documentation
5. Contact AutoCount support

## Common Tasks

### Change AutoCount Database

Edit `web.config`:
```xml
<add key="AutoCount:DatabaseName" value="NEW_DATABASE_NAME" />
```

Restart the application.

### Enable Debug Mode

Edit `web.config`:
```xml
<add key="AutoCount:DebugMode" value="true" />
```

**WARNING**: Only for development. Disable for production.

### Change SQL Server

Edit `web.config`:
```xml
<add key="AutoCount:ServerName" value="NEW_SERVER_NAME" />
```

Restart the application.

### Add New Endpoint

1. Create a new service interface in `Backend.Infrastructure.AutoCount/`
2. Implement the service
3. Create a new controller in `Backend.Api/Controllers/`
4. Add unit tests in `Backend.Tests/`
5. Update README.md with endpoint documentation

## Performance Tips

1. **Cache Tax Codes**: Tax codes rarely change, cache them
2. **Batch Operations**: Use batch endpoints for multiple operations
3. **Connection Pooling**: SQL Server connection pooling is automatic
4. **Async Operations**: Consider async/await for I/O operations
5. **Monitoring**: Monitor response times and optimize slow queries

## Security Checklist

- [ ] Use HTTPS for all endpoints
- [ ] Store credentials in secure secret storage (not web.config)
- [ ] Disable debug mode in production
- [ ] Set up firewall rules
- [ ] Enable SSL certificate validation
- [ ] Implement API authentication/authorization
- [ ] Log all operations for audit trail
- [ ] Regular security updates for .NET Framework

Enjoy! 🚀

