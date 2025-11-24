using System;
using System.Configuration;

namespace Backend.Infrastructure.AutoCount
{
    /// <summary>
    /// Configuration class for JWT (JSON Web Token) authentication.
    /// Loads JWT settings from web.config appSettings.
    /// </summary>
    public class JwtConfig
    {
        /// <summary>
        /// Secret key used to sign and validate JWT tokens
        /// </summary>
        public string Secret { get; set; }

        /// <summary>
        /// JWT issuer (who created the token)
        /// </summary>
        public string Issuer { get; set; }

        /// <summary>
        /// JWT audience (who the token is intended for)
        /// </summary>
        public string Audience { get; set; }

        /// <summary>
        /// Token expiry time in minutes
        /// </summary>
        public int ExpiryMinutes { get; set; }

        /// <summary>
        /// Loads JWT configuration from web.config appSettings.
        /// </summary>
        /// <returns>JwtConfig instance with loaded settings</returns>
        /// <exception cref="ConfigurationErrorsException">Thrown if required settings are missing or invalid</exception>
        public static JwtConfig LoadFromConfig()
        {
            var config = new JwtConfig
            {
                Secret = ConfigurationManager.AppSettings["Jwt:Secret"],
                Issuer = ConfigurationManager.AppSettings["Jwt:Issuer"],
                Audience = ConfigurationManager.AppSettings["Jwt:Audience"]
            };

            // Parse expiry minutes
            string expiryMinutesStr = ConfigurationManager.AppSettings["Jwt:ExpiryMinutes"];
            if (!int.TryParse(expiryMinutesStr, out int expiryMinutes) || expiryMinutes <= 0)
            {
                expiryMinutes = 480; // Default to 8 hours
            }
            config.ExpiryMinutes = expiryMinutes;

            // Validate required settings
            if (string.IsNullOrWhiteSpace(config.Secret))
                throw new ConfigurationErrorsException("Jwt:Secret is not configured in appSettings");
            if (string.IsNullOrWhiteSpace(config.Issuer))
                throw new ConfigurationErrorsException("Jwt:Issuer is not configured in appSettings");
            if (string.IsNullOrWhiteSpace(config.Audience))
                throw new ConfigurationErrorsException("Jwt:Audience is not configured in appSettings");

            return config;
        }

        /// <summary>
        /// Validates that all required JWT settings are configured.
        /// </summary>
        /// <returns>True if all settings are valid; otherwise false</returns>
        public bool IsValid()
        {
            return !string.IsNullOrWhiteSpace(Secret) &&
                   !string.IsNullOrWhiteSpace(Issuer) &&
                   !string.IsNullOrWhiteSpace(Audience) &&
                   ExpiryMinutes > 0;
        }

        /// <summary>
        /// Gets the token expiry time as a TimeSpan.
        /// </summary>
        /// <returns>TimeSpan representing the token expiry duration</returns>
        public TimeSpan GetExpiryTimeSpan()
        {
            return TimeSpan.FromMinutes(ExpiryMinutes);
        }
    }
}

