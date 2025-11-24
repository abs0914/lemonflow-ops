# Implementation Notes

## AutoCount 2.1 Integration - Key Implementation Details

This document provides detailed notes on how this backend implements the AutoCount 2.1 API integration, with references to the official documentation.

## 1. Integration Method: "Interface with API – Web service"

**Reference**: https://wiki.autocountsoft.com/wiki/Integration_Methods

This backend is implemented as an **external web service** that:
- Accepts HTTP requests from the Lemon-co frontend application
- Reads and writes master data (Debtors/Customers) and documents (Sales Invoices) to AutoCount via its API
- Does NOT use XML/Excel import as the primary mechanism
- Does NOT implement a plug-in; it's a standalone integration service

**Location in Code**: 
- `Backend.Api/Controllers/` - HTTP endpoints that accept requests
- `Backend.Infrastructure.AutoCount/` - AutoCount API integration logic

## 2. UserSession & DBSetting Initialization

**Reference**: https://wiki.autocountsoft.com/wiki/Initiate_UserSession_and_DBSetting

### Critical Requirement: Single UserSession Per Application

Per AutoCount docs: "UserSession must only be initiated once per running application."

**Implementation**:
- `AutoCountSessionProvider.cs` - Singleton pattern with thread-safe lazy initialization
- `AutoCountConnectionConfig.cs` - Configuration loading from web.config
- `Global.asax.cs` - Application startup initialization

### Initialization Flow

```csharp
// Step 1: Create DBSetting
var dbSetting = new DBSetting();
dbSetting.DBServerType = DBServerType.SQL2012;  // Must match your SQL Server version
dbSetting.ServerName = "your-server";
dbSetting.DatabaseName = "your-autocount-db";
dbSetting.UserName = "sa";  // SQL login
dbSetting.Password = "password";

// Step 2: Create UserSession
var userSession = new UserSession();

// Step 3: Login to AutoCount
bool loginSuccess = userSession.Login(dbSetting, "autocount-user", "autocount-password");

// Step 4: SubProjectStartup (required for non-UI integration)
var startup = new Startup();
startup.SubProjectStartup(userSession, StartupPlugInOption.LoadStandardPlugIn);
```

**Location in Code**: `AutoCountSessionProvider.Initialize()` method

## 3. MainEntry Startup Options

**Reference**: https://wiki.autocountsoft.com/wiki/AutoCount_Accounting_2.1_API#3_MainEntry_to_start_a_subProject

AutoCount provides three startup methods:

### Option 1: UI-Based Login (NOT USED)
```csharp
// Shows Windows Forms login dialog
AutoCount.MainEntry.MainStartup.Default.SubProjectStartupWithLogin("", "");
```
Not suitable for server-side integration.

### Option 2: UIStartup (NOT USED)
```csharp
// Uses UI components for login
AutoCount.MainEntry.UIStartup
```
Not suitable for unattended server processes.

### Option 3: Startup (USED - Recommended)
```csharp
// Non-UI, unattended integration
var startup = new Startup();
startup.SubProjectStartup(userSession, StartupPlugInOption.LoadStandardPlugIn);
```

**This backend uses Option 3** because:
- No UI forms are shown to end users
- Suitable for unattended server processes
- Credentials are provided programmatically

**Location in Code**: `AutoCountSessionProvider.Initialize()` method

## 4. NuGet Package Selection

**Reference**: https://wiki.autocountsoft.com/wiki/AutoCount_Accounting_2.1_API#NuGet

### Why AutoCount2.MainEntry?

Per AutoCount docs: "If unsure of which NuGet package to install, select AutoCount2.MainEntry package is sufficient for most project."

**Benefits**:
- Single package that includes all required dependencies
- Automatically pulls: AutoCount2.Accounting, AutoCount2.UI, AutoCount2.Sales, etc.
- Simplifies dependency management
- Ensures version compatibility

**Location in Code**: `Backend.Infrastructure.AutoCount/Backend.Infrastructure.AutoCount.csproj`

```xml
<PackageReference Include="AutoCount2.MainEntry" Version="2.1.0" />
```

## 5. Tax Code Handling

**Reference**: https://wiki.autocountsoft.com/wiki/AutoCount_Accounting_2.1_API#GST_Tax_Code_and_Tax_Rate

### Important: GovernmentTaxCode Replaces IRASTaxCode

Per AutoCount docs: "GovernmentTaxCode replaces older IRASTaxCode naming"

**Implementation**:
- `IAutoCountSalesInvoiceService.GetAvailableTaxCodes()` - Retrieves available tax codes
- `IAutoCountSalesInvoiceService.GetTaxRate(taxCode)` - Resolves tax rate for a code
- Tax codes are resolved dynamically from AutoCount, not hardcoded

**Location in Code**: 
- `AutoCountSalesInvoiceService.cs` - Tax code resolution methods
- `SalesInvoiceLine.cs` - TaxCode and TaxRate properties

### Usage Example

```csharp
// Get available tax codes
var taxCodes = invoiceService.GetAvailableTaxCodes();  // ["SR", "ZR", "E"]

// Get tax rate for a specific code
var rate = invoiceService.GetTaxRate("SR");  // Returns 6.0 for 6%

// Use in invoice line
var line = new SalesInvoiceLine
{
    TaxCode = "SR",
    TaxRate = rate,
    LineAmount = 100m,
    TaxAmount = 100m * (rate / 100m)
};
```

