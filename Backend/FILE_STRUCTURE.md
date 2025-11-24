# Backend Solution File Structure

Complete file structure and description of all files in the AutoCount Accounting 2.1 backend integration.

## Solution Root

```
Backend/
├── Backend.sln                          # Visual Studio solution file
├── README.md                            # Main documentation
├── QUICKSTART.md                        # Quick start guide
├── IMPLEMENTATION_NOTES.md              # Detailed implementation notes
└── FILE_STRUCTURE.md                    # This file
```

## Backend.Api Project

ASP.NET Web API project - HTTP endpoints and application startup.

```
Backend.Api/
├── Backend.Api.csproj                  # Project file
├── Global.asax                         # ASP.NET application file
├── Global.asax.cs                      # Application startup & AutoCount initialization
├── WebApiConfig.cs                     # Web API configuration and routing
├── Web.config                          # Configuration settings (credentials, timeouts)
├── packages.config                     # NuGet package references
├── Properties/
│   └── AssemblyInfo.cs                # Assembly metadata
└── Controllers/
    ├── HealthController.cs             # Health check endpoints
    ├── DebtorsController.cs            # Debtor (customer) REST endpoints
    └── SalesInvoicesController.cs      # Sales invoice REST endpoints
```

### Key Files

**Global.asax.cs**
- Application startup handler
- Initializes AutoCount session at app start
- Ensures UserSession is created exactly once
- Per AutoCount docs: "3 MainEntry to start a subProject"

**WebApiConfig.cs**
- Registers Web API routes
- Configures JSON serialization
- Enables CORS if needed

**Web.config**
- AutoCount connection settings (DBServerType, ServerName, DatabaseName)
- SQL Server credentials
- AutoCount user credentials
- Connection timeout settings
- Debug mode flag

