using System.Configuration;

namespace Backend.Infrastructure.AutoCount
{
    /// <summary>
    /// Configuration class for HTTP Basic authentication used by Lemon-co API
    /// endpoints that are called directly from Supabase Edge Functions
    /// (e.g. /api/stock/update-item, /api/purchase/*).
    ///
    /// Values are loaded from web.config appSettings:
    ///   - LemonCo:ApiUsername
    ///   - LemonCo:ApiPassword
    /// </summary>
    public class BasicAuthConfig
    {
        /// <summary>
        /// API username expected in either the Supabase login payload or
        /// HTTP Basic Authorization header.
        /// </summary>
        public string Username { get; set; }

        /// <summary>
        /// API password expected in either the Supabase login payload or
        /// HTTP Basic Authorization header.
        /// </summary>
        public string Password { get; set; }

        /// <summary>
        /// Loads Basic Auth configuration from web.config appSettings.
        /// </summary>
        /// <returns>BasicAuthConfig instance with loaded settings.</returns>
        public static BasicAuthConfig LoadFromConfig()
        {
            var username = ConfigurationManager.AppSettings["LemonCo:ApiUsername"];
            var password = ConfigurationManager.AppSettings["LemonCo:ApiPassword"];

            if (string.IsNullOrWhiteSpace(username))
            {
                throw new ConfigurationErrorsException("LemonCo:ApiUsername is not configured in appSettings");
            }

            if (string.IsNullOrWhiteSpace(password))
            {
                throw new ConfigurationErrorsException("LemonCo:ApiPassword is not configured in appSettings");
            }

            return new BasicAuthConfig
            {
                Username = username,
                Password = password
            };
        }
    }
}