## 6. Thread Safety

AutoCount's thread-safety constraints are not fully documented. This implementation ensures safe concurrent access:

**Strategy**: Serialized access via locks

```csharp
private readonly object _lockObject = new object();

public void SomeOperation()
{
    lock (_lockObject)
    {
        // All AutoCount operations are serialized here
        var userSession = _sessionProvider.GetUserSession();
        // ... perform operation ...
    }
}
```

**Location in Code**: 
- `AutoCountSessionProvider.cs` - Lock around initialization
- `AutoCountDebtorService.cs` - Lock around all operations
- `AutoCountSalesInvoiceService.cs` - Lock around all operations

**Alternative Approach** (if locks cause performance issues):
- Implement a dedicated execution queue
- Use a single-threaded task scheduler
- Document the choice and rationale

## 7. Error Handling & Diagnostics

### Debug Mode

Per AutoCount docs: "ShowDetailErrorMessages" can be enabled for troubleshooting.

**WARNING**: Must be disabled for production.

```csharp
// Development only
if (debugMode)
{
    AutoCount.AutoCountServer.CommonServiceHelper.ShowDetailErrorMessages = true;
}
```

**Location in Code**: `Global.asax.cs` - Can be added to initialization

### Error Propagation

All AutoCount errors are caught and wrapped with meaningful messages:

```csharp
catch (Exception ex)
{
    throw new InvalidOperationException(
        $"Failed to retrieve debtor '{debtorCode}' from AutoCount.", ex);
}
```

**Location in Code**: All service methods in `Backend.Infrastructure.AutoCount/`

## 8. Configuration Management

### Why Not Hardcoded?

Per AutoCount docs and security best practices:
- Credentials should never be hardcoded
- Configuration should be environment-specific
- Secrets should use secure storage in production

### Configuration Hierarchy

1. **Development**: `web.config` with placeholders
2. **Staging**: `web.config` with test credentials
3. **Production**: Secure secret storage (Azure Key Vault, AWS Secrets Manager)

**Location in Code**: 
- `AutoCountConnectionConfig.cs` - Configuration loading
- `web.config` - Configuration storage
- `Global.asax.cs` - Configuration initialization

## 9. API Endpoint Design

### RESTful Principles

All endpoints follow REST conventions:

```
GET    /api/debtors              # List (collection)
GET    /api/debtors/{code}       # Read (single resource)
POST   /api/debtors              # Create (new resource)
PUT    /api/debtors/{code}       # Update (existing resource)
DELETE /api/debtors/{code}       # Delete (remove resource)
```

**Location in Code**: 
- `Backend.Api/Controllers/DebtorsController.cs`
- `Backend.Api/Controllers/SalesInvoicesController.cs`

### HTTP Status Codes

- `200 OK` - Successful GET/PUT
- `201 Created` - Successful POST
- `204 No Content` - Successful DELETE
- `400 Bad Request` - Invalid input
- `404 Not Found` - Resource not found
- `500 Internal Server Error` - Server error

## 10. Testing Strategy

### Unit Tests

- Mock `IAutoCountSessionProvider`
- Test business logic without AutoCount connection
- Fast execution, no external dependencies

**Location in Code**: `Backend.Tests/`

### Integration Tests

- Use real AutoCount connection
- Perform round-trip operations (create, read, delete)
- Gated behind `EnableIntegrationTests` configuration flag
- Should only run in test environment

**Location in Code**: `Backend.Tests/IntegrationTests.cs`

## 11. Deployment Considerations

### IIS Hosting

- Application Pool: .NET Framework 4.8
- Enable 32-bit applications: No (use 64-bit)
- Managed pipeline mode: Integrated
- Identity: ApplicationPoolIdentity or custom service account

### Cloudflare Tunnel

- Exposes backend at `https://api.thelemonco.online`
- Provides DDoS protection and SSL termination
- No need to open firewall ports

### Monitoring

- Log all AutoCount operations
- Monitor health endpoints
- Alert on connection failures
- Track API response times

## 12. Future Enhancements

### Planned Features

1. **Caching**: Cache tax codes and debtor lookups
2. **Batch Operations**: Support bulk create/update
3. **Webhooks**: Notify frontend of AutoCount changes
4. **Audit Trail**: Log all changes for compliance
5. **Rate Limiting**: Prevent abuse
6. **API Versioning**: Support multiple API versions

### Extensibility Points

- Add new services in `Backend.Infrastructure.AutoCount/`
- Add new controllers in `Backend.Api/Controllers/`
- Add new domain models in `Backend.Domain/`
- Add new tests in `Backend.Tests/`

## References

- [AutoCount Integration Methods](https://wiki.autocountsoft.com/wiki/Integration_Methods)
- [AutoCount UserSession & DBSetting](https://wiki.autocountsoft.com/wiki/Initiate_UserSession_and_DBSetting)
- [AutoCount 2.1 API](https://wiki.autocountsoft.com/wiki/AutoCount_Accounting_2.1_API)
- [AutoCount NuGet Packages](https://www.nuget.org/packages?q=AutoCount)

