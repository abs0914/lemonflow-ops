# Configuration Reference

Complete reference for all configuration settings in the AutoCount Accounting 2.1 backend.

## Web.config Settings

All settings are stored in `Backend.Api/Web.config` under `<appSettings>`.

### AutoCount Configuration

#### AutoCount:DBServerType
- **Description**: SQL Server version
- **Type**: String
- **Values**: SQL2000, SQL2005, SQL2008, SQL2012, SQL2016, SQL2019, SQL2022
- **Default**: SQL2012
- **Example**: `<add key="AutoCount:DBServerType" value="SQL2012" />`
- **Production Value**: SQL2012

#### AutoCount:ServerName
- **Description**: SQL Server name or IP address
- **Type**: String
- **Format**: `ServerName` or `ServerName\InstanceName` or `tcp:ServerName\InstanceName`
- **Example**: `<add key="AutoCount:ServerName" value="tcp:LemonCoSrv\A2006" />`
- **Production Value**: tcp:LemonCoSrv\A2006

#### AutoCount:DatabaseName
- **Description**: AutoCount database name
- **Type**: String
- **Example**: `<add key="AutoCount:DatabaseName" value="AED_Terraganics" />`
- **Production Value**: AED_Terraganics

#### AutoCount:SqlUsername
- **Description**: SQL Server login username
- **Type**: String
- **Example**: `<add key="AutoCount:SqlUsername" value="sa" />`
- **Production Value**: sa
- **Note**: Typically 'sa' or a SQL login user

#### AutoCount:SqlPassword
- **Description**: SQL Server login password
- **Type**: String (encrypted in production)
- **Example**: `<add key="AutoCount:SqlPassword" value="oCt2005-ShenZhou6_A2006" />`
- **Production Value**: oCt2005-ShenZhou6_A2006
- **Security**: Use Azure Key Vault or AWS Secrets Manager in production

#### AutoCount:AutoCountUsername
- **Description**: AutoCount user login username
- **Type**: String
- **Example**: `<add key="AutoCount:AutoCountUsername" value="ADMIN" />`
- **Production Value**: ADMIN

#### AutoCount:AutoCountPassword
- **Description**: AutoCount user login password
- **Type**: String (encrypted in production)
- **Example**: `<add key="AutoCount:AutoCountPassword" value="123@admin" />`
- **Production Value**: 123@admin
- **Security**: Use Azure Key Vault or AWS Secrets Manager in production

#### AutoCount:ConnectionTimeoutSeconds
- **Description**: Connection timeout in seconds
- **Type**: Integer
- **Default**: 30
- **Example**: `<add key="AutoCount:ConnectionTimeoutSeconds" value="30" />`
- **Valid Range**: 1-300

#### AutoCount:DebugMode
- **Description**: Enable detailed error messages from AutoCount
- **Type**: Boolean
- **Values**: true, false
- **Default**: false
- **Example**: `<add key="AutoCount:DebugMode" value="false" />`
- **Warning**: Must be false in production

### Supabase Configuration

#### Supabase:Url
- **Description**: Supabase project URL
- **Type**: String (URL)
- **Example**: `<add key="Supabase:Url" value="https://pukezienbcenozlqmunf.supabase.co" />`
- **Production Value**: https://pukezienbcenozlqmunf.supabase.co

#### Supabase:AnonKey
- **Description**: Supabase anonymous key for client-side access
- **Type**: String (JWT)
- **Example**: `<add key="Supabase:AnonKey" value="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..." />`
- **Security**: Keep confidential

#### Supabase:JwtSecret
- **Description**: JWT secret for token validation
- **Type**: String (Base64)
- **Example**: `<add key="Supabase:JwtSecret" value="OhYO147mYGunXEVYGmZ3cYnUb6qyH0E8cvhhoogELnF+uyLuHCNhjEBQpzUgNRqlfSNzf4WzPhZk5gONyxRj7w==" />`
- **Security**: Use secure secret storage in production

#### Supabase:JwtIssuer
- **Description**: JWT issuer URL
- **Type**: String (URL)
- **Example**: `<add key="Supabase:JwtIssuer" value="https://pukezienbcenozlqmunf.supabase.co/auth/v1" />`
- **Production Value**: https://pukezienbcenozlqmunf.supabase.co/auth/v1

### JWT Configuration

#### Jwt:Secret
- **Description**: Secret key for signing and validating JWT tokens
- **Type**: String (Base64)
- **Example**: `<add key="Jwt:Secret" value="OhYO147mYGunXEVYGmZ3cYnUb6qyH0E8cvhhoogELnF+uyLuHCNhjEBQpzUgNRqlfSNzf4WzPhZk5gONyxRj7w==" />`
- **Security**: Use secure secret storage in production
- **Length**: Minimum 32 characters recommended

#### Jwt:Issuer
- **Description**: JWT issuer (who created the token)
- **Type**: String
- **Example**: `<add key="Jwt:Issuer" value="LemonCoProductionAPI" />`
- **Production Value**: LemonCoProductionAPI

#### Jwt:Audience
- **Description**: JWT audience (who the token is intended for)
- **Type**: String
- **Example**: `<add key="Jwt:Audience" value="LemonCoFrontend" />`
- **Production Value**: LemonCoFrontend

#### Jwt:ExpiryMinutes
- **Description**: Token expiry time in minutes
- **Type**: Integer
- **Default**: 480 (8 hours)
- **Example**: `<add key="Jwt:ExpiryMinutes" value="480" />`
- **Valid Range**: 1-10080 (1 minute to 7 days)
- **Recommended**: 480 (8 hours) for production