**Controllers/**
- HealthController: GET /api/health, GET /api/health/autocount
- DebtorsController: GET/POST/PUT/DELETE /api/debtors
- SalesInvoicesController: GET/POST/PUT /api/sales-invoices, tax code endpoints

## Backend.Application Project

Application services and business logic layer.

```
Backend.Application/
├── Backend.Application.csproj          # Project file
├── packages.config                     # NuGet package references
└── Properties/
    └── AssemblyInfo.cs                # Assembly metadata
```

**Note**: Currently a placeholder for future business logic. Services are implemented in Backend.Infrastructure.AutoCount.

## Backend.Infrastructure.AutoCount Project

AutoCount 2.1 API integration layer.

```
Backend.Infrastructure.AutoCount/
├── Backend.Infrastructure.AutoCount.csproj  # Project file
├── AutoCountSessionProvider.cs         # Singleton UserSession management
├── AutoCountConnectionConfig.cs        # Configuration loading from web.config
├── IAutoCountDebtorService.cs          # Debtor service interface
├── AutoCountDebtorService.cs           # Debtor service implementation
├── IAutoCountSalesInvoiceService.cs    # Sales invoice service interface
├── AutoCountSalesInvoiceService.cs     # Sales invoice service implementation
├── packages.config                     # NuGet package references
└── Properties/
    └── AssemblyInfo.cs                # Assembly metadata
```

### Key Files

**AutoCountSessionProvider.cs**
- Singleton pattern for UserSession
- Thread-safe initialization
- Per AutoCount docs: "UserSession must only be initiated once per running application"
- Implements IAutoCountSessionProvider interface
- Handles DBSetting creation, UserSession.Login(), and SubProjectStartup()

**AutoCountConnectionConfig.cs**
- Loads configuration from web.config
- Validates configuration completeness
- Provides strongly-typed access to settings
- Supports environment-specific configuration

**IAutoCountDebtorService.cs & AutoCountDebtorService.cs**
- Debtor (customer) operations
- GetAllDebtors(), GetDebtorByCode(), CreateDebtor(), UpdateDebtor(), DeleteDebtor()
- Thread-safe access via locks
- Per AutoCount docs: "Interface with API – Web service" integration method

**IAutoCountSalesInvoiceService.cs & AutoCountSalesInvoiceService.cs**
- Sales invoice operations
- GetSalesInvoiceByDocumentNo(), CreateSalesInvoice(), UpdateSalesInvoice(), PostSalesInvoice()
- Tax code handling: GetAvailableTaxCodes(), GetTaxRate()
- Per AutoCount docs: "GovernmentTaxCode replaces older IRASTaxCode naming"

## Backend.Domain Project

Domain models and DTOs.

```
Backend.Domain/
├── Backend.Domain.csproj               # Project file
├── Debtor.cs                           # Debtor domain model
├── SalesInvoice.cs                     # SalesInvoice and SalesInvoiceLine models
├── packages.config                     # NuGet package references
└── Properties/
    └── AssemblyInfo.cs                # Assembly metadata
```

### Key Files

**Debtor.cs**
- Domain model for customer/debtor
- Properties: Code, Name, ContactPerson, Email, Phone, Address, City, State, PostalCode, Country
- Properties: TaxRegistrationNumber, CreditLimit, PaymentTerms, CurrencyCode, IsActive, Remarks
- Timestamps: CreatedDate, ModifiedDate

**SalesInvoice.cs**
- Domain model for sales invoice
- Properties: DocumentNo, DebtorCode, InvoiceDate, DueDate, CurrencyCode, ExchangeRate
- Properties: Subtotal, TaxAmount, Total, Remarks, Status
- Contains List<SalesInvoiceLine> for line items
- SalesInvoiceLine: LineNo, ItemCode, Description, Quantity, UnitOfMeasure, UnitPrice
- SalesInvoiceLine: TaxCode, TaxRate, TaxAmount, Remarks

## Backend.Tests Project

Unit and integration tests.

```
Backend.Tests/
├── Backend.Tests.csproj                # Project file
├── HealthControllerTests.cs            # Unit tests for HealthController
├── AutoCountDebtorServiceTests.cs      # Unit tests for AutoCountDebtorService
├── AutoCountSalesInvoiceServiceTests.cs # Unit tests for AutoCountSalesInvoiceService
├── IntegrationTests.cs                 # Integration tests (round-trip operations)
├── packages.config                     # NuGet package references
└── Properties/
    └── AssemblyInfo.cs                # Assembly metadata
```

### Key Files

**HealthControllerTests.cs**
- Tests for health check endpoints
- Mocks IAutoCountSessionProvider
- Tests: GetHealth(), GetAutoCountHealth() with various states

**AutoCountDebtorServiceTests.cs**
- Tests for debtor service
- Validates input validation (null checks, empty strings)
- Tests: GetDebtorByCode(), CreateDebtor(), UpdateDebtor(), DeleteDebtor(), DebtorExists()

**AutoCountSalesInvoiceServiceTests.cs**
- Tests for sales invoice service
- Validates input validation
- Tests: GetSalesInvoiceByDocumentNo(), CreateSalesInvoice(), UpdateSalesInvoice(), PostSalesInvoice()
- Tests: SalesInvoiceExists(), GetTaxRate()

**IntegrationTests.cs**
- Round-trip tests against real AutoCount database
- Gated behind EnableIntegrationTests configuration flag
- Tests: CreateAndRetrieveDebtor_RoundTrip(), CreateAndRetrieveSalesInvoice_RoundTrip()
- Includes test data setup and cleanup

## Configuration Files

### Web.config (Backend.Api)

```xml
<appSettings>
  <!-- AutoCount Connection Configuration -->
  <add key="AutoCount:DBServerType" value="SQL2012" />
  <add key="AutoCount:ServerName" value="<YOUR_SQL_SERVER_NAME>" />
  <add key="AutoCount:DatabaseName" value="<YOUR_AUTOCOUNT_DB_NAME>" />
  <add key="AutoCount:SqlUsername" value="<YOUR_SQL_USERNAME>" />
  <add key="AutoCount:SqlPassword" value="<YOUR_SQL_PASSWORD>" />
  <add key="AutoCount:AutoCountUsername" value="<YOUR_AUTOCOUNT_USERNAME>" />
  <add key="AutoCount:AutoCountPassword" value="<YOUR_AUTOCOUNT_PASSWORD>" />
  <add key="AutoCount:ConnectionTimeoutSeconds" value="30" />
  <add key="AutoCount:DebugMode" value="false" />
</appSettings>
```

### Backend.Api.csproj

- Target Framework: .NET Framework 4.8
- Output Type: Library (Web API)
- References: System.Web.Http, Newtonsoft.Json
- Project References: Backend.Application, Backend.Infrastructure.AutoCount, Backend.Domain

### Backend.Infrastructure.AutoCount.csproj

- Target Framework: .NET Framework 4.8
- NuGet Package: AutoCount2.MainEntry (version 2.1.0)
- Project References: Backend.Domain

### Backend.Tests.csproj

- Target Framework: .NET Framework 4.8
- NuGet Packages: NUnit, NUnit3TestAdapter, Moq
- Project References: Backend.Api, Backend.Application, Backend.Infrastructure.AutoCount

## NuGet Dependencies

### Backend.Api
- Microsoft.AspNet.WebApi.Core (5.2.7)
- Microsoft.AspNet.WebApi.WebHost (5.2.7)
- Microsoft.AspNet.Cors (5.2.7)
- Newtonsoft.Json (12.0.3)

### Backend.Infrastructure.AutoCount
- AutoCount2.MainEntry (2.1.0) - Includes all AutoCount dependencies

### Backend.Tests
- NUnit (3.13.3)
- NUnit3TestAdapter (4.2.1)
- Moq (4.16.1)

## Documentation Files

### README.md
- Overview and architecture
- AutoCount integration details
- REST API endpoints
- Building and running instructions
- Testing procedures
- Deployment guide
- Troubleshooting

### QUICKSTART.md
- 5-minute setup guide
- Prerequisites
- Configuration steps
- Testing endpoints
- Troubleshooting common issues
- Common tasks

### IMPLEMENTATION_NOTES.md
- Detailed implementation notes
- AutoCount integration method explanation
- UserSession initialization flow
- MainEntry startup options
- NuGet package selection rationale
- Tax code handling details
- Thread safety strategy
- Error handling approach
- Configuration management
- API endpoint design
- Testing strategy
- Deployment considerations
- Future enhancements

### FILE_STRUCTURE.md
- This file
- Complete file structure
- File descriptions
- Configuration details
- NuGet dependencies

## Assembly GUIDs

Each project has a unique GUID for identification:

- Backend.Api: A1B2C3D4-E5F6-47G8-H9I0-J1K2L3M4N5O6
- Backend.Application: B2C3D4E5-F6G7-48H9-I0J1-K2L3M4N5O6P7
- Backend.Infrastructure.AutoCount: C3D4E5F6-G7H8-49I0-J1K2-L3M4N5O6P7Q8
- Backend.Domain: D4E5F6G7-H8I9-40J0-K1L2-M3N4O5P6Q7R8
- Backend.Tests: E5F6G7H8-I9J0-41K0-L1M2-N3O4P5Q6R7S8

## Build Output

After building, output files are located in:

```
Backend.Api/bin/
Backend.Application/bin/
Backend.Infrastructure.AutoCount/bin/
Backend.Domain/bin/
Backend.Tests/bin/
```

## Deployment

For production deployment:

1. Build in Release configuration
2. Copy `Backend.Api/bin/Release/` to IIS application folder
3. Update `Web.config` with production credentials
4. Configure IIS application pool (.NET Framework 4.8)
5. Set up SSL certificate
6. Configure Cloudflare tunnel

See README.md for detailed deployment instructions.

