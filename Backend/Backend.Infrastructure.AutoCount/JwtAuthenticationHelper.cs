using System;
using System.IdentityModel.Tokens.Jwt;
using System.Linq;
using System.Security.Claims;
using System.Text;
using Microsoft.IdentityModel.Tokens;

namespace Backend.Infrastructure.AutoCount
{
    /// <summary>
    /// Helper class for JWT token generation and validation.
    /// Provides methods to create and validate JWT tokens for API authentication.
    /// </summary>
    public class JwtAuthenticationHelper
    {
        private readonly JwtConfig _jwtConfig;

        /// <summary>
        /// Initializes a new instance of the JwtAuthenticationHelper class.
        /// </summary>
        /// <param name="jwtConfig">JWT configuration settings</param>
        public JwtAuthenticationHelper(JwtConfig jwtConfig)
        {
            if (jwtConfig == null)
                throw new ArgumentNullException("jwtConfig");
            _jwtConfig = jwtConfig;
        }

        /// <summary>
        /// Generates a new JWT token with the specified claims.
        /// </summary>
        /// <param name="userId">User ID to include in the token</param>
        /// <param name="email">User email to include in the token</param>
        /// <param name="additionalClaims">Optional additional claims to include</param>
        /// <returns>JWT token string</returns>
        public string GenerateToken(string userId, string email, params Claim[] additionalClaims)
        {
            if (string.IsNullOrWhiteSpace(userId))
                throw new ArgumentException("User ID cannot be null or empty", "userId");
            if (string.IsNullOrWhiteSpace(email))
                throw new ArgumentException("Email cannot be null or empty", "email");

            var key = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(_jwtConfig.Secret));
            var credentials = new SigningCredentials(key, SecurityAlgorithms.HmacSha256);

            var claims = new[]
            {
                new Claim(ClaimTypes.NameIdentifier, userId),
                new Claim(ClaimTypes.Email, email),
                new Claim("iss", _jwtConfig.Issuer),
                new Claim("aud", _jwtConfig.Audience)
            };

            var token = new JwtSecurityToken(
                issuer: _jwtConfig.Issuer,
                audience: _jwtConfig.Audience,
                claims: claims,
                expires: DateTime.UtcNow.Add(_jwtConfig.GetExpiryTimeSpan()),
                signingCredentials: credentials
            );

            return new JwtSecurityTokenHandler().WriteToken(token);
        }

        /// <summary>
        /// Validates a JWT token and returns the claims if valid.
        /// </summary>
        /// <param name="token">JWT token string to validate</param>
        /// <param name="claimsPrincipal">Output parameter containing the validated claims principal</param>
        /// <returns>True if token is valid; otherwise false</returns>
        public bool ValidateToken(string token, out ClaimsPrincipal claimsPrincipal)
        {
            claimsPrincipal = null;

            if (string.IsNullOrWhiteSpace(token))
                return false;

            try
            {
                var key = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(_jwtConfig.Secret));
                var tokenHandler = new JwtSecurityTokenHandler();

                var validationParameters = new TokenValidationParameters
                {
                    ValidateIssuerSigningKey = true,
                    IssuerSigningKey = key,
                    ValidateIssuer = true,
                    ValidIssuer = _jwtConfig.Issuer,
                    ValidateAudience = true,
                    ValidAudience = _jwtConfig.Audience,
                    ValidateLifetime = true,
                    ClockSkew = TimeSpan.Zero
                };

                SecurityToken validatedToken;
                claimsPrincipal = tokenHandler.ValidateToken(token, validationParameters, out validatedToken);
                return true;
            }
            catch (Exception ex)
            {
                // Log the exception if needed
                System.Diagnostics.Debug.WriteLine("Token validation failed: " + ex.Message);
                return false;
            }
        }

        /// <summary>
        /// Extracts the user ID from a JWT token without validation.
        /// </summary>
        /// <param name="token">JWT token string</param>
        /// <returns>User ID if found; otherwise null</returns>
        public string GetUserIdFromToken(string token)
        {
            if (string.IsNullOrWhiteSpace(token))
                return null;

            try
            {
                var tokenHandler = new JwtSecurityTokenHandler();
                var jwtToken = tokenHandler.ReadToken(token) as JwtSecurityToken;

                if (jwtToken == null)
                    return null;
                var claim = jwtToken.Claims.FirstOrDefault(c => c.Type == ClaimTypes.NameIdentifier);
                return claim != null ? claim.Value : null;
            }
            catch
            {
                return null;
            }
        }

        /// <summary>
        /// Extracts the email from a JWT token without validation.
        /// </summary>
        /// <param name="token">JWT token string</param>
        /// <returns>Email if found; otherwise null</returns>
        public string GetEmailFromToken(string token)
        {
            if (string.IsNullOrWhiteSpace(token))
                return null;

            try
            {
                var tokenHandler = new JwtSecurityTokenHandler();
                var jwtToken = tokenHandler.ReadToken(token) as JwtSecurityToken;

                if (jwtToken == null)
                    return null;
                var claim = jwtToken.Claims.FirstOrDefault(c => c.Type == ClaimTypes.Email);
                return claim != null ? claim.Value : null;
            }
            catch
            {
                return null;
            }
        }
    }
}

