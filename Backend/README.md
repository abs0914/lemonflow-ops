# AutoCount Accounting 2.1 Backend Integration

A production-ready ASP.NET Web API backend service that integrates with AutoCount Accounting 2.1, exposing secure REST endpoints for managing Debtors (Customers) and Sales Invoices.

## Overview

This backend service implements the **"Interface with API – Web service"** integration method as documented in the [AutoCount Integration Methods](https://wiki.autocountsoft.com/wiki/Integration_Methods) guide.

### Key Features

- **Secure REST API** hosted behind Cloudflared at `https://api.thelemonco.online`
- **Debtor Management**: Create, read, update, and delete customer records
- **Sales Invoice Management**: Create, read, update, and post sales invoices
- **Tax Code Handling**: Automatic resolution of tax codes and rates per AutoCount 2.1 specifications
- **Health Checks**: Endpoints to verify backend and AutoCount connectivity
- **Thread-Safe AutoCount Integration**: Singleton UserSession with serialized access
- **Comprehensive Logging**: All AutoCount operations are logged for debugging

## Architecture

### Project Structure

```
Backend/
├── Backend.Api/                    # ASP.NET Web API project
│   ├── Controllers/                # HTTP endpoints
│   ├── Global.asax.cs              # Application startup & AutoCount initialization
│   ├── WebApiConfig.cs             # Web API configuration
│   └── Web.config                  # Configuration settings
├── Backend.Application/            # Application services (business logic)
├── Backend.Infrastructure.AutoCount/  # AutoCount API integration
│   ├── AutoCountSessionProvider.cs    # Singleton UserSession management
│   ├── AutoCountConnectionConfig.cs   # Configuration loading
│   ├── AutoCountDebtorService.cs      # Debtor operations
│   └── AutoCountSalesInvoiceService.cs # Sales invoice operations
├── Backend.Domain/                 # Domain models (DTOs)
│   ├── Debtor.cs
│   └── SalesInvoice.cs
└── Backend.Tests/                  # Unit and integration tests
```

### Design Principles

1. **Dependency Inversion**: All services use interfaces for loose coupling
2. **Separation of Concerns**: Clear boundaries between API, application, and infrastructure layers
3. **Thread Safety**: AutoCount operations are serialized via locks to ensure safe concurrent access
4. **Configuration Management**: All settings loaded from `web.config` with no hardcoded values
5. **Error Handling**: Meaningful error messages without leaking sensitive details

## AutoCount Integration

### Per AutoCount 2.1 API Documentation

This implementation strictly follows the official AutoCount documentation:

- **Integration Method**: [Interface with API – Web service](https://wiki.autocountsoft.com/wiki/Integration_Methods)
- **Session Management**: [Initiate UserSession and DBSetting](https://wiki.autocountsoft.com/wiki/Initiate_UserSession_and_DBSetting)
- **API Reference**: [AutoCount Accounting 2.1 API](https://wiki.autocountsoft.com/wiki/AutoCount_Accounting_2.1_API)

### UserSession Initialization

Per AutoCount docs, UserSession must be initialized **exactly once** at application startup:

1. **Create DBSetting** with SQL Server connection details
2. **Create UserSession** instance
3. **Call UserSession.Login()** with AutoCount credentials
4. **Call SubProjectStartup()** to initialize the accounting engine

This is implemented in `Global.asax.cs` and managed by the `AutoCountSessionProvider` singleton.

### NuGet Package

The backend uses the **AutoCount2.MainEntry** NuGet package as recommended by AutoCount:

> "If unsure of which NuGet package to install, select AutoCount2.MainEntry package is sufficient for most project."

This package automatically pulls all required dependencies (AutoCount2.Accounting, AutoCount2.UI, AutoCount2.Sales, etc.).

## Configuration

### Web.config Settings

All configuration is stored in `web.config` under `<appSettings>`:

```xml
<appSettings>
  <!-- SQL Server Configuration -->
  <add key="AutoCount:DBServerType" value="SQL2012" />
  <add key="AutoCount:ServerName" value="<YOUR_SQL_SERVER_NAME>" />
  <add key="AutoCount:DatabaseName" value="<YOUR_AUTOCOUNT_DB_NAME>" />
  <add key="AutoCount:SqlUsername" value="<YOUR_SQL_USERNAME>" />
  <add key="AutoCount:SqlPassword" value="<YOUR_SQL_PASSWORD>" />
  
  <!-- AutoCount User Credentials -->
  <add key="AutoCount:AutoCountUsername" value="<YOUR_AUTOCOUNT_USERNAME>" />
  <add key="AutoCount:AutoCountPassword" value="<YOUR_AUTOCOUNT_PASSWORD>" />
  
  <!-- Optional Settings -->
  <add key="AutoCount:ConnectionTimeoutSeconds" value="30" />
  <add key="AutoCount:DebugMode" value="false" />
</appSettings>
```

### Security Best Practices

⚠️ **WARNING**: Do not store credentials in plain text in production.

For production deployments, use secure secret storage:
- **Azure**: Azure Key Vault
- **AWS**: AWS Secrets Manager
- **On-Premises**: Windows Credential Manager or HashiCorp Vault

## REST API Endpoints

### Authentication

```
POST /api/auth/login              # Authenticate and get JWT token
POST /api/auth/validate           # Validate JWT token
POST /api/auth/refresh            # Refresh expired token
```

### Health Checks

```
GET /api/health
GET /api/health/autocount
```

### Debtors (Customers)

```
GET    /api/debtors              # List all debtors
GET    /api/debtors/{code}       # Get debtor by code
POST   /api/debtors              # Create new debtor
PUT    /api/debtors/{code}       # Update debtor
DELETE /api/debtors/{code}       # Delete debtor
```

### Sales Invoices

```
GET    /api/sales-invoices/{documentNo}           # Get invoice
POST   /api/sales-invoices                        # Create invoice
PUT    /api/sales-invoices/{documentNo}           # Update invoice
POST   /api/sales-invoices/{documentNo}/post      # Post (finalize) invoice
GET    /api/sales-invoices/tax-codes              # Get available tax codes
GET    /api/sales-invoices/tax-rate/{taxCode}     # Get tax rate
```

## Building and Running

### Prerequisites

- Windows Server 2012 R2 or later
- .NET Framework 4.8
- SQL Server 2012 SP3 or later
- AutoCount Accounting 2.1 installed and configured
- Visual Studio 2019 or later (for development)

### Build

```bash
cd Backend
dotnet build Backend.sln
```

Or using Visual Studio:
1. Open `Backend.sln` in Visual Studio
2. Build Solution (Ctrl+Shift+B)

### Run

#### Option 1: IIS Hosting (Recommended for Production)

1. Create a new IIS Application Pool (.NET Framework 4.8)
2. Create a new IIS Website pointing to `Backend.Api` folder
3. Configure SSL certificate for HTTPS
4. Update `web.config` with AutoCount credentials
5. Start the website

#### Option 2: IIS Express (Development)

```bash
cd Backend/Backend.Api
iisexpress /path:. /port:44300
```

#### Option 3: Windows Service

Use a Windows Service wrapper (e.g., TopShelf) to host the Web API.

## Testing

### Unit Tests

Run unit tests using NUnit:

```bash
cd Backend/Backend.Tests
nunit3-console Backend.Tests.dll
```

Or in Visual Studio:
- Test Explorer (Test > Test Explorer)
- Run All Tests (Ctrl+R, A)

### Integration Tests

Integration tests perform actual round-trip operations against AutoCount:

1. Configure test AutoCount account book
2. Set `EnableIntegrationTests=true` in `app.config`
3. Run tests with `[Category("Integration")]` filter

**Important**: Integration tests require valid AutoCount credentials and should only run in a test environment.

## Deployment

### Cloudflare Tunnel Setup

To expose the backend at `https://api.thelemonco.online`:

1. Install Cloudflare Tunnel client on the server
2. Create a tunnel: `cloudflared tunnel create lemonflow-api`
3. Configure routing:
   ```bash
   cloudflared tunnel route dns lemonflow-api api.thelemonco.online
   ```
4. Start the tunnel:
   ```bash
   cloudflared tunnel run lemonflow-api
   ```

### Production Checklist

- [ ] Update `web.config` with production credentials (use secure secret storage)
- [ ] Set `AutoCount:DebugMode` to `false`
- [ ] Configure SSL certificate for HTTPS
- [ ] Set up logging to a centralized system
- [ ] Configure database backups
- [ ] Set up monitoring and alerting
- [ ] Test disaster recovery procedures
- [ ] Document runbooks for common issues

## Troubleshooting

### AutoCount Connection Issues

If `GET /api/health/autocount` returns an error:

1. Verify SQL Server is running and accessible
2. Check AutoCount credentials in `web.config`
3. Verify AutoCount database exists and is accessible
4. Check Windows Event Viewer for errors
5. Enable `AutoCount:DebugMode=true` for detailed error messages (development only)

### Common Errors

| Error | Solution |
|-------|----------|
| "Failed to login to AutoCount" | Check AutoCount username/password |
| "Cannot connect to SQL Server" | Verify server name, database name, and SQL credentials |
| "UserSession already initialized" | Ensure application is not starting multiple times |
| "Tax code not found" | Verify tax code exists in AutoCount and SubProjectStartup was called |

## Development Notes

### Adding New Endpoints

1. Create a new service interface in `Backend.Infrastructure.AutoCount`
2. Implement the service using AutoCount API
3. Create a controller in `Backend.Api/Controllers`
4. Add unit tests in `Backend.Tests`
5. Update this README with endpoint documentation

### Thread Safety

AutoCount's thread-safety constraints are not fully documented. To ensure safe concurrent access:

- All AutoCount operations are serialized via locks in service classes
- UserSession is accessed only through the singleton provider
- No direct access to AutoCount entities outside the infrastructure layer

If you encounter threading issues, consider implementing a dedicated execution queue instead of locks.

## Documentation

- **README.md** - This file (overview and architecture)
- **QUICKSTART.md** - Quick start guide for setup
- **AUTHENTICATION.md** - JWT and authentication details
- **IMPLEMENTATION_NOTES.md** - Technical implementation details
- **FILE_STRUCTURE.md** - Complete file listing
- **DEPLOYMENT_CHECKLIST.md** - Production deployment guide

## References

- [AutoCount Integration Methods](https://wiki.autocountsoft.com/wiki/Integration_Methods)
- [AutoCount UserSession & DBSetting](https://wiki.autocountsoft.com/wiki/Initiate_UserSession_and_DBSetting)
- [AutoCount 2.1 API Documentation](https://wiki.autocountsoft.com/wiki/AutoCount_Accounting_2.1_API)
- [AutoCount NuGet Packages](https://www.nuget.org/packages?q=AutoCount)
- [JWT.io](https://jwt.io) - JWT documentation
- [Supabase Auth](https://supabase.com/docs/guides/auth) - Supabase authentication

## Support

For issues or questions:
1. Check the troubleshooting section above
2. Review AutoCount documentation
3. Check application logs
4. Contact AutoCount support

## License

Copyright © 2024 Lemon-co. All rights reserved.

