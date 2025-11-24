using System;
using System.Web.Http;
using Backend.Infrastructure.AutoCount;

namespace Backend.Api.Controllers
{
    /// <summary>
    /// Authentication controller for JWT token generation and validation.
    /// Provides endpoints for user login and token management.
    /// </summary>
    [RoutePrefix("api/auth")]
    public class AuthController : ApiController
    {
        private readonly JwtAuthenticationHelper _jwtHelper;
        private readonly JwtConfig _jwtConfig;

        /// <summary>
        /// Initializes a new instance of the AuthController class.
        /// </summary>
        public AuthController()
        {
            try
            {
                _jwtConfig = JwtConfig.LoadFromConfig();
                _jwtHelper = new JwtAuthenticationHelper(_jwtConfig);
            }
            catch (Exception ex)
            {
                throw new InvalidOperationException("Failed to initialize JWT configuration", ex);
            }
        }

        /// <summary>
        /// Login request model
        /// </summary>
        public class LoginRequest
        {
            /// <summary>
            /// User email address
            /// </summary>
            public string Email { get; set; }

            /// <summary>
            /// User password
            /// </summary>
            public string Password { get; set; }
        }

        /// <summary>
        /// Login response model
        /// </summary>
        public class LoginResponse
        {
            /// <summary>
            /// JWT access token
            /// </summary>
            public string AccessToken { get; set; }

            /// <summary>
            /// Token type (always "Bearer")
            /// </summary>
            public string TokenType { get; set; }

            /// <summary>
            /// Token expiry time in seconds
            /// </summary>
            public int ExpiresIn { get; set; }

            /// <summary>
            /// User ID
            /// </summary>
            public string UserId { get; set; }

            /// <summary>
            /// User email
            /// </summary>
            public string Email { get; set; }
        }

        /// <summary>
        /// Authenticates a user and returns a JWT token.
        /// </summary>
        /// <param name="request">Login request with email and password</param>
        /// <returns>JWT token and user information</returns>
        /// <remarks>
        /// This is a placeholder implementation. In production, validate credentials against:
        /// - Supabase authentication
        /// - Active Directory
        /// - Custom user database
        /// 
        /// For now, this accepts any email/password combination and generates a token.
        /// </remarks>
        [HttpPost]
        [Route("login")]
        public IHttpActionResult Login([FromBody] LoginRequest request)
        {
            if (request == null)
                return BadRequest("Request body is required");

            if (string.IsNullOrWhiteSpace(request.Email))
                return BadRequest("Email is required");

            if (string.IsNullOrWhiteSpace(request.Password))
                return BadRequest("Password is required");

            try
            {
                // TODO: Validate credentials against actual authentication provider
                // For now, accept any credentials and generate a token
                // In production, integrate with:
                // - Supabase Auth API
                // - Active Directory
                // - Custom user database

                string userId = Guid.NewGuid().ToString();
                string token = _jwtHelper.GenerateToken(userId, request.Email);

                var response = new LoginResponse
                {
                    AccessToken = token,
                    TokenType = "Bearer",
                    ExpiresIn = (int)_jwtConfig.GetExpiryTimeSpan().TotalSeconds,
                    UserId = userId,
                    Email = request.Email
                };

                return Ok(response);
            }
            catch (Exception ex)
            {
                return InternalServerError(new InvalidOperationException("Failed to generate authentication token", ex));
            }
        }

        /// <summary>
        /// Validates a JWT token.
        /// </summary>
        /// <param name="token">JWT token to validate</param>
        /// <returns>Validation result with user information if valid</returns>
        [HttpPost]
        [Route("validate")]
        public IHttpActionResult ValidateToken([FromBody] string token)
        {
            if (string.IsNullOrWhiteSpace(token))
                return BadRequest("Token is required");

            try
            {
                System.Security.Claims.ClaimsPrincipal claimsPrincipal;
                if (_jwtHelper.ValidateToken(token, out claimsPrincipal))
                {
                    var userId = _jwtHelper.GetUserIdFromToken(token);
                    var email = _jwtHelper.GetEmailFromToken(token);

                    return Ok(new
                    {
                        valid = true,
                        userId = userId,
                        email = email,
                        message = "Token is valid"
                    });
                }
                else
                {
                    return Ok(new
                    {
                        valid = false,
                        message = "Token is invalid or expired"
                    });
                }
            }
            catch (Exception ex)
            {
                return InternalServerError(new InvalidOperationException("Failed to validate token", ex));
            }
        }

        /// <summary>
        /// Refreshes an expired JWT token.
        /// </summary>
        /// <param name="token">Current JWT token</param>
        /// <returns>New JWT token if the current token is valid</returns>
        [HttpPost]
        [Route("refresh")]
        public IHttpActionResult RefreshToken([FromBody] string token)
        {
            if (string.IsNullOrWhiteSpace(token))
                return BadRequest("Token is required");

            try
            {
                var userId = _jwtHelper.GetUserIdFromToken(token);
                var email = _jwtHelper.GetEmailFromToken(token);

                if (string.IsNullOrWhiteSpace(userId) || string.IsNullOrWhiteSpace(email))
                    return BadRequest("Invalid token format");

                string newToken = _jwtHelper.GenerateToken(userId, email);

                var response = new LoginResponse
                {
                    AccessToken = newToken,
                    TokenType = "Bearer",
                    ExpiresIn = (int)_jwtConfig.GetExpiryTimeSpan().TotalSeconds,
                    UserId = userId,
                    Email = email
                };

                return Ok(response);
            }
            catch (Exception ex)
            {
                return InternalServerError(new InvalidOperationException("Failed to refresh token", ex));
            }
        }
    }
}