## Configuration Classes

### AutoCountConnectionConfig

**Location**: `Backend.Infrastructure.AutoCount/AutoCountConnectionConfig.cs`

**Properties**:
- DBServerType: string
- ServerName: string
- DatabaseName: string
- SqlUsername: string
- SqlPassword: string
- AutoCountUsername: string
- AutoCountPassword: string
- ConnectionTimeoutSeconds: int
- DebugMode: bool

**Methods**:
- `LoadFromConfig()` - Load from web.config
- `Validate()` - Validate all required settings

### SupabaseConfig

**Location**: `Backend.Infrastructure.AutoCount/SupabaseConfig.cs`

**Properties**:
- Url: string
- AnonKey: string
- JwtSecret: string
- JwtIssuer: string

**Methods**:
- `LoadFromConfig()` - Load from web.config
- `IsValid()` - Check if all settings are valid

### JwtConfig

**Location**: `Backend.Infrastructure.AutoCount/JwtConfig.cs`

**Properties**:
- Secret: string
- Issuer: string
- Audience: string
- ExpiryMinutes: int

**Methods**:
- `LoadFromConfig()` - Load from web.config
- `IsValid()` - Check if all settings are valid
- `GetExpiryTimeSpan()` - Get expiry as TimeSpan

## Environment-Specific Configuration

### Development

```xml
<add key="AutoCount:ServerName" value="localhost\SQLEXPRESS" />
<add key="AutoCount:DatabaseName" value="AutoCount_Dev" />
<add key="AutoCount:DebugMode" value="true" />
```

### Staging

```xml
<add key="AutoCount:ServerName" value="staging-sql-server" />
<add key="AutoCount:DatabaseName" value="AutoCount_Staging" />
<add key="AutoCount:DebugMode" value="false" />
```

### Production

```xml
<add key="AutoCount:ServerName" value="tcp:LemonCoSrv\A2006" />
<add key="AutoCount:DatabaseName" value="AED_Terraganics" />
<add key="AutoCount:DebugMode" value="false" />
```

## Secure Secret Storage

### Azure Key Vault

```csharp
var client = new SecretClient(vaultUri, new DefaultAzureCredential());
KeyVaultSecret secret = await client.GetSecretAsync("AutoCount-SqlPassword");
string password = secret.Value;
```

### AWS Secrets Manager

```csharp
var client = new SecretsManagerClient();
var request = new GetSecretValueRequest { SecretId = "autocount/sql-password" };
var response = await client.GetSecretValueAsync(request);
string password = response.SecretString;
```

### Environment Variables

```csharp
string password = Environment.GetEnvironmentVariable("AUTOCOUNT_SQL_PASSWORD");
```

## Configuration Validation

All configurations are validated at application startup in `Global.asax.cs`:

1. **AutoCount Configuration**: Validated by `AutoCountConnectionConfig.Validate()`
2. **JWT Configuration**: Validated by `JwtConfig.IsValid()`
3. **Supabase Configuration**: Validated by `SupabaseConfig.IsValid()`

If any configuration is invalid, the application will throw an exception and fail to start.

## Troubleshooting Configuration Issues

### "AutoCount:ServerName is not configured"

**Solution**: Add the setting to web.config:
```xml
<add key="AutoCount:ServerName" value="tcp:LemonCoSrv\A2006" />
```

### "Cannot connect to SQL Server"

**Causes**:
- Incorrect server name
- SQL Server not running
- Firewall blocking connection
- Incorrect credentials

**Solution**:
1. Verify server name format: `ServerName\InstanceName` or `tcp:ServerName\InstanceName`
2. Check SQL Server is running
3. Verify firewall allows SQL Server port (1433)
4. Test credentials with SQL Server Management Studio

### "Failed to login to AutoCount"

**Causes**:
- Incorrect AutoCount username/password
- AutoCount user doesn't exist
- AutoCount database not accessible

**Solution**:
1. Verify AutoCount credentials
2. Check user exists in AutoCount
3. Verify database is accessible

### "JWT configuration not found"

**Causes**:
- Missing JWT settings in web.config
- Typo in configuration key names

**Solution**:
1. Add all required JWT settings to web.config
2. Check key names match exactly (case-sensitive)

## Configuration Checklist

- [ ] AutoCount:DBServerType configured
- [ ] AutoCount:ServerName configured
- [ ] AutoCount:DatabaseName configured
- [ ] AutoCount:SqlUsername configured
- [ ] AutoCount:SqlPassword configured
- [ ] AutoCount:AutoCountUsername configured
- [ ] AutoCount:AutoCountPassword configured
- [ ] Supabase:Url configured
- [ ] Supabase:AnonKey configured
- [ ] Supabase:JwtSecret configured
- [ ] Supabase:JwtIssuer configured
- [ ] Jwt:Secret configured
- [ ] Jwt:Issuer configured
- [ ] Jwt:Audience configured
- [ ] Jwt:ExpiryMinutes configured
- [ ] All credentials stored securely (not in code)
- [ ] Debug mode disabled in production
- [ ] Configuration validated at startup

## References

- [AutoCount Configuration](https://wiki.autocountsoft.com/wiki/Initiate_UserSession_and_DBSetting)
- [Supabase Configuration](https://supabase.com/docs/guides/auth)
- [JWT Configuration](https://jwt.io)

