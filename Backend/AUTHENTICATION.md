# Authentication & JWT Integration

This document describes the authentication and JWT (JSON Web Token) integration in the AutoCount Accounting 2.1 backend.

## Overview

The backend now includes:
- **JWT Token Generation**: Create secure tokens for API authentication
- **Token Validation**: Verify token authenticity and expiry
- **Supabase Integration**: Support for Supabase authentication
- **Production Configuration**: All credentials stored in web.config

## Configuration

### Web.config Settings

All authentication settings are configured in `Backend.Api/Web.config`:

```xml
<!-- Supabase Configuration -->
<add key="Supabase:Url" value="https://pukezienbcenozlqmunf.supabase.co" />
<add key="Supabase:AnonKey" value="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..." />
<add key="Supabase:JwtSecret" value="OhYO147mYGunXEVYGmZ3cYnUb6qyH0E8cvhhoogELnF+uyLuHCNhjEBQpzUgNRqlfSNzf4WzPhZk5gONyxRj7w==" />
<add key="Supabase:JwtIssuer" value="https://pukezienbcenozlqmunf.supabase.co/auth/v1" />

<!-- JWT Configuration for Lemon-co API -->
<add key="Jwt:Secret" value="OhYO147mYGunXEVYGmZ3cYnUb6qyH0E8cvhhoogELnF+uyLuHCNhjEBQpzUgNRqlfSNzf4WzPhZk5gONyxRj7w==" />
<add key="Jwt:Issuer" value="LemonCoProductionAPI" />
<add key="Jwt:Audience" value="LemonCoFrontend" />
<add key="Jwt:ExpiryMinutes" value="480" />
```

### Configuration Classes

#### JwtConfig
Loads and validates JWT settings from web.config.

```csharp
var jwtConfig = JwtConfig.LoadFromConfig();
// Properties: Secret, Issuer, Audience, ExpiryMinutes
// Methods: IsValid(), GetExpiryTimeSpan()
```

#### SupabaseConfig
Loads and validates Supabase settings from web.config.

```csharp
var supabaseConfig = SupabaseConfig.LoadFromConfig();
// Properties: Url, AnonKey, JwtSecret, JwtIssuer
// Methods: IsValid()
```

## JWT Token Management

### JwtAuthenticationHelper

Helper class for token generation and validation.

#### Generate Token

```csharp
var jwtConfig = JwtConfig.LoadFromConfig();
var jwtHelper = new JwtAuthenticationHelper(jwtConfig);

string token = jwtHelper.GenerateToken(
    userId: "user-123",
    email: "user@example.com"
);
```

Token includes:
- User ID (NameIdentifier claim)
- Email (Email claim)
- Issuer (LemonCoProductionAPI)
- Audience (LemonCoFrontend)
- Expiry (480 minutes = 8 hours)

#### Validate Token

```csharp
if (jwtHelper.ValidateToken(token, out var claimsPrincipal))
{
    // Token is valid
    var userId = jwtHelper.GetUserIdFromToken(token);
    var email = jwtHelper.GetEmailFromToken(token);
}
else
{
    // Token is invalid or expired
}
```

## Authentication Endpoints

### POST /api/auth/login

Authenticates a user and returns a JWT token.

**Request**:
```json
{
  "email": "user@example.com",
  "password": "password123"
}
```

**Response** (200 OK):
```json
{
  "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "tokenType": "Bearer",
  "expiresIn": 28800,
  "userId": "user-123",
  "email": "user@example.com"
}
```

**Error Response** (400 Bad Request):
```json
{
  "message": "Email is required"
}
```

### POST /api/auth/validate

Validates a JWT token.

**Request**:
```json
"eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
```

**Response** (200 OK - Valid):
```json
{
  "valid": true,
  "userId": "user-123",
  "email": "user@example.com",
  "message": "Token is valid"
}
```

**Response** (200 OK - Invalid):
```json
{
  "valid": false,
  "message": "Token is invalid or expired"
}
```

### POST /api/auth/refresh

Refreshes an expired JWT token.

**Request**:
```json
"eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
```

**Response** (200 OK):
```json
{
  "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "tokenType": "Bearer",
  "expiresIn": 28800,
  "userId": "user-123",
  "email": "user@example.com"
}
```

## Usage Examples

### Using cURL

#### Login

```bash
curl -X POST https://localhost:44300/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "user@example.com",
    "password": "password123"
  }'
```

#### Validate Token

```bash
curl -X POST https://localhost:44300/api/auth/validate \
  -H "Content-Type: application/json" \
  -d '"eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."'
```

#### Refresh Token

```bash
curl -X POST https://localhost:44300/api/auth/refresh \
  -H "Content-Type: application/json" \
  -d '"eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."'
```

### Using JavaScript/Fetch

```javascript
// Login
const response = await fetch('https://api.thelemonco.online/api/auth/login', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    email: 'user@example.com',
    password: 'password123'
  })
});

const data = await response.json();
const token = data.accessToken;

// Use token in subsequent requests
const apiResponse = await fetch('https://api.thelemonco.online/api/debtors', {
  headers: {
    'Authorization': `Bearer ${token}`
  }
});
```

## Token Structure

JWT tokens contain the following claims:

```json
{
  "iss": "LemonCoProductionAPI",
  "aud": "LemonCoFrontend",
  "sub": "user-123",
  "email": "user@example.com",
  "iat": 1704067200,
  "exp": 1704153600
}
```

- **iss** (Issuer): LemonCoProductionAPI
- **aud** (Audience): LemonCoFrontend
- **sub** (Subject): User ID
- **email**: User email
- **iat** (Issued At): Token creation time (Unix timestamp)
- **exp** (Expiration): Token expiry time (Unix timestamp)

## Security Considerations

### Token Expiry

Tokens expire after 480 minutes (8 hours) by default. Configure in web.config:

```xml
<add key="Jwt:ExpiryMinutes" value="480" />
```

### Token Refresh

Use the `/api/auth/refresh` endpoint to get a new token before expiry:

```javascript
// Refresh token 5 minutes before expiry
const expiryTime = new Date(data.expiresIn * 1000);
const refreshTime = new Date(expiryTime.getTime() - 5 * 60 * 1000);

setTimeout(() => {
  // Call refresh endpoint
}, refreshTime - new Date());
```

### HTTPS Only

Always use HTTPS in production. Tokens should never be transmitted over HTTP.

### Secure Storage

Store tokens securely on the client:
- **Web**: Use httpOnly cookies or secure localStorage
- **Mobile**: Use secure storage (Keychain, Keystore)
- **Desktop**: Use credential manager

### Secret Management

In production, store JWT secret in secure secret storage:
- **Azure**: Azure Key Vault
- **AWS**: AWS Secrets Manager
- **On-Premises**: HashiCorp Vault

Do not hardcode secrets in web.config.

## Integration with Supabase

The backend supports Supabase authentication:

1. **Supabase URL**: Project URL for API calls
2. **Anon Key**: Public key for client-side access
3. **JWT Secret**: Secret for token validation
4. **JWT Issuer**: Supabase auth endpoint

### Validating Supabase Tokens

To validate tokens issued by Supabase:

```csharp
var supabaseConfig = SupabaseConfig.LoadFromConfig();
// Use supabaseConfig.JwtSecret to validate Supabase tokens
```

## Troubleshooting

### "Token is invalid or expired"

- Check token hasn't expired (compare exp claim with current time)
- Verify JWT secret matches between issuer and validator
- Check token wasn't tampered with

### "Failed to generate authentication token"

- Verify JWT configuration is loaded correctly
- Check JWT secret is not empty
- Verify issuer and audience are configured

### "Supabase configuration not found"

- Check Supabase settings in web.config
- Verify all required Supabase keys are present
- Check for typos in configuration keys

## Next Steps

1. **Implement Credential Validation**: Replace placeholder login with real authentication
2. **Add Authorization**: Implement role-based access control (RBAC)
3. **Add Token Refresh**: Implement automatic token refresh on client
4. **Add Audit Logging**: Log all authentication events
5. **Add Rate Limiting**: Prevent brute force attacks on login endpoint

## References

- [JWT.io](https://jwt.io) - JWT documentation
- [Supabase Auth](https://supabase.com/docs/guides/auth) - Supabase authentication
- [Microsoft IdentityModel](https://github.com/AzureAD/azure-activedirectory-identitymodel-extensions-for-dotnet) - JWT validation library

